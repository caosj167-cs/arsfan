import { NextRequest } from "next/server";

import { getMatchDetail, getStoredMatchData } from "@/lib/queries/match";
import { apiError, apiJson, ApiErrorCode } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, context: { params: Promise<{ fixtureId: string }> }) {
  const { fixtureId } = await context.params;
  const result = await getMatchDetail(fixtureId);

  if (!result.storedFixture && !result.fixture && result.apiFootballError === "Fixture not found in API-Football") {
    return apiError(ApiErrorCode.FIXTURE_NOT_FOUND, "Fixture not found", 404, { source: "API-Football" });
  }

  if (!result.storedFixture && !result.fixture) {
    return apiError(ApiErrorCode.DETAILS_UNAVAILABLE, "Match details unavailable", 503, { source: "API-Football", stale: true });
  }

  // 本库已落库的比赛事件/统计（由 syncMatchEvents 写入），优先用于避免每次都打外部 API
  const storedKey = result.storedFixture?.id ?? fixtureId;
  const stored = await getStoredMatchData(storedKey);

  return apiJson(
    { ...result, stored },
    {
      source: result.apiFootballAvailable ? "API-Football" : "local-db",
      lastUpdatedAt: new Date().toISOString(),
      stale: !result.apiFootballAvailable,
      storedEvents: stored.events.length,
      storedTeamStats: stored.teamStats.length,
      storedPlayerStats: stored.playerStats.length,
    },
    result.apiFootballError ? { code: ApiErrorCode.DETAILS_UNAVAILABLE, message: "Some match details are unavailable" } : null,
  );
}
