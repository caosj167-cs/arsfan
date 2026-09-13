import { NextRequest } from "next/server";
import { z } from "zod";

import { syncMatchReportForEntry, syncMatchReports } from "@/lib/sync/matchReports";
import { aggregatePlayerStatsFromReports } from "@/lib/sync/playerStats";
import { prisma } from "@/lib/prisma";
import { apiError, apiJson, ApiErrorCode } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/** 只读诊断：列出已落库的比赛报告 */
export async function GET() {
  const rows = await prisma.matchReport.findMany({
    orderBy: { kickoffAt: "asc" },
    select: {
      id: true,
      fixtureEntryId: true,
      fotmobMatchId: true,
      competition: true,
      round: true,
      kickoffAt: true,
      homeTeamName: true,
      awayTeamName: true,
      homeScore: true,
      awayScore: true,
      fetchedAt: true,
    },
  });
  return apiJson({ reports: rows, total: rows.length }, { source: "fotmob" });
}

const bodySchema = z
  .object({
    action: z.enum(["sync", "entry", "aggregate"]).default("sync"),
    season: z.number().int().optional(),
    entryId: z.string().min(1).optional(),
    limit: z.number().int().positive().optional(),
  })
  .default({ action: "sync" });

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
    return apiError(ApiErrorCode.INVALID_BODY, "Invalid match-report sync body", 400);
  }
  try {
    if (parsed.data.action === "entry") {
      if (!parsed.data.entryId) {
        return apiError(ApiErrorCode.INVALID_QUERY, "entryId is required", 400, { source: "fotmob" });
      }
      const result = await syncMatchReportForEntry(parsed.data.entryId);
      return apiJson(result, { source: "fotmob", action: "entry", fetchedAt: new Date().toISOString() });
    }
    if (parsed.data.action === "aggregate") {
      const result = await aggregatePlayerStatsFromReports({ season: parsed.data.season });
      return apiJson(result, { source: "fotmob", action: "aggregate", fetchedAt: new Date().toISOString() });
    }
    const result = await syncMatchReports({ season: parsed.data.season, limit: parsed.data.limit });
    return apiJson(result, { source: "fotmob", action: "sync", fetchedAt: new Date().toISOString() });
  } catch (error) {
    console.error("Match report sync failed", error);
    const message = error instanceof Error ? error.message : "Match report sync failed";
    const status = message.includes("不存在") || message.includes("未在") ? 404 : 502;
    return apiError(status === 404 ? ApiErrorCode.FIXTURE_NOT_FOUND : ApiErrorCode.SYNC_FAILED, message, status, { source: "fotmob" });
  }
}
