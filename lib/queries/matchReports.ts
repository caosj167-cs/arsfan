import type { MatchReportPayload } from "@/lib/providers/fotmob";
import { prisma } from "@/lib/prisma";

export type MatchCenterView = {
  entry: {
    id: string;
    kickoffAt: string;
    competition: string;
    homeAway: "HOME" | "AWAY";
    opponentName: string;
    opponentCrest: string | null;
    homeScore: number | null;
    awayScore: number | null;
    verified: boolean;
    sources: string[];
  };
  report: {
    fotmobMatchId: string;
    competition: string;
    round: string | null;
    fetchedAt: string;
    finish: boolean;
    payload: MatchReportPayload;
  } | null;
};

/** 比赛中心：赛程（FixtureEntry）+ 已抓取的比赛报告（MatchReport） */
export async function getMatchCenter(entryId: string): Promise<MatchCenterView | null> {
  const entry = await prisma.fixtureEntry.findUnique({ where: { id: entryId } });
  if (!entry) return null;

  const report = await prisma.matchReport.findFirst({ where: { fixtureEntryId: entry.id } });

  return {
    entry: {
      id: entry.id,
      kickoffAt: entry.kickoffAt.toISOString(),
      competition: entry.competition,
      homeAway: entry.homeAway === "HOME" ? "HOME" : "AWAY",
      opponentName: entry.opponentName,
      opponentCrest: entry.opponentCrest,
      homeScore: entry.homeScore,
      awayScore: entry.awayScore,
      verified: entry.verified,
      sources: entry.sources,
    },
    report: report
      ? {
          fotmobMatchId: report.fotmobMatchId,
          competition: report.competition,
          round: report.round,
          fetchedAt: report.fetchedAt.toISOString(),
          finish: report.finished,
          payload: report.payload as unknown as MatchReportPayload,
        }
      : null,
  };
}

/** 有比赛报告的赛程 id 集合（用于前端决定哪些行可点击进入比赛中心） */
export async function getEntryIdsWithReport(season: number): Promise<string[]> {
  const rows = await prisma.matchReport.findMany({
    where: { season, fixtureEntryId: { not: null } },
    select: { fixtureEntryId: true },
  });
  return rows.map((row) => row.fixtureEntryId!).filter(Boolean);
}
