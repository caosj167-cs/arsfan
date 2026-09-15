/**
 * FotMob 比赛数据抓取。
 *
 * 背景：FotMob 的 JSON API（/api/matchDetails）在本环境返回 SPA 外壳，Sofascore 直接 403。
 * 但 FotMob 的**比赛页 HTML 内嵌 `__NEXT_DATA__`**，其中 pageProps.content 就是完整的
 * matchFacts / stats / lineup / playerStats / shotmap —— 等价于官方 JSON，因此改为「抓页面 + 解析内嵌 JSON」。
 *
 * 原则：字段缺失一律留空（null / [])并记入 missing，不编造。
 */

import { normalizeCompetition } from "@/lib/data/competitions";
import type { PlayerMatchMetrics } from "@/lib/data/player-metrics";

export const FOTMOB_PROVIDER = "fotmob";
/** api-football=42、football-data=57；FotMob 上 Arsenal 的球队 id 是 9825 */
export const FOTMOB_ARSENAL_TEAM_ID = 9825;

const USER_AGENT = "Mozilla/5.0 (compatible; ArsenalFanDataHub/1.0; +https://www.fotmob.com/)";
const REQUEST_TIMEOUT_MS = 20_000;

/* ---------------- 原始结构（按需取用，宽松类型） ---------------- */

type Json = Record<string, unknown>;

export type FotmobFixtureRef = {
  matchId: string;
  kickoffAt: Date | null;
  opponentName: string;
  opponentKeyRaw: string;
  homeAway: "HOME" | "AWAY";
  competition: string;
  finished: boolean;
  started: boolean;
  homeScore: number | null;
  awayScore: number | null;
  scoreStr: string | null;
};

export type FotmobRawMatch = { general: Json; header: Json; content: Json };

/* ---------------- 抓取 + 解析 ---------------- */

async function fetchHtml(url: string, init: { noStore?: boolean } = {}): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "text/html,application/xhtml+xml", "User-Agent": USER_AGENT },
      // 同步入口要最新值：noStore 时禁用 Next 数据缓存；渲染路径仍按 15 分钟缓存
      ...(init.noStore ? { cache: "no-store" as RequestCache } : { next: { revalidate: 900 } }),
    });
    if (!response.ok) throw new Error(`FotMob page request failed with HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function extractNextData(html: string): Json | null {
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]) as Json;
  } catch {
    return null;
  }
}

function asRecord(value: unknown): Json | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Json) : null;
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

/** 抓取球队赛程页，取 fallback[`team-<id>`].overview.overviewFixtures（含 matchId/时间/对手/比分） */
export async function fetchFotmobTeamFixtures(teamId = FOTMOB_ARSENAL_TEAM_ID): Promise<FotmobFixtureRef[]> {
  const html = await fetchHtml(`https://www.fotmob.com/teams/${teamId}/matches/arsenal`);
  const data = extractNextData(html);
  const pageProps = asRecord(asRecord(data?.props)?.pageProps);
  const fallback = asRecord(pageProps?.fallback);
  const team = asRecord(fallback?.[`team-${teamId}`]);
  const overview = asRecord(team?.overview);
  const fixtures = overview?.overviewFixtures;
  if (!Array.isArray(fixtures)) return [];

  const out: FotmobFixtureRef[] = [];
  for (const raw of fixtures) {
    const f = asRecord(raw);
    if (!f) continue;
    const status = asRecord(f.status) ?? {};
    const home = asRecord(f.home) ?? {};
    const away = asRecord(f.away) ?? {};
    const arsenalHome = num(home.id) === teamId;
    const opponent = arsenalHome ? away : home;
    const utc = str(status.utcTime);
    const matchId = f.id === undefined || f.id === null ? null : String(f.id);
    if (!matchId) continue;
    out.push({
      matchId,
      kickoffAt: utc ? new Date(utc) : null,
      opponentName: str(opponent.name) ?? "未知对手",
      opponentKeyRaw: str(opponent.name) ?? "",
      homeAway: arsenalHome ? "HOME" : "AWAY",
      competition: str(asRecord(f.tournament)?.name) ?? "未分类赛事",
      finished: status.finished === true,
      started: status.started === true,
      homeScore: num(home.score),
      awayScore: num(away.score),
      scoreStr: str(status.scoreStr),
    });
  }
  return out;
}

