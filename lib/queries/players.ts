import {
  SQUAD_PLAYERS,
  getPlayerById,
  autoFillFormation,
  isGoalkeeper,
  getOutfieldAttrs,
  type SquadPlayer,
  type FormationSlot,
} from "@/lib/data/squad";
import type { PlayerMatchMetrics } from "@/lib/data/player-metrics";
import { playerMatchKey } from "@/lib/data/player-name";
import { prisma } from "@/lib/prisma";

export { type SquadPlayer, type FormationSlot, isGoalkeeper, getOutfieldAttrs };
export { getPlayerById, autoFillFormation };

/** 获取全部球员（按位置分组） */
export function getSquadData() {
  const players = SQUAD_PLAYERS;
  const formation = autoFillFormation();

  // 按大类分组
  const goalkeepers = players.filter((p) => p.position === "GK");
  const defenders = players.filter((p) => ["CB", "RB", "LB"].includes(p.position));
  const midfielders = players.filter((p) => ["DM", "CM", "AM"].includes(p.position));
  const forwards = players.filter((p) => ["RW", "LW", "ST", "W"].includes(p.position));

  return { players, formation, goalkeepers, defenders, midfielders, forwards };
}

/** 获取单个球员详情 */
export function getPlayerDetail(id: string): SquadPlayer | null {
  return getPlayerById(id) ?? null;
}

/** 榜单行（供球队数据页进球/助攻榜使用） */
export type LeaderRow = {
  id: string;
  name: string;
  position: string;
  appearances: number | null;
  goals: number | null;
  assists: number | null;
  rating: number | null;
  /** 该行是否已命中真实赛季统计（api-football）。false 时页面应显示“—”，不得展示占位数 */
  hasLiveStats: boolean;
};

function toLeaderRow(player: SquadPlayer): LeaderRow {
  return {
    id: player.id,
    name: player.name,
    position: player.position,
    appearances: null,
    goals: null,
    assists: null,
    rating: null,
    hasLiveStats: false,
  };
}

// 服务端侧复用（客户端组件请直接从 @/lib/data/season 引入，避免打包进 Prisma）
export { seasonLabel } from "@/lib/data/season";

export type PlayerSeasonStatView = {
  providerPlayerId: string;
  playerName: string;
  season: number;
  appearances: number;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  rating: number | null;
  /** 衍生指标（射门/射正、关键传球、传球、过人、对抗、丢球权、被犯规、犯规、抢断、解围） */
  metrics: PlayerMatchMetrics | null;
  lastSyncedAt: string;
};

/**
 * 解析「当前展示用的真实数据赛季」（起始年份，如 2026-27 → 2026）。
 * 优先级：API_FOOTBALL_SEASON 环境变量 → 库中已落库的最新赛季 → 当前年份。
 * 取「已落库的最新赛季」可让前端在拿到真实数据后自动展示（并带赛季标签），
 * 而不是因为硬编码当前年而在数据缺失时永远显示占位。
 */
export async function resolveSeason(): Promise<number> {
  const fromEnv = Number.parseInt(process.env.API_FOOTBALL_SEASON ?? "", 10);
  if (Number.isInteger(fromEnv)) return fromEnv;
  const latest = await prisma.playerSeasonStat.findFirst({
    orderBy: { season: "desc" },
    select: { season: true },
  });
  return latest?.season ?? new Date().getUTCFullYear();
}

/**
 * 按 squad slug 取真实赛季统计（来自 playerSeasonStat，api-football 落库）。
 * 匹配键用 squad slug（如 "declan-rice"）归一化后对比 api-football 全名（"Declan Rice"）——
 * 注意 squad.nameEn 是短名（"Rice"），不可作为匹配键。
 * 赛季由 resolveSeason() 决定；无匹配返回 null（前端应显示“暂无数据”而非伪造）。
 */
export async function getPlayerSeasonStatBySlug(slug: string): Promise<PlayerSeasonStatView | null> {
  const player = getPlayerById(slug);
  if (!player) return null;

  const target = playerMatchKey(slug);
  const rows = await prisma.playerSeasonStat.findMany({ where: { season: await resolveSeason() } });
  const match = rows.find((r) => playerMatchKey(r.playerName) === target);
  return match ? toSeasonStatView(match) : null;
}

type SeasonStatRow = Awaited<ReturnType<typeof prisma.playerSeasonStat.findFirst>>;

function toSeasonStatView(row: NonNullable<SeasonStatRow>): PlayerSeasonStatView {
  return {
    providerPlayerId: row.providerPlayerId,
    playerName: row.playerName,
    season: row.season,
    appearances: row.appearances,
    goals: row.goals,
    assists: row.assists,
    yellowCards: row.yellowCards,
    redCards: row.redCards,
    rating: row.rating,
    metrics: (row.metrics as PlayerMatchMetrics | null) ?? null,
    lastSyncedAt: row.lastSyncedAt.toISOString(),
  };
}

/**
 * 已落库真实统计按 squad slug 索引，供阵容列表/弹窗渲染。
 * 未命中的 slug 不在结果里（调用方应显示“—”而非占位数）。
 */
export async function getRealStatsBySlug(): Promise<Record<string, PlayerSeasonStatView>> {
  const season = await resolveSeason();
  const rows = await prisma.playerSeasonStat.findMany({ where: { season } });
  const byKey = new Map(rows.map((r) => [playerMatchKey(r.playerName), r]));
  const out: Record<string, PlayerSeasonStatView> = {};
  for (const player of SQUAD_PLAYERS) {
    const stat = byKey.get(playerMatchKey(player.id));
    if (stat) out[player.id] = toSeasonStatView(stat);
  }
  return out;
}

/**
 * 队内进球榜/助攻榜（真实数据版）。
 * 只有命中真实赛季统计的球员才带数值（hasLiveStats=true），其余显示“—”，不展示占位数。
 * 返回 season / live，供页面标注「数据来源与赛季」。
 */
export async function getLeaderboardsWithRealStats(limit = 12) {
  const season = await resolveSeason();
  const stats = await prisma.playerSeasonStat.findMany({ where: { season } });
  const byKey = new Map(stats.map((s) => [playerMatchKey(s.playerName), s]));

  const overlay = (row: LeaderRow): LeaderRow => {
    // row.id 是 squad slug，用同一「首字母+姓」键与 api-football 名对齐
    const stat = byKey.get(playerMatchKey(row.id));
    if (!stat) return row;
    return {
      ...row,
      appearances: stat.appearances,
      goals: stat.goals,
      assists: stat.assists,
      rating: stat.rating,
      hasLiveStats: true,
    };
  };

  const rows = SQUAD_PLAYERS.map(toLeaderRow).map(overlay);
  const live = rows.some((r) => r.hasLiveStats);

  return {
    scorers: [...rows].sort((a, b) => (b.goals ?? -1) - (a.goals ?? -1)).slice(0, limit),
    assisters: [...rows].sort((a, b) => (b.assists ?? -1) - (a.assists ?? -1)).slice(0, limit),
    season,
    live,
  };
}
