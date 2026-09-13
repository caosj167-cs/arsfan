import { NextRequest } from "next/server";

import { reconcileScores, syncFootballData } from "@/lib/sync/football-data";
import { apiError, apiJson, ApiErrorCode } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

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
