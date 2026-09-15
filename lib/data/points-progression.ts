/**
 * 联赛积分走势：把「已完赛 + 有比分」的联赛赛程折算成逐场累计积分 / 净胜球，
 * 供球队数据页「积分榜」tab 画积分曲线。
 *
 * 纯函数、无依赖（不 import prisma），可被客户端组件安全引用，也可直接单测。
 *
 * 口径要点：`homeScore`/`awayScore` 是**主队/客队**的进球数（字面值），
 * 阿森纳在哪一侧由 `homeAway` 决定 —— 取错侧会让胜负整体反转、积分全错。
 */

export type ProgressionInput = {
  competitionCode: string | null;
  kickoffAt: string;
  opponentName: string;
  homeAway: "HOME" | "AWAY";
  status: string;
  homeScore: number | null;
  awayScore: number | null;
};

export type ProgressionPoint = {
  /** 第几场（1-based，仅计已完赛的联赛场次） */
  matchday: number;
  kickoffAt: string;
  opponentName: string;
  homeAway: "HOME" | "AWAY";
  /** 本场阿森纳进球 */
  goalsFor: number;
  /** 本场阿森纳失球 */
  goalsAgainst: number;
  result: "W" | "D" | "L";
  /** 本场净胜球（可负） */
  goalDiff: number;
  /** 累计积分 */
  cumulativePoints: number;
  /** 累计净胜球 */
  cumulativeGoalDiff: number;
};

/** 单场「阿森纳视角」的进球/失球；比分缺失返回 null。 */
export function arsenalGoals(
  homeAway: "HOME" | "AWAY",
  homeScore: number | null,
  awayScore: number | null,
): { goalsFor: number; goalsAgainst: number } | null {
  if (homeScore === null || awayScore === null) return null;
  return homeAway === "HOME"
    ? { goalsFor: homeScore, goalsAgainst: awayScore }
    : { goalsFor: awayScore, goalsAgainst: homeScore };
}

/**
 * 按时间升序累加出积分走势。
 * 只取 `competitionCode` 匹配、`status === "FINISHED"` 且比分齐全的场次；其余忽略。
 */
export function buildLeagueProgression(
  entries: ProgressionInput[],
  competitionCode = "PL",
): ProgressionPoint[] {
  const played = entries
    .filter((entry) => entry.competitionCode === competitionCode && entry.status === "FINISHED")
    .slice()
    .sort((a, b) => a.kickoffAt.localeCompare(b.kickoffAt));

  const points: ProgressionPoint[] = [];
  let cumulativePoints = 0;
  let cumulativeGoalDiff = 0;

  for (const entry of played) {
    const goals = arsenalGoals(entry.homeAway, entry.homeScore, entry.awayScore);
    if (!goals) continue;
    const result: ProgressionPoint["result"] =
      goals.goalsFor > goals.goalsAgainst ? "W" : goals.goalsFor === goals.goalsAgainst ? "D" : "L";
    cumulativePoints += result === "W" ? 3 : result === "D" ? 1 : 0;
    const goalDiff = goals.goalsFor - goals.goalsAgainst;
    cumulativeGoalDiff += goalDiff;
    points.push({
      matchday: points.length + 1,
      kickoffAt: entry.kickoffAt,
      opponentName: entry.opponentName,
      homeAway: entry.homeAway,
      goalsFor: goals.goalsFor,
      goalsAgainst: goals.goalsAgainst,
      result,
      goalDiff,
      cumulativePoints,
      cumulativeGoalDiff,
    });
  }

  return points;
}
