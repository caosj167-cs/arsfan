import { z } from "zod";

const openLigaResultSchema = z.object({
  resultTypeKind: z.string().optional(),
  resultOrderID: z.number().optional(),
  pointsTeam1: z.number(),
  pointsTeam2: z.number(),
});

const openLigaMatchSchema = z.object({
  matchID: z.number(),
  matchDateTimeUTC: z.string().optional(),
  matchDateTime: z.string(),
  leagueSeason: z.number(),
  leagueShortcut: z.string(),
  leagueName: z.string(),
  matchIsFinished: z.boolean(),
  team1: z.object({
    teamId: z.number(),
    teamName: z.string(),
    shortName: z.string().optional(),
    teamIconUrl: z.string().optional().nullable(),
  }),
  team2: z.object({
    teamId: z.number(),
    teamName: z.string(),
    shortName: z.string().optional(),
    teamIconUrl: z.string().optional().nullable(),
  }),
  matchResults: z.array(openLigaResultSchema).optional(),
  goals: z.array(
    z.object({
      goalID: z.number(),
      scoreTeam1: z.number(),
      scoreTeam2: z.number(),
      matchMinute: z.number().nullable().optional(),
      goalGetterName: z.string().optional(),
      scoringTeamId: z.number().nullable().optional(),
    }),
  ).optional(),
});

export type NormalizedMatch = {
  provider: "openligadb" | "api-football";
  providerMatchId: string;
  competition: string;
  season: string;
  kickoffAt: string;
  status: "SCHEDULED" | "FINISHED";
  homeTeam: { id: string; name: string; logoUrl: string | null };
  awayTeam: { id: string; name: string; logoUrl: string | null };
  homeScore: number | null;
  awayScore: number | null;
};

export type OpenLigaDbOptions = {
  leagueShortcut?: string;
  season: number;
  team?: string;
};

const OPENLIGADB_ENDPOINT = "https://api.openligadb.de";

function finalResult(match: z.infer<typeof openLigaMatchSchema>) {
  const results = match.matchResults ?? [];
  return (
    results.find((result) =>
      ["After90Minutes", "AfterExtraTime", "AfterPenalties"].includes(
        result.resultTypeKind ?? "",
      ),
    ) ?? results.at(-1)
  );
}

function normalizeMatch(match: z.infer<typeof openLigaMatchSchema>): NormalizedMatch {
  const result = finalResult(match);

  return {
    provider: "openligadb",
    providerMatchId: String(match.matchID),
    competition: match.leagueName,
    season: String(match.leagueSeason),
    kickoffAt: match.matchDateTimeUTC ?? new Date(match.matchDateTime).toISOString(),
    status: match.matchIsFinished ? "FINISHED" : "SCHEDULED",
    homeTeam: {
      id: String(match.team1.teamId),
      name: match.team1.teamName,
      logoUrl: match.team1.teamIconUrl ?? null,
    },
    awayTeam: {
      id: String(match.team2.teamId),
      name: match.team2.teamName,
      logoUrl: match.team2.teamIconUrl ?? null,
    },
    homeScore: result?.pointsTeam1 ?? null,
    awayScore: result?.pointsTeam2 ?? null,
  };
}

export async function fetchOpenLigaDbMatches({
  leagueShortcut = process.env.OPENLIGADB_LEAGUE_SHORTCUT ?? "pl",
  season,
  team,
}: OpenLigaDbOptions): Promise<NormalizedMatch[]> {
  const path = [
    "getmatchdata",
    encodeURIComponent(leagueShortcut),
    String(season),
    team ? encodeURIComponent(team) : null,
  ]
    .filter(Boolean)
    .join("/");
  const response = await fetch(`${OPENLIGADB_ENDPOINT}/${path}`, {
    headers: { Accept: "application/json" },
    next: { revalidate: 900 },
  });

  if (!response.ok) {
    throw new Error(`OpenLigaDB request failed with HTTP ${response.status}`);
  }

  const payload = z.array(openLigaMatchSchema).parse(await response.json());
  return payload.map(normalizeMatch);
}

export function compareMatchScores(
  primary: Pick<NormalizedMatch, "homeTeam" | "awayTeam" | "homeScore" | "awayScore">,
  secondary: Pick<NormalizedMatch, "homeTeam" | "awayTeam" | "homeScore" | "awayScore">,
) {
  const sameTeams =
    primary.homeTeam.name.toLowerCase() === secondary.homeTeam.name.toLowerCase() &&
    primary.awayTeam.name.toLowerCase() === secondary.awayTeam.name.toLowerCase();

  return {
    sameTeams,
    sameScore:
      sameTeams &&
      primary.homeScore === secondary.homeScore &&
      primary.awayScore === secondary.awayScore,
    primary: {
      homeScore: primary.homeScore,
      awayScore: primary.awayScore,
    },
    secondary: {
      homeScore: secondary.homeScore,
      awayScore: secondary.awayScore,
    },
  };
}
