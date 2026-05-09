-- ─── Election: add electionYear, recompose unique ────────────────────────
ALTER TABLE "Election" ADD COLUMN "electionYear" INTEGER;
UPDATE "Election" SET "electionYear" = EXTRACT(YEAR FROM "createdAt")::int WHERE "electionYear" IS NULL;
-- keep NULL allowed; electionYear becomes part of the composite unique (NULLs treated distinct)
DROP INDEX IF EXISTS "Election_assemblyNo_assemblyName_key";
CREATE UNIQUE INDEX "Election_assemblyNo_assemblyName_electionYear_key"
  ON "Election" ("assemblyNo", "assemblyName", "electionYear");

-- ─── Household ───────────────────────────────────────────────────────────
CREATE TABLE "Household" (
    "id" SERIAL NOT NULL,
    "headName" TEXT,
    "address" TEXT,
    "partNumber" TEXT,
    "pollingStationId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Household_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Household_partNumber_idx" ON "Household" ("partNumber");
CREATE INDEX "Household_pollingStationId_idx" ON "Household" ("pollingStationId");
ALTER TABLE "Household"
  ADD CONSTRAINT "Household_pollingStationId_fkey"
  FOREIGN KEY ("pollingStationId") REFERENCES "PollingStation" ("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── Voter: segmentation fields, predictedLeaning, householdId ──────────
ALTER TABLE "Voter"
  ADD COLUMN "community" TEXT,
  ADD COLUMN "religion" TEXT,
  ADD COLUMN "occupation" TEXT,
  ADD COLUMN "language" TEXT,
  ADD COLUMN "householdId" INTEGER,
  ADD COLUMN "predictedLeaning" JSONB,
  ADD COLUMN "predictedAt" TIMESTAMP(3);

CREATE INDEX "Voter_community_idx" ON "Voter" ("community");
CREATE INDEX "Voter_religion_idx" ON "Voter" ("religion");
CREATE INDEX "Voter_occupation_idx" ON "Voter" ("occupation");
CREATE INDEX "Voter_householdId_idx" ON "Voter" ("householdId");

ALTER TABLE "Voter"
  ADD CONSTRAINT "Voter_householdId_fkey"
  FOREIGN KEY ("householdId") REFERENCES "Household" ("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── VoterTurnout (per voter × election) ─────────────────────────────────
CREATE TABLE "VoterTurnout" (
    "id" SERIAL NOT NULL,
    "voterId" INTEGER NOT NULL,
    "electionId" INTEGER NOT NULL,
    "voted" BOOLEAN NOT NULL DEFAULT false,
    "polledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VoterTurnout_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "VoterTurnout_voterId_electionId_key"
  ON "VoterTurnout" ("voterId", "electionId");
CREATE INDEX "VoterTurnout_electionId_idx" ON "VoterTurnout" ("electionId");
ALTER TABLE "VoterTurnout"
  ADD CONSTRAINT "VoterTurnout_voterId_fkey"
  FOREIGN KEY ("voterId") REFERENCES "Voter" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VoterTurnout"
  ADD CONSTRAINT "VoterTurnout_electionId_fkey"
  FOREIGN KEY ("electionId") REFERENCES "Election" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: copy each Voter.pollingDate into a VoterTurnout row,
-- joined to the matching Election by (assemblyNo, assemblyName).
INSERT INTO "VoterTurnout" ("voterId", "electionId", "voted", "polledAt", "createdAt")
SELECT v."id", e."id", TRUE, v."pollingDate", NOW()
FROM "Voter" v
JOIN "Election" e
  ON e."assemblyNo" = v."assemblyNo" AND e."assemblyName" = v."assemblyName"
WHERE v."pollingDate" IS NOT NULL;

-- Drop legacy column
ALTER TABLE "Voter" DROP COLUMN IF EXISTS "pollingDate";

-- ─── Cohort (saved filter) ───────────────────────────────────────────────
CREATE TABLE "Cohort" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "criteria" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Cohort_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Cohort_createdAt_idx" ON "Cohort" ("createdAt");
