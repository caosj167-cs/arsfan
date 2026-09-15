/**
 * 英超排名走势：用「整轮联赛的比赛结果」逐轮推算联赛榜，取出目标球队每轮结束后的名次。
 *
 * 为什么必须用全部场次：名次取决于**其它球队**的结果，只看自己的赛程是算不出排名的。
 * 数据源为 FotMob 联赛页的 `fixtures.allMatches`（38 轮 × 10 场，含已完赛比分）。
 *
 * 纯函数、无依赖（不 import prisma），可被客户端组件安全引用，也可直接单测。
 *
 * 排序口径：积分 ↓ → 净胜球 ↓ → 进球 ↓ → 队名（与英超/常见实现一致）。
 */

export type LeagueMatchInput = {
  round: number | null;
  homeTeamId: number;
  homeName: string;
  awayTeamId: number;
  awayName: string;
  finished: boolean;
  homeScore: number | null;
  awayScore: number | null;
};

export type PositionPoint = {
  /** 第几轮（仅在该轮全部场次均已完赛时计入） */
  round: number;
  /** 目标球队本轮结束后的名次 */
  position: number;
  points: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalDifference: number;
};

type TeamRecord = {
  teamId: number;
  name: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
};

/** 一轮的场次数（英超 20 队 → 10 场）。不足即视为该轮未完成。 */
export const MATCHES_PER_ROUND = 10;

function sortTable(records: TeamRecord[]): TeamRecord[] {
  return [...records].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const gdA = a.goalsFor - a.goalsAgainst;
    const gdB = b.goalsFor - b.goalsAgainst;
    if (gdB !== gdA) return gdB - gdA;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    return a.name.localeCompare(b.name);
  });
}

/**
 * 逐轮推算目标球队的名次走势。
 * 只处理「有比分且 finished」的场次；某轮不足 {@link MATCHES_PER_ROUND} 场则整轮跳过，
 * 以免给出「半轮」失真名次（宁可缺口，不编造）。
 */
export function buildPositionProgression(matches: LeagueMatchInput[], teamId: number): PositionPoint[] {
  const byRound = new Map<number, LeagueMatchInput[]>();
  for (const match of matches) {
    if (match.round === null || !match.finished) continue;
    if (match.homeScore === null || match.awayScore === null) continue;
    const list = byRound.get(match.round) ?? [];
    list.push(match);
    byRound.set(match.round, list);
  }

  const records = new Map<number, TeamRecord>();
  const ensure = (id: number, name: string): TeamRecord => {
    let record = records.get(id);
    if (!record) {
      record = { teamId: id, name, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 };
      records.set(id, record);
    }
    if (!record.name && name) record.name = name;
    return record;
  };

  const points: PositionPoint[] = [];
  const rounds = [...byRound.keys()].sort((a, b) => a - b);

  for (const round of rounds) {
    const roundMatches = byRound.get(round) ?? [];
    // 必须**恰好** 10 场才算这一轮完整：少于 10 是还没踢完；
    // 多于 10 说明数据有重复/串轮，宁可跳过也不要算出错误名次。
    if (roundMatches.length !== MATCHES_PER_ROUND) continue;

    for (const match of roundMatches) {
      const home = ensure(match.homeTeamId, match.homeName);
      const away = ensure(match.awayTeamId, match.awayName);
      const homeGoals = match.homeScore as number;
      const awayGoals = match.awayScore as number;

      home.played += 1;
      away.played += 1;
      home.goalsFor += homeGoals;
      home.goalsAgainst += awayGoals;
      away.goalsFor += awayGoals;
      away.goalsAgainst += homeGoals;

      if (homeGoals > awayGoals) {
        home.won += 1;
        home.points += 3;
        away.lost += 1;
      } else if (homeGoals < awayGoals) {
        away.won += 1;
        away.points += 3;
        home.lost += 1;
      } else {
        home.drawn += 1;
        away.drawn += 1;
        home.points += 1;
        away.points += 1;
      }
    }

    const table = sortTable([...records.values()]);
    const index = table.findIndex((record) => record.teamId === teamId);
    if (index < 0) continue;
    const record = table[index];
    points.push({
      round,
      position: index + 1,
      points: record.points,
      played: record.played,
      won: record.won,
      drawn: record.drawn,
      lost: record.lost,
      goalDifference: record.goalsFor - record.goalsAgainst,
    });
  }

  return points;
}

/**
 * 校验并解析同步时写进 `SyncRun.metadata` 的走势数据。
 * 脏 JSON 一律丢弃（宁可不画，也不让页面因未知形状的 Json 崩掉）。
 */
export function parsePositionProgression(value: unknown): PositionPoint[] {
  if (!Array.isArray(value)) return [];
  const numericKeys = ["round", "position", "points", "played", "won", "drawn", "lost", "goalDifference"] as const;
  const out: PositionPoint[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    if (!numericKeys.every((key) => typeof row[key] === "number" && Number.isFinite(row[key]))) continue;
    out.push({
      round: row.round as number,
      position: row.position as number,
      points: row.points as number,
      played: row.played as number,
      won: row.won as number,
      drawn: row.drawn as number,
      lost: row.lost as number,
      goalDifference: row.goalDifference as number,
    });
  }
  return out.sort((a, b) => a.round - b.round);
}
