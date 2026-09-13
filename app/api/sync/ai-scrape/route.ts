import { NextRequest } from "next/server";
import { z } from "zod";

import { syncAiNews } from "@/lib/sync/aiScrape";
import { apiError, apiJson, ApiErrorCode } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

const bodySchema = z
  .object({
    source: z.string().min(1).default("bbc-sport"),
    url: z.string().url().default("https://www.bbc.com/sport/football/arsenal"),
  })
  .default({ source: "bbc-sport", url: "https://www.bbc.com/sport/football/arsenal" });

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
    return apiError(ApiErrorCode.INVALID_BODY, "Invalid source or url", 400);
  }
  try {
    const result = await syncAiNews({ source: parsed.data.source, url: parsed.data.url });
    return apiJson(result, { source: parsed.data.source, sourceUrl: parsed.data.url, fetchedAt: new Date().toISOString() });
  } catch (error) {
    console.error("AI news sync failed", error);
    return apiError(ApiErrorCode.SYNC_FAILED, "AI news synchronization failed", 502, { source: parsed.data.source });
  }
}
