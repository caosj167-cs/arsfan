import { describe, it, expect } from "vitest";
import { getPlayerPhoto, DEFAULT_PLAYER_PHOTO } from "@/lib/data/player-photos";

describe("getPlayerPhoto（P1-⑦ 头像回退）", () => {
  it("已知球员返回本地头像路径", () => {
    expect(getPlayerPhoto("bukayo-saka")).toBe("/players/bukayo-saka.png");
    expect(getPlayerPhoto("max-dowman")).toBe("/players/max-dowman.png");
  });
  it("未知球员回退默认占位图", () => {
    expect(getPlayerPhoto("does-not-exist")).toBe(DEFAULT_PLAYER_PHOTO);
    expect(DEFAULT_PLAYER_PHOTO).toBe("/players/default-avatar.svg");
  });
});
