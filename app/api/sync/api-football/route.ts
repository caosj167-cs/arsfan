import { NextRequest } from "next/server";
import { z } from "zod";

import { syncMatchEvents, syncPlayerStats } from "@/lib/sync/api-football";
import { apiError, apiJson, ApiErrorCode } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

const bodySchema = z
  .object({
    action: z.enum(["players", "match-events"]).default("players"),
    // players
    league: z.number().int().optional(),
    season: z.number().int().optional(),
    teamId: z.number().int().optional(),
    // match-events
    fixtureId: z.string().min(1).optional(),
  })
  .default({ action: "players" });

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return (
    request.headers.get("authorization") === `Bearer ${secret}` ||
    request.headers.get("x-cron-secret") === secret
  );
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return apiError(ApiErrorCode.UNAUTHORIZED, "Unauthorized", 401);
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return apiError(ApiErrorCode.INVALID_BODY, "Invalid api-football sync body", 400);
  }
  try {
    if (parsed.data.action === "players") {
      const result = await syncPlayerStats({
        league: parsed.data.league,
        season: parsed.data.season,
        teamId: parsed.data.teamId,
      });
      return apiJson(result, { source: "api-football", action: "players", fetchedAt: new Date().toISOString() });
    }
    if (!parsed.data.fixtureId) {
      return apiError(ApiErrorCode.INVALID_QUERY, "fixtureId is required for match-events", 400, { source: "api-football" });
    }
    const result = await syncMatchEvents(parsed.data.fixtureId);
    return apiJson(result, { source: "api-football", action: "match-events", fetchedAt: new Date().toISOString() });
  } catch (error) {
    console.error("api-football sync failed", error);
    const message = error instanceof Error ? error.message : "api-football sync failed";
    const status = message.includes("not found") ? 404 : 502;
    return apiError(
      status === 404 ? ApiErrorCode.FIXTURE_NOT_FOUND : ApiErrorCode.SYNC_FAILED,
      message,
      status,
      { source: "api-football" },
    );
  }
}
