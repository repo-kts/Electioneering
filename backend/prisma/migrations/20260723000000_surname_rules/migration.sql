-- Surname → caste/category/religion mapping rules (admin-managed, seeds blank
-- voter cells at import by last-name match).
CREATE TABLE "SurnameRule" (
    "id" SERIAL NOT NULL,
    "surname" TEXT NOT NULL,
    "caste" TEXT,
    "category" TEXT,
    "religion" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SurnameRule_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SurnameRule_surname_key" ON "SurnameRule"("surname");
CREATE INDEX "SurnameRule_active_idx" ON "SurnameRule"("active");
