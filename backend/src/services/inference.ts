// Inference engine — predicts each voter's likely candidate preference from
// the Form 20 vote-share of their polling station.
//
// v1: PS-share inheritance. Every voter assigned to a polling station inherits
//     that station's normalized vote share per candidate.
// v2 (later): demographic transfer — solve booth × demographic = vote-share via
//     least-squares and redistribute per voter weighted by community/age/gender.
//
// Result is written to Voter.predictedLeaning (JSONB) as:
//   { byCandidate: { "Name": share, ... }, leader: "Name", leaderShare: 0.74 }
// plus Voter.predictedAt timestamp.

import { prisma } from '../lib/prisma.js';

export interface PSLeaning {
  byCandidate: Record<string, number>;
  leader: string | null;
  leaderShare: number;
  totalValid: number;
}

/** Compute per-PS leaning for an election from VoteResult rows. */
export async function computePollingStationLeanings(
  electionId: number,
): Promise<Map<number, PSLeaning>> {
  const stations = await prisma.pollingStation.findMany({
    where: { electionId },
    include: { voteResults: { include: { candidate: true } } },
  });
  const out = new Map<number, PSLeaning>();
  for (const ps of stations) {
    const byCandidate: Record<string, number> = {};
    let total = 0;
    for (const vr of ps.voteResults) {
      total += vr.votes;
    }
    let leader: string | null = null;
    let leaderShare = 0;
    if (total > 0) {
      for (const vr of ps.voteResults) {
        const share = vr.votes / total;
        byCandidate[vr.candidate.name] = share;
        if (share > leaderShare) {
          leaderShare = share;
          leader = vr.candidate.name;
        }
      }
    }
    out.set(ps.id, { byCandidate, leader, leaderShare, totalValid: total });
  }
  return out;
}

/**
 * Recompute predictedLeaning for every Voter linked (via pollingStationId)
 * to a PollingStation in the given election.
 *
 * Returns counts.
 */
export async function recomputePredictedLeaning(
  electionId: number,
): Promise<{ stations: number; votersUpdated: number }> {
  const leanings = await computePollingStationLeanings(electionId);
  const psIds = Array.from(leanings.keys());
  if (psIds.length === 0) return { stations: 0, votersUpdated: 0 };

  const now = new Date();
  let updated = 0;

  // Group voters by pollingStationId then bulk-update with the PS's leaning.
  for (const psId of psIds) {
    const lean = leanings.get(psId)!;
    if (lean.totalValid === 0) continue; // no Form 20 data for this PS — skip
    const result = await prisma.voter.updateMany({
      where: { pollingStationId: psId },
      data: {
        predictedLeaning: lean as unknown as object,
        predictedAt: now,
      },
    });
    updated += result.count;
  }
  return { stations: psIds.length, votersUpdated: updated };
}

/**
 * Auto-link voters to a polling station within an election by matching
 * `Voter.pollingStationName` (case-insensitive trim) against
 * `PollingStation.name`. Useful when voters were created before Form 20.
 */
export async function linkVotersToPollingStations(electionId: number): Promise<number> {
  const stations = await prisma.pollingStation.findMany({
    where: { electionId },
    select: { id: true, name: true },
  });
  let linked = 0;
  for (const ps of stations) {
    if (!ps.name) continue;
    const r = await prisma.voter.updateMany({
      where: {
        pollingStationName: { equals: ps.name, mode: 'insensitive' },
        pollingStationId: null,
      },
      data: { pollingStationId: ps.id },
    });
    linked += r.count;
  }
  return linked;
}
