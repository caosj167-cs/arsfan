import { TeamDataPage } from "@/components/team-data-page";
import { getFixtureEntries } from "@/lib/queries/fixtureEntries";
import { getStandings } from "@/lib/queries/football";
import { getEntryIdsWithReport } from "@/lib/queries/matchReports";
import { getLeaderboardsWithRealStats } from "@/lib/queries/players";

export const dynamic = "force-dynamic";

type TeamLike = { name: string; shortName: string | null; crest: string | null };

/**
 * 对手队徽兜底：合并赛程多数已带 opponentCrest，缺失时用 football-data 球队表按名匹配补。
 */
function buildCrestMap(...groups: TeamLike[][]): Record<string, string> {
  const map: Record<string, string> = {};
  const add = (team: TeamLike) => {
    if (!team.crest) return;
    const keys = [team.name, team.shortName ?? "", team.name.replace(/\s+(FC|AFC|CF|SC|AC|City FC)$/i, "").trim()];
    for (const key of keys) {
      if (key) map[key] = team.crest as string;
    }
  };
  for (const group of groups) for (const team of group) add(team);
  return map;
}

export default async function TeamDataRoute() {
  const [entriesResult, standingsResult] = await Promise.all([getFixtureEntries(), getStandings()]);

  const crestMap = buildCrestMap(standingsResult.standings.map((row) => row.team));

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
