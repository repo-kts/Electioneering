// Candidate report card — assembles a one-shot scorecard for a candidate in
// an election: headline KPIs, booth strengths/weaknesses, GOTV + swing target
// counts, community leaning, and plain-language recommended actions. Consumed
// by routes/reports.ts to render an Excel workbook.

import { prisma } from '../lib/prisma.js';
import {
  computeBoothTargets,
  computeTurnoutGap,
  type BoothTarget,
} from './boothAnalytics.js';
import { computeCommunityLeaning, type CommunityLeaning } from './inference.js';

export interface ReportCard {
  election: {
    id: number;
    state: string;
    assemblyNo: string;
    assemblyName: string;
    electionType: string;
    electionYear: number | null;
  };
  candidate: string;
  kpis: {
    ourVotes: number;
    totalValid: number;
    ourShare: number;
    rank: number;
    candidatesCount: number;
    result: 'Won' | 'Lost' | 'Unknown';
    leader: string | null;
    leaderVotes: number;
    margin: number; // signed votes vs winner (negative = behind)
  };
  boothSummary: ReturnType<typeof emptyish>;
  strongBooths: BoothTarget[];
  weakBooths: BoothTarget[];
  swingBooths: BoothTarget[];
  gotv: Array<BoothTarget & { gotvScore: number }>;
  communityLeaning: CommunityLeaning[];
  recommendations: string[];
}

function emptyish() {
  return {} as Record<string, number>;
}

export async function assembleReportCard(
  electionId: number,
  requestedCandidate?: string,
): Promise<ReportCard> {
  const election = await prisma.election.findUnique({ where: { id: electionId } });
  if (!election) {
    const e = new Error('Election not found');
    (e as Error & { status?: number }).status = 404;
    throw e;
  }

  const targets = await computeBoothTargets(electionId, requestedCandidate);
  const candidate = targets.ourCandidate;
  const gotv = await computeTurnoutGap(electionId, candidate);
  const community = await computeCommunityLeaning(electionId, 'religion');

  // Candidate totals for KPIs.
  const totals = await prisma.voteResult.groupBy({
    by: ['candidateId'],
    where: { candidate: { electionId } },
    _sum: { votes: true },
  });
  const cands = await prisma.candidate.findMany({ where: { electionId } });
  const nameById = new Map(cands.map((c) => [c.id, c.name]));
  const ranked = totals
    .map((t) => ({ name: nameById.get(t.candidateId) ?? '?', votes: t._sum.votes ?? 0 }))
    .sort((a, b) => b.votes - a.votes);
  const totalValid = ranked.reduce((s, r) => s + r.votes, 0);
  const ourEntry = ranked.find((r) => r.name === candidate);
  const ourVotes = ourEntry?.votes ?? 0;
  const rank = Math.max(1, ranked.findIndex((r) => r.name === candidate) + 1);
  const leaderEntry = ranked[0];
  const result: 'Won' | 'Lost' | 'Unknown' =
    !leaderEntry || totalValid === 0 ? 'Unknown' : leaderEntry.name === candidate ? 'Won' : 'Lost';

  const strongBooths = [...targets.items]
    .filter((b) => b.totalValid > 0)
    .sort((a, b) => b.ourShare - a.ourShare)
    .slice(0, 15);
  const weakBooths = [...targets.items]
    .filter((b) => b.totalValid > 0)
    .sort((a, b) => a.ourShare - b.ourShare)
    .slice(0, 15);
  const swingBooths = targets.items
    .filter((b) => b.classification === 'Swing')
    .sort((a, b) => a.margin - b.margin);

  // Recommendations — plain-language, derived from the numbers.
  const recommendations: string[] = [];
  const s = targets.summary;
  if (s.Swing > 0)
    recommendations.push(
      `${s.Swing} swing booth(s) are within 10% — prioritise canvassing and local issues here.`,
    );
  if (gotv.items.length > 0)
    recommendations.push(
      `${gotv.items.length} favorable booth(s) have below-median turnout (${(Math.min(targets.medianTurnout, 1) * 100).toFixed(0)}%) — run GOTV/mobilisation to bank these votes.`,
    );
  if (s['Marginal-win'] > 0)
    recommendations.push(
      `${s['Marginal-win']} booth(s) are won only narrowly — defend them; small slippage flips the seat.`,
    );
  if (s['Safe-loss'] > 0)
    recommendations.push(
      `${s['Safe-loss']} opposition-stronghold booth(s) — do not over-invest; contain the margin instead.`,
    );
  const topGroup = community.groups[0];
  if (topGroup && topGroup.leader && topGroup.leader !== candidate)
    recommendations.push(
      `Largest community "${topGroup.group}" (${topGroup.voters} voters) leans to ${topGroup.leader} (est ${(topGroup.leaderShare * 100).toFixed(0)}%) — a key persuasion target.`,
    );
  if (recommendations.length === 0)
    recommendations.push('No critical targeting gaps detected for the current data.');

  return {
    election: {
      id: election.id,
      state: election.state,
      assemblyNo: election.assemblyNo,
      assemblyName: election.assemblyName,
      electionType: election.electionType,
      electionYear: election.electionYear,
    },
    candidate,
    kpis: {
      ourVotes,
      totalValid,
      ourShare: totalValid > 0 ? ourVotes / totalValid : 0,
      rank,
      candidatesCount: ranked.length,
      result,
      leader: leaderEntry?.name ?? null,
      leaderVotes: leaderEntry?.votes ?? 0,
      margin: ourVotes - (leaderEntry?.votes ?? 0),
    },
    boothSummary: targets.summary,
    strongBooths,
    weakBooths,
    swingBooths,
    gotv: gotv.items,
    communityLeaning: community.groups,
    recommendations,
  };
}
