// Household clustering — voters who share a house (makan) within the same
// part/booth are a family unit and tend to vote as a bloc. Households are
// per-election: we group each election's roll (BoothVoter) by
// (booth, partNumber, houseNumber), create a Household on that booth, link its
// members, pick a head (eldest), and record the size.

import { prisma } from '../lib/prisma.js';

interface RollRow {
  id: number; // BoothVoter id
  boothId: number;
  partNumber: string | null;
  houseNumber: string | null;
  voter: { id: number; age: number; assemblyNo: string };
}

function keyOf(r: RollRow): string {
  return [r.boothId, r.partNumber ?? '', (r.houseNumber ?? '').trim().toUpperCase()].join('|');
}

export interface HouseholdRebuildResult {
  scope: string;
  voters: number;
  households: number;
  linked: number;
}

/**
 * Rebuild households for a scope (one assembly, or all when omitted).
 * Idempotent: clears prior Household links for the scope, then regroups.
 * Only roll entries with a non-empty houseNumber are clustered.
 */
export async function rebuildHouseholds(assemblyNo?: string): Promise<HouseholdRebuildResult> {
  const rows: RollRow[] = await prisma.boothVoter.findMany({
    where: assemblyNo ? { voter: { assemblyNo } } : {},
    select: {
      id: true,
      boothId: true,
      partNumber: true,
      houseNumber: true,
      voter: { select: { id: true, age: true, assemblyNo: true } },
    },
  });

  // Group by household key; skip entries without a house number.
  const groups = new Map<string, RollRow[]>();
  for (const r of rows) {
    if (!r.houseNumber || !String(r.houseNumber).trim()) continue;
    const k = keyOf(r);
    const arr = groups.get(k);
    if (arr) arr.push(r);
    else groups.set(k, [r]);
  }

  // Detach existing links + delete stale households in scope so the rebuild is
  // clean and idempotent.
  const bvIds = rows.map((r) => r.id);
  await prisma.boothVoter.updateMany({
    where: { id: { in: bvIds } },
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
    const head = members.reduce((a, b) => (b.voter.age > a.voter.age ? b : a), first);
    const hh = await prisma.household.create({
      data: {
        assemblyNo: first.voter.assemblyNo,
        partNumber: first.partNumber,
        houseNumber: first.houseNumber,
        headVoterId: head.voter.id,
        headName: null,
        size: members.length,
        boothId: first.boothId,
      },
    });
    households += 1;
    const ids = members.map((m) => m.id);
    const r = await prisma.boothVoter.updateMany({
      where: { id: { in: ids } },
      data: { householdId: hh.id },
    });
    linked += r.count;
  }

  return {
    scope: assemblyNo ?? 'all',
    voters: rows.length,
    households,
    linked,
  };
}
