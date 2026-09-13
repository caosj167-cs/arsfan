import { seasonStartYear } from "@/lib/data/season";
import {
  FOTMOB_PROVIDER,
  fetchFotmobMatch,
  fetchFotmobTeamFixtures,
  normalizeFotmobMatch,
  type FotmobFixtureRef,
} from "@/lib/providers/fotmob";
import { opponentKey } from "@/lib/sync/fixtureEntries";
import { aggregatePlayerStatsFromReports, type PlayerStatsAggregateResult } from "@/lib/sync/playerStats";
import { prisma } from "@/lib/prisma";

/**
 * 完赛比赛的「比赛中心」数据落库：
 *   赛程(FixtureEntry) ──▶ 匹配 FotMob 比赛 ──▶ 抓比赛页内嵌 JSON ──▶ 归一化 ──▶ MatchReport
 * 缺数据的字段留空，不编造。
 */

export type MatchReportSyncResult = {
  season: number;
  fotmobFixtures: number;
  matchedEntries: number;
  finished: number;
  synced: number;
  skipped: number;
  errors: string[];
  /** 报告同步后顺带执行的球员赛季数据聚合结果 */
  aggregated?: PlayerStatsAggregateResult;
};

function findFotmobMatch(
  entry: { opponentName: string; homeAway: string; kickoffAt: Date },
  refs: FotmobFixtureRef[],
) {
  const wantKey = opponentKey(entry.opponentName);
  const wantDate = entry.kickoffAt.toISOString().slice(0, 10);
  return refs.find((ref) => {
    if (ref.homeAway !== entry.homeAway) return false;
    const refKey = opponentKey(ref.opponentKeyRaw);
    const keyOk = refKey === wantKey || refKey.includes(wantKey) || wantKey.includes(refKey);
    if (!keyOk) return false;
    if (!ref.kickoffAt) return true;
    return ref.kickoffAt.toISOString().slice(0, 10) === wantDate;
  }) ?? null;
}

async function upsertReport(
  fotmobMatchId: string,
  fixtureEntryId: string | null,
  season: number,
  kickoffAt: Date,
) {
  const raw = await fetchFotmobMatch(fotmobMatchId);
  if (!raw) throw new Error(`FotMob match ${fotmobMatchId} 页面无内嵌数据`);
  const payload = normalizeFotmobMatch(fotmobMatchId, raw);

  await prisma.matchReport.upsert({
    where: { fotmobMatchId },
    create: {
      fotmobMatchId,
      fixtureEntryId,
      season,
      kickoffAt,
      competition: payload.competition,
      round: payload.round,
      homeTeamName: payload.teams.home.name,
      awayTeamName: payload.teams.away.name,
      homeScore: payload.teams.home.score,
      awayScore: payload.teams.away.score,
      finished: true,
      payload: payload as unknown as object,
      source: FOTMOB_PROVIDER,
      fetchedAt: new Date(),
    },
    update: {
      fixtureEntryId,
      competition: payload.competition,
      round: payload.round,
      homeTeamName: payload.teams.home.name,
      awayTeamName: payload.teams.away.name,
      homeScore: payload.teams.home.score,
      awayScore: payload.teams.away.score,
      finished: true,
      payload: payload as unknown as object,
      fetchedAt: new Date(),
    },
  });

  return payload;
}

/** 同步本赛季已完成比赛的比赛中心数据 */
export async function syncMatchReports(options: { season?: number; limit?: number } = {}): Promise<MatchReportSyncResult> {
  const season = options.season ?? seasonStartYear();
  const result: MatchReportSyncResult = { season, fotmobFixtures: 0, matchedEntries: 0, finished: 0, synced: 0, skipped: 0, errors: [] };

  const refs = await fetchFotmobTeamFixtures();
  result.fotmobFixtures = refs.length;
  if (!refs.length) {
    result.errors.push("FotMob 球队赛程页未解析到任何比赛");
    return result;
  }

  const entries = await prisma.fixtureEntry.findMany({ where: { season }, orderBy: { kickoffAt: "asc" } });
  const now = Date.now();
  let processed = 0;

  for (const entry of entries) {
    // 只处理「已开赛 + 3 小时」之后的比赛（与刷新节奏一致）
    if (entry.kickoffAt.getTime() + 3 * 60 * 60 * 1000 > now) continue;
    const ref = findFotmobMatch({ opponentName: entry.opponentName, homeAway: entry.homeAway, kickoffAt: entry.kickoffAt }, refs);
    if (!ref) {
      result.skipped += 1;
      continue;
    }
    result.matchedEntries += 1;
    if (!ref.finished) {
      result.skipped += 1;
      continue;
    }
    result.finished += 1;
    if (options.limit && processed >= options.limit) continue;
    processed += 1;
    try {
      await upsertReport(ref.matchId, entry.id, season, entry.kickoffAt);
      result.synced += 1;
    } catch (error) {
      result.errors.push(`${entry.opponentName}: ${error instanceof Error ? error.message : "未知错误"}`);
    }
  }

  // 报告落库后顺带聚合球员赛季数据（供榜单 / 球员页消费真实数据）
  try {
    result.aggregated = await aggregatePlayerStatsFromReports({ season });
  } catch (error) {
    result.errors.push(`球员数据聚合失败: ${error instanceof Error ? error.message : "未知错误"}`);
  }

  return result;
}

/** 针对单个赛程（比赛中心页面 id 即 FixtureEntry.id）同步 */
export async function syncMatchReportForEntry(entryId: string) {
  const entry = await prisma.fixtureEntry.findUnique({ where: { id: entryId } });
  if (!entry) throw new Error("赛程不存在");
  const refs = await fetchFotmobTeamFixtures();
  const ref = findFotmobMatch({ opponentName: entry.opponentName, homeAway: entry.homeAway, kickoffAt: entry.kickoffAt }, refs);
  if (!ref) throw new Error("未在 FotMob 找到对应比赛");
  await upsertReport(ref.matchId, entry.id, entry.season, entry.kickoffAt);
  const aggregated = await aggregatePlayerStatsFromReports({ season: entry.season });
  return { entryId, fotmobMatchId: ref.matchId, aggregated };
}
