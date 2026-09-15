import { describe, it, expect } from "vitest";
import {
  extraCrestForOpponentKey,
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
