import { fetchGuardianNews, type NewsArticle } from "@/lib/providers/guardian";
import { getStandings, type FixtureView, type FixtureStatusValue } from "@/lib/queries/football";
import { getFixtureEntries, type FixtureEntryView } from "@/lib/queries/fixtureEntries";
import { getAiNews } from "@/lib/queries/official";

const ARSENAL_TEAM_ID = "57";
const ARSENAL_CREST = "https://crests.football-data.org/57.png";

/**
 * 把合并后的 FixtureEntry 映射成 home-dashboard 已消费的 FixtureView。
 * 这样首页「下一场 / 近期战绩」与球队数据页读同一份三源合并数据，
 * 欧战 / 杯赛的下一场也会出现在首页（此前首页只读 football-data 的英超 Fixture）。
 */
function entryToFixtureView(e: FixtureEntryView): FixtureView {
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

export type HomeNewsItem = {
  id: string;
  title: string;
  summary: string | null;
  publishedAt: string;
  sourceUrl: string;
  sourceLabel: string;
  isAi: boolean;
  fetchedAt?: string | null;
  imageUrl?: string | null;
};

export type HomeNewsFeed = {
  items: HomeNewsItem[];
  guardianCount: number;
  aiCount: number;
  lastFetchedAt: string | null;
};

function mapGuardian(articles: NewsArticle[]): HomeNewsItem[] {
  return articles.map((a) => ({
    id: a.id,
    title: a.title,
    summary: a.summary,
    publishedAt: a.publishedAt,
    sourceUrl: a.sourceUrl,
    sourceLabel: "The Guardian",
    isAi: false,
    imageUrl: a.imageUrl,
  }));
}

function mapAi(
  rows: Array<{ id: string; title: string; summary: string | null; publishedAt: string; sourceUrl: string; source: string; fetchedAt: string; imageUrl: string | null }>,
): HomeNewsItem[] {
  return rows.map((a) => ({
    id: a.id,
    title: a.title,
    summary: a.summary,
    publishedAt: a.publishedAt,
    sourceUrl: a.sourceUrl,
    sourceLabel: `AI · ${a.source.replace(/^ai-scraper:/, "")}`,
    isAi: true,
    fetchedAt: a.fetchedAt,
    imageUrl: a.imageUrl,
  }));
}

export async function getHomeData() {
  const [fixturesResult, standingsResult, newsResult, aiResult] = await Promise.allSettled([
    getFixtureEntries().then((r) => ({
      fixtures: r.entries.map(entryToFixtureView),
      lastUpdatedAt: r.lastUpdatedAt,
    })),
    getStandings(),
    fetchGuardianNews({ pageSize: 6 }),
    getAiNews({ pageSize: 8 }),
  ]);

  const fixtures = fixturesResult.status === "fulfilled" ? fixturesResult.value.fixtures : [];
  const standings = standingsResult.status === "fulfilled" ? standingsResult.value.standings : [];
  const guardian = newsResult.status === "fulfilled" ? newsResult.value.articles : [];
  const ai = aiResult.status === "fulfilled" ? aiResult.value.articles : [];

  const guardianItems = mapGuardian(guardian);
  const aiItems = mapAi(ai);
  const items = [...guardianItems, ...aiItems]
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, 8);

  const news: HomeNewsFeed = {
    items,
    guardianCount: guardianItems.length,
    aiCount: aiItems.length,
    lastFetchedAt: aiResult.status === "fulfilled" ? aiResult.value.lastFetchedAt : null,
  };

  const standingsLastUpdated =
    standingsResult.status === "fulfilled" ? standingsResult.value.lastUpdatedAt : null;
  const fixturesLastUpdated =
    fixturesResult.status === "fulfilled" ? fixturesResult.value.lastUpdatedAt : null;

  return {
    fixtures,
    standings,
    news,
    lastUpdatedAt: standingsLastUpdated ?? fixturesLastUpdated,
    dataUnavailable:
      fixturesResult.status === "rejected" || standingsResult.status === "rejected" || newsResult.status === "rejected",
  };
}
