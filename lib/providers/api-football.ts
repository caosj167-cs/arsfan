import { z } from "zod";

const teamSchema = z.object({
  id: z.number(),
  name: z.string(),
  logo: z.string().url().nullish(),
});

const playerRefSchema = z.object({
  id: z.number().nullish(),
  name: z.string().nullish(),
  photo: z.string().url().nullish(),
  number: z.number().nullish(),
});

const fixtureSchema = z.object({
  id: z.number(),
  referee: z.string().nullish(),
  timezone: z.string().nullish(),
  date: z.string().datetime({ offset: true }),
  timestamp: z.number().nullish(),
  periods: z.object({ first: z.number().nullish(), second: z.number().nullish() }).nullish(),
  venue: z.object({ name: z.string().nullish(), city: z.string().nullish() }).nullish(),
  status: z.object({ long: z.string(), short: z.string(), elapsed: z.number().nullish(), extra: z.number().nullish() }).passthrough(),
});

const leagueSchema = z.object({
  id: z.number(),
  name: z.string(),
  country: z.string(),
  logo: z.string().url().nullish(),
  season: z.number(),
  round: z.string().nullish(),
});

const scoreTeamSchema = z.object({
  home: z.number().nullish(),
  away: z.number().nullish(),
});

const fixtureResponseSchema = z.object({
  fixture: fixtureSchema,
  league: leagueSchema,
  teams: z.object({ home: teamSchema, away: teamSchema }),
  goals: scoreTeamSchema,
  score: z.object({
    halftime: scoreTeamSchema.nullish(),
    fulltime: scoreTeamSchema.nullish(),
    extratime: scoreTeamSchema.nullish(),
    penalty: scoreTeamSchema.nullish(),
  }),
});

const eventSchema = z.object({
  time: z.object({ elapsed: z.number(), extra: z.number().nullish() }),
  team: teamSchema,
  player: playerRefSchema,
  assist: playerRefSchema,
  type: z.string(),
  detail: z.string().nullish(),
  comments: z.string().nullish(),
});

const lineupPlayerSchema = z.object({
  player: z.object({
    id: z.number(),
    name: z.string(),
    number: z.number().nullish(),
    pos: z.string().nullish(),
    grid: z.string().nullish(),
  }),
});

const lineupSchema = z.object({
  team: teamSchema.extend({ colors: z.record(z.string(), z.unknown()).nullish() }),
  coach: playerRefSchema,
  formation: z.string().nullish(),
  startXI: z.array(lineupPlayerSchema),
  substitutes: z.array(lineupPlayerSchema),
});

const teamStatisticSchema = z.object({
  type: z.string(),
  value: z.union([z.string(), z.number()]).nullable(),
});

const teamStatisticsSchema = z.object({
  team: teamSchema,
  statistics: z.array(teamStatisticSchema),
});

const statNumberSchema = z.object({ total: z.number().nullish(), on: z.number().nullish() }).passthrough();
const statValueSchema = z.object({ total: z.number().nullish(), key: z.number().nullish(), accuracy: z.union([z.string(), z.number()]).nullish() }).passthrough();

const playerMatchStatsSchema = z.object({
  games: z.object({
    minutes: z.number().nullish(),
    number: z.number().nullish(),
    position: z.string().nullish(),
    rating: z.string().nullish(),
    captain: z.boolean().nullish(),
    substitute: z.boolean().nullish(),
  }).passthrough().nullish(),
  offsides: z.number().nullish(),
  shots: statNumberSchema.nullish(),
  goals: z.object({ total: z.number().nullish(), conceded: z.number().nullish(), assists: z.number().nullish(), saves: z.number().nullish() }).passthrough().nullish(),
  passes: statValueSchema.nullish(),
  tackles: z.object({ total: z.number().nullish(), blocks: z.number().nullish(), interceptions: z.number().nullish() }).passthrough().nullish(),
  duels: z.object({ total: z.number().nullish(), won: z.number().nullish() }).passthrough().nullish(),
  dribbles: z.object({ attempts: z.number().nullish(), success: z.number().nullish(), past: z.number().nullish() }).passthrough().nullish(),
  fouls: z.object({ drawn: z.number().nullish(), committed: z.number().nullish() }).passthrough().nullish(),
  cards: z.object({ yellow: z.number().nullish(), red: z.number().nullish() }).passthrough().nullish(),
  penalty: z.object({ won: z.number().nullish(), committed: z.number().nullish(), scored: z.number().nullish(), missed: z.number().nullish(), saved: z.number().nullish() }).passthrough().nullish(),
}).passthrough();

const playerStatsRowSchema = z.object({
  player: playerRefSchema,
  statistics: z.array(playerMatchStatsSchema),
});

const playerTeamSchema = teamSchema.extend({ update: z.string().nullish() });
const playerStatsSchema = z.object({ team: playerTeamSchema, players: z.array(playerStatsRowSchema) });

const apiEnvelopeSchema = z.object({
  errors: z.union([z.record(z.string(), z.unknown()), z.array(z.unknown())]),
  results: z.number(),
});

export type ApiFootballEvent = z.infer<typeof eventSchema>;
export type ApiFootballLineup = z.infer<typeof lineupSchema>;
export type ApiFootballTeamStatistics = z.infer<typeof teamStatisticsSchema>;
export type ApiFootballPlayerStats = z.infer<typeof playerStatsSchema>;
export type ApiFootballFixture = z.infer<typeof fixtureResponseSchema>;

const API_FOOTBALL_ENDPOINT = "https://v3.football.api-sports.io";
export const API_FOOTBALL_PROVIDER = "api-football";

