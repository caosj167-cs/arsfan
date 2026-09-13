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

function level2Headings(wikitext: string) {
  const out: Array<{ pos: number; title: string }> = [];
  const re = /^={2}([^=\n][^\n]*?)\s*={2}\s*$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(wikitext)) !== null) out.push({ pos: m.index, title: m[1].trim() });
  return out;
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

  const headings = level2Headings(wikitext);
  const competitionFor = (pos: number) => {
    let title = "";
    for (const h of headings) {
      if (h.pos < pos) title = h.title;
      else break;
    }
    return title;
  };

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

    const competition = normalizeCompetition(competitionFor(start));
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
