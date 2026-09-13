import { prisma } from "@/lib/prisma";
import { fetchGuardianArticle } from "@/lib/providers/guardian";

export type NewsDetail = {
  id: string;
  title: string;
  summary: string | null;
  body: string | null;
  publishedAt: string;
  category: string;
  source: string;
  sourceUrl: string;
  imageUrl: string | null;
  fetchedAt: string | null;
  fromCache: boolean;
};

/**
 * 按 slug 取单篇新闻详情。
 * 1) 优先查 officialNews 表（覆盖 AI 摘要稿 + arsenal.com 官方稿）；
 * 2) 表未命中且 slug 形如 Guardian 内容 id 时，实时拉取 Guardian 单篇（含正文）。
 * 两者皆无返回 null。
 */
export async function getNewsBySlug(slug: string): Promise<NewsDetail | null> {
  const dbRow = await prisma.officialNews.findUnique({ where: { id: slug } });
  if (dbRow) {
    return {
      id: dbRow.id,
      title: dbRow.title,
      summary: dbRow.summary,
      body: null,
      publishedAt: dbRow.publishedAt.toISOString(),
      category: dbRow.category,
      source: dbRow.provider.startsWith("ai-scraper:")
        ? `AI · ${dbRow.provider.replace(/^ai-scraper:/, "")}`
        : dbRow.provider,
      sourceUrl: dbRow.sourceUrl,
      imageUrl: dbRow.imageUrl,
      fetchedAt: dbRow.fetchedAt.toISOString(),
      fromCache: true,
    };
  }

  // 表未命中：尝试 Guardian 实时单篇（slug 即 Guardian 内容 id，可能含斜杠）
  try {
    const live = await fetchGuardianArticle(slug);
    if (live) {
      return { ...live, fetchedAt: new Date().toISOString(), fromCache: false };
    }
  } catch (error) {
    console.error("Guardian single-article fetch failed", error);
  }

  return null;
}
