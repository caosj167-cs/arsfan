import { z } from "zod";

const guardianArticleSchema = z.object({
  id: z.string(),
  type: z.string(),
  sectionId: z.string().optional(),
  sectionName: z.string().optional(),
  webPublicationDate: z.string(),
  webTitle: z.string(),
  webUrl: z.string().url(),
  fields: z
    .object({
      trailText: z.string().optional(),
      thumbnail: z.string().url().optional(),
    })
    .optional(),
});

const guardianResponseSchema = z.object({
  response: z.object({
    status: z.literal("ok"),
    total: z.number(),
    currentPage: z.number(),
    pages: z.number(),
    pageSize: z.number(),
    results: z.array(guardianArticleSchema),
  }),
});

export type NewsCategory = "all" | "official" | "matchday" | "squad" | "opinion";

export type NewsArticle = {
  id: string;
  title: string;
  summary: string | null;
  publishedAt: string;
  source: "The Guardian";
  sourceUrl: string;
  imageUrl: string | null;
  category: NewsCategory;
};

export type GuardianNewsResult = {
  articles: NewsArticle[];
  page: number;
  pageSize: number;
  total: number;
  pages: number;
  lastUpdatedAt: string;
};

const GUARDIAN_ENDPOINT = "https://content.guardianapis.com/search";

function categoryQuery(category?: NewsCategory): string {
  switch (category) {
    case "matchday":
      return "match report OR fixture OR matchday";
    case "squad":
      return "player OR squad OR injury";
    case "opinion":
      return "opinion OR analysis";
    case "official":
      return "Arsenal official";
    default:
      return "";
  }
}

function mapCategory(sectionId?: string): NewsCategory {
  if (sectionId === "football/matchreports" || sectionId === "football/live") {
    return "matchday";
  }

  if (sectionId === "football/arsenal") {
    return "official";
  }

  return "all";
}

export function stripMarkup(value: string): string {
  return value.replace(/<[^>]*>/g, "").replace(/&[^;]+;/g, " ").trim();
}

export async function fetchGuardianNews(options: {
  query?: string;
  category?: NewsCategory;
  page?: number;
  pageSize?: number;
} = {}): Promise<GuardianNewsResult> {
  const apiKey = process.env.NEWS_API_KEY;
  if (!apiKey) {
    throw new Error("NEWS_API_KEY is not configured");
  }

  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, options.pageSize ?? 10));
  const categoryTerms = categoryQuery(options.category);
  const query = [options.query?.trim() || "Arsenal", categoryTerms]
    .filter(Boolean)
    .join(" ");
  const params = new URLSearchParams({
    "api-key": apiKey,
    q: query,
    section: "football",
    "order-by": "newest",
    page: String(page),
    "page-size": String(pageSize),
    "show-fields": "trailText,thumbnail",
  });

  const response = await fetch(`${GUARDIAN_ENDPOINT}?${params.toString()}`, {
    headers: { Accept: "application/json" },
    next: { revalidate: 900 },
  });

  if (!response.ok) {
    throw new Error(`Guardian API request failed with HTTP ${response.status}`);
  }

  const payload = guardianResponseSchema.parse(await response.json());
  const guardian = payload.response;

  return {
    articles: guardian.results.map((article) => ({
      id: article.id,
      title: article.webTitle,
      summary: article.fields?.trailText ? stripMarkup(article.fields.trailText) : null,
      publishedAt: article.webPublicationDate,
      source: "The Guardian",
      sourceUrl: article.webUrl,
      imageUrl: article.fields?.thumbnail ?? null,
      category: mapCategory(article.sectionId),
    })),
    page: guardian.currentPage,
    pageSize: guardian.pageSize,
    total: guardian.total,
    pages: guardian.pages,
    lastUpdatedAt: new Date().toISOString(),
  };
}

/**
 * 按内容 id 拉取单篇 Guardian 文章详情（含正文 body）。
 * 用于 /api/news/[slug] 中 DB 未命中时的实时回填。
 * 失败（无 key / 404 / 解析失败）返回 null，由调用方降级。
 */
export async function fetchGuardianArticle(id: string): Promise<{
  id: string;
  title: string;
  summary: string | null;
  body: string | null;
  publishedAt: string;
  category: NewsCategory;
  source: "The Guardian";
  sourceUrl: string;
  imageUrl: string | null;
} | null> {
  const apiKey = process.env.NEWS_API_KEY;
  if (!apiKey) return null;

  const url = `https://content.guardianapis.com/${id}?api-key=${apiKey}&show-fields=body,trailText,thumbnail`;
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: 1800 },
  });
  if (!response.ok) return null;

  try {
    const payload = await response.json();
    const content = payload?.response?.content;
    if (!content) return null;
    const fields = content.fields ?? {};
    return {
      id: content.id,
      title: content.webTitle,
      summary: fields.trailText ? stripMarkup(fields.trailText) : null,
      body: fields.body ? stripMarkup(fields.body) : null,
      publishedAt: content.webPublicationDate,
      category: "all",
      source: "The Guardian",
      sourceUrl: content.webUrl,
      imageUrl: fields.thumbnail ?? null,
    };
  } catch {
    return null;
  }
}
