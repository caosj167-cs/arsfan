import { describe, expect, it } from "vitest";

import { parseGoalsPair } from "@/lib/providers/fotmob";

/**
 * FotMob 联赛表的 scoresStr 是「进球-失球」（如 "8-1"）。
 * 解析一旦反了，积分榜的净胜球/进失球就会整列错位，故单测锁死。
 */
describe("parseGoalsPair", () => {
  it("解析进球-失球（左为进球）", () => {
    expect(parseGoalsPair("8-1")).toEqual({ goalsFor: 8, goalsAgainst: 1 });
  });

  it("两位失球不截断", () => {
    expect(parseGoalsPair("13-5")).toEqual({ goalsFor: 13, goalsAgainst: 5 });
  });

  it("容忍空格", () => {
    expect(parseGoalsPair(" 4 - 7 ")).toEqual({ goalsFor: 4, goalsAgainst: 7 });
  });

  it("零进球零失球", () => {
    expect(parseGoalsPair("0-0")).toEqual({ goalsFor: 0, goalsAgainst: 0 });
  });

  it("缺失或非法返回 null（调用方应记入 missing，不编造）", () => {
    expect(parseGoalsPair(null)).toBeNull();
    expect(parseGoalsPair("")).toBeNull();
    expect(parseGoalsPair("—")).toBeNull();
    expect(parseGoalsPair("8:1")).toBeNull();
  });
});
