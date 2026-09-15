/**
 * 赛事名归一化：不同来源（football-data / arsenal.com / Wikipedia）对同一赛事的叫法不同，
 * 统一收敛为 { name, code }，便于跨源合并与展示。纯函数，可供客户端引用。
 */
export type CompetitionInfo = { name: string; code: string | null };

const RULES: Array<{ code: string; name: string; patterns: RegExp[] }> = [
  { code: "PL", name: "Premier League", patterns: [/premier league/i, /\bepl\b/i] },
  { code: "CL", name: "UEFA Champions League", patterns: [/champions league/i, /\bucl\b/i] },
  { code: "LC", name: "League Cup", patterns: [/efl cup/i, /league cup/i, /carabao/i, /\bleague cup\b/i] },
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

export const OFFICIAL_COMPETITION_CODES = ["PL", "CL", "LC", "FAC"] as const;
