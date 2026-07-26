// Helpers for the MASTER-BOOTH model.
//
// PollingStation is the master booth: one stable row per physical booth, keyed
// by an operator-assigned, immutable, globally-unique UNIQUE_CODE (`code`).
// Importers (voter roll, Form 20) NEVER create master booths — they resolve one
// by `code` and reject unknown codes. A Booth is the per-election join (Election
// × master booth); a BoothVoter is the per-election roll entry.

import { Prisma } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';

// Accepts either the base client or a transaction client.
type Db = PrismaClient | Prisma.TransactionClient;

// ─── Master booth (upsert by UNIQUE_CODE) ──────────────────────────────────
export interface MasterBoothInput {
  code: string;
  parliamentaryConstituencyId: number;
  assemblyConstituencyId?: number | null;
  state?: string | null;
  parlNo?: string | null;
  parlName?: string | null;
  assemblyNo?: string | null;
  assemblyName?: string | null;
  partNumber?: string | null;
  boothName?: string | null;
  pollingStationName?: string | null;
  mainTown?: string | null;
  postOffice?: string | null;
  policeStation?: string | null;
  block?: string | null;
  subdivision?: string | null;
  district?: string | null;
  pinCode?: string | null;
}

/** Create/update a master booth by its UNIQUE_CODE. Returns { id, created }. */
export async function upsertMasterBooth(
  db: Db,
  input: MasterBoothInput,
): Promise<{ id: number; created: boolean }> {
  const data = {
    parliamentaryConstituencyId: input.parliamentaryConstituencyId,
    assemblyConstituencyId: input.assemblyConstituencyId ?? null,
    state: input.state ?? null,
    parlNo: input.parlNo ?? null,
    parlName: input.parlName ?? null,
    assemblyNo: input.assemblyNo ?? null,
    assemblyName: input.assemblyName ?? null,
    partNumber: input.partNumber ?? null,
    boothName: input.boothName ?? null,
    pollingStationName: input.pollingStationName ?? null,
    // `name` mirrors the booth name so existing analytics reads keep working.
    name: input.boothName || input.pollingStationName || null,
    mainTown: input.mainTown ?? null,
    postOffice: input.postOffice ?? null,
    policeStation: input.policeStation ?? null,
    block: input.block ?? null,
    subdivision: input.subdivision ?? null,
    district: input.district ?? null,
    pinCode: input.pinCode ?? null,
  };
  const existing = await db.pollingStation.findUnique({ where: { code: input.code }, select: { id: true } });
  const row = await db.pollingStation.upsert({
    where: { code: input.code },
    create: { code: input.code, ...data },
    update: data,
    select: { id: true },
  });
  return { id: row.id, created: !existing };
}

export interface ResolvedBooth {
  id: number;
  assemblyNo: string | null;
  assemblyName: string | null;
  parlNo: string | null;
  parlName: string | null;
  // Booth/area geography a voter inherits (the roll no longer carries these).
  partNumber: string | null;
  mainTown: string | null;
  ward: string | null;
  postOffice: string | null;
  policeStation: string | null;
  block: string | null;
  subdivision: string | null;
  district: string | null;
  pinCode: string | null;
}

/** Look up master booths by UNIQUE_CODE. Returns a Map code → booth (missing
 *  codes are simply absent from the map). Codes are matched case-sensitively. */
export async function resolveBoothsByCode(
  db: Db,
  codes: string[],
): Promise<Map<string, ResolvedBooth>> {
  const unique = [...new Set(codes.filter((c) => c && c.trim()))];
  if (unique.length === 0) return new Map();
  const rows = await db.pollingStation.findMany({
    where: { code: { in: unique } },
    select: {
      id: true, code: true, assemblyNo: true, assemblyName: true, parlNo: true, parlName: true,
      partNumber: true, mainTown: true, ward: true, postOffice: true, policeStation: true,
      block: true, subdivision: true, district: true, pinCode: true,
    },
  });
  return new Map(rows.map((r) => [r.code, r]));
}

// ─── Per-election Booth join (upsert by [electionId, pollingStationId]) ─────
/** Upsert the per-election booth for a master booth; returns its id. */
export async function upsertBooth(
  db: Db,
  args: {
    electionId: number;
    pollingStationId: number;
    serial?: number;
    name?: string | null;
    rejectedVotes?: number;
    notaVotes?: number;
    tenderedVotes?: number;
  },
): Promise<number> {
  const tallies = {
    rejectedVotes: args.rejectedVotes ?? 0,
    notaVotes: args.notaVotes ?? 0,
    tenderedVotes: args.tenderedVotes ?? 0,
  };
  const booth = await db.booth.upsert({
    where: { electionId_pollingStationId: { electionId: args.electionId, pollingStationId: args.pollingStationId } },
    create: {
      electionId: args.electionId,
      pollingStationId: args.pollingStationId,
      serial: args.serial ?? 0,
      name: args.name ?? undefined,
      ...tallies,
    },
    update: {
      serial: args.serial ?? undefined,
      name: args.name ?? undefined,
      ...tallies,
    },
    select: { id: true },
  });
  return booth.id;
}

