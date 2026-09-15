import { describe, expect, it } from "vitest";

import { normalizeCompetition } from "@/lib/data/competitions";
import {
  competitionTitleFor,
  parseHeadings,
  sectionPath,
  type WikiHeading,
} from "@/lib/providers/wikipedia";

/** [级别, 标题] → heading 序列（pos 递增） */
function headings(spec: Array<[number, string]>): WikiHeading[] {
  return spec.map(([level, title], index) => ({ pos: index * 100, level, title }));
}

/** 假装比赛出现在最后一个标题之后 */
function pick(spec: Array<[number, string]>): string {
  return competitionTitleFor(headings(spec), (spec.length - 1) * 100 + 50);
}

describe("parseHeadings", () => {
  it("识别 2~6 级标题，且 3 级不会被误当成 2 级", () => {
    const wikitext = "== A ==\ntext\n=== B ===\nmore\n====== C ======\n";
    expect(parseHeadings(wikitext).map((h) => [h.level, h.title])).toEqual([
      [2, "A"],
      [3, "B"],
      [6, "C"],
    ]);
  });
});

describe("sectionPath（所属小节路径：由外到内）", () => {
  it("同级标题会结束上一节，只保留严格递减的包含链", () => {
    const all = headings([[2, "Competitions"], [3, "Overall record"], [3, "FA Community Shield"]]);
    expect(sectionPath(all, 250).map((h) => h.title)).toEqual(["Competitions", "FA Community Shield"]);
  });

  it("忽略比赛之后的标题", () => {
    const all = headings([[2, "Competitions"], [3, "Premier League"], [2, "Statistics"]]);
    expect(sectionPath(all, 150).map((h) => h.title)).toEqual(["Competitions", "Premier League"]);
  });
});

describe("competitionTitleFor", () => {
  it("社区盾：不再返回容器名 Competitions（本次修复的 bug）", () => {
    // 与真实维基页同构：== Competitions == → === Overall record === / === FA Community Shield ===
    const spec: Array<[number, string]> = [
      [2, "Review"],
      [2, "Kits"],
      [2, "Pre-season and friendlies"],
      [2, "Competitions"],
      [3, "Overall record"],
      [3, "FA Community Shield"],
    ];
    expect(pick(spec)).toBe("FA Community Shield");
    expect(normalizeCompetition(pick(spec))).toEqual({ name: "Community Shield", code: "CS" });
  });

  it("联赛：跳过 L4 的 Matches，命中 L3 的 Premier League", () => {
    expect(
      pick([[2, "Competitions"], [3, "Premier League"], [4, "Results by round"], [4, "Matches"]]),
    ).toBe("Premier League");
  });

  it("欧冠：跳过 League phase / Matches，命中 L3", () => {
    expect(
      pick([[2, "Competitions"], [3, "UEFA Champions League"], [4, "League phase"], [5, "Matches"]]),
    ).toBe("UEFA Champions League");
  });

  it("季前热身：命中 L2（并识别为 Friendly → code FR）", () => {
    const title = pick([[2, "Pre-season and friendlies"]]);
    expect(title).toBe("Pre-season and friendlies");
    expect(normalizeCompetition(title).code).toBe("FR");
  });

  it("未知赛事但非容器标题：直接用该标题，而不是容器名", () => {
    expect(pick([[2, "Competitions"], [3, "UEFA Super Cup"]])).toBe("UEFA Super Cup");
  });
});

describe("normalizeCompetition 的社区盾规则", () => {
  it("FA Community Shield → Community Shield / CS（页面标签命中「社区盾」）", () => {
    expect(normalizeCompetition("FA Community Shield")).toEqual({ name: "Community Shield", code: "CS" });
    expect(normalizeCompetition("Community Shield")).toEqual({ name: "Community Shield", code: "CS" });
  });
});
