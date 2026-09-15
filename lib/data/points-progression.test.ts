import { describe, expect, it } from "vitest";

import { arsenalGoals, buildLeagueProgression, type ProgressionInput } from "@/lib/data/points-progression";

function entry(over: Partial<ProgressionInput> = {}): ProgressionInput {
  return {
    competitionCode: "PL",
    kickoffAt: "2026-08-21T00:00:00.000Z",
    opponentName: "Coventry City FC",
    homeAway: "HOME",
    status: "FINISHED",
    homeScore: 3,
    awayScore: 0,
    ...over,
  };
}

describe("arsenalGoals（主客取侧）", () => {
  it("主场：homeScore 是阿森纳进球", () => {
    expect(arsenalGoals("HOME", 2, 1)).toEqual({ goalsFor: 2, goalsAgainst: 1 });
  });

  it("客场：awayScore 是阿森纳进球（取错侧会整体反转）", () => {
    expect(arsenalGoals("AWAY", 0, 2)).toEqual({ goalsFor: 2, goalsAgainst: 0 });
  });

  it("比分缺失返回 null", () => {
    expect(arsenalGoals("HOME", null, 1)).toBeNull();
    expect(arsenalGoals("AWAY", 1, null)).toBeNull();
  });
});

describe("buildLeagueProgression", () => {
  it("按时间升序累加，主场胜=3 分", () => {
    const rows = buildLeagueProgression([entry()]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      matchday: 1,
      result: "W",
      goalsFor: 3,
      goalsAgainst: 0,
      goalDiff: 3,
      cumulativePoints: 3,
      cumulativeGoalDiff: 3,
    });
  });

  it("客场胜也算 3 分（不是按主场比分判定）", () => {
    const rows = buildLeagueProgression([
      entry({ kickoffAt: "2026-08-31T00:00:00.000Z", homeAway: "AWAY", homeScore: 0, awayScore: 1 }),
    ]);
    expect(rows[0]).toMatchObject({ result: "W", goalsFor: 1, goalsAgainst: 0, cumulativePoints: 3 });
  });

  it("胜/平/负累计与净胜球累加", () => {
    const rows = buildLeagueProgression([
      entry({ kickoffAt: "2026-01-01T00:00:00.000Z", homeScore: 3, awayScore: 0 }), // W +3 → 3
      entry({ kickoffAt: "2026-01-02T00:00:00.000Z", homeScore: 1, awayScore: 1 }), // D +1 → 4
      entry({ kickoffAt: "2026-01-03T00:00:00.000Z", homeScore: 0, awayScore: 2 }), // L +0 → 4
    ]);
    expect(rows.map((r) => r.result)).toEqual(["W", "D", "L"]);
    expect(rows.map((r) => r.cumulativePoints)).toEqual([3, 4, 4]);
    expect(rows.map((r) => r.cumulativeGoalDiff)).toEqual([3, 3, 1]);
  });

  it("乱序输入按 kickoffAt 重排后再累加", () => {
    const rows = buildLeagueProgression([
      entry({ kickoffAt: "2026-01-03T00:00:00.000Z", homeScore: 0, awayScore: 2 }),
      entry({ kickoffAt: "2026-01-01T00:00:00.000Z", homeScore: 3, awayScore: 0 }),
    ]);
    expect(rows.map((r) => r.matchday)).toEqual([1, 2]);
    expect(rows.map((r) => r.cumulativePoints)).toEqual([3, 3]);
  });

  it("忽略非目标赛事 / 未完赛 / 缺比分的场次", () => {
    const rows = buildLeagueProgression([
      entry(),
      entry({ competitionCode: "CL" }), // 欧冠
      entry({ status: "TIMED" }), // 未开赛
      entry({ homeScore: null }), // 缺比分
      entry({ competitionCode: null }), // 脏数据（如 'Competitions'）
    ]);
    expect(rows).toHaveLength(1);
  });

  it("全胜 4 场 = 12 分（与 FotMob 积分榜口径一致）", () => {
    const rows = buildLeagueProgression([
      entry({ kickoffAt: "2026-01-01T00:00:00.000Z" }),
      entry({ kickoffAt: "2026-01-02T00:00:00.000Z", homeAway: "AWAY", homeScore: 0, awayScore: 1 }),
      entry({ kickoffAt: "2026-01-03T00:00:00.000Z", homeScore: 2, awayScore: 1 }),
      entry({ kickoffAt: "2026-01-04T00:00:00.000Z", homeAway: "AWAY", homeScore: 0, awayScore: 2 }),
    ]);
    expect(rows.map((r) => r.cumulativePoints)).toEqual([3, 6, 9, 12]);
    expect(rows[3].cumulativeGoalDiff).toBe(7);
  });

  it("空输入返回空数组", () => {
    expect(buildLeagueProgression([])).toEqual([]);
  });
});
