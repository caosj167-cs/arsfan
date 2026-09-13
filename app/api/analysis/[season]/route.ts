import { NextRequest } from "next/server";

import { getSeasonAnalysis } from "@/lib/queries/analysis";
import { apiError, apiJson, ApiErrorCode } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, context: { params: Promise<{ season: string }> }) {
  const { season: seasonRaw } = await context.params;
  const season = Number.parseInt(seasonRaw, 10);

  if (!Number.isInteger(season) || season <= 0) {
    return apiError(ApiErrorCode.INVALID_QUERY, "season must be a positive integer (football-data providerSeasonId)", 400);
  }

  try {
    const analysis = await getSeasonAnalysis(season);
    if (!analysis.found) {
      return apiError(
        ApiErrorCode.SEASON_NOT_FOUND,
        `No standings data for season ${season}`,
        404,
        { source: "football-data.org", season },
      );
    }
    return apiJson(analysis, {
      source: "football-data.org",
      lastUpdatedAt: analysis.lastUpdatedAt,
      season: analysis.season?.providerSeasonId,
    });
  } catch (error) {
    console.error("Season analysis failed", error);
    return apiError(ApiErrorCode.ANALYSIS_UNAVAILABLE, "Season analysis unavailable", 503, {
      source: "football-data.org",
      season,
    });
  }
}
