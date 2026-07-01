-- AlterTable
ALTER TABLE "Household" ADD COLUMN     "assemblyNo" TEXT,
ADD COLUMN     "headVoterId" INTEGER,
ADD COLUMN     "houseNumber" TEXT,
ADD COLUMN     "size" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Voter" ADD COLUMN     "block" TEXT,
ADD COLUMN     "communityConfidence" DOUBLE PRECISION,
ADD COLUMN     "communitySource" TEXT NOT NULL DEFAULT 'inferred',
ADD COLUMN     "district" TEXT,
ADD COLUMN     "fullName" TEXT,
ADD COLUMN     "houseNumber" TEXT,
ADD COLUMN     "mainTown" TEXT,
ADD COLUMN     "mandal" TEXT,
ADD COLUMN     "panchayat" TEXT,
ADD COLUMN     "pinCode" TEXT,
ADD COLUMN     "policeStation" TEXT,
ADD COLUMN     "pollingStationAddress" TEXT,
ADD COLUMN     "postOffice" TEXT,
ADD COLUMN     "relationType" TEXT,
ADD COLUMN     "relativeName" TEXT,
ADD COLUMN     "revenueDivision" TEXT,
ADD COLUMN     "sectionName" TEXT,
ADD COLUMN     "sectionNo" TEXT,
ADD COLUMN     "subdivision" TEXT,
ADD COLUMN     "tehsil" TEXT,
ADD COLUMN     "ward" TEXT;

-- CreateIndex
CREATE INDEX "Household_assemblyNo_partNumber_houseNumber_idx" ON "Household"("assemblyNo", "partNumber", "houseNumber");

-- CreateIndex
CREATE INDEX "Voter_ward_idx" ON "Voter"("ward");

-- CreateIndex
CREATE INDEX "Voter_panchayat_idx" ON "Voter"("panchayat");

-- CreateIndex
CREATE INDEX "Voter_block_idx" ON "Voter"("block");

-- CreateIndex
CREATE INDEX "Voter_tehsil_idx" ON "Voter"("tehsil");

-- CreateIndex
CREATE INDEX "Voter_district_idx" ON "Voter"("district");

-- CreateIndex
CREATE INDEX "Voter_assemblyNo_partNumber_houseNumber_idx" ON "Voter"("assemblyNo", "partNumber", "houseNumber");