/** 抓取单场比赛页并返回内嵌的 general + content */
export async function fetchFotmobMatch(matchId: string): Promise<FotmobRawMatch | null> {
  const html = await fetchHtml(`https://www.fotmob.com/match/${matchId}`);
  const data = extractNextData(html);
  const pageProps = asRecord(asRecord(data?.props)?.pageProps);
  const general = asRecord(pageProps?.general);
  const header = asRecord(pageProps?.header) ?? {};
  const content = asRecord(pageProps?.content);
  if (!general || !content) return null;
  return { general, header, content };
}

/* ---------------- 归一化（与现有 CSV 同口径） ---------------- */

export type MatchTeamSide = { id: number | null; name: string; score: number | null; scoreHalfTime: number | null };

export type MatchStatRow = {
  key: string;
  metric: string;
  home: string | number | null;
  away: string | number | null;
  format: string | null;
  highlight: string | null;
};

export type MatchPlayerRow = PlayerMatchMetrics & {
  playerId: number | null;
  name: string;
  shirtNumber: string | null;
  position: string | null;
  starter: boolean;
  captain: boolean;
  minutes: number | null;
  rating: number | null;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  subInMinute: number | null;
  subOutMinute: number | null;
  notes: string | null;
};

export type MatchEventRow = {
  minute: number | null;
  minuteExtra: number | null;
  type: string;
  side: "home" | "away" | "neutral";
  player: string | null;
  detail: string | null;
  scoreAfter: string | null;
};

export type MatchLineupBlock = {
  teamId: number | null;
  name: string;
  formation: string | null;
  coach: string | null;
  starters: MatchPlayerRow[];
  subs: MatchPlayerRow[];
  unavailable: Array<{ name: string; reason: string | null }>;
};

export type MatchReportPayload = {
  source: "fotmob";
  fotmobMatchId: string;
  competition: string;
  round: string | null;
  kickoffAt: string | null;
  venue: string | null;
  city: string | null;
  referee: string | null;
  weather: string | null;
  teams: { home: MatchTeamSide; away: MatchTeamSide };
  teamStats: MatchStatRow[];
  lineups: { home: MatchLineupBlock; away: MatchLineupBlock };
  events: MatchEventRow[];
  players: MatchPlayerRow[];
  playerOfTheMatch: { name: string | null; rating: number | null } | null;
  missing: string[];
};

/** FotMob positionId → 位置标签（由真实比赛数据与官方报告交叉核对得出；未收录的用 coarse 分组兜底） */
const POSITION_LABELS: Record<number, string> = {
  11: "GK",
  32: "RB",
  34: "CB",
  36: "CB",
  38: "LB",
  64: "DM",
  66: "CM",
  83: "RM",
  85: "AM",
  87: "LM",
  115: "ST",
};
const POSITION_GROUPS: Record<number, string> = { 0: "GK", 1: "后卫", 2: "中场", 3: "前锋" };

function positionLabel(positionId: number | null, usualId: number | null): string | null {
  if (positionId !== null && POSITION_LABELS[positionId]) return POSITION_LABELS[positionId];
  if (usualId !== null && POSITION_GROUPS[usualId]) return POSITION_GROUPS[usualId];
  return null;
}

type PlayerPerformance = {
  rating?: number | null;
  substitutionEvents?: Array<{ time?: number; type?: string }>;
  cards?: Array<{ type?: string }>;
};

const CARD_KEYS: Record<string, "yellowCards" | "redCards"> = { yellow: "yellowCards", red: "redCards", secondyellow: "redCards" };

