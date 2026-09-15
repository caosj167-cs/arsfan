import { TeamDataPage } from "@/components/team-data-page";
import { getFixtureEntries } from "@/lib/queries/fixtureEntries";
import { getStandings } from "@/lib/queries/football";
import { getEntryIdsWithReport } from "@/lib/queries/matchReports";
import { getLeaderboardsWithRealStats } from "@/lib/queries/players";
import { EXTRA_CREST_BY_OPPONENT_NAME } from "@/lib/data/crests";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "球队数据",
  description: "阿森纳积分榜、赛程与对手队徽，三源合并的权威数据。",
};

export const revalidate = 300;

type TeamLike = { name: string; shortName: string | null; crest: string | null };

/**
 * 对手队徽兜底：合并赛程多数已带 opponentCrest，缺失时用 football-data 球队表按名匹配补。
 *
 * ⚠️ 去后缀的正则里**不能**出现 `City FC` 这类多词分支：正则取最左匹配，
 * "Manchester City FC" 会先匹配到 " City FC" 而被截成 "Manchester"，
 * 于是映射里没有 "Manchester City" 这个键，对手队徽就退化成字母章。
 */
const CLUB_SUFFIX = /\s+(FC|AFC|CF|SC|AC)$/i;

function buildCrestMap(...groups: TeamLike[][]): Record<string, string> {
  const map: Record<string, string> = {};
  const add = (team: TeamLike) => {
    if (!team.crest) return;
    const keys = [team.name, team.shortName ?? "", team.name.replace(CLUB_SUFFIX, "").trim()];
    for (const key of keys) {
      if (key) map[key] = team.crest as string;
    }
  };
  for (const group of groups) for (const team of group) add(team);
  return map;
}

export default async function TeamDataRoute() {
  const [entriesResult, standingsResult] = await Promise.all([getFixtureEntries(), getStandings()]);

  const crestMap = {
    ...buildCrestMap(standingsResult.standings.map((row) => row.team)),
    ...EXTRA_CREST_BY_OPPONENT_NAME,
  };

  const { scorers, assisters, season: leaderboardSeason } = await getLeaderboardsWithRealStats();
  const entryReportIds = await getEntryIdsWithReport(entriesResult.season);

  return (
    <TeamDataPage
      entries={entriesResult.entries}
      entryReportIds={entryReportIds}
      standings={standingsResult.standings}
      lastUpdatedAt={standingsResult.lastUpdatedAt}
      scorers={scorers}
      assisters={assisters}
      leaderboardSeason={leaderboardSeason}
      crestMap={crestMap}
      nowIso={new Date().toISOString()}
    />
  );
}
