import { seasonStartYear } from "@/lib/data/season";
import { prisma } from "@/lib/prisma";

export type FixtureEntryView = {
  id: string;
  season: number;
  kickoffAt: string;
  competition: string;
  competitionCode: string | null;
  opponentName: string;
  opponentCrest: string | null;
  homeAway: "HOME" | "AWAY";
  status: string;
  homeScore: number | null;
  awayScore: number | null;
  scoreSource: string | null;
  sources: string[];
  verified: boolean;
  primarySource: string;
};

export type FixtureEntriesResult = {
  entries: FixtureEntryView[];
  season: number;
  total: number;
  verified: number;
  lastUpdatedAt: string | null;
};

/** 读取合并后的赛季赛程（FixtureEntry）。默认赛季取 SEASON_START_YEAR（2026）。 */
export async function getFixtureEntries(options: { season?: number } = {}): Promise<FixtureEntriesResult> {
  const season = options.season ?? seasonStartYear();
  const [rows, latest] = await Promise.all([
    prisma.fixtureEntry.findMany({ where: { season }, orderBy: { kickoffAt: "asc" } }),
    prisma.fixtureEntry.findFirst({
      where: { season },
      orderBy: { updatedAt: "desc" },
      select: { updatedAt: true },
    }),
  ]);

  const entries: FixtureEntryView[] = rows.map((row) => ({
    id: row.id,
    season: row.season,
    kickoffAt: row.kickoffAt.toISOString(),
    competition: row.competition,
    competitionCode: row.competitionCode,
    opponentName: row.opponentName,
    opponentCrest: row.opponentCrest,
    homeAway: row.homeAway === "HOME" ? "HOME" : "AWAY",
    status: row.status,
    homeScore: row.homeScore,
    awayScore: row.awayScore,
    scoreSource: row.scoreSource,
    sources: row.sources,
    verified: row.verified,
    primarySource: row.primarySource,
  }));

  return {
    entries,
    season,
    total: entries.length,
    verified: entries.filter((entry) => entry.verified).length,
    lastUpdatedAt: latest?.updatedAt.toISOString() ?? null,
  };
}
