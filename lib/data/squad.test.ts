import { describe, expect, it } from "vitest";

import { SQUAD_PLAYERS, getPlayerById, searchSquadPlayers } from "@/lib/data/squad";

describe("searchSquadPlayers（顶栏搜索球员）", () => {
  it("空查询返回空数组", () => {
    expect(searchSquadPlayers("")).toEqual([]);
    expect(searchSquadPlayers("   ")).toEqual([]);
  });

  it("按英文名（不区分大小写）命中", () => {
    const hits = searchSquadPlayers("saka");
    expect(hits.map((p) => p.id)).toContain("bukayo-saka");
    expect(searchSquadPlayers("SAKA").map((p) => p.id)).toContain("bukayo-saka");
  });

  it("按中文名命中", () => {
    const hits = searchSquadPlayers("萨卡");
    expect(hits.map((p) => p.id)).toContain("bukayo-saka");
  });

  it("按 slug 命中", () => {
    const hits = searchSquadPlayers("max-dowman");
    expect(hits.map((p) => p.id)).toEqual(["max-dowman"]);
  });

  it("带变音符的英文名：纯 ascii 查询经 slug 命中，原名亦可命中", () => {
    // nameEn 为 Ødegaard（含变音符），纯 ascii "odegaard" 靠 slug martin-odegaard 命中
    expect(searchSquadPlayers("odegaard").map((p) => p.id)).toContain("martin-odegaard");
    expect(searchSquadPlayers("Ødegaard").map((p) => p.id)).toContain("martin-odegaard");
  });

  it("limit 生效", () => {
    expect(searchSquadPlayers("a", 3).length).toBeLessThanOrEqual(3);
  });

  it("命中的球员都存在于名册中", () => {
    for (const p of searchSquadPlayers("a", 8)) {
      expect(getPlayerById(p.id)).toBeDefined();
      expect(SQUAD_PLAYERS).toContain(p);
    }
  });
});
