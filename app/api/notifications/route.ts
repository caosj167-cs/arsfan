import { NextResponse } from "next/server";

import { getFixtureEntries } from "@/lib/queries/fixtureEntries";

export const dynamic = "force-dynamic";

/**
 * 顶栏通知：把合并赛程拆成「赛前提醒（下一场起）」与「战报（已完赛）」。
 * 数据来自三源合并的 FixtureEntry，未读角标 = 未来未开赛场次数量。
 */
export async function GET() {
  const { entries } = await getFixtureEntries();
  const now = Date.now();

  const upcoming = entries
    .filter(
      (e) =>
        (e.status === "SCHEDULED" || e.status === "TIMED") &&
        new Date(e.kickoffAt).getTime() >= now,
    )
    .sort((a, b) => +new Date(a.kickoffAt) - +new Date(b.kickoffAt))
    .slice(0, 3)
    .map((e) => ({
      id: e.id,
      kind: "upcoming" as const,
      title: `下一场 · 阿森纳 vs ${e.opponentName}`,
      body: `${e.competition} · ${e.homeAway === "HOME" ? "主场" : "客场"}`,
      time: e.kickoffAt,
      href: `/matches/${e.id}`,
    }));

  const recent = entries
    .filter((e) => e.status === "FINISHED")
    .sort((a, b) => +new Date(b.kickoffAt) - +new Date(a.kickoffAt))
    .slice(0, 5)
    .map((e) => {
      const arsenalHome = e.homeAway === "HOME";
      const own = arsenalHome ? e.homeScore : e.awayScore;
      const opp = arsenalHome ? e.awayScore : e.homeScore;
      const result =
        own != null && opp != null ? (own > opp ? "胜" : own === opp ? "平" : "负") : "—";
      return {
        id: e.id,
        kind: "result" as const,
        title: `阿森纳 ${own ?? "-"} : ${opp ?? "-"} ${e.opponentName}`,
        body: `${e.competition} · ${result}`,
        time: e.kickoffAt,
        href: `/matches/${e.id}`,
      };
    });

  return NextResponse.json({
    upcoming,
    recent,
    unread: upcoming.length,
  });
}