export function normalizeFotmobMatch(matchId: string, raw: FotmobRawMatch): MatchReportPayload {
  const { general, header, content } = raw;
  const missing: string[] = [];

  const homeGeneral = asRecord(general.homeTeam) ?? {};
  const awayGeneral = asRecord(general.awayTeam) ?? {};
  // 比分来自 header.teams（general.homeTeam 不含比分）
  const headerTeams = Array.isArray(header.teams) ? header.teams.flatMap((x) => { const r = asRecord(x); return r ? [r] : []; }) : [];
  const headerHome = headerTeams.find((t) => num(t.id) === num(homeGeneral.id)) ?? null;
  const headerAway = headerTeams.find((t) => num(t.id) === num(awayGeneral.id)) ?? null;
  const infoBox = asRecord(asRecord(content.matchFacts)?.infoBox) ?? {};
  const stadium = asRecord(infoBox.Stadium) ?? {};
  const tournament = asRecord(infoBox.Tournament) ?? {};
  const matchDate = asRecord(infoBox["Match Date"]) ?? {};

  // playerStats：按 playerId 索引，含评分/分钟/进球/助攻
  const playerStats: Record<string, Json> = {};
  const psRaw = asRecord(content.playerStats);
  if (psRaw) for (const [pid, value] of Object.entries(psRaw)) { const v = asRecord(value); if (v) playerStats[pid] = v; }

  const statValue = (pid: number | null, title: string): number | null => {
    if (pid === null) return null;
    const entry = playerStats[String(pid)];
    const stats = entry?.stats;
    if (!Array.isArray(stats)) return null;
    for (const groupRaw of stats) {
      const group = asRecord(groupRaw);
      const groupStats = asRecord(group?.stats);
      if (!groupStats) continue;
      const item = groupStats[title];
      const stat = asRecord(asRecord(item)?.stat);
      const value = num(stat?.value);
      if (value !== null) return value;
    }
    return null;
  };

  const mapPlayer = (p: Json, starter: boolean): MatchPlayerRow => {
    const perf = (asRecord(p.performance) ?? {}) as PlayerPerformance;
    const pid = num(p.id);
    const subs = Array.isArray(perf.substitutionEvents) ? perf.substitutionEvents : [];
    const subIn = subs.find((e) => e?.type === "subIn");
    const subOut = subs.find((e) => e?.type === "subOut");
    const cards = Array.isArray(perf.cards) ? perf.cards : [];
    let yellow = 0;
    let red = 0;
    for (const card of cards) {
      const t = String(card?.type ?? "").toLowerCase().replace(/\s/g, "");
      if (CARD_KEYS[t] === "yellowCards") yellow += 1;
      else if (CARD_KEYS[t] === "redCards") red += 1;
    }
    const rating = num(perf.rating) ?? statValue(pid, "FotMob rating");
    return {
      playerId: pid,
      name: str(p.name) ?? "未知球员",
      shirtNumber: p.shirtNumber === undefined || p.shirtNumber === null ? null : String(p.shirtNumber),
      position: positionLabel(num(p.positionId), num(p.usualPlayingPositionId)),
      starter,
      captain: p.isCaptain === true,
      minutes: statValue(pid, "Minutes played"),
      rating,
      goals: statValue(pid, "Goals") ?? 0,
      assists: statValue(pid, "Assists") ?? 0,
      yellowCards: yellow,
      redCards: red,
      // 衍生指标（FotMob 标题 → 字段）；缺的记 0，不推算
      shots: statValue(pid, "Total shots") ?? 0,
      shotsOnTarget: statValue(pid, "Shots on target") ?? 0,
      keyPasses: statValue(pid, "Chances created") ?? 0,
      accuratePasses: statValue(pid, "Accurate passes") ?? 0,
      successfulDribbles: statValue(pid, "Successful dribbles") ?? 0,
      duelsWon: statValue(pid, "Duels won") ?? 0,
      dispossessed: statValue(pid, "Dispossessed") ?? 0,
      wasFouled: statValue(pid, "Was fouled") ?? 0,
      foulsCommitted: statValue(pid, "Fouls committed") ?? 0,
      tackles: statValue(pid, "Tackles") ?? 0,
      clearances: statValue(pid, "Clearances") ?? 0,
      subInMinute: num(subIn?.time),
      subOutMinute: num(subOut?.time),
      notes: null,
    };
  };

  const mapLineup = (side: "home" | "away"): MatchLineupBlock => {
    const t = asRecord(asRecord(content.lineup)?.[side === "home" ? "homeTeam" : "awayTeam"]) ?? {};
    const starters = Array.isArray(t.starters) ? t.starters.flatMap((x) => { const r = asRecord(x); return r ? [mapPlayer(r, true)] : []; }) : [];
    const subs = Array.isArray(t.subs) ? t.subs.flatMap((x) => { const r = asRecord(x); return r ? [mapPlayer(r, false)] : []; }) : [];
    const unavailable = Array.isArray(t.unavailable)
      ? t.unavailable.flatMap((x) => { const r = asRecord(x); return r ? [{ name: str(r.name) ?? "未知", reason: str(asRecord(r.unavailability)?.type) }] : []; })
      : [];
    const coach = asRecord(t.coach);
    return {
      teamId: num(t.id),
      name: str(t.name) ?? "",
      formation: str(t.formation),
      coach: coach ? str(coach.name) : null,
      starters,
      subs,
      unavailable,
    };
  };

  // 球队统计：content.stats.Periods.All.stats → 分组 → 行
  const teamStats: MatchStatRow[] = [];
  const periods = asRecord(asRecord(content.stats)?.Periods);
  const all = asRecord(periods?.All);
  const groups = all?.stats;
  if (Array.isArray(groups)) {
    for (const groupRaw of groups) {
      const group = asRecord(groupRaw);
      const statRows = group?.stats;
      if (!Array.isArray(statRows)) continue;
      for (const rowRaw of statRows) {
        const row = asRecord(rowRaw);
        const arr = row?.stats;
        if (!row || !Array.isArray(arr) || arr.length < 2) continue;
        teamStats.push({
          key: str(row.key) ?? str(row.title) ?? "",
          metric: str(row.title) ?? "",
          home: (arr[0] as string | number | null) ?? null,
          away: (arr[1] as string | number | null) ?? null,
          format: str(row.format),
          highlight: str(row.highlighted),
        });
      }
    }
  } else {
    missing.push("teamStats");
  }

  // 事件
  const eventsRaw = asRecord(asRecord(content.matchFacts)?.events)?.events;
  const events: MatchEventRow[] = [];
  if (Array.isArray(eventsRaw)) {
    for (const eRaw of eventsRaw) {
      const e = asRecord(eRaw);
      if (!e) continue;
      const time = num(e.time) ?? num(e.timeMinutes);
      const extra = num(e.timeExtra);
      const sideRaw = String(e.isHome === true ? "home" : e.isHome === false ? "away" : "neutral");
      events.push({
        minute: time,
        minuteExtra: extra,
        type: str(e.type) ?? "unknown",
        side: sideRaw as MatchEventRow["side"],
        player: str(asRecord(e.player)?.name) ?? str(e.playerName),
        detail: str(e.detail) ?? str(e.card) ?? str(e.assistStr),
        scoreAfter: str(e.score),
      });
    }
  }

  const potm = asRecord(asRecord(content.matchFacts)?.playerOfTheMatch);

  // 半场比分：仅由「Goal」事件推导；若存在乌龙球（归属易错）则不推导，留空
  const hasOwnGoal = events.some((e) => e.type.toLowerCase().includes("own"));
  let halfHome: number | null = null;
  let halfAway: number | null = null;
  if (!hasOwnGoal && events.some((e) => e.type === "Goal")) {
    halfHome = 0;
    halfAway = 0;
    for (const e of events) {
      if (e.type !== "Goal") continue;
      const minute = e.minute ?? 0;
      if (minute > 45) continue;
      if (e.side === "home") halfHome += 1;
      else if (e.side === "away") halfAway += 1;
    }
  }

  const payload: MatchReportPayload = {
    source: "fotmob",
    fotmobMatchId: matchId,
    competition: normalizeCompetition(str(tournament.leagueName) ?? str(general.leagueName)).name,
    round: str(tournament.roundName) ?? str(tournament.round) ?? str(general.matchRound),
    kickoffAt: str(matchDate.utcTime) ?? str(general.matchTimeUTC),
    venue: str(stadium.name),
    city: str(stadium.city),
    referee: str(infoBox.Referee as unknown) ?? str(asRecord(infoBox.Referee)?.text),
    weather: null,
    teams: {
      home: {
        id: num(homeGeneral.id),
        name: str(homeGeneral.name) ?? "主队",
        score: num(headerHome?.score) ?? num(homeGeneral.score),
        scoreHalfTime: halfHome,
      },
      away: {
        id: num(awayGeneral.id),
        name: str(awayGeneral.name) ?? "客队",
        score: num(headerAway?.score) ?? num(awayGeneral.score),
        scoreHalfTime: halfAway,
      },
    },
    teamStats,
    lineups: { home: mapLineup("home"), away: mapLineup("away") },
    events,
    players: [],
    playerOfTheMatch: potm ? { name: str(potm.name), rating: num(potm.rating) } : null,
    missing,
  };

  payload.players = [...payload.lineups.home.starters, ...payload.lineups.home.subs, ...payload.lineups.away.starters, ...payload.lineups.away.subs];

  if (!payload.venue) missing.push("venue");
  if (!payload.referee) missing.push("referee");
  if (!payload.events.length) missing.push("events");
  if (!payload.teamStats.length) missing.push("teamStats");
  if (!payload.lineups.home.starters.length) missing.push("homeLineup");
  if (!payload.lineups.away.starters.length) missing.push("awayLineup");

  return payload;
}

