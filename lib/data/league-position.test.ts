import { describe, expect, it } from "vitest";

import {
  buildPositionProgression,
  parsePositionProgression,
  type LeagueMatchInput,
} from "@/lib/data/league-position";

type Result = [number, number, number, number];

/** 把 [主,客,主进球,客进球] 列表变成某一轮的比赛（调用方保证一轮 10 场） */
function round(roundNo: number, results: Result[]): LeagueMatchInput[] {
  return results.map(([home, away, homeScore, awayScore]) => ({
    round: roundNo,
    homeTeamId: home,
    homeName: `Team ${home}`,
    awayTeamId: away,
    awayName: `Team ${away}`,
    finished: true,
    homeScore,
    awayScore,
  }));
}

/** 除首场外的 9 场 0-0，凑满一轮 10 场 */
const DRAWS: Result[] = [
  [3, 4, 0, 0],
  [5, 6, 0, 0],
  [7, 8, 0, 0],
  [9, 10, 0, 0],
  [11, 12, 0, 0],
  [13, 14, 0, 0],
  [15, 16, 0, 0],
  [17, 18, 0, 0],
  [19, 20, 0, 0],
];

/** R1：1 主场 3-0 胜 2，其余 0-0 */
const ROUND1: Result[] = [[1, 2, 3, 0], ...DRAWS];

/** R2：3 主场 1-0 胜 1；4 与 2 打平；其余 0-0（去掉 DRAWS 里的 [3,4] 以免 3 双赛） */
const ROUND2: Result[] = [[3, 1, 1, 0], [4, 2, 0, 0], ...DRAWS.filter(([home]) => home !== 3)];

describe("buildPositionProgression", () => {
  it("空输入返回空", () => {
    expect(buildPositionProgression([], 1)).toEqual([]);
  });

  it("整轮 10 场后给出名次与战绩", () => {
    expect(round(1, ROUND1)).toHaveLength(10);
    const rows = buildPositionProgression(round(1, ROUND1), 1);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      round: 1,
      position: 1,
      points: 3,
      played: 1,
      won: 1,
      drawn: 0,
      lost: 0,
      goalDifference: 3,
    });
  });

  it("该轮不足 10 场则整轮跳过（不给半轮失真名次）", () => {
    const nine = round(1, ROUND1.slice(0, 9));
    expect(nine).toHaveLength(9);
    expect(buildPositionProgression(nine, 1)).toEqual([]);
  });

  it("忽略未完赛场次（导致该轮不足 10 场 → 跳过）", () => {
    const matches = round(1, ROUND1);
    matches[0] = { ...matches[0], finished: false };
    expect(buildPositionProgression(matches, 1)).toEqual([]);
  });

  it("该轮多于 10 场（脏数据/串轮）也整轮跳过，不把多余比赛计入", () => {
    const eleven = round(1, [...ROUND1, [2, 5, 9, 0] as Result]);
    expect(eleven).toHaveLength(11);
    expect(buildPositionProgression(eleven, 1)).toEqual([]);
  });

  it("多轮累加，名次会变化（R1 第1 → R2 第2）", () => {
    expect(round(2, ROUND2)).toHaveLength(10);
    const rows = buildPositionProgression([...round(1, ROUND1), ...round(2, ROUND2)], 1);
    expect(rows.map((r) => r.round)).toEqual([1, 2]);
    expect(rows.map((r) => r.position)).toEqual([1, 2]);
    expect(rows[1]).toMatchObject({ points: 3, played: 2, won: 1, drawn: 0, lost: 1, goalDifference: 2 });
  });

  it("同分按净胜球排（+5 优于 +2）", () => {
    const all = round(1, [[1, 2, 2, 0], [3, 4, 5, 0], ...DRAWS.filter(([home]) => home !== 3)]);
    expect(all).toHaveLength(10);
    expect(buildPositionProgression(all, 3)[0].position).toBe(1);
    expect(buildPositionProgression(all, 1)[0].position).toBe(2);
  });

  it("轮次乱序输入按轮次升序输出", () => {
    const all = [...round(2, ROUND2), ...round(1, ROUND1)];
    expect(buildPositionProgression(all, 1).map((r) => r.round)).toEqual([1, 2]);
  });

  it("目标球队不在数据里 → 空", () => {
    expect(buildPositionProgression(round(1, ROUND1), 999)).toEqual([]);
  });
});

describe("parsePositionProgression（校验 SyncRun.metadata 里的 JSON）", () => {
  it("非数组 → 空", () => {
    expect(parsePositionProgression(null)).toEqual([]);
    expect(parsePositionProgression({})).toEqual([]);
    expect(parsePositionProgression("x")).toEqual([]);
  });

  it("丢弃字段缺失/类型不对的行，并按轮次排序", () => {
    const rows = parsePositionProgression([
      { round: 2, position: 2, points: 3, played: 2, won: 1, drawn: 0, lost: 1, goalDifference: 2 },
      { round: 1, position: 1, points: 3, played: 1, won: 1, drawn: 0, lost: 0, goalDifference: 3 },
      { round: "3", position: 1 },
      null,
    ]);
    expect(rows.map((r) => r.round)).toEqual([1, 2]);
    expect(rows[0].position).toBe(1);
  });
});
