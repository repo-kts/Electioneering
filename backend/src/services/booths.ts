// Helpers for the MASTER-BOOTH model.
//
// PollingStation is the master booth: one stable row per physical booth, keyed
// by an operator-assigned, immutable, globally-unique UNIQUE_CODE (`code`).
// Importers (voter roll, Form 20) NEVER create master booths — they resolve one
// by `code` and reject unknown codes. A Booth is the per-election join (Election
// × master booth); a BoothVoter is the per-election roll entry.

import type { Prisma, PrismaClient } from '@prisma/client';

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
