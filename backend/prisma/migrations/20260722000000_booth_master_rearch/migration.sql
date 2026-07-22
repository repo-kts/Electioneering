-- Booth master re-architecture.
--
-- PollingStation becomes the MASTER BOOTH: one stable row per physical booth,
-- keyed by an operator-assigned, immutable, globally-unique UNIQUE_CODE (`code`),
-- attached to the geography master via real FKs (PC required, AC nullable).
-- The per-election Booth join is re-keyed from [electionId, serial] to
-- [electionId, pollingStationId]; serial becomes per-election metadata.
--
-- CLEAN WIPE: booths, per-election results/rolls and voters are cleared so the
-- data can be re-imported booth-first by UNIQUE_CODE. Elections and all master
-- data (geography, lookup lists) are preserved.

-- 1. Wipe the data pipeline (order-independent via CASCADE).
TRUNCATE TABLE
  "BoothVoter",
  "VoteResult",
  "Household",
  "Booth",
  "Candidate",
  "PollingStation",
  "Voter"
RESTART IDENTITY CASCADE;

-- 2. PollingStation → master booth: geography FKs + attributes.
ALTER TABLE "PollingStation"
  ADD COLUMN "parliamentaryConstituencyId" INTEGER NOT NULL,
  ADD COLUMN "assemblyConstituencyId" INTEGER,
  ADD COLUMN "state" TEXT,
  ADD COLUMN "parlNo" TEXT,
  ADD COLUMN "parlName" TEXT,
  ADD COLUMN "partNumber" TEXT,
  ADD COLUMN "boothName" TEXT,
  ADD COLUMN "pollingStationName" TEXT,
  ADD COLUMN "mainTown" TEXT,
  ADD COLUMN "block" TEXT,
  ADD COLUMN "subdivision" TEXT,
  ADD COLUMN "district" TEXT,
  ADD COLUMN "pinCode" TEXT;

CREATE INDEX "PollingStation_parliamentaryConstituencyId_idx" ON "PollingStation"("parliamentaryConstituencyId");
CREATE INDEX "PollingStation_assemblyConstituencyId_idx" ON "PollingStation"("assemblyConstituencyId");

ALTER TABLE "PollingStation"
  ADD CONSTRAINT "PollingStation_parliamentaryConstituencyId_fkey"
    FOREIGN KEY ("parliamentaryConstituencyId") REFERENCES "ParliamentaryConstituency"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "PollingStation_assemblyConstituencyId_fkey"
    FOREIGN KEY ("assemblyConstituencyId") REFERENCES "AssemblyConstituency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 3. Booth join: re-key identity to [electionId, pollingStationId].
DROP INDEX IF EXISTS "Booth_electionId_serial_key";
ALTER TABLE "Booth" DROP CONSTRAINT IF EXISTS "Booth_electionId_serial_key";
ALTER TABLE "Booth" ALTER COLUMN "serial" SET DEFAULT 0;
CREATE UNIQUE INDEX "Booth_electionId_pollingStationId_key" ON "Booth"("electionId", "pollingStationId");
CREATE INDEX "Booth_electionId_serial_idx" ON "Booth"("electionId", "serial");
