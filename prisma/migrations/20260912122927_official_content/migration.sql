-- CreateTable
CREATE TABLE "OfficialNews" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerRecordId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "category" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "imageUrl" TEXT,
    "summary" TEXT,
    "fetchedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfficialNews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfficialFixture" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerRecordId" TEXT NOT NULL,
    "kickoffAt" TIMESTAMP(3) NOT NULL,
    "opponentName" TEXT NOT NULL,
    "opponentCrest" TEXT,
    "competition" TEXT NOT NULL,
    "homeAway" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "homeScore" INTEGER,
    "awayScore" INTEGER,
    "scoreSource" TEXT,
    "scoreUpdatedAt" TIMESTAMP(3),
    "fetchedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfficialFixture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerProfile" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerRecordId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" TEXT,
    "nationality" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "profileUrl" TEXT NOT NULL,
    "imageUrl" TEXT,
    "fetchedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OfficialNews_publishedAt_idx" ON "OfficialNews"("publishedAt");

-- CreateIndex
CREATE INDEX "OfficialNews_category_publishedAt_idx" ON "OfficialNews"("category", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "OfficialNews_provider_providerRecordId_key" ON "OfficialNews"("provider", "providerRecordId");

-- CreateIndex
CREATE INDEX "OfficialFixture_kickoffAt_idx" ON "OfficialFixture"("kickoffAt");

-- CreateIndex
CREATE UNIQUE INDEX "OfficialFixture_provider_providerRecordId_key" ON "OfficialFixture"("provider", "providerRecordId");

-- CreateIndex
CREATE INDEX "PlayerProfile_name_idx" ON "PlayerProfile"("name");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerProfile_provider_providerRecordId_key" ON "PlayerProfile"("provider", "providerRecordId");