// ─── Form 20 grid (batched) ────────────────────────────────────────────────
export interface BoothGridRow {
  pollingStationId: number;
  serial?: number;
  rejectedVotes?: number;
  notaVotes?: number;
  tenderedVotes?: number;
  votes: Array<{ candidateId: number; votes: number }>;
}

/**
 * Upsert a whole Form 20 grid — the per-election Booth rows plus their vote
 * results — in a FIXED number of queries (3), not 3 per row.
 *
 * The obvious per-row loop (upsertBooth → deleteMany → createMany) costs three
 * round trips per booth; against a remote Neon pooler that is ~115 round trips
 * for a 46-booth sheet and blows Prisma's 5 s interactive-transaction timeout
 * (P2028). The booth upsert has to be raw SQL because Prisma has no batched
 * upsert — `updatedAt` is `@updatedAt` (NOT NULL, no DB default), so raw
 * inserts must set it explicitly.
 *
 * Booths are UPSERTED, never deleted — deleting them would cascade-remove the
 * BoothVoter roll mappings. Duplicate codes in one sheet are collapsed to the
 * last occurrence (matching the old sequential-overwrite behaviour, and
 * required because ON CONFLICT cannot touch the same row twice).
 *
 * Returns the number of booths written.
 */
export async function replaceBoothGrid(
  db: Db,
  electionId: number,
  rows: BoothGridRow[],
): Promise<number> {
  const byPs = new Map<number, BoothGridRow>();
  for (const r of rows) byPs.set(r.pollingStationId, r);
  const deduped = [...byPs.values()];
  if (deduped.length === 0) return 0;

  const values = deduped.map(
    (r) => Prisma.sql`(${electionId}, ${r.pollingStationId}, ${r.serial ?? 0}, ${
      r.rejectedVotes ?? 0
    }, ${r.notaVotes ?? 0}, ${r.tenderedVotes ?? 0}, NOW())`,
  );
  const booths = await db.$queryRaw<Array<{ id: number; pollingStationId: number }>>(Prisma.sql`
    INSERT INTO "Booth" ("electionId","pollingStationId","serial","rejectedVotes","notaVotes","tenderedVotes","updatedAt")
    VALUES ${Prisma.join(values)}
    ON CONFLICT ("electionId","pollingStationId") DO UPDATE SET
      "serial"        = EXCLUDED."serial",
      "rejectedVotes" = EXCLUDED."rejectedVotes",
      "notaVotes"     = EXCLUDED."notaVotes",
      "tenderedVotes" = EXCLUDED."tenderedVotes",
      "updatedAt"     = NOW()
    RETURNING "id", "pollingStationId"
  `);

  const boothIdByPs = new Map(booths.map((b) => [b.pollingStationId, b.id]));

  // Replace only these booths' results — one deleteMany for the whole grid.
  await db.voteResult.deleteMany({ where: { boothId: { in: booths.map((b) => b.id) } } });

  const data = deduped.flatMap((r) => {
    const boothId = boothIdByPs.get(r.pollingStationId);
    if (!boothId) return [];
    return r.votes.map((v) => ({ boothId, candidateId: v.candidateId, votes: v.votes }));
  });
  if (data.length) await db.voteResult.createMany({ data, skipDuplicates: true });

  return booths.length;
}

export interface RollPosition {
  partNumber?: string | null;
  partName?: string | null;
  partSerial?: string | null;
  houseNumber?: string | null;
  sectionNo?: string | null;
  sectionName?: string | null;
}

/** Upsert the per-election voter↔booth roll entry (unique on electionId+voterId). */
export async function upsertBoothVoter(
  db: Db,
  args: {
    electionId: number;
    boothId: number;
    voterId: number;
    roll?: RollPosition;
    voted?: boolean;
    polledAt?: Date | null;
  },
): Promise<void> {
  const roll = args.roll ?? {};
  const data = {
    boothId: args.boothId,
    partNumber: roll.partNumber ?? undefined,
    partName: roll.partName ?? undefined,
    partSerial: roll.partSerial ?? undefined,
    houseNumber: roll.houseNumber ?? undefined,
    sectionNo: roll.sectionNo ?? undefined,
    sectionName: roll.sectionName ?? undefined,
    voted: args.voted ?? undefined,
    polledAt: args.polledAt ?? undefined,
  };
  await db.boothVoter.upsert({
    where: { electionId_voterId: { electionId: args.electionId, voterId: args.voterId } },
    create: { electionId: args.electionId, voterId: args.voterId, ...data },
    update: data,
  });
}
