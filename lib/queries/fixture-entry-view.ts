// 把合并后的 FixtureEntry 映射成 home-dashboard 已消费的 FixtureView。
//
// 这样首页「下一场 / 近期战绩」与球队数据页读同一份三源合并数据，
// 欧战 / 杯赛的下一场也会出现在首页（此前首页只读 football-data 的英超 Fixture）。
//
// 仅依赖类型（import type 在运行期被擦除，不引入 prisma / 网络），便于单测。

import type { FixtureEntryView } from "@/lib/queries/fixtureEntries";
import type { FixtureView, FixtureStatusValue } from "@/lib/queries/football";

const ARSENAL_TEAM_ID = "57";
const ARSENAL_CREST = "https://crests.football-data.org/57.png";

export function entryToFixtureView(e: FixtureEntryView): FixtureView {
  const arsenalHome = e.homeAway === "HOME";
  const arsenal = {
    id: ARSENAL_TEAM_ID,
    providerTeamId: ARSENAL_TEAM_ID,
    name: "Arsenal",
    shortName: "Arsenal",
    crest: ARSENAL_CREST,
  };
  const opponent = {
    id: e.id,
    providerTeamId: e.opponentName,
    name: e.opponentName,
    shortName: null,
    crest: e.opponentCrest,
  };
  return {
    id: e.id,
    providerMatchId: e.id,
    kickoffAt: e.kickoffAt,
    status: e.status as FixtureStatusValue,
    matchday: null,
    homeTeam: arsenalHome ? arsenal : opponent,
    awayTeam: arsenalHome ? opponent : arsenal,
    score: { home: e.homeScore, away: e.awayScore, halfTimeHome: null, halfTimeAway: null },
    competition: { name: e.competition, code: e.competitionCode },
  };
}
