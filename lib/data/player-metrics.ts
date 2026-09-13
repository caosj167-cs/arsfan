/**
 * 球员衍生指标（纯类型 + 列定义）。
 * 客户端与服务端通用；**不可**引入 Prisma。
 *
 * 数据来源：FotMob 比赛报告里每名球员的指标（逐场累加；FotMob 无「总传球」
 * 故「传球」取 Accurate passes，缺的指标留 0，不推算）。
 */

export type PlayerMatchMetrics = {
  /** 射门（Total shots） */
  shots: number;
  /** 射正（Shots on target） */
  shotsOnTarget: number;
  /** 关键传球（Chances created） */
  keyPasses: number;
  /** 传球（Accurate passes） */
  accuratePasses: number;
  /** 过人（Successful dribbles） */
  successfulDribbles: number;
  /** 对抗（Duels won） */
  duelsWon: number;
  /** 丢球权（Dispossessed） */
  dispossessed: number;
  /** 被犯规（Was fouled） */
  wasFouled: number;
  /** 犯规（Fouls committed） */
  foulsCommitted: number;
  /** 抢断（Tackles） */
  tackles: number;
  /** 解围（Clearances） */
  clearances: number;
};

export const EMPTY_METRICS: PlayerMatchMetrics = {
  shots: 0,
  shotsOnTarget: 0,
  keyPasses: 0,
  accuratePasses: 0,
  successfulDribbles: 0,
  duelsWon: 0,
  dispossessed: 0,
  wasFouled: 0,
  foulsCommitted: 0,
  tackles: 0,
  clearances: 0,
};

/** 赛季统计行（结构型，PlayerSeasonStatView 天然满足） */
export type PlayerStatRow = {
  appearances: number;
  goals: number;
  assists: number;
  rating: number | null;
  metrics: PlayerMatchMetrics | null;
};

export type StatColumn = {
  key: string;
  label: string;
  /** 是否以强调色/加粗展示 */
  emphasis?: boolean;
  /** 返回 null / undefined 表示无数据 → UI 显示「—」 */
  value: (row: PlayerStatRow) => string | number | null;
};

function num(value: number | null | undefined): number | null {
  return typeof value === "number" ? value : null;
}

/**
 * 赛季统计展示列（顺序即表头顺序）。
 * 阵容列表与球员资料页「赛季统计」共用，保证两处口径与顺序一致。
 */
export const SEASON_STAT_COLUMNS: StatColumn[] = [
  { key: "appearances", label: "出场", value: (row) => row.appearances },
  { key: "goals", label: "进球", emphasis: true, value: (row) => row.goals },
  { key: "assists", label: "助攻", value: (row) => row.assists },
  {
    key: "shots",
    label: "射门/射正",
    value: (row) => (row.metrics ? `${row.metrics.shots}/${row.metrics.shotsOnTarget}` : null),
  },
  { key: "keyPasses", label: "关键传球", value: (row) => num(row.metrics?.keyPasses) },
  { key: "accuratePasses", label: "传球", value: (row) => num(row.metrics?.accuratePasses) },
  { key: "successfulDribbles", label: "过人", value: (row) => num(row.metrics?.successfulDribbles) },
  { key: "duelsWon", label: "对抗", value: (row) => num(row.metrics?.duelsWon) },
  { key: "dispossessed", label: "丢球权", value: (row) => num(row.metrics?.dispossessed) },
  { key: "wasFouled", label: "被犯规", value: (row) => num(row.metrics?.wasFouled) },
  { key: "foulsCommitted", label: "犯规", value: (row) => num(row.metrics?.foulsCommitted) },
  { key: "tackles", label: "抢断", value: (row) => num(row.metrics?.tackles) },
  { key: "clearances", label: "解围", value: (row) => num(row.metrics?.clearances) },
  {
    key: "rating",
    label: "评分",
    emphasis: true,
    value: (row) => (row.rating === null ? null : row.rating.toFixed(2)),
  },
];

/** 取单元格展示文本（无数据显示「—」） */
export function statCell(column: StatColumn, row: PlayerStatRow): string | number {
  const value = column.value(row);
  return value === null || value === undefined ? "—" : value;
}
