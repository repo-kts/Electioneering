// Voter segmentation — translates a `criteria` JSON spec into a Prisma
// where-clause + post-filter for predictedLeaning and turnout joins.

import type { Prisma } from '@prisma/client';
import { z } from 'zod';

export const segmentSchema = z.object({
  // geography
  state: z.string().optional(),
  parlNo: z.string().optional(),
  parlName: z.string().optional(),
  assemblyNo: z.string().optional(),
  assemblyName: z.string().optional(),
  partNumber: z.string().optional(),
  pollingStationName: z.string().optional(),
  pollingStationId: z.coerce.number().int().optional(),
  // demographics
  community: z.union([z.string(), z.array(z.string())]).optional(),
  occupation: z.union([z.string(), z.array(z.string())]).optional(),
  language: z.union([z.string(), z.array(z.string())]).optional(),
  gender: z.enum(['Male', 'Female', 'Other']).optional(),
  ageMin: z.coerce.number().int().min(0).optional(),
  ageMax: z.coerce.number().int().max(150).optional(),
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
  if (c.partNumber) where.partNumber = c.partNumber;
  if (c.pollingStationName) {
    where.pollingStationName = { equals: c.pollingStationName, mode: 'insensitive' };
  }
  if (c.pollingStationId) where.pollingStationId = c.pollingStationId;
  if (c.gender) where.gender = c.gender;

  const community = multi(c.community);
  if (community) where.community = { in: community, mode: 'insensitive' };
  const occupation = multi(c.occupation);
  if (occupation) where.occupation = { in: occupation, mode: 'insensitive' };
  const language = multi(c.language);
  if (language) where.language = { in: language, mode: 'insensitive' };

  if (c.ageMin != null || c.ageMax != null) {
    where.age = {};
    if (c.ageMin != null) (where.age as { gte?: number }).gte = c.ageMin;
    if (c.ageMax != null) (where.age as { lte?: number }).lte = c.ageMax;
  }

  // turnout filters via relations
  if (c.votedIn?.length) {
    where.turnouts = {
      some: { voted: true, electionId: { in: c.votedIn } },
    };
  }
  if (c.notVotedIn?.length) {
    where.AND = (where.AND ?? []) as Prisma.VoterWhereInput[];
    (where.AND as Prisma.VoterWhereInput[]).push({
      NOT: { turnouts: { some: { voted: true, electionId: { in: c.notVotedIn } } } },
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
  byCommunity: Array<{ key: string; count: number }>;
  byOccupation: Array<{ key: string; count: number }>;
  byLanguage: Array<{ key: string; count: number }>;
  byGender: Array<{ key: string; count: number }>;
  byAgeBucket: Array<{ key: string; count: number }>;
  byPollingStation: Array<{ key: string; count: number }>;
  byPredictedLeader: Array<{ key: string; count: number }>;
}

const AGE_BUCKETS: Array<[string, (a: number) => boolean]> = [
  ['18-25', (a) => a >= 18 && a <= 25],
  ['26-35', (a) => a >= 26 && a <= 35],
  ['36-45', (a) => a >= 36 && a <= 45],
  ['46-60', (a) => a >= 46 && a <= 60],
  ['60+', (a) => a > 60],
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

export function aggregate(
  voters: Array<{
    community: string | null;
    occupation: string | null;
    language: string | null;
    gender: string;
    age: number;
    pollingStationName: string;
    predictedLeaning?: unknown;
  }>,
): SegmentAggregates {
  const community = new Map<string, number>();
  const occupation = new Map<string, number>();
  const language = new Map<string, number>();
  const gender = new Map<string, number>();
  const ageB = new Map<string, number>();
  const ps = new Map<string, number>();
  const leader = new Map<string, number>();
  for (const v of voters) {
    bumpMap(community, v.community);
    bumpMap(occupation, v.occupation);
    bumpMap(language, v.language);
    bumpMap(gender, v.gender);
    const bucket = AGE_BUCKETS.find(([, f]) => f(v.age))?.[0] ?? '—';
    bumpMap(ageB, bucket);
    bumpMap(ps, v.pollingStationName);
    const lean = v.predictedLeaning as { leader?: string } | null;
    bumpMap(leader, lean?.leader);
  }
  return {
    byCommunity: toArray(community),
    byOccupation: toArray(occupation),
    byLanguage: toArray(language),
    byGender: toArray(gender),
    byAgeBucket: toArray(ageB),
    byPollingStation: toArray(ps),
    byPredictedLeader: toArray(leader),
  };
}
