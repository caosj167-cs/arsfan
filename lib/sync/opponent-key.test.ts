import { describe, it, expect } from "vitest";
import { opponentKey } from "@/lib/sync/opponent-key";
import { EXTRA_OPPONENT_CRESTS } from "@/lib/data/crests";

describe("opponentKey（与静态队徽映射键一致）", () => {
  it("Bayern München → bayernmunchen（去变音符 + 去空格）", () => {
    expect(opponentKey("Bayern München")).toBe("bayernmunchen");
  });
  it("Real Madrid → realmadrid", () => {
    expect(opponentKey("Real Madrid")).toBe("realmadrid");
  });
  it("Slavia Praha → slaviapraha", () => {
    expect(opponentKey("Slavia Praha")).toBe("slaviapraha");
  });
  it("Borussia Dortmund → borussiadortmund", () => {
    expect(opponentKey("Borussia Dortmund")).toBe("borussiadortmund");
  });
  it("FC Barcelona → barcelona（去 FC 后缀）", () => {
    expect(opponentKey("FC Barcelona")).toBe("barcelona");
  });
  it("Arsenal FC → arsenal", () => {
    expect(opponentKey("Arsenal FC")).toBe("arsenal");
  });
  it("AFC Bournemouth → bournemouth", () => {
    expect(opponentKey("AFC Bournemouth")).toBe("bournemouth");
  });
  it("归一化结果能命中 crests.ts 的静态队徽键（不变量）", () => {
    for (const key of Object.keys(EXTRA_OPPONENT_CRESTS)) {
      expect(opponentKey(key)).toBe(key);
    }
  });
});
