-- Add caste + category; repurpose community as the fixed Gen/OBC/SC/ST class.
ALTER TABLE "Voter" ADD COLUMN "caste" TEXT;
ALTER TABLE "Voter" ADD COLUMN "category" TEXT;

-- Existing `community` held an open-ended caste tag. Move those values into the
-- new `caste` column, then clear `community` so it can hold the fixed
-- reservation class (Gen/OBC/SC/ST) going forward.
UPDATE "Voter" SET "caste" = "community" WHERE "community" IS NOT NULL;
UPDATE "Voter" SET "community" = NULL;

CREATE INDEX "Voter_caste_idx" ON "Voter"("caste");
CREATE INDEX "Voter_category_idx" ON "Voter"("category");
