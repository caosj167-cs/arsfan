import { NextRequest } from "next/server";
import { z } from "zod";

import { syncArsenalContent, syncArsenalFixtures, syncArsenalNews, syncArsenalPlayers } from "@/lib/sync/arsenal";
import { apiError, apiJson, ApiErrorCode } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ scope: z.enum(["all", "news", "fixtures", "players"]).default("all") }).default({ scope: "all" });

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}` || request.headers.get("x-cron-secret") === secret;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return apiError(ApiErrorCode.UNAUTHORIZED, "Unauthorized", 401);
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return apiError(ApiErrorCode.INVALID_SCOPE, "Invalid sync scope", 400);
  }
  try {
    const result =
      parsed.data.scope === "news"
        ? await syncArsenalNews()
        : parsed.data.scope === "fixtures"
          ? await syncArsenalFixtures()
          : parsed.data.scope === "players"
            ? await syncArsenalPlayers()
            : await syncArsenalContent();
    return apiJson(result, {
      source: "arsenal.com",
      sourceUrls: {
        news: "https://www.arsenal.com/news/all/1",
        fixtures: "https://www.arsenal.com/fixtures/men/fixtures",
        players: "https://www.arsenal.com/fixtures/men/players",
      },
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Arsenal official content sync failed", error);
    return apiError(ApiErrorCode.SYNC_FAILED, "Arsenal official content synchronization failed", 502, { source: "arsenal.com" });
  }
}
