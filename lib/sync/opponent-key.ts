/** 对手归一化 key：去变音符、去 F.C./AFC/FC 等后缀与符号。
 *
 * 与 FixtureEntry 的唯一键 (season, opponentKey, homeAway, matchDate) 共用，
 * 也是 lib/data/crests.ts 静态队徽映射的键。单独抽成无依赖纯函数以便单测，
 * 并验证归一化结果确实能命中队徽映射的键。
 */
export function opponentKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[øØ]/g, "o")
    .replace(/[đĐ]/g, "d")
    .replace(/[łŁ]/g, "l")
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\b(a ?f ?c|f ?c|w ?f ?c)\b/g, "")
    .replace(/\b(afc|fc|wfc|women|ladies|reserves|u21|u18)\b/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]/g, "");
}
