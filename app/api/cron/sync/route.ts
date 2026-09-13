import { NextRequest } from "next/server";

import { apiError, apiJson, ApiErrorCode } from "@/lib/api/respond";
import { seasonStartYear } from "@/lib/data/season";
import { refreshFixtureResults, syncFixtureEntries } from "@/lib/sync/fixtureEntries";
import { syncMatchReports } from "@/lib/sync/matchReports";

export const dynamic = "force-dynamic";
/** 合并三源 + 抓 FotMob 可能较慢；Vercel 需 Pro 才能到 300s，Hobby 上限 60s */
export const maxDuration = 300;

/**
 * 定时同步入口（面向生产 cron）。
 *
 * 为什么单独开这个路由：平台 cron（Vercel Cron / GitHub Actions / cron-job.org）
 * 通常只发 **GET**，而 `/api/sync/fixtures` 的 GET 是「只读预览」，写操作在 POST 上。
 * 这里提供一个 GET 也能触发的写入口，用 CRON_SECRET 鉴权：
 *   - Vercel Cron 会自动带上 `Authorization: Bearer $CRON_SECRET`
 *   - 其它调度器用 `Authorization: Bearer <secret>` 或 `x-cron-secret: <secret>`
 *
 * 用法：
 *   GET|POST /api/cron/sync              → 默认 refresh（回填已完赛比分 + 抓比赛中心 + 聚合球员）
 *   GET|POST /api/cron/sync?mode=merge   → 三源合并赛程（较重，建议每天一次）
 *   GET|POST /api/cron/sync?mode=both    → 两者都跑
 */

type SyncMode = "refresh" | "merge" | "both";

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return (
    request.headers.get("authorization") === `Bearer ${secret}` ||
    request.headers.get("x-cron-secret") === secret
  );
}

function parseMode(value: string | null | undefined): SyncMode | null {
  if (value === null || value === undefined || value === "") return "refresh";
  return value === "refresh" || value === "merge" || value === "both" ? value : null;
}

async function runSync(mode: SyncMode) {
  const season = seasonStartYear();
  const result: Record<string, unknown> = { mode, season };

  if (mode === "merge" || mode === "both") {
    result.merge = await syncFixtureEntries({ season });
  }
  if (mode === "refresh" || mode === "both") {
    result.refresh = await refreshFixtureResults({ season });
    // 报告同步内部会顺带聚合球员赛季数据
    result.matchReports = await syncMatchReports({ season }).catch((error) => {
      console.error("Match report sync (cron) failed", error);
      return null;
    });
  }
  return result;
}

async function handle(request: NextRequest, modeRaw: string | null | undefined) {
  if (!isAuthorized(request)) {
    return apiError(ApiErrorCode.UNAUTHORIZED, "Unauthorized", 401);
  }
  const mode = parseMode(modeRaw);
  if (!mode) {
    return apiError(ApiErrorCode.INVALID_QUERY, "mode must be one of refresh|merge|both", 400);
  }
  try {
    const result = await runSync(mode);
    return apiJson(result, {
      source: "football-data.org + arsenal.com + wikipedia + fotmob",
      action: `cron:${mode}`,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Cron sync failed", error);
    return apiError(ApiErrorCode.SYNC_FAILED, "Cron sync failed", 502, { source: "cron" });
  }
}

export async function GET(request: NextRequest) {
  return handle(request, request.nextUrl.searchParams.get("mode"));
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { mode?: string };
  return handle(request, body.mode ?? request.nextUrl.searchParams.get("mode"));
}
