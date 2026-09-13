import { NextRequest } from "next/server";

import { getNewsBySlug } from "@/lib/queries/news";
import { apiError, apiJson, ApiErrorCode } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, context: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await context.params;
  // Guardian 内容 id 含斜杠，用 catch-all 捕获后拼接还原
  const id = Array.isArray(slug) ? slug.join("/") : slug;

  if (!id) {
    return apiError(ApiErrorCode.INVALID_QUERY, "News slug is required", 400);
  }

  const article = await getNewsBySlug(id);
  if (!article) {
    return apiError(ApiErrorCode.NEWS_NOT_FOUND, "News article not found", 404, { source: "aggregated" });
  }

  return apiJson(article, {
    source: article.source,
    lastUpdatedAt: article.fetchedAt,
    cached: article.fromCache,
  });
}
