import { NextRequest } from "next/server";

import { getPlayerDetail, getPlayerSeasonStatBySlug } from "@/lib/queries/players";
import { apiError, apiJson, ApiErrorCode } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  if (!id) {
    return apiError(ApiErrorCode.INVALID_QUERY, "Player id is required", 400);
  }

  const player = getPlayerDetail(id);
  if (!player) {
    return apiError(ApiErrorCode.PLAYER_NOT_FOUND, "Player not found", 404, { source: "squad" });
  }

  // 只返回真实赛季统计（FotMob 比赛数据聚合落库）；无匹配则 null + source=unavailable，
  // 不再回传 squad 占位数值（避免把占位数据当成真实统计对外提供）。
  const realStat = await getPlayerSeasonStatBySlug(id);
  const seasonStats = realStat
    ? {
        appearances: realStat.appearances,
        goals: realStat.goals,
        assists: realStat.assists,
        yellowCards: realStat.yellowCards,
        redCards: realStat.redCards,
        rating: realStat.rating,
        metrics: realStat.metrics,
      }
    : null;

  return apiJson(
    {
      ...player,
      seasonStats,
      seasonStatsSource: realStat ? `live:${realStat.season}` : "unavailable",
    },
    {
      source: realStat ? "fotmob (比赛数据聚合)" : "unavailable",
      season: realStat?.season ?? null,
      lastUpdatedAt: realStat?.lastSyncedAt ?? null,
    },
  );
}
