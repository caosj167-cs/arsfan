/**
 * 球员名归一化（纯函数，服务端与客户端均可安全引入；**不可**引入 Prisma）。
 *
 * 用途：把不同数据源的球员名（squad slug / api-football 缩写 / FotMob 全名）
 * 收敛成同一匹配键，供「真实赛季统计 ↔ 阵容名单」对齐。
 */

/** 去掉变音符（é→e、ã→a），并手工处理 NFD 不分解的 Ø/Đ/Ł 等 */
export function transliterate(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[øØ]/g, "o")
    .replace(/[đĐ]/g, "d")
    .replace(/[łŁ]/g, "l")
    .toLowerCase();
}

/**
 * 匹配键：首字母 + 末单词（如 "Declan Rice"→"drice"、"D. Rice"→"drice"）。
 * 各源命名不一致（缩写名 / 全名 / slug），只看姓或全名都会漏配，故统一收敛。
 */
export function playerMatchKey(value: string): string {
  const tokens = transliterate(value)
    .replace(/[^a-z0-9\s]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length === 0) return "";
  return `${tokens[0][0] ?? ""}${tokens[tokens.length - 1]}`;
}

/** 把 squad slug（"gabriel-magalhaes"）转成展示名（"Gabriel Magalhaes"） */
export function slugToPlayerName(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
}
