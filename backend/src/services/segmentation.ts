// Voter segmentation — translates a `criteria` JSON spec into a Prisma
// where-clause + post-filter for predictedLeaning and turnout joins.

import type { Prisma } from '@prisma/client';
import { z } from 'zod';

export const segmentSchema = z.object({
  // election context — resolves per-election attributes (booth, roll position,
  // predicted leaning). Required for booth/leaning/roll filters + aggregates.
  electionId: z.coerce.number().int().optional(),
  // geography
  state: z.string().optional(),
  parlNo: z.string().optional(),
  parlName: z.string().optional(),
  assemblyNo: z.string().optional(),
  assemblyName: z.string().optional(),
  partNumber: z.string().optional(),
  pollingStationName: z.string().optional(),
  boothId: z.coerce.number().int().optional(),
  pollingStationId: z.coerce.number().int().optional(), // legacy alias for boothId
  // extended administrative geography
  ward: z.string().optional(),
  panchayat: z.string().optional(),
  block: z.string().optional(),
  tehsil: z.string().optional(),
  district: z.string().optional(),
  householdId: z.coerce.number().int().optional(),
  // demographics
  caste: z.union([z.string(), z.array(z.string())]).optional(),
  community: z.union([z.string(), z.array(z.string())]).optional(), // Gen/OBC/SC/ST
  category: z.union([z.string(), z.array(z.string())]).optional(),
  religion: z.union([z.string(), z.array(z.string())]).optional(),
  occupation: z.union([z.string(), z.array(z.string())]).optional(),
  language: z.union([z.string(), z.array(z.string())]).optional(),
  gender: z.enum(['Male', 'Female', 'Other']).optional(),
  ageMin: z.coerce.number().int().min(0).optional(),
  ageMax: z.coerce.number().int().max(150).optional(),
  firstTimeOnly: z.coerce.boolean().optional(), // age ≤ 19
  // turnout
  votedIn: z.array(z.coerce.number().int()).optional(),    // election ids
  notVotedIn: z.array(z.coerce.number().int()).optional(),
  // predicted leaning
  leaningTo: z.string().optional(),       // candidate name
  leaningMin: z.coerce.number().min(0).max(1).optional(), // min share
  // free text
  search: z.string().optional(),
  // pagination
  take: z.coerce.number().int().min(1).max(2000).default(200),
  skip: z.coerce.number().int().min(0).default(0),
});

export type SegmentCriteria = z.infer<typeof segmentSchema>;

function multi(v: string | string[] | undefined): string[] | undefined {
  if (v == null) return undefined;
  if (Array.isArray(v)) return v.filter((x) => x && x.length);
  return v ? [v] : undefined;
}

export function buildVoterWhere(c: SegmentCriteria): Prisma.VoterWhereInput {
  const where: Prisma.VoterWhereInput = {};
  if (c.state) where.state = c.state;
  if (c.parlNo) where.parlNo = c.parlNo;
  if (c.parlName) where.parlName = c.parlName;
  if (c.assemblyNo) where.assemblyNo = c.assemblyNo;
  if (c.assemblyName) where.assemblyName = c.assemblyName;

  // Per-election roll / booth filters go through the BoothVoter relation.
  // We collect them into a single `some` (scoped to electionId when given).
  const bv: Prisma.BoothVoterWhereInput = {};
  if (c.electionId) bv.electionId = c.electionId;
  if (c.partNumber) bv.partNumber = c.partNumber;
  const boothId = c.boothId ?? c.pollingStationId;
  if (boothId) bv.boothId = boothId;
  if (c.householdId) bv.householdId = c.householdId;
  if (c.pollingStationName) {
    bv.booth = {
      pollingStation: { name: { equals: c.pollingStationName, mode: 'insensitive' } },
    };
  }
  if (Object.keys(bv).length) where.boothVoters = { some: bv };

  if (c.gender) where.gender = c.gender;
  if (c.ward) where.ward = { equals: c.ward, mode: 'insensitive' };
  if (c.panchayat) where.panchayat = { equals: c.panchayat, mode: 'insensitive' };
  if (c.block) where.block = { equals: c.block, mode: 'insensitive' };
  if (c.tehsil) where.tehsil = { equals: c.tehsil, mode: 'insensitive' };
  if (c.district) where.district = { equals: c.district, mode: 'insensitive' };

  const caste = multi(c.caste);
  if (caste) where.caste = { in: caste, mode: 'insensitive' };
  const community = multi(c.community);
  if (community) where.community = { in: community, mode: 'insensitive' };
  const category = multi(c.category);
  if (category) where.category = { in: category, mode: 'insensitive' };
  const religion = multi(c.religion);
  if (religion) where.religion = { in: religion, mode: 'insensitive' };
  const occupation = multi(c.occupation);
  if (occupation) where.occupation = { in: occupation, mode: 'insensitive' };
  const language = multi(c.language);
  if (language) where.language = { in: language, mode: 'insensitive' };

  const ageMin = c.firstTimeOnly ? (c.ageMin ?? 18) : c.ageMin;
  const ageMax = c.firstTimeOnly ? Math.min(c.ageMax ?? 19, 19) : c.ageMax;
  if (ageMin != null || ageMax != null) {
    where.age = {};
    if (ageMin != null) (where.age as { gte?: number }).gte = ageMin;
    if (ageMax != null) (where.age as { lte?: number }).lte = ageMax;
  }

  // turnout filters via the BoothVoter relation
  if (c.votedIn?.length) {
    where.AND = (where.AND ?? []) as Prisma.VoterWhereInput[];
    (where.AND as Prisma.VoterWhereInput[]).push({
      boothVoters: { some: { voted: true, electionId: { in: c.votedIn } } },
    });
  }
  if (c.notVotedIn?.length) {
    where.AND = (where.AND ?? []) as Prisma.VoterWhereInput[];
    (where.AND as Prisma.VoterWhereInput[]).push({
      NOT: { boothVoters: { some: { voted: true, electionId: { in: c.notVotedIn } } } },
    });
  }

  // search across name / EPIC / mobile
  if (c.search) {
    const q = c.search.trim();
    if (q) {
      where.OR = [
        { firstName: { contains: q, mode: 'insensitive' } },
        { lastName: { contains: q, mode: 'insensitive' } },
        { epic: { contains: q.toUpperCase() } },
        { mobile: { contains: q } },
      ];
    }
  }

  return where;
}

