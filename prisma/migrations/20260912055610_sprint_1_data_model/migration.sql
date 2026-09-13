-- CreateEnum
CREATE TYPE "FixtureStatus" AS ENUM ('SCHEDULED', 'TIMED', 'IN_PLAY', 'PAUSED', 'FINISHED', 'SUSPENDED', 'POSTPONED', 'CANCELLED', 'AWARDED');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerTeamId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "tla" TEXT,
    "crest" TEXT,
    "address" TEXT,
    "website" TEXT,
    "founded" INTEGER,
    "clubColors" TEXT,
    "venue" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Competition" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerCompetitionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "type" TEXT,
    "emblem" TEXT,
    "plan" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Competition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Season" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "providerSeasonId" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "current" BOOLEAN NOT NULL DEFAULT false,
    "currentMatchday" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Season_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fixture" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerMatchId" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "seasonId" TEXT,
    "utcDate" TIMESTAMP(3) NOT NULL,
    "status" "FixtureStatus" NOT NULL,
    "matchday" INTEGER,
    "stage" TEXT,
    "group" TEXT,
    "winner" TEXT,
    "duration" TEXT,
    "homeTeamId" TEXT NOT NULL,
    "awayTeamId" TEXT NOT NULL,
    "homeScore" INTEGER,
    "awayScore" INTEGER,
    "halfTimeHomeScore" INTEGER,
    "halfTimeAwayScore" INTEGER,
    "extraTimeHomeScore" INTEGER,
    "extraTimeAwayScore" INTEGER,
    "penaltiesHomeScore" INTEGER,
    "penaltiesAwayScore" INTEGER,
    "lastUpdated" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Fixture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StandingEntry" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "playedGames" INTEGER NOT NULL,
    "won" INTEGER NOT NULL,
    "drawn" INTEGER NOT NULL,
    "lost" INTEGER NOT NULL,
    "points" INTEGER NOT NULL,
    "goalsFor" INTEGER NOT NULL,
    "goalsAgainst" INTEGER NOT NULL,
    "goalDifference" INTEGER NOT NULL,
    "form" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StandingEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncRun" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "status" "SyncStatus" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "fetchedCount" INTEGER NOT NULL DEFAULT 0,
    "upsertedCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "metadata" JSONB,

    CONSTRAINT "SyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Team_name_idx" ON "Team"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Team_provider_providerTeamId_key" ON "Team"("provider", "providerTeamId");

-- CreateIndex
CREATE INDEX "Competition_code_idx" ON "Competition"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Competition_provider_providerCompetitionId_key" ON "Competition"("provider", "providerCompetitionId");

-- CreateIndex
CREATE INDEX "Season_competitionId_current_idx" ON "Season"("competitionId", "current");

-- CreateIndex
CREATE UNIQUE INDEX "Season_competitionId_providerSeasonId_key" ON "Season"("competitionId", "providerSeasonId");

-- CreateIndex
CREATE INDEX "Fixture_utcDate_idx" ON "Fixture"("utcDate");

-- CreateIndex
CREATE INDEX "Fixture_competitionId_seasonId_utcDate_idx" ON "Fixture"("competitionId", "seasonId", "utcDate");

-- CreateIndex
CREATE INDEX "Fixture_homeTeamId_utcDate_idx" ON "Fixture"("homeTeamId", "utcDate");

-- CreateIndex
CREATE INDEX "Fixture_awayTeamId_utcDate_idx" ON "Fixture"("awayTeamId", "utcDate");

-- CreateIndex
CREATE UNIQUE INDEX "Fixture_provider_providerMatchId_key" ON "Fixture"("provider", "providerMatchId");

-- CreateIndex
CREATE INDEX "StandingEntry_seasonId_position_idx" ON "StandingEntry"("seasonId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "StandingEntry_seasonId_teamId_key" ON "StandingEntry"("seasonId", "teamId");

-- CreateIndex
CREATE INDEX "SyncRun_provider_scope_startedAt_idx" ON "SyncRun"("provider", "scope", "startedAt");

-- AddForeignKey
ALTER TABLE "Season" ADD CONSTRAINT "Season_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fixture" ADD CONSTRAINT "Fixture_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fixture" ADD CONSTRAINT "Fixture_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fixture" ADD CONSTRAINT "Fixture_homeTeamId_fkey" FOREIGN KEY ("homeTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fixture" ADD CONSTRAINT "Fixture_awayTeamId_fkey" FOREIGN KEY ("awayTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StandingEntry" ADD CONSTRAINT "StandingEntry_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StandingEntry" ADD CONSTRAINT "StandingEntry_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
