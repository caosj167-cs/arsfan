import { normalizeCompetition } from "@/lib/data/competitions";

/**
 * Wikipedia 赛季页（如 "2026–27 Arsenal F.C. season"）的赛程抓取。
 * BBC 的足球数据是 CloudFront 签名接口 + 前端渲染，服务端抓不到；
 * Wikipedia 通过 MediaWiki API 取 wikitext，内部的 {{Football box collapsible}} 模板结构稳定、可直接解析，
 * 因此作为第二个"网站"来源，与 arsenal.com 交叉验证。
 */

export const WIKIPEDIA_PROVIDER = "wikipedia";
const WIKI_API = "https://en.wikipedia.org/w/api.php";
const USER_AGENT = "ArsenalFanDataHub/1.0 (+https://en.wikipedia.org/)";
const REQUEST_TIMEOUT_MS = 20_000;

export type WikipediaFixtureItem = {
  sourceRecordId: string;
  kickoffAt: Date;
  opponentName: string;
  homeAway: "HOME" | "AWAY";
  competition: string;
  competitionCode: string | null;
  /** 字面比分（主队-客队）；未赛为 null */
  homeScore: number | null;
  awayScore: number | null;
  fetchedAt: Date;
};

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

function stripMarkup(value: string): string {
  return value
    .replace(/<ref[\s\S]*?<\/ref>/gi, "")
    .replace(/<ref[^>]*\/>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/\{\{[^{}]*\}\}/g, "")
    .replace(/'''?/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseDate(value: string, time: string | undefined): Date | null {
  const match = value.match(/(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})/);
  if (!match) return null;
  const day = Number.parseInt(match[1], 10);
  const month = MONTHS[match[2].slice(0, 3).toLowerCase()];
  const year = Number.parseInt(match[3], 10);
  if (month === undefined) return null;
  const timeMatch = time?.match(/(\d{1,2}):(\d{2})/);
  const hour = timeMatch ? Number.parseInt(timeMatch[1], 10) : 12;
  const minute = timeMatch ? Number.parseInt(timeMatch[2], 10) : 0;
  const parsed = new Date(Date.UTC(year, month, day, hour, minute));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseScore(value: string | undefined): { home: number; away: number } | null {
  if (!value) return null;
  const match = value.replace(/&ndash;|&mdash;/g, "–").match(/(\d+)\s*[–\-−—]\s*(\d+)/);
  if (!match) return null;
  return { home: Number.parseInt(match[1], 10), away: Number.parseInt(match[2], 10) };
}

function parseBoxParams(segment: string): Record<string, string> {
  const params: Record<string, string> = {};
  for (const rawLine of segment.split("\n")) {
    const line = rawLine.trim();
    if (!line.startsWith("|")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(1, eq).trim().toLowerCase();
    if (!key || key in params) continue;
    params[key] = line.slice(eq + 1).trim();
  }
  return params;
}

export type WikiHeading = { pos: number; level: number; title: string };

/** 解析全部标题（`== X ==` 到 `====== X ======`），带级别与位置。 */
export function parseHeadings(wikitext: string): WikiHeading[] {
  const out: WikiHeading[] = [];
  const re = /^(={2,6})\s*([^=\n][^\n]*?)\s*\1\s*$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(wikitext)) !== null) out.push({ pos: m.index, level: m[1].length, title: m[2].trim() });
  return out;
}

/**
 * 容器型小节标题：它们只起分组作用，不是赛事名，不能当赛事用。
 * （维基赛季页的常见结构是 `== Competitions ==` → `=== Premier League ===`，前者是容器。）
 */
const CONTAINER_SECTION_TITLES = new Set([
  "competitions", "overview", "statistics", "review", "first team", "kits",
  "contracts and transfers", "awards and nominations", "references", "overall record",
  "league table", "results summary", "results by round", "matches", "appearances",
  "goals", "assists", "disciplinary record", "clean sheets", "hat-tricks",
]);

/**
 * 比赛所在小节的**包含路径**（由外到内）。
 * 做法：从该位置向前回溯，只接受级别严格递减的标题——遇到同级或更高级的标题
 * 即说明上一节已结束。例：`Matches`(L4) → `Premier League`(L3) → `Competitions`(L2)。
 */
export function sectionPath(headings: WikiHeading[], pos: number): WikiHeading[] {
  const path: WikiHeading[] = [];
  for (let i = headings.length - 1; i >= 0; i -= 1) {
    const heading = headings[i];
    if (heading.pos >= pos) continue;
    if (!path.length || heading.level < path[path.length - 1].level) path.push(heading);
    if (path[path.length - 1]?.level === 2) break; // 已到 L2，无需再往外
  }
  return path.reverse();
}

/**
 * 取比赛所属赛事的标题。
 *
 * 在包含路径里**由内向外**找第一个「能识别为已知赛事」的标题：
 *   `Matches`(不认识) → `Premier League`(认识 ✓)
 * 都不认识时，退到最内层的非容器标题，最后退到最外层标题。
 *
 * 这样修掉了「只认 L2 标题」的旧 bug：旧逻辑会把 `== Competitions ==` 下的比赛
 * 一律标成 "Competitions"（含 2026 社区盾那场；该行仅来自维基，没有其它源纠正它）。
 */
export function competitionTitleFor(headings: WikiHeading[], pos: number): string {
  const path = sectionPath(headings, pos);
  for (let i = path.length - 1; i >= 0; i -= 1) {
    if (normalizeCompetition(path[i].title).code !== null) return path[i].title;
  }
  for (let i = path.length - 1; i >= 0; i -= 1) {
    if (!CONTAINER_SECTION_TITLES.has(path[i].title.toLowerCase())) return path[i].title;
  }
  return path[0]?.title ?? "";
}

async function fetchWikitext(pageTitle: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const params = new URLSearchParams({
      action: "parse",
      page: pageTitle,
      prop: "wikitext",
      format: "json",
      formatversion: "2",
    });
    const response = await fetch(`${WIKI_API}?${params.toString()}`, {
      signal: controller.signal,
      headers: { Accept: "application/json", "User-Agent": USER_AGENT },
      next: { revalidate: 900 },
    });
    if (!response.ok) throw new Error(`Wikipedia API request failed with HTTP ${response.status}`);
    const payload = (await response.json()) as { parse?: { wikitext?: string }; error?: { info?: string } };
    if (payload.error) throw new Error(`Wikipedia API error: ${payload.error.info ?? "unknown"}`);
    return payload.parse?.wikitext ?? "";
  } finally {
    clearTimeout(timeout);
  }
}

/** 赛季页标题：2026 → "2026–27 Arsenal F.C. season"（注意是 en dash） */
export function wikipediaSeasonPage(season: number): string {
  const end = String((season + 1) % 100).padStart(2, "0");
  return `${season}\u2013${end} Arsenal F.C. season`;
}

export async function fetchWikipediaFixtures(options: { season: number; pageTitle?: string } = { season: 0 }): Promise<WikipediaFixtureItem[]> {
  const fetchedAt = new Date();
  const pageTitle = options.pageTitle ?? wikipediaSeasonPage(options.season);
  const wikitext = await fetchWikitext(pageTitle);
  if (!wikitext) return [];

  const headings = parseHeadings(wikitext);

  const boxRe = /\{\{\s*football box collapsible/gi;
  const positions: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = boxRe.exec(wikitext)) !== null) positions.push(m.index);

  const items: WikipediaFixtureItem[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < positions.length; i += 1) {
    const start = positions[i];
    const end = i + 1 < positions.length ? positions[i + 1] : wikitext.length;
    const params = parseBoxParams(wikitext.slice(start, end));

    const team1 = stripMarkup(params.team1 ?? "");
    const team2 = stripMarkup(params.team2 ?? "");
    if (!team1 || !team2) continue;
    const arsenalIsTeam1 = /\barsenal\b/i.test(team1);
    const arsenalIsTeam2 = /\barsenal\b/i.test(team2);
    if (arsenalIsTeam1 === arsenalIsTeam2) continue; // 必须是阿森纳参与且仅一方是阿森纳

    const kickoffAt = parseDate(params.date ?? "", params.time);
    if (!kickoffAt) continue;

    const competition = normalizeCompetition(competitionTitleFor(headings, start));
    const opponentName = arsenalIsTeam1 ? team2 : team1;
    const score = parseScore(params.score);
    const recordId = `${kickoffAt.toISOString().slice(0, 10)}|${opponentName.toLowerCase()}|${arsenalIsTeam1 ? "HOME" : "AWAY"}`;
    if (seen.has(recordId)) continue;
    seen.add(recordId);

    items.push({
      sourceRecordId: recordId,
      kickoffAt,
      opponentName,
      homeAway: arsenalIsTeam1 ? "HOME" : "AWAY",
      competition: competition.name,
      competitionCode: competition.code,
      homeScore: score ? score.home : null,
      awayScore: score ? score.away : null,
      fetchedAt,
    });
  }

  return items.sort((a, b) => a.kickoffAt.getTime() - b.kickoffAt.getTime());
}
