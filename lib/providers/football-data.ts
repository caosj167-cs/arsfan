import { z } from "zod";

const teamSchema = z.object({
  id: z.number(),
  name: z.string(),
  shortName: z.string().nullish(),
  tla: z.string().nullish(),
  crest: z.string().url().nullish(),
  address: z.string().nullish(),
  website: z.string().url().nullish(),
  founded: z.number().nullish(),
  clubColors: z.string().nullish(),
  venue: z.string().nullish(),
});

const scoreSchema = z.object({
  winner: z.string().nullish(),
  duration: z.string().nullish(),
  fullTime: z.object({ home: z.number().nullish(), away: z.number().nullish() }),
  halfTime: z.object({ home: z.number().nullish(), away: z.number().nullish() }).optional(),
  extraTime: z.object({ home: z.number().nullish(), away: z.number().nullish() }).optional(),
  penalties: z.object({ home: z.number().nullish(), away: z.number().nullish() }).optional(),
});

const matchSchema = z.object({
  id: z.number(),
  utcDate: z.string().datetime({ offset: true }),
  status: z.enum([
    "SCHEDULED",
    "TIMED",
    "IN_PLAY",
    "PAUSED",
    "FINISHED",
    "SUSPENDED",
    "POSTPONED",
    "CANCELLED",
    "AWARDED",
  ]),
  matchday: z.number().nullish(),
  stage: z.string().nullish(),
  group: z.string().nullish(),
  lastUpdated: z.string().datetime({ offset: true }).nullish(),
  homeTeam: teamSchema,
  awayTeam: teamSchema,
  score: scoreSchema,
});

const teamResponseSchema = teamSchema.extend({
  runningCompetitions: z.array(z.unknown()).optional(),
});

const competitionSchema = z.object({
  id: z.number(),
  name: z.string(),
  code: z.string().nullish(),
  type: z.string().nullish(),
  emblem: z.string().url().nullish(),
  plan: z.string().nullish(),
  currentSeason: z
    .object({
      id: z.number(),
      startDate: z.string().date(),
      endDate: z.string().date(),
      currentMatchday: z.number().nullish(),
    })
    .nullish(),
});

const matchesResponseSchema = z.object({
  matches: z.array(matchSchema),
});

const standingRowSchema = z.object({
  position: z.number(),
  team: teamSchema,
  playedGames: z.number(),
  won: z.number(),
  draw: z.number(),
  lost: z.number(),
  points: z.number(),
  goalsFor: z.number(),
  goalsAgainst: z.number(),
  goalDifference: z.number(),
  form: z.string().nullish(),
});

const standingsResponseSchema = z.object({
  competition: competitionSchema,
  season: z.object({
    id: z.number(),
    startDate: z.string().date(),
    endDate: z.string().date(),
    currentMatchday: z.number().nullish(),
  }),
  standings: z.array(
    z.object({
      stage: z.string().nullish(),
      type: z.string(),
      group: z.string().nullish(),
      table: z.array(standingRowSchema),
    }),
  ),
});

export type FootballDataTeam = z.infer<typeof teamSchema>;
export type FootballDataMatch = z.infer<typeof matchSchema>;
export type FootballDataCompetition = z.infer<typeof competitionSchema>;
export type FootballDataStandings = z.infer<typeof standingsResponseSchema>;

const FOOTBALL_DATA_ENDPOINT = "https://api.football-data.org/v4";
export const FOOTBALL_DATA_PROVIDER = "football-data.org";

function requireApiKey() {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  if (!apiKey) {
    throw new Error("FOOTBALL_DATA_API_KEY is not configured");
  }
  return apiKey;
}

async function fetchFootballData<T>(path: string, schema: z.ZodType<T>): Promise<T> {
  const response = await fetch(`${FOOTBALL_DATA_ENDPOINT}${path}`, {
    headers: {
      Accept: "application/json",
      "X-Auth-Token": requireApiKey(),
    },
    next: { revalidate: 900 },
  });

  if (!response.ok) {
    throw new Error(`football-data.org request failed with HTTP ${response.status}`);
  }

  return schema.parse(await response.json());
}

export async function fetchFootballDataTeam(teamId = 57) {
  return fetchFootballData(`/teams/${teamId}`, teamResponseSchema);
}

export async function fetchFootballDataCompetition(code = "PL") {
  return fetchFootballData(`/competitions/${encodeURIComponent(code)}`, competitionSchema);
}

export async function fetchFootballDataMatches(options: {
  teamId?: number;
  competition?: string;
  season?: number;
  status?: "SCHEDULED" | "LIVE" | "FINISHED";
} = {}) {
  const params = new URLSearchParams();
  if (options.competition) params.set("competitions", options.competition);
  if (options.season) params.set("season", String(options.season));
  if (options.status) params.set("status", options.status);
  params.set("limit", "100");
  const prefix = options.teamId ? `/teams/${options.teamId}/matches` : "/matches";
  const query = params.toString();
  const payload = await fetchFootballData(`${prefix}?${query}`, matchesResponseSchema);
  return payload.matches;
}

export async function fetchFootballDataStandings(options: {
  competition?: string;
  season?: number;
} = {}) {
  const competition = options.competition ?? "PL";
  const params = options.season ? `?season=${options.season}` : "";
  return fetchFootballData(
    `/competitions/${encodeURIComponent(competition)}/standings${params}`,
    standingsResponseSchema,
  );
}