/**
 * Predicted-leaning filter is applied in JS after the SQL query because
 * Prisma can't easily filter inside a JSONB key against a runtime value
 * across all candidates without raw SQL. With Postgres-specific operators
 * we could push it down later.
 */
export function passesLeaningFilter(
  voter: { predictedLeaning?: unknown },
  c: SegmentCriteria,
): boolean {
  if (!c.leaningTo && c.leaningMin == null) return true;
  const lean = voter.predictedLeaning as
    | { byCandidate?: Record<string, number>; leader?: string; leaderShare?: number }
    | null;
  if (!lean) return false;
  if (c.leaningTo) {
    const share = lean.byCandidate?.[c.leaningTo] ?? 0;
    if (share <= 0) return false;
    if (c.leaningMin != null && share < c.leaningMin) return false;
  } else if (c.leaningMin != null) {
    if ((lean.leaderShare ?? 0) < c.leaningMin) return false;
  }
  return true;
}

export interface SegmentAggregates {
  byCaste: Array<{ key: string; count: number }>;
  byCommunity: Array<{ key: string; count: number }>;
  byCategory: Array<{ key: string; count: number }>;
  byReligion: Array<{ key: string; count: number }>;
  byOccupation: Array<{ key: string; count: number }>;
  byLanguage: Array<{ key: string; count: number }>;
  byGender: Array<{ key: string; count: number }>;
  byAgeBucket: Array<{ key: string; count: number }>;
  byWard: Array<{ key: string; count: number }>;
  byPanchayat: Array<{ key: string; count: number }>;
  byBlock: Array<{ key: string; count: number }>;
  byPollingStation: Array<{ key: string; count: number }>;
  byPredictedLeader: Array<{ key: string; count: number }>;
  byHouseholdSize: Array<{ key: string; count: number }>;
  firstTimeVoters: number;
}

const AGE_BUCKETS: Array<[string, (a: number) => boolean]> = [
  ['18-25', (a) => a >= 18 && a <= 25],
  ['26-40', (a) => a >= 26 && a <= 40],
  ['41-60', (a) => a >= 41 && a <= 60],
  ['61-80', (a) => a >= 61 && a <= 80],
  ['80+', (a) => a > 80],
];

function bumpMap(m: Map<string, number>, k: string | null | undefined) {
  const key = k && String(k).trim() ? String(k).trim() : '—';
  m.set(key, (m.get(key) ?? 0) + 1);
}
function toArray(m: Map<string, number>) {
  return Array.from(m.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count);
}

/** Per-election fields that live on BoothVoter, flattened onto a voter for
 *  aggregation / leaning filtering. Use `attachElectionFields`. */