/* ---------------- 联赛积分表（联赛页内嵌 __NEXT_DATA__） ---------------- */

/** FotMob 联赛 id：英超 = 47（同源：Arsenal 球队 id = 9825） */
export const FOTMOB_PREMIER_LEAGUE_ID = 47;

export type FotmobTableRow = {
  /** 名次（FotMob 字段 idx） */
  position: number;
  /** FotMob 球队 id（Arsenal = 9825） */
  teamId: number;
  name: string;
  shortName: string | null;
  pageUrl: string | null;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  qualColor: string | null;
};

export type FotmobLeagueTable = {
  leagueId: number;
  leagueName: string;
  /** FotMob 的赛季串，如 "2026/2027" */
  selectedSeason: string | null;
  isCurrentSeason: boolean;
  rows: FotmobTableRow[];
  missing: string[];
};

/** FotMob 的 scoresStr 形如 "8-1"（进球-失球）。导出以便单测。 */
export function parseGoalsPair(value: string | null): { goalsFor: number; goalsAgainst: number } | null {
  if (!value) return null;
  const m = value.match(/^\s*(\d+)\s*-\s*(\d+)\s*$/);
  if (!m) return null;
  return { goalsFor: Number(m[1]), goalsAgainst: Number(m[2]) };
}

/**
 * 抓取 FotMob 联赛积分表（与比赛页同套路：抓页面 HTML → 解析内嵌 `__NEXT_DATA__`）。
 * 路径：`props.pageProps.table[0].data`，总榜在 `data.table.all`。
 * 字段缺失留空并记入 missing，不编造。
 */
