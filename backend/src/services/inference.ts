// Inference engine — predicts each voter's likely candidate preference from
// the Form 20 vote-share of their booth.
//
// v1: booth-share inheritance. Every voter placed on a booth (via BoothVoter)
//     inherits that booth's normalized vote share per candidate.
// v2 (later): demographic transfer — solve booth × demographic = vote-share via
//     least-squares and redistribute per voter weighted by community/age/gender.
//
// Result is written to BoothVoter.predictedLeaning (JSONB) as:
//   { byCandidate: { "Name": share, ... }, leader: "Name", leaderShare: 0.74 }
// plus BoothVoter.predictedAt timestamp — i.e. per election, not on the voter.

import { prisma } from '../lib/prisma.js';

export interface PSLeaning {
  byCandidate: Record<string, number>;
  leader: string | null;
  leaderShare: number;
  totalValid: number;
}

/** Compute per-booth leaning for an election from VoteResult rows. */
export async function computeBoothLeanings(
  electionId: number,
): Promise<Map<number, PSLeaning>> {
  const booths = await prisma.booth.findMany({
    where: { electionId },
    include: { voteResults: { include: { candidate: true } } },
  });
  const out = new Map<number, PSLeaning>();
  for (const booth of booths) {
    const byCandidate: Record<string, number> = {};
    let total = 0;
    for (const vr of booth.voteResults) {
      total += vr.votes;
    }
    let leader: string | null = null;
    let leaderShare = 0;
    if (total > 0) {
      for (const vr of booth.voteResults) {
        const share = vr.votes / total;
        byCandidate[vr.candidate.name] = share;
        if (share > leaderShare) {
          leaderShare = share;
          leader = vr.candidate.name;
        }
      }
    }
    out.set(booth.id, { byCandidate, leader, leaderShare, totalValid: total });
  }
  return out;
}

/**
 * Recompute predictedLeaning for every BoothVoter placed on a booth in the
 * given election.
 *
 * Returns counts.
 */
export async function recomputePredictedLeaning(
  electionId: number,
): Promise<{ booths: number; votersUpdated: number }> {
  const leanings = await computeBoothLeanings(electionId);
  const boothIds = Array.from(leanings.keys());
  if (boothIds.length === 0) return { booths: 0, votersUpdated: 0 };

  const now = new Date();
  let updated = 0;

  // Group BoothVoters by boothId then bulk-update with the booth's leaning.
  for (const boothId of boothIds) {
    const lean = leanings.get(boothId)!;
    if (lean.totalValid === 0) continue; // no Form 20 data for this booth — skip
    const result = await prisma.boothVoter.updateMany({
      where: { boothId },
      data: {
        predictedLeaning: lean as unknown as object,
        predictedAt: now,
      },
    });
    updated += result.count;
  }
  return { booths: boothIds.length, votersUpdated: updated };
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
  const leanings = await computeBoothLeanings(electionId);
  const boothIds = Array.from(leanings.keys()).filter((id) => (leanings.get(id)?.totalValid ?? 0) > 0);
  if (boothIds.length === 0) return { electionId, dimension, groups: [] };

  const roll = await prisma.boothVoter.findMany({
    where: { boothId: { in: boothIds } },
    select: { boothId: true, voter: { select: { religion: true, community: true } } },
  });

  // group → candidate → weighted vote mass; group → total weight (voters)
  const weighted = new Map<string, Map<string, number>>();
  const groupVoters = new Map<string, number>();
  for (const bv of roll) {
    const label = (dimension === 'community' ? bv.voter.community : bv.voter.religion)?.trim();
    if (!label) continue;
    const lean = leanings.get(bv.boothId);
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
 * Fallback linker: re-point any BoothVoter rows in this election whose booth
 * has no Form 20 results onto the booth that matches by `partSerial`/name.
 *
 * The primary roll↔booth join is structural (roll Part Number == Booth serial,
 * done at voter-upload time). This exists only to reconcile rows uploaded
 * before their Form 20 booth existed; it matches BoothVoter.partNumber to the
 * booth serial within the election.
 */
export async function linkRollToBooths(electionId: number): Promise<number> {
  const booths = await prisma.booth.findMany({
    where: { electionId },
    select: { id: true, serial: true },
  });
  const bySerial = new Map<string, number>();
  for (const b of booths) bySerial.set(String(b.serial), b.id);

  const orphans = await prisma.boothVoter.findMany({
    where: { electionId },
    select: { id: true, boothId: true, partNumber: true },
  });
  let linked = 0;
  for (const bv of orphans) {
    const want = bySerial.get(String(bv.partNumber ?? '').trim());
    if (want != null && want !== bv.boothId) {
      await prisma.boothVoter.update({ where: { id: bv.id }, data: { boothId: want } });
      linked++;
    }
  }
  return linked;
}
