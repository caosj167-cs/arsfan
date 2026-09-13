import type { Prisma } from "@/app/generated/prisma/client";

import { EMPTY_METRICS, type PlayerMatchMetrics } from "@/lib/data/player-metrics";
import { slugToPlayerName, transliterate } from "@/lib/data/player-name";
import { seasonStartYear } from "@/lib/data/season";
import {
  FOTMOB_ARSENAL_TEAM_ID,
  FOTMOB_PROVIDER,
  type MatchLineupBlock,
  type MatchPlayerRow,
  type MatchReportPayload,
} from "@/lib/providers/fotmob";
import { prisma } from "@/lib/prisma";

/**
 * 球员赛季数据聚合。
 *
 * 背景：26/27 赛季的球员统计数据源（api-football）不可用，故改为
 *   「每场抓取（比赛中心 FotMob 报告）──▶ 聚合成 Arsenal 每名球员的本季数据」。
 *
 * 数据来源单一且真实：只统计已落库的比赛报告里 Arsenal 侧球员的
 * 出场 / 进球 / 助攻 / 黄牌 / 红牌 / 平均评分。抓不到的字段留空/0，**不编造**。
 * 结果写入 PlayerSeasonStat（provider=fotmob、season=本季），读取层据此展示。
 */

/**
 * FotMob 对个别球员只给「名」（如 Arsenal 的 Gabriel = Gabriel Magalhães），
 * 与 squad slug 的匹配键不一致，做显式别名归一（已知真实对应，非推测）。
 * 键为「名字全名转写」（"Gabriel" → "gabriel"）。
 */
const NAME_ALIASES: Record<string, string> = { gabriel: "gabriel-magalhaes" };

/** 把数据源里的名字归一到与 squad slug 可匹配的形式 */
function canonicalPlayerName(rawName: string): string {
  const alias = NAME_ALIASES[transliterate(rawName).trim()];
  return alias ? slugToPlayerName(alias) : rawName;
}

type Aggregate = {
  providerPlayerId: string;
  playerName: string;
  position: string | null;
  appearances: number;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  ratingSum: number;
  ratingCount: number;
  metrics: PlayerMatchMetrics;
};

/** 需要逐场累加的衍生指标 */
const METRIC_KEYS: (keyof PlayerMatchMetrics)[] = [
  "shots",
  "shotsOnTarget",
  "keyPasses",
  "accuratePasses",
  "successfulDribbles",
  "duelsWon",
  "dispossessed",
  "wasFouled",
  "foulsCommitted",
  "tackles",
  "clearances",
];

export type PlayerStatsAggregateResult = {
  season: number;
  reports: number;
  players: number;
  upserted: number;
};

function pickArsenalBlock(payload: MatchReportPayload): MatchLineupBlock | null {
  const sides = [payload.lineups?.home, payload.lineups?.away].filter(Boolean) as MatchLineupBlock[];
  const byId = sides.find((side) => side.teamId === FOTMOB_ARSENAL_TEAM_ID);
  if (byId) return byId;
  return sides.find((side) => side.name && /arsenal/i.test(side.name)) ?? null;
}

/** 从已落库的比赛报告聚合出 Arsenal 球员的本季统计，并写入 PlayerSeasonStat */
export async function aggregatePlayerStatsFromReports(
  options: { season?: number } = {},
): Promise<PlayerStatsAggregateResult> {
  const season = options.season ?? seasonStartYear();
  const reports = await prisma.matchReport.findMany({
    where: { season, finished: true },
    orderBy: { kickoffAt: "asc" },
    select: { payload: true },
  });

  const byPlayer = new Map<string, Aggregate>();

  for (const report of reports) {
    const payload = report.payload as unknown as MatchReportPayload | null;
    if (!payload?.lineups) continue;
    const block = pickArsenalBlock(payload);
    if (!block) continue;

    const rows: MatchPlayerRow[] = [...(block.starters ?? []), ...(block.subs ?? [])];
    for (const player of rows) {
      if (player.playerId === null || player.playerId === undefined) continue;
      const id = String(player.playerId);
      const minutes = player.minutes ?? 0;
      // 出场判定：首发 / 替补登场 / 有出场分钟（未登场的替补不计）
      const played = player.starter || player.subInMinute !== null || minutes > 0;

      const agg =
        byPlayer.get(id) ??
        ({
          providerPlayerId: id,
          playerName: canonicalPlayerName(player.name),
          position: null,
          appearances: 0,
          goals: 0,
          assists: 0,
          yellowCards: 0,
          redCards: 0,
          ratingSum: 0,
          ratingCount: 0,
          metrics: { ...EMPTY_METRICS },
        } satisfies Aggregate);

      if (player.position && (minutes > 0 || player.starter)) agg.position = player.position;
      if (played) agg.appearances += 1;
      agg.goals += player.goals ?? 0;
      agg.assists += player.assists ?? 0;
      agg.yellowCards += player.yellowCards ?? 0;
      agg.redCards += player.redCards ?? 0;
      for (const key of METRIC_KEYS) agg.metrics[key] += player[key] ?? 0;
      if (typeof player.rating === "number") {
        agg.ratingSum += player.rating;
        agg.ratingCount += 1;
      }
      byPlayer.set(id, agg);
    }
  }

  // 幂等重建：聚合结果可完全从报告推导，故先清后写
  await prisma.playerSeasonStat.deleteMany({ where: { provider: FOTMOB_PROVIDER, season } });

  if (byPlayer.size) {
    const data: Prisma.PlayerSeasonStatCreateManyInput[] = [...byPlayer.values()].map((agg) => ({
      provider: FOTMOB_PROVIDER,
      providerPlayerId: agg.providerPlayerId,
      playerName: agg.playerName,
      season,
      league: null,
      team: "Arsenal",
      position: agg.position,
      appearances: agg.appearances,
      goals: agg.goals,
      assists: agg.assists,
      yellowCards: agg.yellowCards,
      redCards: agg.redCards,
      rating: agg.ratingCount ? Number((agg.ratingSum / agg.ratingCount).toFixed(2)) : null,
      metrics: agg.metrics,
      lastSyncedAt: new Date(),
    }));
    await prisma.playerSeasonStat.createMany({ data });
  }

  return { season, reports: reports.length, players: byPlayer.size, upserted: byPlayer.size };
}
