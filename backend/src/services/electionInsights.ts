// Election-level insight aggregates that power the party breakdown, the
// per-assembly timeline (year-over-year results), and the elections hierarchy
// tree (type → year → constituency). All numbers are real, derived from the
// Form 20 VoteResult grid + PollingStation reject/NOTA tallies.

import { prisma } from '../lib/prisma.js';
import { computePollingStationLeanings } from './inference.js';

interface CandidateTotal {
  id: number;
  name: string;
  party: string | null;
  votes: number;
  share: number; // votes / totalValid
}

/**
 * Per-candidate vote totals for an election (includes zero-vote candidates),
 * sorted by votes desc, with each candidate's share of total valid votes.
 */
async function loadCandidateTotals(
  electionId: number,
): Promise<{ candidates: CandidateTotal[]; totalValid: number }> {
  const cands = await prisma.candidate.findMany({
    where: { electionId },
    orderBy: { position: 'asc' },
  });
  const sums = await prisma.voteResult.groupBy({
    by: ['candidateId'],
    where: { candidate: { electionId } },
    _sum: { votes: true },
  });
  const sumById = new Map(sums.map((s) => [s.candidateId, s._sum.votes ?? 0]));

  let totalValid = 0;
  const withVotes = cands.map((c) => {
    const votes = sumById.get(c.id) ?? 0;
    totalValid += votes;
    return { id: c.id, name: c.name, party: c.party, votes };
  });
  const candidates: CandidateTotal[] = withVotes
    .map((c) => ({ ...c, share: totalValid > 0 ? c.votes / totalValid : 0 }))
    .sort((a, b) => b.votes - a.votes);
  return { candidates, totalValid };
}

function partyKey(party: string | null | undefined): string {
  const p = party?.trim();
  return p && p.length ? p : 'Independent';
}

// ─── 1. Party analytics ───────────────────────────────────────────────────
export interface PartyAnalyticsResult {
  election: {
    id: number;
    assemblyNo: string;
    assemblyName: string;
    electionType: string;
    electionYear: number | null;
  };
  totalValid: number;
  parties: Array<{
    party: string;
    votes: number;
    share: number;
    candidateCount: number;
    boothsLed: number;
    topCandidate: { name: string; votes: number } | null;
  }>;
}

export async function computePartyAnalytics(electionId: number): Promise<PartyAnalyticsResult> {
  const election = await prisma.election.findUnique({ where: { id: electionId } });
  if (!election) {
    const err = new Error('Election not found');
    (err as Error & { status?: number }).status = 404;
    throw err;
  }

  const { candidates, totalValid } = await loadCandidateTotals(electionId);

  // Booths led per party — from per-PS leaders (matched by candidate name).
  const nameToParty = new Map(candidates.map((c) => [c.name, partyKey(c.party)]));
  const leanings = await computePollingStationLeanings(electionId);
  const boothsLed = new Map<string, number>();
  for (const lean of leanings.values()) {
    if (!lean.leader || lean.totalValid === 0) continue;
    const key = nameToParty.get(lean.leader) ?? 'Independent';
    boothsLed.set(key, (boothsLed.get(key) ?? 0) + 1);
  }

  // Aggregate candidates into parties.
  const agg = new Map<
    string,
    { votes: number; candidateCount: number; top: { name: string; votes: number } | null }
  >();
  for (const c of candidates) {
    const key = partyKey(c.party);
    const e = agg.get(key) ?? { votes: 0, candidateCount: 0, top: null };
    e.votes += c.votes;
    e.candidateCount += 1;
    if (!e.top || c.votes > e.top.votes) e.top = { name: c.name, votes: c.votes };
    agg.set(key, e);
  }

  const parties = Array.from(agg.entries())
    .map(([party, e]) => ({
      party,
      votes: e.votes,
      share: totalValid > 0 ? e.votes / totalValid : 0,
      candidateCount: e.candidateCount,
      boothsLed: boothsLed.get(party) ?? 0,
      topCandidate: e.top,
    }))
    .sort((a, b) => b.votes - a.votes);

  return {
    election: {
      id: election.id,
      assemblyNo: election.assemblyNo,
      assemblyName: election.assemblyName,
      electionType: election.electionType,
      electionYear: election.electionYear,
    },
    totalValid,
    parties,
  };
}

// ─── 2. Assembly timeline (year-over-year) ─────────────────────────────────
export interface AssemblyTimelineResult {
  assembly: { assemblyNo: string | null; assemblyName: string | null; state: string | null };
  elections: Array<{
    electionId: number;
    electionYear: number | null;
    electionType: string;
    totalElectors: number | null;
    turnout: { voted: number; registered: number | null; pct: number };
    totalValid: number;
    winner: { name: string; party: string | null; votes: number; share: number } | null;
    runnerUp: { name: string; party: string | null; votes: number; share: number } | null;
    margin: number;
    winnerParty: string | null;
  }>;
}

