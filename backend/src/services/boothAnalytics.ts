// Booth (polling-station) targeting analytics. Classifies each booth by how
// competitive it is for a chosen "our candidate", and surfaces the actionable
// lists a campaign needs: swing booths to persuade, strongholds to defend,
// opposition strongholds, and GOTV (favorable but low-turnout) booths.

import { prisma } from '../lib/prisma.js';
import { computePollingStationLeanings } from './inference.js';

export type BoothClass =
  | 'Safe-win'
  | 'Marginal-win'
  | 'Swing'
  | 'Marginal-loss'
  | 'Safe-loss'
  | 'No-data';

export interface BoothTarget {
  id: number;
  serial: number;
  name: string | null;
  registeredVoters: number;
  totalValid: number;
  totalPolled: number;
  turnoutPct: number; // 0..1, null-safe (0 when no registered voters)
  notaShare: number;
  ourShare: number;
  leader: string | null;
  leaderShare: number;
  topOpponent: string | null;
  topOpponentShare: number;
  margin: number; // ourShare - topOpponentShare (signed)
  classification: BoothClass;
}

export interface BoothTargetsResult {
  electionId: number;
  ourCandidate: string;
  medianTurnout: number;
  summary: Record<BoothClass, number>;
  items: BoothTarget[];
}

function classify(margin: number, hasData: boolean): BoothClass {
  if (!hasData) return 'No-data';
  if (margin >= 0.15) return 'Safe-win';
  if (margin >= 0) return 'Marginal-win';
  if (margin >= -0.1) return 'Swing';
  if (margin >= -0.2) return 'Marginal-loss';
  return 'Safe-loss';
}

const EMPTY_SUMMARY = (): Record<BoothClass, number> => ({
  'Safe-win': 0,
  'Marginal-win': 0,
  Swing: 0,
  'Marginal-loss': 0,
  'Safe-loss': 0,
  'No-data': 0,
});

/**
 * Resolve the "our candidate" name. If not supplied (or unknown), default to
 * the election's overall leading candidate so the call still returns useful data.
 */
async function resolveOurCandidate(
  electionId: number,
  requested?: string,
): Promise<string> {
  const cands = await prisma.candidate.findMany({ where: { electionId } });
  if (requested) {
    const hit = cands.find((c) => c.name.toLowerCase() === requested.toLowerCase());
    if (hit) return hit.name;
  }
  // Default to overall leader by total votes.
  const totals = await prisma.voteResult.groupBy({
    by: ['candidateId'],
    where: { candidate: { electionId } },
    _sum: { votes: true },
  });
  let bestId = -1;
  let bestVotes = -1;
  for (const t of totals) {
    const v = t._sum.votes ?? 0;
    if (v > bestVotes) {
      bestVotes = v;
      bestId = t.candidateId;
    }
  }
  return cands.find((c) => c.id === bestId)?.name ?? cands[0]?.name ?? '';
}

export async function computeBoothTargets(
  electionId: number,
  requestedCandidate?: string,
): Promise<BoothTargetsResult> {
  const ourCandidate = await resolveOurCandidate(electionId, requestedCandidate);
  const leanings = await computePollingStationLeanings(electionId);
  const stations = await prisma.pollingStation.findMany({
    where: { electionId },
    orderBy: { serial: 'asc' },
    include: { _count: { select: { voters: true } } },
  });

  const items: BoothTarget[] = stations.map((ps) => {
    const lean = leanings.get(ps.id);
    const byCandidate = lean?.byCandidate ?? {};
    const totalValid = lean?.totalValid ?? 0;
    const hasData = totalValid > 0;
    const ourShare = byCandidate[ourCandidate] ?? 0;

    // Best opponent = highest share among candidates that aren't ours.
    let topOpponent: string | null = null;
    let topOpponentShare = 0;
    for (const [name, share] of Object.entries(byCandidate)) {
      if (name === ourCandidate) continue;
      if (share > topOpponentShare) {
        topOpponentShare = share;
        topOpponent = name;
      }
    }

    const totalPolled = totalValid + ps.rejectedVotes + ps.notaVotes;
    const registered = ps._count.voters;
    const turnoutPct = registered > 0 ? totalPolled / registered : 0;
    const notaShare = totalPolled > 0 ? ps.notaVotes / totalPolled : 0;
    const margin = ourShare - topOpponentShare;

    return {
      id: ps.id,
      serial: ps.serial,
      name: ps.name,
      registeredVoters: registered,
      totalValid,
      totalPolled,
      turnoutPct,
      notaShare,
      ourShare,
      leader: lean?.leader ?? null,
      leaderShare: lean?.leaderShare ?? 0,
      topOpponent,
      topOpponentShare,
      margin,
      classification: classify(margin, hasData),
    };
  });

  const summary = EMPTY_SUMMARY();
  for (const it of items) summary[it.classification] += 1;

  // Median turnout across booths that have a turnout signal.
  const turnouts = items.map((i) => i.turnoutPct).filter((t) => t > 0).sort((a, b) => a - b);
  const medianTurnout = turnouts.length
    ? turnouts[Math.floor(turnouts.length / 2)]
    : 0;

  return { electionId, ourCandidate, medianTurnout, summary, items };
}

