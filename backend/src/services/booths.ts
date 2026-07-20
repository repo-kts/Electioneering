// Helpers for the three-layer PollingStation → Booth → BoothVoter model.
//
// A physical PollingStation (building) is deduped across elections by its
// in-house `code`. A Booth is the per-election polling booth (Form 20 row) at
// that building. A BoothVoter is the per-election roll entry placing a Voter
// (mapped by stable EPIC) on a booth, carrying roll position + turnout +
// predicted leaning.

import type { Prisma, PrismaClient } from '@prisma/client';
import { pollingStationCode } from '../lib/pollingStationCode.js';

// Accepts either the base client or a transaction client.
type Db = PrismaClient | Prisma.TransactionClient;

export interface StationInput {
  assemblyNo?: string | null;
  assemblyName?: string | null;
  name?: string | null;
  address?: string | null;
  cityVillage?: string | null;
  ward?: string | null;
  tolaMohalla?: string | null;
  postOffice?: string | null;
  policeStation?: string | null;
}

/** Upsert the physical building by its deterministic code; returns its id. */
export async function upsertPollingStation(
  db: Db,
  input: StationInput,
  fallbackSerial?: number,
): Promise<number> {
  const code = pollingStationCode(input.assemblyNo, input.name, fallbackSerial);
  const data = {
    name: input.name ?? undefined,
    address: input.address ?? undefined,
    cityVillage: input.cityVillage ?? undefined,
    ward: input.ward ?? undefined,
    tolaMohalla: input.tolaMohalla ?? undefined,
    postOffice: input.postOffice ?? undefined,
    policeStation: input.policeStation ?? undefined,
    assemblyNo: input.assemblyNo ?? undefined,
    assemblyName: input.assemblyName ?? undefined,
  };
  const ps = await db.pollingStation.upsert({
    where: { code },
    create: { code, ...data },
    // Only backfill missing fields — don't clobber a geocoded/richer row with blanks.
    update: data,
    select: { id: true },
  });
  return ps.id;
}

/** Upsert the per-election booth by (electionId, serial); returns its id. */
export async function upsertBooth(
  db: Db,
  args: {
    electionId: number;
    pollingStationId: number;
    serial: number;
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
    where: { electionId_serial: { electionId: args.electionId, serial: args.serial } },
    create: {
      electionId: args.electionId,
      pollingStationId: args.pollingStationId,
      serial: args.serial,
      name: args.name ?? undefined,
      ...tallies,
    },
    update: {
      pollingStationId: args.pollingStationId,
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
