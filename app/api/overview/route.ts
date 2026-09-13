import { getOverviewData } from "@/lib/queries/overview";
import { apiError, apiJson, ApiErrorCode } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getOverviewData();
    return apiJson(data, {
      source: "aggregated (football-data.org + The Guardian + AI)",
      lastUpdatedAt: data.lastUpdatedAt,
    });
  } catch (error) {
    console.error("Overview aggregation failed", error);
    return apiError(ApiErrorCode.READ_FAILED, "Failed to build overview", 503, { source: "aggregated" });
  }
}
