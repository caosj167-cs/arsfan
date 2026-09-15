/**
 * 赛事名归一化：不同来源（football-data / arsenal.com / Wikipedia）对同一赛事的叫法不同，
 * 统一收敛为 { name, code }，便于跨源合并与展示。纯函数，可供客户端引用。
 */
export type CompetitionInfo = { name: string; code: string | null };

// ⚠️ 顺序即优先级：先命中的规则生效。
const RULES: Array<{ code: string; name: string; patterns: RegExp[] }> = [
  // `premier league` / `league cup` 都是子串匹配，必须把 PL2 / Premier League Cup /
  // International Cup 这类同名青年或次级赛事一并排除，否则会被误判成英超或联赛杯。
  { code: "PL", name: "Premier League", patterns: [/\bpremier league\b(?!\s*(?:2\b|cup|international))/i, /\bepl\b/i] },
  { code: "CL", name: "UEFA Champions League", patterns: [/champions league/i, /\bucl\b/i] },
  { code: "EL", name: "UEFA Europa League", patterns: [/europa league/i, /\buel\b/i] },
  { code: "ECL", name: "UEFA Conference League", patterns: [/conference league/i] },
  // 联赛杯只认 EFL/卡拉宝/裸的 "League Cup"；`(?<!premier )` 防止吃掉 "Premier League Cup"
  { code: "LC", name: "League Cup", patterns: [/efl cup/i, /(?<!premier )league cup/i, /carabao/i] },
  { code: "FAC", name: "FA Cup", patterns: [/\bfa cup\b/i] },
  // 维基把这场写作 "FA Community Shield"；页面的赛事标签用的是 "Community Shield"（→ 社区盾）
  { code: "CS", name: "Community Shield", patterns: [/community shield/i] },
  { code: "FR", name: "Friendly", patterns: [/friendly/i, /friendlies/i, /emirates cup/i, /pre-?season/i] },
];

export function normalizeCompetition(raw: string | null | undefined): CompetitionInfo {
  const value = (raw ?? "").trim();
  if (!value) return { name: "未分类赛事", code: null };
  for (const rule of RULES) {
    if (rule.patterns.some((pattern) => pattern.test(value))) return { name: rule.name, code: rule.code };
  }
  return { name: value, code: null };
}

/** 正式赛事 = 排除季前热身/酋长杯等 */
export function isOfficialCompetition(raw: string | null | undefined): boolean {
  return normalizeCompetition(raw).code !== "FR";
}

/** 已登记（有一等公民待遇：中文标签 + 专属配色）的赛事码。新增赛事时同步补这里 + 两处 UI 标签/颜色。 */
export const OFFICIAL_COMPETITION_CODES = ["PL", "CL", "EL", "ECL", "LC", "FAC", "CS"] as const;
