import { NextRequest, NextResponse } from "next/server";

import { searchSquadPlayers } from "@/lib/data/squad";
import { getFixtureEntries } from "@/lib/queries/fixtureEntries";

export const dynamic = "force-dynamic";

/**
 * 顶栏搜索：同时检索球员（本地名册）与赛程（三源合并 FixtureEntry）。
 * 球员命中 name / nameEn / id；赛程命中对手名 / 赛事名 / 赛事代码。
 */
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 1) {
    return NextResponse.json({ players: [], fixtures: [] });
  }
  const lower = q.toLowerCase();

  const players = searchSquadPlayers(q, 8).map((p) => ({
    id: p.id,
    name: p.name,
    nameEn: p.nameEn,
    number: p.number,
    position: p.position,
    href: `/players/${p.id}`,
  }));

  const { entries } = await getFixtureEntries();
  const fixtures = entries
    .filter(
      (e) =>
        e.opponentName.toLowerCase().includes(lower) ||
        e.competition.toLowerCase().includes(lower) ||
        (e.competitionCode ?? "").toLowerCase().includes(lower),
    )
    .slice(0, 8)
    .map((e) => ({
      id: e.id,
      opponentName: e.opponentName,
      competition: e.competition,
      competitionCode: e.competitionCode,
      homeAway: e.homeAway,
      status: e.status,
      kickoffAt: e.kickoffAt,
      homeScore: e.homeScore,
      awayScore: e.awayScore,
      href: `/matches/${e.id}`,
    }));

  return NextResponse.json({ players, fixtures });
}
