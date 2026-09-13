import { getHomeData } from "@/lib/queries/home";
import type { FixtureView, StandingView } from "@/lib/queries/football";
import type { HomeNewsItem } from "@/lib/queries/home";

const FINISHED = "FINISHED";
const NON_RESULT_STATUSES = new Set(["CANCELLED", "POSTPONED", "AWARDED"]);

export type OverviewData = {
  nextMatch: FixtureView | null;
  recentForm: FixtureView[];
  standingsTop: StandingView[];
  arsenalPosition: number | null;
  latestNews: HomeNewsItem[];
  lastUpdatedAt: string | null;
};

/**
 * 首页概览聚合：下一场 + 近期战绩(近5) + 积分榜前5 + 最新新闻(前5)。
 * 复用 getHomeData 的并发拉取结果做整形，避免重复 DB 调用。
 */
export async function getOverviewData(): Promise<OverviewData> {
  const home = await getHomeData();

  const now = Date.now();
  const upcoming = home.fixtures
    .filter((f) => {
      if (f.status === FINISHED || NON_RESULT_STATUSES.has(f.status)) return false;
      // 进行中/暂停的比赛直接算“下一场”（实时性）
      if (f.status === "IN_PLAY" || f.status === "PAUSED") return true;
      // 其余按开赛时间是否在未来判断，避免未同步的过去比赛被误判为下一场
      return new Date(f.kickoffAt).getTime() >= now;
    })
    .sort((a, b) => new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime());
  const nextMatch = upcoming[0] ?? null;

  const recentForm = home.fixtures
    .filter((f) => f.status === FINISHED)
    .sort((a, b) => new Date(b.kickoffAt).getTime() - new Date(a.kickoffAt).getTime())
    .slice(0, 5);

  const standingsTop = home.standings.slice(0, 5);
  const arsenalRow = home.standings.find((s) => s.team.name.includes("Arsenal")) ?? null;

  return {
    nextMatch,
    recentForm,
    standingsTop,
    arsenalPosition: arsenalRow ? arsenalRow.position : null,
    latestNews: home.news.items.slice(0, 5),
    lastUpdatedAt: home.lastUpdatedAt ?? null,
  };
}
