import { fetchGuardianNews, type NewsArticle } from "@/lib/providers/guardian";
import { getFixtures, getStandings } from "@/lib/queries/football";
import { getAiNews } from "@/lib/queries/official";

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
    getFixtures({ pageSize: 100 }),
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
