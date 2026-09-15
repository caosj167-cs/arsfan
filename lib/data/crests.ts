// 8 支非英超对手（欧冠 / 联赛杯 / 足总杯）的队徽，football-data CDN 静态映射。
//
// 这些球队不在 football-data 的英超球队表里，arsenal.com / wikipedia 也未回传队徽，
// 因此 FixtureEntry.opponentCrest 长期为空 → 队标回退成字母章。
// 这里用与 FixtureEntry 一致的 opponentKey（见 lib/sync/fixtureEntries.ts）作键固化。
//
// 所有 URL 均已用 HEAD 校验返回 200，且 crests.football-data.org 已在
// lib/images.ts 的 OPTIMIZABLE_IMAGE_HOSTS 白名单内（走 next/image 优化）。

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
