import { NextRequest } from "next/server";
import { z } from "zod";

import { getCachedNews, newsCacheKey, setCachedNews } from "@/lib/news-cache";
import { fetchGuardianNews } from "@/lib/providers/guardian";
import { apiError, apiJson, ApiErrorCode } from "@/lib/api/respond";

const querySchema = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.enum(["all", "official", "matchday", "squad", "opinion"]).default("all"),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(50).default(10),
});

export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return apiError(ApiErrorCode.INVALID_QUERY, "Invalid news query parameters", 400);
  }

  const cacheKey = newsCacheKey(parsed.data);

  try {
    const news = await fetchGuardianNews(parsed.data);
    setCachedNews(cacheKey, news);
    return apiJson(news.articles, {
      source: "The Guardian",
      lastUpdatedAt: news.lastUpdatedAt,
      page: news.page,
      pageSize: news.pageSize,
      total: news.total,
      pages: news.pages,
    });
  } catch (error) {
    console.error("Guardian news request failed", error);
    const cached = getCachedNews(cacheKey);
    if (cached) {
      return apiJson(
        cached.value.articles,
        {
          source: "The Guardian",
          lastUpdatedAt: cached.value.lastUpdatedAt,
          cachedAt: cached.cachedAt,
          page: cached.value.page,
          pageSize: cached.value.pageSize,
          total: cached.value.total,
          pages: cached.value.pages,
          stale: true,
        },
        { code: ApiErrorCode.STALE_DATA, message: "News provider unavailable; showing the most recent cached data" },
      );
    }

    return apiError(ApiErrorCode.NEWS_PROVIDER_ERROR, "News provider unavailable", 502, { source: "The Guardian" });
  }
}
