import { NextRequest } from "next/server";

import { getMatchCenter } from "@/lib/queries/matchReports";
import { apiError, apiJson, ApiErrorCode } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/** 比赛中心 JSON：id 为 FixtureEntry.id */
export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const center = await getMatchCenter(id);
  if (!center) {
    return apiError(ApiErrorCode.FIXTURE_NOT_FOUND, "Match not found", 404, { source: "fixtures" });
  }
  return apiJson(center, {
    source: center.report ? "fotmob" : "fixtures",
    lastUpdatedAt: center.report?.fetchedAt ?? null,
    hasReport: center.report !== null,
  });
}
