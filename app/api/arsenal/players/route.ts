import { getOfficialPlayers } from "@/lib/queries/official";
import { apiError, apiJson, ApiErrorCode } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await getOfficialPlayers();
    return apiJson(result.players, {
      source: "arsenal.com",
      sourceUrl: "https://www.arsenal.com/fixtures/men/players",
      total: result.players.length,
      lastUpdatedAt: result.lastFetchedAt,
    });
  } catch (error) {
    console.error("Arsenal official players read failed", error);
    return apiError(ApiErrorCode.OFFICIAL_PLAYER_READ_ERROR, "Official Arsenal player profiles unavailable", 503, { source: "arsenal.com" });
  }
}
