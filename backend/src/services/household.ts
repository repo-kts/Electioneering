// Household clustering — voters who share a house (makan) within the same
// part/booth are a family unit and tend to vote as a bloc. We group by
// (assemblyNo, partNumber, houseNumber), create a Household, link its voters,
// pick a head (eldest), and record the size.

import { prisma } from '../lib/prisma.js';

function keyOf(v: { assemblyNo: string; partNumber: string; houseNumber: string | null }): string {
  return [v.assemblyNo, v.partNumber, (v.houseNumber ?? '').trim().toUpperCase()].join('|');
}

export interface HouseholdRebuildResult {
  scope: string;
  voters: number;
  households: number;
  linked: number;
}

/**
 * Rebuild households for a scope (one assembly, or all voters when omitted).
 * Idempotent: clears prior Household links for the scope, then regroups.
 * Only voters with a non-empty houseNumber are clustered.
 */
export async function rebuildHouseholds(assemblyNo?: string): Promise<HouseholdRebuildResult> {
  const where = assemblyNo ? { assemblyNo } : {};
  const voters = await prisma.voter.findMany({
    where,
    select: {
      id: true,
      age: true,
      relationType: true,
      lastName: true,
      assemblyNo: true,
      partNumber: true,
      houseNumber: true,
      pollingStationId: true,
    },
  });

  // Group by household key; skip voters without a house number.
  const groups = new Map<string, typeof voters>();
  for (const v of voters) {
    if (!v.houseNumber || !String(v.houseNumber).trim()) continue;
    const k = keyOf(v);
    const arr = groups.get(k);
    if (arr) arr.push(v);
    else groups.set(k, [v]);
  }

  // Detach existing household links + delete stale households in scope so the
  // rebuild is clean and idempotent.
  const voterIds = voters.map((v) => v.id);
  await prisma.voter.updateMany({
    where: { id: { in: voterIds } },
    data: { householdId: null },
  });
  await prisma.household.deleteMany({
    where: assemblyNo ? { assemblyNo } : undefined,
  });

  let households = 0;
  let linked = 0;
  for (const [, members] of groups) {
    const first = members[0];
    // Head = eldest member (tie → first). Captures the likely roll head.
    const head = members.reduce((a, b) => (b.age > a.age ? b : a), first);
    const hh = await prisma.household.create({
      data: {
        assemblyNo: first.assemblyNo,
        partNumber: first.partNumber,
        houseNumber: first.houseNumber,
        headVoterId: head.id,
        headName: null,
        size: members.length,
        pollingStationId: first.pollingStationId,
      },
    });
    households += 1;
    const ids = members.map((m) => m.id);
    const r = await prisma.voter.updateMany({
      where: { id: { in: ids } },
      data: { householdId: hh.id },
    });
    linked += r.count;
  }

  return {
    scope: assemblyNo ?? 'all',
    voters: voters.length,
    households,
    linked,
  };
}
