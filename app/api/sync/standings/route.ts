import { NextRequest } from "next/server";

import { getStandings } from "@/lib/queries/football";
import { syncStandingsFromFotmob } from "@/lib/sync/fotmobStandings";
import { apiError, apiJson, ApiErrorCode } from "@/lib/api/respond";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * 积分榜同步（抓 FotMob 联赛表，与进球/助攻榜同源）。
 *
 *   GET  → 只读诊断：当前积分榜（读取层视角），含阿森纳行。
 *   POST → 手动触发一次同步（写 StandingEntry），需 CRON_SECRET 鉴权。
 *
 * 定时路径：/api/cron/sync?mode=refresh|both 已包含本同步。
 */

const ARSENAL_PROVIDER_TEAM_ID = "57";

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return (
    request.headers.get("authorization") === `Bearer ${secret}` ||
    request.headers.get("x-cron-secret") === secret
  );
}

export async function GET() {
  const result = await getStandings();
  return apiJson(
    {
      rows: result.standings.length,
      top: result.standings.slice(0, 3).map((row) => ({
        position: row.position,
        team: row.team.name,
        played: row.playedGames,
        points: row.points,
      })),
      arsenal: result.standings.find((row) => row.team.providerTeamId === ARSENAL_PROVIDER_TEAM_ID) ?? null,
    },
    { source: "fotmob", competition: result.competition, season: result.season, lastUpdatedAt: result.lastUpdatedAt },
  );
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return apiError(ApiErrorCode.UNAUTHORIZED, "Unauthorized", 401);
  }
  try {
    const result = await syncStandingsFromFotmob();
    return apiJson(result, { source: "fotmob", action: "standings", fetchedAt: new Date().toISOString() });
  } catch (error) {
    console.error("Standings sync failed", error);
    const message = error instanceof Error ? error.message : "Standings sync failed";
    return apiError(ApiErrorCode.SYNC_FAILED, message, 502, { source: "fotmob" });
  }
}
