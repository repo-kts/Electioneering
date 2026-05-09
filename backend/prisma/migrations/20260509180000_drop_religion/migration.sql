-- Drop religion column + its index
DROP INDEX IF EXISTS "Voter_religion_idx";
ALTER TABLE "Voter" DROP COLUMN IF EXISTS "religion";