export interface ElectionVoterFields {
  pollingStationName?: string | null;
  partNumber?: string | null;
  partName?: string | null;
  partSerial?: string | null;
  houseNumber?: string | null;
  householdId?: number | null;
  predictedLeaning?: unknown;
}

type VoterWithBoothVoters = {
  boothVoters?: Array<{
    electionId: number;
    partNumber?: string | null;
    partName?: string | null;
    partSerial?: string | null;
    houseNumber?: string | null;
    householdId?: number | null;
    predictedLeaning?: unknown;
    booth?: { pollingStation?: { name?: string | null } | null } | null;
  }>;
};

/**
 * Flatten each voter's per-election BoothVoter (for `electionId`, else the
 * first) into top-level fields so `aggregate` / `passesLeaningFilter` can read
 * them without knowing about the join. Pass voters queried with
 * `include: { boothVoters: { where: { electionId }, include: { booth: { include: { pollingStation: true } } } } }`.
 */
export function attachElectionFields<T extends object>(
  voters: T[],
  electionId?: number,
): Array<T & ElectionVoterFields> {
  return voters.map((v) => {
    const list = (v as VoterWithBoothVoters).boothVoters ?? [];
    const bv = (electionId != null ? list.find((x) => x.electionId === electionId) : list[0]) ?? list[0];
    return {
      ...v,
      pollingStationName: bv?.booth?.pollingStation?.name ?? null,
      partNumber: bv?.partNumber ?? null,
      partName: bv?.partName ?? null,
      partSerial: bv?.partSerial ?? null,
      houseNumber: bv?.houseNumber ?? null,
      householdId: bv?.householdId ?? null,
      predictedLeaning: bv?.predictedLeaning ?? null,
    };
  });
}

export function aggregate(
  voters: Array<{
    caste?: string | null;
    community: string | null;
    category?: string | null;
    religion?: string | null;
    occupation: string | null;
    language: string | null;
    gender: string;
    age: number;
    pollingStationName?: string | null;
    ward?: string | null;
    panchayat?: string | null;
    block?: string | null;
    householdId?: number | null;
    predictedLeaning?: unknown;
  }>,
): SegmentAggregates {
  const caste = new Map<string, number>();
  const community = new Map<string, number>();
  const category = new Map<string, number>();
  const religion = new Map<string, number>();
  const occupation = new Map<string, number>();
  const language = new Map<string, number>();
  const gender = new Map<string, number>();
  const ageB = new Map<string, number>();
  const ward = new Map<string, number>();
  const panchayat = new Map<string, number>();
  const block = new Map<string, number>();
  const ps = new Map<string, number>();
  const leader = new Map<string, number>();
  const householdCounts = new Map<number, number>(); // householdId → members
  let firstTimeVoters = 0;
  for (const v of voters) {
    bumpMap(caste, v.caste);
    bumpMap(community, v.community);
    bumpMap(category, v.category);
    bumpMap(religion, v.religion);
    bumpMap(occupation, v.occupation);
    bumpMap(language, v.language);
    bumpMap(gender, v.gender);
    const bucket = AGE_BUCKETS.find(([, f]) => f(v.age))?.[0] ?? '—';
    bumpMap(ageB, bucket);
    bumpMap(ward, v.ward);
    bumpMap(panchayat, v.panchayat);
    bumpMap(block, v.block);
    bumpMap(ps, v.pollingStationName);
    const lean = v.predictedLeaning as { leader?: string } | null;
    bumpMap(leader, lean?.leader);
    if (v.age <= 19) firstTimeVoters += 1;
    if (v.householdId != null) {
      householdCounts.set(v.householdId, (householdCounts.get(v.householdId) ?? 0) + 1);
    }
  }

  // Distribution of household sizes (number of households per size bucket).
  const sizeBuckets = new Map<string, number>();
  for (const size of householdCounts.values()) {
    const key = size >= 5 ? '5+' : String(size);
    sizeBuckets.set(key, (sizeBuckets.get(key) ?? 0) + 1);
  }

  return {
    byCaste: toArray(caste),
    byCommunity: toArray(community),
    byCategory: toArray(category),
    byReligion: toArray(religion),
    byOccupation: toArray(occupation),
    byLanguage: toArray(language),
    byGender: toArray(gender),
    byAgeBucket: toArray(ageB),
    byWard: toArray(ward),
    byPanchayat: toArray(panchayat),
    byBlock: toArray(block),
    byPollingStation: toArray(ps),
    byPredictedLeader: toArray(leader),
    byHouseholdSize: Array.from(sizeBuckets.entries())
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => a.key.localeCompare(b.key)),
    firstTimeVoters,
  };
}
