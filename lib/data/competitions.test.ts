import { describe, expect, it } from "vitest";

import { isOfficialCompetition, normalizeCompetition } from "@/lib/data/competitions";

describe("normalizeCompetition", () => {
  it("英超：同名青年/次级赛事不能被误判成英超", () => {
    expect(normalizeCompetition("Premier League")).toEqual({ name: "Premier League", code: "PL" });
    expect(normalizeCompetition("EPL")).toEqual({ name: "Premier League", code: "PL" });
    expect(normalizeCompetition("Premier League 2").code).toBeNull();
    expect(normalizeCompetition("Premier League Cup").code).toBeNull();
    expect(normalizeCompetition("Premier League International Cup").code).toBeNull();
  });

  it("欧战三级：欧冠 / 欧联 / 欧协联 各自归位", () => {
    expect(normalizeCompetition("UEFA Champions League")).toEqual({ name: "UEFA Champions League", code: "CL" });
    expect(normalizeCompetition("Europa League")).toEqual({ name: "UEFA Europa League", code: "EL" });
    expect(normalizeCompetition("UEFA Europa League")).toEqual({ name: "UEFA Europa League", code: "EL" });
    expect(normalizeCompetition("UEFA Conference League")).toEqual({ name: "UEFA Conference League", code: "ECL" });
    // 旧名（Europa Conference League）含 "conference league"，不能被 /europa league/ 抢先命中
    expect(normalizeCompetition("UEFA Europa Conference League").code).toBe("ECL");
  });

  it("联赛杯 / 足总杯 / 社区盾", () => {
    expect(normalizeCompetition("EFL Cup")).toEqual({ name: "League Cup", code: "LC" });
    expect(normalizeCompetition("Carabao Cup").code).toBe("LC");
    expect(normalizeCompetition("FA Cup")).toEqual({ name: "FA Cup", code: "FAC" });
    expect(normalizeCompetition("Emirates FA Cup")).toEqual({ name: "FA Cup", code: "FAC" });
    expect(normalizeCompetition("FA Community Shield")).toEqual({ name: "Community Shield", code: "CS" });
  });

  it("热身赛类 → FR", () => {
    expect(normalizeCompetition("Pre-season friendly").code).toBe("FR");
    expect(normalizeCompetition("Emirates Cup").code).toBe("FR");
    expect(normalizeCompetition("Club Friendlies").code).toBe("FR");
  });

  it("未登记赛事 → 原样保留、code=null（不丢数据）", () => {
    expect(normalizeCompetition("UEFA Super Cup")).toEqual({ name: "UEFA Super Cup", code: null });
    expect(normalizeCompetition("FIFA Club World Cup")).toEqual({ name: "FIFA Club World Cup", code: null });
  });

  it("空值 → 未分类赛事", () => {
    expect(normalizeCompetition("")).toEqual({ name: "未分类赛事", code: null });
    expect(normalizeCompetition(null)).toEqual({ name: "未分类赛事", code: null });
  });
});

describe("isOfficialCompetition", () => {
  it("只排除 FR（热身/酋长杯），未登记赛事会被保留", () => {
    expect(isOfficialCompetition("Premier League")).toBe(true);
    expect(isOfficialCompetition("FA Community Shield")).toBe(true);
    expect(isOfficialCompetition("UEFA Conference League")).toBe(true);
    expect(isOfficialCompetition("UEFA Super Cup")).toBe(true); // 未登记但不等于 FR → 保留
    expect(isOfficialCompetition("Pre-season friendly")).toBe(false);
    expect(isOfficialCompetition("Emirates Cup")).toBe(false);
  });
});