export async function fetchFotmobLeagueTable(leagueId = FOTMOB_PREMIER_LEAGUE_ID): Promise<FotmobLeagueTable> {
  const html = await fetchHtml(`https://www.fotmob.com/leagues/${leagueId}`, { noStore: true });
  const data = extractNextData(html);
  const pageProps = asRecord(asRecord(data?.props)?.pageProps);
  const container = Array.isArray(pageProps?.table) ? asRecord(pageProps.table[0]) : null;
  const payload = asRecord(container?.data);
  const rowsRaw = asRecord(payload?.table)?.all;

  const missing: string[] = [];
  const rows: FotmobTableRow[] = [];
  if (!Array.isArray(rowsRaw)) {
    missing.push("table.all");
  } else {
    for (const raw of rowsRaw) {
      const r = asRecord(raw);
      if (!r) continue;
      const teamId = num(r.id);
      if (teamId === null) continue;
      const pair = parseGoalsPair(str(r.scoresStr));
      if (!pair) missing.push(`scoresStr:${str(r.name) ?? teamId}`);
      rows.push({
        position: num(r.idx) ?? rows.length + 1,
        teamId,
        name: str(r.name) ?? "",
        shortName: str(r.shortName),
        pageUrl: str(r.pageUrl),
        played: num(r.played) ?? 0,
        won: num(r.wins) ?? 0,
        drawn: num(r.draws) ?? 0,
        lost: num(r.losses) ?? 0,
        goalsFor: pair?.goalsFor ?? 0,
        goalsAgainst: pair?.goalsAgainst ?? 0,
        goalDifference: num(r.goalConDiff) ?? 0,
        points: num(r.pts) ?? 0,
        qualColor: str(r.qualColor),
      });
    }
  }

  return {
    leagueId: num(payload?.leagueId) ?? leagueId,
    leagueName: str(payload?.leagueName) ?? "",
    selectedSeason: str(payload?.selectedSeason),
    isCurrentSeason: payload?.isCurrentSeason === true,
    rows,
    missing,
  };
}