export async function computeAssemblyTimeline(opts: {
  assemblyNo?: string;
  assemblyName?: string;
  limit?: number;
}): Promise<AssemblyTimelineResult> {
  const where: { assemblyNo?: string; assemblyName?: string } = {};
  if (opts.assemblyNo) where.assemblyNo = opts.assemblyNo;
  if (opts.assemblyName) where.assemblyName = opts.assemblyName;

  const rows = await prisma.election.findMany({
    where,
    orderBy: { electionYear: 'desc' },
    ...(opts.limit ? { take: opts.limit } : {}),
  });

  const first = rows[0] ?? null;
  const elections = await Promise.all(
    rows.map(async (e) => {
      const { candidates, totalValid } = await loadCandidateTotals(e.id);
      const psAgg = await prisma.pollingStation.aggregate({
        where: { electionId: e.id },
        _sum: { rejectedVotes: true, notaVotes: true },
      });
      const rejected = psAgg._sum.rejectedVotes ?? 0;
      const nota = psAgg._sum.notaVotes ?? 0;
      const voted = totalValid + rejected + nota; // total polled
      const registered = e.totalElectors;
      const winner = candidates[0] ?? null;
      const runnerUp = candidates[1] ?? null;
      return {
        electionId: e.id,
        electionYear: e.electionYear,
        electionType: e.electionType,
        totalElectors: e.totalElectors,
        turnout: {
          voted,
          registered,
          pct: registered && registered > 0 ? voted / registered : 0,
        },
        totalValid,
        winner: winner
          ? { name: winner.name, party: winner.party, votes: winner.votes, share: winner.share }
          : null,
        runnerUp: runnerUp
          ? {
              name: runnerUp.name,
              party: runnerUp.party,
              votes: runnerUp.votes,
              share: runnerUp.share,
            }
          : null,
        margin: (winner?.votes ?? 0) - (runnerUp?.votes ?? 0),
        winnerParty: winner?.party ?? null,
      };
    }),
  );

  return {
    assembly: {
      assemblyNo: first?.assemblyNo ?? opts.assemblyNo ?? null,
      assemblyName: first?.assemblyName ?? opts.assemblyName ?? null,
      state: first?.state ?? null,
    },
    elections,
  };
}

// ─── 3. Elections hierarchy (type → constituency, years nested per row) ─────
export interface HierarchyYear {
  electionId: number;
  year: number | null;
  electionType: string;
  totalElectors: number | null;
  pollingStations: number;
  winner: { name: string; party: string | null; share: number } | null;
}

export interface HierarchyConstituency {
  key: string;
  assemblyNo: string;
  assemblyName: string;
  state: string;
  parlName: string;
  latestElectionId: number; // link target (most recent year)
  yearCount: number;
  totalElectors: number | null; // latest year's electors
  pollingStations: number; // latest year
  winner: { name: string; party: string | null; share: number } | null; // latest year
  years: HierarchyYear[]; // newest first
}

export interface ElectionsHierarchyResult {
  types: Array<{
    electionType: string;
    constituencyCount: number;
    yearCount: number;
    totalElectors: number;
    constituencies: HierarchyConstituency[];
  }>;
}

export async function computeElectionsHierarchy(): Promise<ElectionsHierarchyResult> {
  const elections = await prisma.election.findMany({
    orderBy: [{ electionType: 'asc' }, { assemblyName: 'asc' }, { electionYear: 'desc' }],
  });

  const enriched = await Promise.all(
    elections.map(async (e) => {
      const { candidates } = await loadCandidateTotals(e.id);
      const pollingStations = await prisma.pollingStation.count({ where: { electionId: e.id } });
      const w = candidates[0] ?? null;
      return {
        election: e,
        pollingStations,
        winner: w ? { name: w.name, party: w.party, share: w.share } : null,
      };
    }),
  );

  // type → constituency(assemblyNo::assemblyName) → year rows
  const typeMap = new Map<string, Map<string, HierarchyConstituency>>();

  for (const item of enriched) {
    const e = item.election;
    const consMap = typeMap.get(e.electionType) ?? new Map<string, HierarchyConstituency>();
    const key = `${e.assemblyNo}::${e.assemblyName}`;
    const yearRow: HierarchyYear = {
      electionId: e.id,
      year: e.electionYear,
      electionType: e.electionType,
      totalElectors: e.totalElectors,
      pollingStations: item.pollingStations,
      winner: item.winner,
    };
    const existing = consMap.get(key);
    if (existing) {
      existing.years.push(yearRow);
    } else {
      consMap.set(key, {
        key,
        assemblyNo: e.assemblyNo,
        assemblyName: e.assemblyName,
        state: e.state,
        parlName: e.parlName,
        latestElectionId: e.id,
        yearCount: 1,
        totalElectors: e.totalElectors,
        pollingStations: item.pollingStations,
        winner: item.winner,
        years: [yearRow],
      });
    }
    typeMap.set(e.electionType, consMap);
  }

  const types = Array.from(typeMap.entries())
    .map(([electionType, consMap]) => {
      const constituencies = Array.from(consMap.values())
        .map((c) => {
          // Order years newest first; the newest defines the row's headline stats.
          c.years.sort((a, b) => (b.year ?? -Infinity) - (a.year ?? -Infinity));
          const latest = c.years[0];
          return {
            ...c,
            yearCount: c.years.length,
            latestElectionId: latest.electionId,
            totalElectors: latest.totalElectors,
            pollingStations: latest.pollingStations,
            winner: latest.winner,
          };
        })
        .sort((a, b) => a.assemblyName.localeCompare(b.assemblyName));
      return {
        electionType,
        constituencyCount: constituencies.length,
        yearCount: constituencies.reduce((s, c) => s + c.yearCount, 0),
        totalElectors: constituencies.reduce((s, c) => s + (c.totalElectors ?? 0), 0),
        constituencies,
      };
    })
    .sort((a, b) => a.electionType.localeCompare(b.electionType));

  return { types };
}
