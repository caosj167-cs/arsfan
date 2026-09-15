import { NextRequest } from "next/server";

import { reconcileScores, syncFootballData } from "@/lib/sync/football-data";
import { apiError, apiJson, ApiErrorCode } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/**
 * football-data.org 全量同步（手动）。
 *
 * ⚠️ 本同步**不再写积分榜**（返回里 `standings` 恒为 0）：积分榜唯一写入源是
 * `syncStandingsFromFotmob()`（抓 FotMob 联赛表，见 POST /api/sync/standings）。
 * 原因是 football-data 的 standings 长期滞后（2026-27 只到第 2 轮），会覆盖掉最新榜。
 * `action: "reconcile"` 仍可用于比分回填。
 */

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const authorization = request.headers.get("authorization");
  const headerSecret = request.headers.get("x-cron-secret");
  return authorization === `Bearer ${secret}` || headerSecret === secret;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return apiError(ApiErrorCode.UNAUTHORIZED, "Unauthorized", 401);
  }

  const body = await request.json().catch(() => ({}));
  const action = (body && typeof body === "object" && "action" in body ? (body as { action: unknown }).action : "sync") as string;

  try {
    if (action === "reconcile") {
      const scores = await reconcileScores();
      return apiJson({ action: "reconcile", scores }, { source: "football-data.org" });
    }
    const result = await syncFootballData();
    return apiJson(result, { source: "football-data.org" });
  } catch (error) {
    console.error("football-data.org sync failed", error);
    return apiError(ApiErrorCode.SYNC_FAILED, "Football data synchronization failed", 502, { source: "football-data.org" });
  }
}