export interface SwingResult {
  electionA: number;
  electionB: number;
  candidates: Array<{ candidate: string; shareA: number; shareB: number; delta: number }>;
  booths: Array<{
    serial: number;
    name: string | null;
    leaderA: string | null;
    leaderB: string | null;
    flipped: boolean;
    byCandidate: Array<{ candidate: string; shareA: number; shareB: number; delta: number }>;
  }>;
}

/**
 * Cross-election swing — per-candidate vote-share delta between two elections,
 * overall and per booth (matched by polling-station serial). Candidates are
 * matched by name; booths present in only one election are skipped.
 */
export async function computeSwing(electionA: number, electionB: number): Promise<SwingResult> {
  const [a, b] = await Promise.all([
    computePollingStationLeanings(electionA),
    computePollingStationLeanings(electionB),
  ]);
  const [psA, psB] = await Promise.all([
    prisma.pollingStation.findMany({ where: { electionId: electionA }, select: { id: true, serial: true, name: true } }),
    prisma.pollingStation.findMany({ where: { electionId: electionB }, select: { id: true, serial: true } }),
  ]);
  const serialToB = new Map(psB.map((p) => [p.serial, p.id]));

  // Overall per-candidate share = mean of booth shares (booths present in both).
  const overallA = new Map<string, { sum: number; n: number }>();
  const overallB = new Map<string, { sum: number; n: number }>();
  const bump = (m: Map<string, { sum: number; n: number }>, k: string, v: number) => {
    const e = m.get(k) ?? { sum: 0, n: 0 };
    e.sum += v;
    e.n += 1;
    m.set(k, e);
  };

  const booths: SwingResult['booths'] = [];
  for (const ps of psA) {
    const bId = serialToB.get(ps.serial);
    if (bId == null) continue;
    const la = a.get(ps.id);
    const lb = b.get(bId);
    if (!la || !lb || la.totalValid === 0 || lb.totalValid === 0) continue;

    const names = new Set([...Object.keys(la.byCandidate), ...Object.keys(lb.byCandidate)]);
    const byCandidate = Array.from(names).map((candidate) => {
      const shareA = la.byCandidate[candidate] ?? 0;
      const shareB = lb.byCandidate[candidate] ?? 0;
      bump(overallA, candidate, shareA);
      bump(overallB, candidate, shareB);
      return { candidate, shareA, shareB, delta: shareB - shareA };
    });
    booths.push({
      serial: ps.serial,
      name: ps.name,
      leaderA: la.leader,
      leaderB: lb.leader,
      flipped: la.leader !== lb.leader,
      byCandidate: byCandidate.sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta)),
    });
  }

  const names = new Set([...overallA.keys(), ...overallB.keys()]);
  const candidates = Array.from(names)
    .map((candidate) => {
      const ea = overallA.get(candidate);
      const eb = overallB.get(candidate);
      const shareA = ea && ea.n ? ea.sum / ea.n : 0;
      const shareB = eb && eb.n ? eb.sum / eb.n : 0;
      return { candidate, shareA, shareB, delta: shareB - shareA };
    })
    .sort((x, y) => y.delta - x.delta);

  return { electionA, electionB, candidates, booths };
}

export interface GotvBooth extends BoothTarget {
  gotvScore: number; // favorability × turnout shortfall
}

/**
 * GOTV list: booths favorable (or winnable) for our candidate that are also
 * under-performing on turnout — the highest-leverage places to mobilize.
 */
export async function computeTurnoutGap(
  electionId: number,
  requestedCandidate?: string,
): Promise<{ electionId: number; ourCandidate: string; medianTurnout: number; items: GotvBooth[] }> {
  const base = await computeBoothTargets(electionId, requestedCandidate);
  const FAVORABLE: BoothClass[] = ['Safe-win', 'Marginal-win', 'Swing'];
  const items: GotvBooth[] = base.items
    .filter(
      (b) =>
        FAVORABLE.includes(b.classification) &&
        b.registeredVoters > 0 &&
        b.turnoutPct < base.medianTurnout,
    )
    .map((b) => {
      // Favorability weight: stronger lean + bigger turnout shortfall = higher.
      const favor = Math.max(b.margin, 0) + (b.classification === 'Swing' ? 0.05 : 0.1);
      const shortfall = Math.max(base.medianTurnout - b.turnoutPct, 0);
      return { ...b, gotvScore: favor * shortfall * b.registeredVoters };
    })
    .sort((a, b) => b.gotvScore - a.gotvScore);

  return {
    electionId,
    ourCandidate: base.ourCandidate,
    medianTurnout: base.medianTurnout,
    items,
  };
}
