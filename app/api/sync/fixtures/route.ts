import { NextRequest } from "next/server";
import { z } from "zod";

import { previewFixtureSources, refreshFixtureResults, syncFixtureEntries } from "@/lib/sync/fixtureEntries";
import { syncMatchReports } from "@/lib/sync/matchReports";
import { getFixtureEntries } from "@/lib/queries/fixtureEntries";
import { apiError, apiJson, ApiErrorCode } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

const bodySchema = z
  .object({
    action: z.enum(["merge", "refresh"]).default("merge"),
    season: z.number().int().optional(),
    limit: z.number().int().positive().optional(),
  })
  .default({ action: "merge" });

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return (
    request.headers.get("authorization") === `Bearer ${secret}` ||
    request.headers.get("x-cron-secret") === secret
  );
}

/** 只读诊断：预览三源各自抓到的条数（不写库、不需要密钥） */
export async function GET(request: NextRequest) {
  const seasonParam = request.nextUrl.searchParams.get("season");
  const season = seasonParam ? Number.parseInt(seasonParam, 10) : undefined;
  if (seasonParam && (!Number.isInteger(season) || (season as number) <= 0)) {
    return apiError(ApiErrorCode.INVALID_QUERY, "season must be a positive integer", 400);
  }
  try {
    const [preview, stored] = await Promise.all([
      previewFixtureSources(season),
      getFixtureEntries({ season }),
    ]);
    const now = Date.now();
    const upcoming = stored.entries
      .filter((entry) => new Date(entry.kickoffAt).getTime() > now)
      .slice(0, 60)
      .map((entry) => ({
        id: entry.id,
        kickoffAt: entry.kickoffAt,
        refreshAfter: new Date(new Date(entry.kickoffAt).getTime() + 3 * 60 * 60 * 1000).toISOString(),
        opponentName: entry.opponentName,
        competition: entry.competition,
        homeAway: entry.homeAway,
        verified: entry.verified,
        hasScore: entry.homeScore !== null && entry.awayScore !== null,
      }));
    return apiJson(
      { preview, stored: { season: stored.season, total: stored.total, verified: stored.verified, lastUpdatedAt: stored.lastUpdatedAt }, upcoming },
      { source: "football-data.org + arsenal.com + wikipedia", season: season ?? stored.season },
    );
  } catch (error) {
    console.error("Fixture source preview failed", error);
    return apiError(ApiErrorCode.READ_FAILED, "Failed to preview fixture sources", 503);
  }
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return apiError(ApiErrorCode.UNAUTHORIZED, "Unauthorized", 401);
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return apiError(ApiErrorCode.INVALID_BODY, "Invalid fixtures sync body", 400);
  }
  try {
    if (parsed.data.action === "refresh") {
      const result = await refreshFixtureResults({ season: parsed.data.season, limit: parsed.data.limit });
      // 「开赛+3h」同时抓取该场的比赛中心数据（FotMob）
      const matchReports = await syncMatchReports({ season: parsed.data.season }).catch((error) => {
        console.error("Match report sync (in refresh) failed", error);
        return null;
      });
      return apiJson(result, {
        source: "football-data.org + arsenal.com + wikipedia + fotmob",
        action: "refresh",
        matchReports,
        fetchedAt: new Date().toISOString(),
      });
    }
    const result = await syncFixtureEntries({ season: parsed.data.season });
    return apiJson(result, {
      source: "football-data.org + arsenal.com + wikipedia",
      action: "merge",
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Fixture entries sync failed", error);
    return apiError(ApiErrorCode.SYNC_FAILED, "Fixture merge failed", 502, { source: "fixtures" });
  }
}
