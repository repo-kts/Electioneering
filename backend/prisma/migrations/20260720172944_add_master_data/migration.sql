-- CreateTable
CREATE TABLE "Country" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Country_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "State" (
    "id" SERIAL NOT NULL,
    "countryId" INTEGER NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "State_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParliamentaryConstituency" (
    "id" SERIAL NOT NULL,
    "stateId" INTEGER NOT NULL,
    "number" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "seatType" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParliamentaryConstituency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssemblyConstituency" (
    "id" SERIAL NOT NULL,
    "parlId" INTEGER NOT NULL,
    "number" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "seatType" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssemblyConstituency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MasterCategory" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "system" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MasterCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MasterOption" (
    "id" SERIAL NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "code" TEXT,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MasterOption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Country_code_key" ON "Country"("code");

-- CreateIndex
CREATE INDEX "State_countryId_idx" ON "State"("countryId");

-- CreateIndex
CREATE UNIQUE INDEX "State_countryId_name_key" ON "State"("countryId", "name");

-- CreateIndex
CREATE INDEX "ParliamentaryConstituency_stateId_idx" ON "ParliamentaryConstituency"("stateId");

-- CreateIndex
CREATE UNIQUE INDEX "ParliamentaryConstituency_stateId_number_key" ON "ParliamentaryConstituency"("stateId", "number");

-- CreateIndex
CREATE INDEX "AssemblyConstituency_parlId_idx" ON "AssemblyConstituency"("parlId");

-- CreateIndex
CREATE UNIQUE INDEX "AssemblyConstituency_parlId_number_key" ON "AssemblyConstituency"("parlId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "MasterCategory_key_key" ON "MasterCategory"("key");

-- CreateIndex
CREATE INDEX "MasterOption_categoryId_idx" ON "MasterOption"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "MasterOption_categoryId_label_key" ON "MasterOption"("categoryId", "label");

-- AddForeignKey
ALTER TABLE "State" ADD CONSTRAINT "State_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParliamentaryConstituency" ADD CONSTRAINT "ParliamentaryConstituency_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "State"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssemblyConstituency" ADD CONSTRAINT "AssemblyConstituency_parlId_fkey" FOREIGN KEY ("parlId") REFERENCES "ParliamentaryConstituency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterOption" ADD CONSTRAINT "MasterOption_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "MasterCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

