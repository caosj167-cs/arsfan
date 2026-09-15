import { describe, it, expect } from "vitest";
import {
  crestIndexByOpponentKey,
  extraCrestForOpponentKey,
  resolveOpponentCrest,
  EXTRA_CREST_BY_OPPONENT_NAME,
  EXTRA_OPPONENT_CRESTS,
} from "@/lib/data/crests";

describe("crests（P1-⑤ 8 队静态队徽）", () => {
  it("按 opponentKey 取固化队徽", () => {
    expect(extraCrestForOpponentKey("napoli")).toBe("https://crests.football-data.org/113.png");
    expect(extraCrestForOpponentKey("realmadrid")).toBe("https://crests.football-data.org/86.png");
    expect(extraCrestForOpponentKey("realbetis")).toBe("https://crests.football-data.org/90.png");
  });
  it("未知对手返回 null", () => {
    expect(extraCrestForOpponentKey("tottenhamhotspur")).toBeNull();
  });
  it("按原始对手名取队徽（team-data 合并用）", () => {
    expect(EXTRA_CREST_BY_OPPONENT_NAME["Real Madrid"]).toBe("https://crests.football-data.org/86.png");
    expect(EXTRA_CREST_BY_OPPONENT_NAME["Bayern München"]).toBe("https://crests.football-data.org/5.png");
  });
  it("8 支对手全部覆盖", () => {
    expect(Object.keys(EXTRA_OPPONENT_CRESTS).length).toBe(8);
  });
});

describe("crestIndexByOpponentKey（球队表按名索引）", () => {
  const teams = [
    { name: "Ipswich Town FC", crest: "https://crests.football-data.org/349.png" },
    { name: "Manchester City FC", crest: "https://crests.football-data.org/65.png" },
    { name: "No Crest FC", crest: null },
  ];

  it("用与 opponentKey 同口径的键索引（去 FC 后缀）", () => {
    const index = crestIndexByOpponentKey(teams);
    expect(index.get("ipswichtown")).toBe("https://crests.football-data.org/349.png");
    expect(index.get("manchestercity")).toBe("https://crests.football-data.org/65.png");
  });

  it("无队徽的队不入索引", () => {
    expect(crestIndexByOpponentKey(teams).has("nocrest")).toBe(false);
  });

  it("同键重复时保留先出现的", () => {
    const index = crestIndexByOpponentKey([
      { name: "Ipswich Town FC", crest: "first" },
      { name: "Ipswich Town", crest: "second" },
    ]);
    expect(index.get("ipswichtown")).toBe("first");
  });
});

describe("resolveOpponentCrest（兜底链优先级）", () => {
  const teamCrests = crestIndexByOpponentKey([
    { name: "Ipswich Town FC", crest: "team-table" },
  ]);

  it("来源给的队徽最优先", () => {
    expect(resolveOpponentCrest({ fromSources: "from-source", opponentKey: "ipswichtown", teamCrests })).toBe("from-source");
  });

  it("来源没有 → 球队表按名回查（本次修复的场景）", () => {
    expect(resolveOpponentCrest({ fromSources: null, opponentKey: "ipswichtown", teamCrests })).toBe("team-table");
  });

  it("球队表也没有 → 静态固化表（欧冠/杯赛 8 队）", () => {
    expect(resolveOpponentCrest({ fromSources: null, opponentKey: "napoli", teamCrests: new Map() })).toBe(
      "https://crests.football-data.org/113.png",
    );
  });

  it("都没有 → null（页面上仍回退字母章）", () => {
    expect(resolveOpponentCrest({ fromSources: undefined, opponentKey: "unknownclub", teamCrests: new Map() })).toBeNull();
  });
});
