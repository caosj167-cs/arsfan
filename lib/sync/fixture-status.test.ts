import { describe, it, expect } from "vitest";
import { deriveFixtureEntryStatus, planFixtureEntryDeletion } from "@/lib/sync/fixture-status";
import type { FixtureSourceLabel } from "@/lib/sync/fixture-status";

describe("deriveFixtureEntryStatus（P1-④ 状态判定）", () => {
  it("fd FINISHED → FINISHED（已开赛）", () => {
    expect(
      deriveFixtureEntryStatus({ fdStatus: "FINISHED", sourceStatuses: ["FINISHED"], started: true, hasSameDayScore: false }),
    ).toBe("FINISHED");
  });

  it("已完赛但 fd 卡 TIMED、wikipedia 有比分 → FINISHED（桑德兰场景）", () => {
    const status = deriveFixtureEntryStatus({
      fdStatus: "TIMED",
      sourceStatuses: ["TIMED", "FINISHED"],
      started: true,
      hasSameDayScore: true,
    });
    expect(status).toBe("FINISHED");
  });

  it("进行中（IN_PLAY）保留实时状态，不被有比分误判为 FINISHED", () => {
    const status = deriveFixtureEntryStatus({
      fdStatus: "IN_PLAY",
      sourceStatuses: ["IN_PLAY"],
      started: true,
      hasSameDayScore: true,
    });
    expect(status).toBe("IN_PLAY");
  });

  it("未开赛且 fd SCHEDULED → SCHEDULED", () => {
    expect(
      deriveFixtureEntryStatus({ fdStatus: "SCHEDULED", sourceStatuses: ["SCHEDULED"], started: false, hasSameDayScore: false }),
    ).toBe("SCHEDULED");
  });

  it("未开赛且 fd 为 null → SCHEDULED", () => {
    expect(
      deriveFixtureEntryStatus({ fdStatus: null, sourceStatuses: [], started: false, hasSameDayScore: false }),
    ).toBe("SCHEDULED");
  });

  it("未开赛且 fd 非 SETTLED（脏数据 TIMED）→ 保留 fd 原值", () => {
    expect(
      deriveFixtureEntryStatus({ fdStatus: "TIMED", sourceStatuses: ["TIMED"], started: false, hasSameDayScore: false }),
    ).toBe("TIMED");
  });

  it("已开赛、无 fd 状态但有同日比分 → FINISHED", () => {
    expect(
      deriveFixtureEntryStatus({ fdStatus: undefined, sourceStatuses: ["SCHEDULED"], started: true, hasSameDayScore: true }),
    ).toBe("FINISHED");
  });

  it("已开赛、有 AWARDED 终场 → FINISHED", () => {
    expect(
      deriveFixtureEntryStatus({ fdStatus: "AWARDED", sourceStatuses: ["AWARDED"], started: true, hasSameDayScore: true }),
    ).toBe("FINISHED");
  });
});

const rows = (ids: string[], source: FixtureSourceLabel) =>
  ids.map((id) => ({ id, primarySource: source }));

describe("planFixtureEntryDeletion（P1-③ 破坏性删除守卫）", () => {
  it("三源全成功：删所有孤儿（不在 keepIds 的行）", () => {
    const existing = [...rows(["a"], "football-data.org"), ...rows(["b"], "arsenal.com"), ...rows(["c"], "wikipedia")];
    expect(planFixtureEntryDeletion({ keepIds: ["a"], failedSources: [], existingRows: existing })).toEqual(["b", "c"]);
  });

  it("arsenal.com 失败：保留其独有行，只删其它孤儿", () => {
    const existing = [...rows(["x"], "football-data.org"), ...rows(["y"], "arsenal.com"), ...rows(["z"], "wikipedia")];
    const del = planFixtureEntryDeletion({ keepIds: [], failedSources: ["arsenal.com"], existingRows: existing });
    expect(del.sort()).toEqual(["x", "z"]);
    expect(del).not.toContain("y");
  });

  it("wikipedia 失败：保留其独有行", () => {
    const existing = [...rows(["x"], "football-data.org"), ...rows(["y"], "arsenal.com"), ...rows(["z"], "wikipedia")];
    const del = planFixtureEntryDeletion({ keepIds: [], failedSources: ["wikipedia"], existingRows: existing });
    expect(del.sort()).toEqual(["x", "y"]);
  });

  it("两源都失败：只删 football-data.org 的孤儿", () => {
    const existing = [...rows(["x"], "football-data.org"), ...rows(["y"], "arsenal.com"), ...rows(["z"], "wikipedia")];
    const del = planFixtureEntryDeletion({
      keepIds: [],
      failedSources: ["arsenal.com", "wikipedia"],
      existingRows: existing,
    });
    expect(del).toEqual(["x"]);
  });

  it("keepIds 已覆盖全部行 → 不删任何行", () => {
    const existing = [...rows(["a"], "football-data.org"), ...rows(["b"], "arsenal.com")];
    expect(planFixtureEntryDeletion({ keepIds: ["a", "b"], failedSources: [], existingRows: existing })).toEqual([]);
  });
});
