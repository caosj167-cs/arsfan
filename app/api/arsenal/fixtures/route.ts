import { NextRequest } from "next/server";
import { z } from "zod";

import { getOfficialFixtures } from "@/lib/queries/official";
import { apiError, apiJson, ApiErrorCode } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(50),
});

export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return apiError(ApiErrorCode.INVALID_QUERY, "Invalid fixture query parameters", 400);
  }
  try {
    const result = await getOfficialFixtures(parsed.data);
    return apiJson(result.fixtures, {
      source: "arsenal.com",
      sourceUrl: "https://www.arsenal.com/fixtures",
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      pages: result.pages,
      lastUpdatedAt: result.lastFetchedAt,
    });
  } catch (error) {
    console.error("Arsenal official fixtures read failed", error);
    return apiError(ApiErrorCode.OFFICIAL_FIXTURE_READ_ERROR, "Official Arsenal fixtures unavailable", 503, { source: "arsenal.com" });
  }
}
