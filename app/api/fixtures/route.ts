import { NextRequest } from "next/server";
import { z } from "zod";

import { fixtureStatuses, getFixtures } from "@/lib/queries/football";
import { apiError, apiJson, ApiErrorCode } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  competition: z.string().trim().min(2).max(10).default("PL"),
  season: z.coerce.number().int().positive().optional(),
  status: z.enum(fixtureStatuses).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return apiError(ApiErrorCode.INVALID_QUERY, "Invalid fixture query parameters", 400);
  }

  try {
    const result = await getFixtures(parsed.data);
    return apiJson(result.fixtures, {
      source: "football-data.org",
      competition: result.competition,
      season: result.season,
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      lastUpdatedAt: result.lastUpdatedAt,
    });
  } catch (error) {
    console.error("Fixture read failed", error);
    return apiError(ApiErrorCode.FIXTURE_READ_ERROR, "Fixtures unavailable", 503, { source: "football-data.org" });
  }
}
