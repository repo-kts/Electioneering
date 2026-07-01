-- AlterTable
ALTER TABLE "Voter" ADD COLUMN     "religion" TEXT;

-- CreateIndex
CREATE INDEX "Voter_religion_idx" ON "Voter"("religion");

