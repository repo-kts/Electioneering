-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('Male', 'Female', 'Other');

-- CreateEnum
CREATE TYPE "UploadStatus" AS ENUM ('processing', 'validated', 'failed');

-- CreateEnum
CREATE TYPE "UploadKind" AS ENUM ('voter', 'form20');

-- CreateTable
CREATE TABLE "Election" (
    "id" SERIAL NOT NULL,
    "state" TEXT NOT NULL,
    "parlNo" TEXT NOT NULL,
    "parlName" TEXT NOT NULL,
    "assemblyNo" TEXT NOT NULL,
    "assemblyName" TEXT NOT NULL,
    "electionType" TEXT NOT NULL DEFAULT 'Assembly Election',
    "totalElectors" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Election_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Candidate" (
    "id" SERIAL NOT NULL,
    "electionId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "party" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Candidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PollingStation" (
    "id" SERIAL NOT NULL,
    "electionId" INTEGER NOT NULL,
    "serial" INTEGER NOT NULL,
    "name" TEXT,
    "rejectedVotes" INTEGER NOT NULL DEFAULT 0,
    "notaVotes" INTEGER NOT NULL DEFAULT 0,
    "tenderedVotes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PollingStation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoteResult" (
    "id" SERIAL NOT NULL,
    "pollingStationId" INTEGER NOT NULL,
    "candidateId" INTEGER NOT NULL,
    "votes" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "VoteResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Voter" (
    "id" SERIAL NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "relFirstName" TEXT NOT NULL,
    "relLastName" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "gender" "Gender" NOT NULL,
    "epic" TEXT NOT NULL,
    "mobile" TEXT,
    "state" TEXT NOT NULL,
    "parlNo" TEXT NOT NULL,
    "parlName" TEXT NOT NULL,
    "assemblyNo" TEXT NOT NULL,
    "assemblyName" TEXT NOT NULL,
    "pollingStationName" TEXT NOT NULL,
    "partNumber" TEXT NOT NULL,
    "partName" TEXT,
    "partSerial" TEXT NOT NULL,
    "pollingDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "pollingStationId" INTEGER,

    CONSTRAINT "Voter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UploadHistory" (
    "id" SERIAL NOT NULL,
    "fileName" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "kind" "UploadKind" NOT NULL,
    "records" INTEGER NOT NULL DEFAULT 0,
    "constituency" TEXT,
    "status" "UploadStatus" NOT NULL DEFAULT 'processing',
    "errorMsg" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UploadHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Election_state_idx" ON "Election"("state");

-- CreateIndex
CREATE UNIQUE INDEX "Election_assemblyNo_assemblyName_key" ON "Election"("assemblyNo", "assemblyName");

-- CreateIndex
CREATE INDEX "Candidate_electionId_idx" ON "Candidate"("electionId");

-- CreateIndex
CREATE INDEX "PollingStation_electionId_idx" ON "PollingStation"("electionId");

-- CreateIndex
CREATE UNIQUE INDEX "PollingStation_electionId_serial_key" ON "PollingStation"("electionId", "serial");

-- CreateIndex
CREATE INDEX "VoteResult_candidateId_idx" ON "VoteResult"("candidateId");

-- CreateIndex
CREATE UNIQUE INDEX "VoteResult_pollingStationId_candidateId_key" ON "VoteResult"("pollingStationId", "candidateId");

-- CreateIndex
CREATE UNIQUE INDEX "Voter_epic_key" ON "Voter"("epic");

-- CreateIndex
CREATE INDEX "Voter_assemblyNo_assemblyName_idx" ON "Voter"("assemblyNo", "assemblyName");

-- CreateIndex
CREATE INDEX "Voter_state_idx" ON "Voter"("state");

-- CreateIndex
CREATE INDEX "Voter_epic_idx" ON "Voter"("epic");

-- CreateIndex
CREATE INDEX "UploadHistory_createdAt_idx" ON "UploadHistory"("createdAt");

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "Election"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollingStation" ADD CONSTRAINT "PollingStation_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "Election"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoteResult" ADD CONSTRAINT "VoteResult_pollingStationId_fkey" FOREIGN KEY ("pollingStationId") REFERENCES "PollingStation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoteResult" ADD CONSTRAINT "VoteResult_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Voter" ADD CONSTRAINT "Voter_pollingStationId_fkey" FOREIGN KEY ("pollingStationId") REFERENCES "PollingStation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
