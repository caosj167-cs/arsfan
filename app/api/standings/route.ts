import { NextRequest } from "next/server";
import { z } from "zod";

import { getStandings } from "@/lib/queries/football";
import { apiError, apiJson, ApiErrorCode } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  competition: z.string().trim().min(2).max(10).default("PL"),
  season: z.coerce.number().int().positive().optional(),
});

export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return apiError(ApiErrorCode.INVALID_QUERY, "Invalid standings query parameters", 400);
  }

  try {
    const result = await getStandings(parsed.data);
    return apiJson(result.standings, {
      source: "football-data.org",
      competition: result.competition,
      season: result.season,
      lastUpdatedAt: result.lastUpdatedAt,
    });
  } catch (error) {
    console.error("Standings read failed", error);
    return apiError(ApiErrorCode.STANDINGS_READ_ERROR, "Standings unavailable", 503, { source: "football-data.org" });
  }
}
