import { parsePositionProgression, type PositionPoint } from "@/lib/data/league-position";
import { FOTMOB_PROVIDER } from "@/lib/providers/fotmob";
import { prisma } from "@/lib/prisma";

/**
 * 读取阿森纳的联赛名次走势（默认英超）。
 *
 * 走势由 `syncStandingsFromFotmob()` 在同步积分榜时一并算出（要用全部球队的结果），
 * 写在**同一条 SyncRun 的 metadata** 里——它随该轮比赛变化、属派生物，不单独建表。
 * 这里取最近一次「成功」运行的那份；从未同步过则返回空数组（页面显示提示而非伪造）。
 */
export async function getLeaguePositionProgression(competitionCode = "PL"): Promise<PositionPoint[]> {
  const run = await prisma.syncRun.findFirst({
    where: {
      provider: FOTMOB_PROVIDER,
      status: "SUCCEEDED",
      scope: { startsWith: `standings:${competitionCode}:` },
    },
    orderBy: { startedAt: "desc" },
    select: { metadata: true },
  });
  if (!run?.metadata || typeof run.metadata !== "object") return [];
  return parsePositionProgression((run.metadata as Record<string, unknown>).progression);
}
