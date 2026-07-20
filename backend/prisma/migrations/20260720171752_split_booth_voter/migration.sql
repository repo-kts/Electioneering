-- DropForeignKey
ALTER TABLE "Household" DROP CONSTRAINT "Household_pollingStationId_fkey";

-- DropForeignKey
ALTER TABLE "PollingStation" DROP CONSTRAINT "PollingStation_electionId_fkey";

-- DropForeignKey
ALTER TABLE "VoteResult" DROP CONSTRAINT "VoteResult_pollingStationId_fkey";

-- DropForeignKey
ALTER TABLE "Voter" DROP CONSTRAINT "Voter_householdId_fkey";

-- DropForeignKey
ALTER TABLE "Voter" DROP CONSTRAINT "Voter_pollingStationId_fkey";

-- DropForeignKey
ALTER TABLE "VoterTurnout" DROP CONSTRAINT "VoterTurnout_electionId_fkey";

-- DropForeignKey
ALTER TABLE "VoterTurnout" DROP CONSTRAINT "VoterTurnout_voterId_fkey";

-- DropIndex
DROP INDEX "Household_pollingStationId_idx";

-- DropIndex
DROP INDEX "PollingStation_electionId_idx";

-- DropIndex
DROP INDEX "PollingStation_electionId_serial_key";

-- DropIndex
DROP INDEX "VoteResult_pollingStationId_candidateId_key";

-- DropIndex
DROP INDEX "Voter_assemblyNo_partNumber_houseNumber_idx";

-- DropIndex
DROP INDEX "Voter_householdId_idx";

-- AlterTable
ALTER TABLE "Household" DROP COLUMN "pollingStationId",
ADD COLUMN     "boothId" INTEGER;

-- AlterTable
ALTER TABLE "PollingStation" DROP COLUMN "electionId",
DROP COLUMN "notaVotes",
DROP COLUMN "rejectedVotes",
DROP COLUMN "serial",
DROP COLUMN "tenderedVotes",
ADD COLUMN     "assemblyName" TEXT,
ADD COLUMN     "assemblyNo" TEXT,
ADD COLUMN     "code" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "VoteResult" DROP COLUMN "pollingStationId",
ADD COLUMN     "boothId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Voter" DROP COLUMN "houseNumber",
DROP COLUMN "householdId",
DROP COLUMN "partName",
DROP COLUMN "partNumber",
DROP COLUMN "partSerial",
DROP COLUMN "pollingStationAddress",
DROP COLUMN "pollingStationId",
DROP COLUMN "pollingStationName",
DROP COLUMN "predictedAt",
DROP COLUMN "predictedLeaning",
DROP COLUMN "sectionName",
DROP COLUMN "sectionNo";

-- DropTable
DROP TABLE "VoterTurnout";

-- CreateTable
CREATE TABLE "Booth" (
    "id" SERIAL NOT NULL,
    "electionId" INTEGER NOT NULL,
    "pollingStationId" INTEGER NOT NULL,
    "serial" INTEGER NOT NULL,
    "name" TEXT,
    "rejectedVotes" INTEGER NOT NULL DEFAULT 0,
    "notaVotes" INTEGER NOT NULL DEFAULT 0,
    "tenderedVotes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Booth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoothVoter" (
    "id" SERIAL NOT NULL,
    "electionId" INTEGER NOT NULL,
    "boothId" INTEGER NOT NULL,
    "voterId" INTEGER NOT NULL,
    "partNumber" TEXT,
    "partName" TEXT,
    "partSerial" TEXT,
    "houseNumber" TEXT,
    "sectionNo" TEXT,
    "sectionName" TEXT,
    "predictedLeaning" JSONB,
    "predictedAt" TIMESTAMP(3),
    "voted" BOOLEAN NOT NULL DEFAULT false,
    "polledAt" TIMESTAMP(3),
    "householdId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BoothVoter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Booth_electionId_idx" ON "Booth"("electionId");

-- CreateIndex
CREATE INDEX "Booth_pollingStationId_idx" ON "Booth"("pollingStationId");

-- CreateIndex
CREATE UNIQUE INDEX "Booth_electionId_serial_key" ON "Booth"("electionId", "serial");

-- CreateIndex
CREATE INDEX "BoothVoter_boothId_idx" ON "BoothVoter"("boothId");

-- CreateIndex
CREATE INDEX "BoothVoter_voterId_idx" ON "BoothVoter"("voterId");

-- CreateIndex
CREATE INDEX "BoothVoter_householdId_idx" ON "BoothVoter"("householdId");

-- CreateIndex
CREATE INDEX "BoothVoter_electionId_voted_idx" ON "BoothVoter"("electionId", "voted");

-- CreateIndex
CREATE UNIQUE INDEX "BoothVoter_electionId_voterId_key" ON "BoothVoter"("electionId", "voterId");

-- CreateIndex
CREATE UNIQUE INDEX "BoothVoter_boothId_voterId_key" ON "BoothVoter"("boothId", "voterId");

-- CreateIndex
CREATE INDEX "Household_boothId_idx" ON "Household"("boothId");

-- CreateIndex
CREATE UNIQUE INDEX "PollingStation_code_key" ON "PollingStation"("code");

-- CreateIndex
CREATE INDEX "PollingStation_assemblyNo_idx" ON "PollingStation"("assemblyNo");

-- CreateIndex
CREATE UNIQUE INDEX "VoteResult_boothId_candidateId_key" ON "VoteResult"("boothId", "candidateId");

-- AddForeignKey
ALTER TABLE "Booth" ADD CONSTRAINT "Booth_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "Election"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booth" ADD CONSTRAINT "Booth_pollingStationId_fkey" FOREIGN KEY ("pollingStationId") REFERENCES "PollingStation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoteResult" ADD CONSTRAINT "VoteResult_boothId_fkey" FOREIGN KEY ("boothId") REFERENCES "Booth"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Household" ADD CONSTRAINT "Household_boothId_fkey" FOREIGN KEY ("boothId") REFERENCES "Booth"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoothVoter" ADD CONSTRAINT "BoothVoter_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "Election"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoothVoter" ADD CONSTRAINT "BoothVoter_boothId_fkey" FOREIGN KEY ("boothId") REFERENCES "Booth"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoothVoter" ADD CONSTRAINT "BoothVoter_voterId_fkey" FOREIGN KEY ("voterId") REFERENCES "Voter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoothVoter" ADD CONSTRAINT "BoothVoter_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE SET NULL ON UPDATE CASCADE;

