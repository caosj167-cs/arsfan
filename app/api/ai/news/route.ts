import { NextRequest } from "next/server";

import { getAiNews } from "@/lib/queries/official";
import { apiError, apiJson, ApiErrorCode } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const page = Number(searchParams.get("page") ?? "1");
  const pageSize = Number(searchParams.get("pageSize") ?? "20");
  const source = searchParams.get("source") ?? undefined;
  try {
    const result = await getAiNews({ page, pageSize, source });
    return apiJson(result.articles, {
      source: source ? `ai-scraper:${source}` : "ai-scraper",
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      pages: result.pages,
      lastUpdatedAt: result.lastFetchedAt,
    });
  } catch (error) {
    console.error("AI news read failed", error);
    return apiError(ApiErrorCode.READ_FAILED, "Failed to read AI scraped news", 500);
  }
}
