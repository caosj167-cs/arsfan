// 8 支非英超对手（欧冠 / 联赛杯 / 足总杯）的队徽，football-data CDN 静态映射。
//
// 这些球队不在 football-data 的英超球队表里，arsenal.com / wikipedia 也未回传队徽，
// 因此 FixtureEntry.opponentCrest 长期为空 → 队标回退成字母章。
// 这里用与 FixtureEntry 一致的 opponentKey（见 lib/sync/fixtureEntries.ts）作键固化。
//
// 所有 URL 均已用 HEAD 校验返回 200，且 crests.football-data.org 已在
// lib/images.ts 的 OPTIMIZABLE_IMAGE_HOSTS 白名单内（走 next/image 优化）。

import { opponentKey } from "@/lib/sync/opponent-key";

export const EXTRA_OPPONENT_CRESTS: Record<string, string> = {
  napoli: "https://crests.football-data.org/113.png",
  lille: "https://crests.football-data.org/521.png",
  bayernmunchen: "https://crests.football-data.org/5.png",
  slaviapraha: "https://crests.football-data.org/930.png",
  borussiadortmund: "https://crests.football-data.org/4.png",
  sabah: "https://crests.football-data.org/10233.png",
  realmadrid: "https://crests.football-data.org/86.png",
  realbetis: "https://crests.football-data.org/90.png",
};

/** 按 opponentKey 取固化队徽；无则返回 null。 */
export function extraCrestForOpponentKey(key: string): string | null {
  return EXTRA_OPPONENT_CRESTS[key] ?? null;
}

/**
 * 用「球队表」（football-data 的 20 支英超队）按归一化队名建队徽索引。
 *
 * 用途：合并赛程时，若**没有任何来源**给出队徽，再按对手名回查这张表兜底。
 * 典型场景——某场比赛只有 arsenal.com / wikipedia 有（football-data 的赛程里没有这场，
 * 因此不带队徽），例如本季 9/15 客场对伊普斯维奇、8/16 社区盾对曼城：
 * 它们在 `Team` 表里都有队徽，只走静态表会漏掉 → 队标回退成字母章。
 *
 * 键与 FixtureEntry.opponentKey 同口径（`opponentKey()` 纯函数）。
 */
export function crestIndexByOpponentKey(
  teams: Array<{ name: string; crest: string | null }>,
): Map<string, string> {
  const index = new Map<string, string>();
  for (const team of teams) {
    if (!team.crest) continue;
    const key = opponentKey(team.name);
    if (key && !index.has(key)) index.set(key, team.crest);
  }
  return index;
}

/** 队徽兜底链：来源给的最优先 → 球队表按名回查 → 静态固化表 → null */
export function resolveOpponentCrest(options: {
  fromSources: string | null | undefined;
  opponentKey: string;
  teamCrests?: Map<string, string>;
}): string | null {
  return (
    options.fromSources ??
    options.teamCrests?.get(options.opponentKey) ??
    extraCrestForOpponentKey(options.opponentKey) ??
    null
  );
}

/**
 * 按「原始对手名」取固化队徽，供 team-data 的 buildCrestMap 直接合并使用。
 * 键名与 FixtureEntry.opponentName 的实际存储值一致（已用 DB 实查核对）。
 */
export const EXTRA_CREST_BY_OPPONENT_NAME: Record<string, string> = {
  Napoli: EXTRA_OPPONENT_CRESTS.napoli,
  Lille: EXTRA_OPPONENT_CRESTS.lille,
  "Bayern München": EXTRA_OPPONENT_CRESTS.bayernmunchen,
  "Slavia Praha": EXTRA_OPPONENT_CRESTS.slaviapraha,
  "Borussia Dortmund": EXTRA_OPPONENT_CRESTS.borussiadortmund,
  "Real Madrid": EXTRA_OPPONENT_CRESTS.realmadrid,
  "Real Betis": EXTRA_OPPONENT_CRESTS.realbetis,
  Sabah: EXTRA_OPPONENT_CRESTS.sabah,
};