function requireApiKey() {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) throw new Error("API_FOOTBALL_KEY is not configured");
  return key;
}

function hasApiErrors(errors: Record<string, unknown> | unknown[]) {
  return Array.isArray(errors) ? errors.length > 0 : Object.keys(errors).length > 0;
}

async function request<T>(path: string, responseSchema: z.ZodType<T>): Promise<T> {
  const response = await fetch(`${API_FOOTBALL_ENDPOINT}${path}`, {
    headers: { Accept: "application/json", "x-apisports-key": requireApiKey() },
    next: { revalidate: 900 },
  });
  const payload: unknown = await response.json();
  const envelope = apiEnvelopeSchema.safeParse(payload);
  if (!response.ok) throw new Error(`API-Football request failed with HTTP ${response.status}`);
  if (!envelope.success) throw new Error("API-Football returned an invalid response envelope");
  if (hasApiErrors(envelope.data.errors)) {
    const detail = JSON.stringify(envelope.data.errors);
    throw new Error(`API-Football returned an API error: ${detail}`);
  }
  return responseSchema.parse(payload);
}

const fixtureListSchema = z.object({ response: z.array(fixtureResponseSchema) });
const eventListSchema = z.object({ response: z.array(eventSchema) });
const lineupListSchema = z.object({ response: z.array(lineupSchema) });
const teamStatisticsListSchema = z.object({ response: z.array(teamStatisticsSchema) });
const playerStatsListSchema = z.object({ response: z.array(playerStatsSchema) });

export async function fetchApiFootballFixture(fixtureId: number) {
  const payload = await request(`/fixtures?id=${fixtureId}`, fixtureListSchema);
  return payload.response[0] ?? null;
}

export async function fetchApiFootballFixturesByDate(options: {
  teamId?: number;
  date: string;
  season?: number;
}) {
  const params = new URLSearchParams({
    team: String(options.teamId ?? 42),
    from: options.date,
    to: options.date,
  });
  // api-football 在给定 from/to 时要求 season 参数，否则报 "The Season field is required"
  if (options.season) params.set("season", String(options.season));
  const payload = await request(`/fixtures?${params.toString()}`, fixtureListSchema);
  return payload.response;
}

export async function fetchApiFootballEvents(fixtureId: number) {
  const payload = await request(`/fixtures/events?fixture=${fixtureId}`, eventListSchema);
  return payload.response;
}

export async function fetchApiFootballLineups(fixtureId: number) {
  const payload = await request(`/fixtures/lineups?fixture=${fixtureId}`, lineupListSchema);
  return payload.response;
}

export async function fetchApiFootballTeamStatistics(fixtureId: number) {
  const payload = await request(`/fixtures/statistics?fixture=${fixtureId}`, teamStatisticsListSchema);
  return payload.response;
}

export async function fetchApiFootballPlayerStats(fixtureId: number) {
  const payload = await request(`/fixtures/players?fixture=${fixtureId}`, playerStatsListSchema);
  return payload.response;
}

const topPlayersStatSchema = z
  .object({
    team: teamSchema,
    league: leagueSchema,
    games: z
      .object({ appearences: z.number().nullish(), rating: z.string().nullish(), number: z.number().nullish(), position: z.string().nullish(), captain: z.boolean().nullish() })
      .passthrough()
      .nullish(),
    goals: z
      .object({ total: z.number().nullish(), assists: z.number().nullish(), conceded: z.number().nullish(), saves: z.number().nullish() })
      .passthrough()
      .nullish(),
    cards: z.object({ yellow: z.number().nullish(), red: z.number().nullish() }).passthrough().nullish(),
  })
  .passthrough();

const topPlayersRowSchema = z.object({
  player: playerRefSchema.extend({ photo: z.string().url().nullish() }),
  statistics: z.array(topPlayersStatSchema),
});

const topPlayersListSchema = z.object({
  response: z.array(topPlayersRowSchema),
  paging: z.object({ current: z.number(), total: z.number() }).nullish(),
});

export type ApiFootballTopPlayer = z.infer<typeof topPlayersRowSchema>;

/**
 * 按球队/联赛/赛季拉取球员赛季统计（含进球+助攻+出场+评分+牌）。
 * 注意：api-football 的 /players/topscorers 不接受 team 过滤，故用 /players?team=…
 * /players 每页仅 20 条，必须翻页，否则会漏掉整个阵容的后半段。
 */
export async function fetchApiFootballPlayers(options: {
  season: number;
  teamId?: number;
  league?: number;
}) {
  const all: ApiFootballTopPlayer[] = [];
  const maxPages = 10; // 安全上限（20×10=200 人，远超单队规模）
  let page = 1;
  for (let i = 0; i < maxPages; i += 1) {
    const params = new URLSearchParams({ season: String(options.season), page: String(page) });
    if (options.teamId) params.set("team", String(options.teamId));
    if (options.league) params.set("league", String(options.league));
    const payload = await request(`/players?${params.toString()}`, topPlayersListSchema);
    all.push(...payload.response);
    const totalPages = payload.paging?.total ?? 1;
    if (payload.response.length === 0 || page >= totalPages) break;
    page += 1;
  }
  return all;
}

export async function fetchApiFootballMatchDetails(fixtureId: number) {
  const [fixture, events, lineups, teamStatistics, playerStats] = await Promise.all([
    fetchApiFootballFixture(fixtureId),
    fetchApiFootballEvents(fixtureId),
    fetchApiFootballLineups(fixtureId),
    fetchApiFootballTeamStatistics(fixtureId),
    fetchApiFootballPlayerStats(fixtureId),
  ]);

  return { fixture, events, lineups, teamStatistics, playerStats };
}
