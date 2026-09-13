import { NextRequest } from "next/server";
import { z } from "zod";

import { getOfficialNews } from "@/lib/queries/official";
import { apiError, apiJson, ApiErrorCode } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(50).default(20),
  category: z.string().trim().max(50).optional(),
});

export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return apiError(ApiErrorCode.INVALID_QUERY, "Invalid news query parameters", 400);
  }
  try {
    const result = await getOfficialNews(parsed.data);
    return apiJson(result.articles, {
      source: "arsenal.com",
      sourceUrl: "https://www.arsenal.com/news",
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      pages: result.pages,
      lastUpdatedAt: result.lastFetchedAt,
    });
  } catch (error) {
    console.error("Arsenal official news read failed", error);
    return apiError(ApiErrorCode.OFFICIAL_NEWS_READ_ERROR, "Official Arsenal news unavailable", 503, { source: "arsenal.com" });
  }
}
