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

export interface CommunityLeaning {
  group: string; // religion (or community) label
  voters: number; // roll voters in this group mapped to booths with results
  byCandidate: Array<{ candidate: string; estShare: number }>;
  leader: string | null;
  leaderShare: number;
}

/**
 * Estimate each community's candidate leaning by correlating the per-booth
 * religion mix (from the roll) with the per-booth Form 20 vote-share.
 *
 * This is ECOLOGICAL inference: it weights each booth's candidate shares by
 * how many voters of the group live there, then averages. It assumes the
 * group votes like its booth on average — a first-order estimate, never a
 * ground-truth claim. Returned shares are flagged `estShare`.
 *
 * `dimension` selects the grouping column: 'religion' (default) or 'community'.
 */
export async function computeCommunityLeaning(
  electionId: number,
  dimension: 'religion' | 'community' = 'religion',
): Promise<{ electionId: number; dimension: string; groups: CommunityLeaning[] }> {
  const leanings = await computePollingStationLeanings(electionId);
  const psIds = Array.from(leanings.keys()).filter((id) => (leanings.get(id)?.totalValid ?? 0) > 0);
  if (psIds.length === 0) return { electionId, dimension, groups: [] };

  const voters = await prisma.voter.findMany({
    where: { pollingStationId: { in: psIds } },
    select: { pollingStationId: true, religion: true, community: true },
  });

  // group → candidate → weighted vote mass; group → total weight (voters)
  const weighted = new Map<string, Map<string, number>>();
  const groupVoters = new Map<string, number>();
  for (const v of voters) {
    const label = (dimension === 'community' ? v.community : v.religion)?.trim();
    if (!label || v.pollingStationId == null) continue;
    const lean = leanings.get(v.pollingStationId);
    if (!lean || lean.totalValid === 0) continue;
    groupVoters.set(label, (groupVoters.get(label) ?? 0) + 1);
    const cand = weighted.get(label) ?? new Map<string, number>();
    for (const [name, share] of Object.entries(lean.byCandidate)) {
      cand.set(name, (cand.get(name) ?? 0) + share); // 1 voter × booth share
    }
    weighted.set(label, cand);
  }

  const groups: CommunityLeaning[] = [];
  for (const [label, cand] of weighted) {
    const total = Array.from(cand.values()).reduce((a, b) => a + b, 0);
    const byCandidate = Array.from(cand.entries())
      .map(([candidate, mass]) => ({ candidate, estShare: total > 0 ? mass / total : 0 }))
      .sort((a, b) => b.estShare - a.estShare);
    groups.push({
      group: label,
      voters: groupVoters.get(label) ?? 0,
      byCandidate,
      leader: byCandidate[0]?.candidate ?? null,
      leaderShare: byCandidate[0]?.estShare ?? 0,
    });
  }
  groups.sort((a, b) => b.voters - a.voters);
  return { electionId, dimension, groups };
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
