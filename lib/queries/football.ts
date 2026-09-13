import { prisma } from "@/lib/prisma";

export const FOOTBALL_DATA_PROVIDER = "football-data.org";
export const DEFAULT_COMPETITION_CODE = "PL";

export const fixtureStatuses = [
  "SCHEDULED",
  "TIMED",
  "IN_PLAY",
  "PAUSED",
  "FINISHED",
  "SUSPENDED",
  "POSTPONED",
  "CANCELLED",
  "AWARDED",
] as const;

export type FixtureStatusValue = (typeof fixtureStatuses)[number];

export type FixtureView = {
  id: string;
  providerMatchId: string;
  kickoffAt: string;
  status: FixtureStatusValue;
  matchday: number | null;
  homeTeam: { id: string; providerTeamId: string; name: string; shortName: string | null; crest: string | null };
  awayTeam: { id: string; providerTeamId: string; name: string; shortName: string | null; crest: string | null };
  score: {
    home: number | null;
    away: number | null;
    halfTimeHome: number | null;
    halfTimeAway: number | null;
  };
  competition: { name: string; code: string | null };
};

export type StandingView = {
  position: number;
  team: { id: string; providerTeamId: string; name: string; shortName: string | null; crest: string | null };
  playedGames: number;
  won: number;
  drawn: number;
  lost: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  form: string | null;
};

type FootballQueryOptions = {
  competition?: string;
  season?: number;
};

async function findCompetition(code = DEFAULT_COMPETITION_CODE) {
  return prisma.competition.findFirst({
    where: { provider: FOOTBALL_DATA_PROVIDER, code },
    orderBy: { updatedAt: "desc" },
  });
}

async function findSeason(options: FootballQueryOptions = {}) {
  const competition = await findCompetition(options.competition);
  if (!competition) return { competition: null, season: null };

  const season = await prisma.season.findFirst({
    where: {
      competitionId: competition.id,
      ...(options.season ? { providerSeasonId: options.season } : {}),
    },
    orderBy: [{ current: "desc" }, { startDate: "desc" }],
  });

  return { competition, season };
}

function toTeamView(team: {
  id: string;
  providerTeamId: string;
  name: string;
  shortName: string | null;
  crest: string | null;
}) {
  return {
    id: team.id,
    providerTeamId: team.providerTeamId,
    name: team.name,
    shortName: team.shortName,
    crest: team.crest,
  };
}

export async function getFixtures(options: {
  competition?: string;
  season?: number;
  status?: FixtureStatusValue;
  month?: number;
  page?: number;
  pageSize?: number;
} = {}) {
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 20));
  const { competition, season } = await findSeason(options);

  if (!competition) {
    return { fixtures: [] as FixtureView[], total: 0, page, pageSize, competition: null, season: null };
  }

  const monthFilter = options.month
    ? {
        gte: new Date(Date.UTC(new Date().getUTCFullYear(), options.month - 1, 1)),
        lt: new Date(Date.UTC(new Date().getUTCFullYear(), options.month, 1)),
      }
    : undefined;
  const where = {
    competitionId: competition.id,
    ...(season ? { seasonId: season.id } : {}),
    ...(options.status ? { status: options.status } : {}),
    ...(monthFilter ? { utcDate: monthFilter } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.fixture.findMany({
      where,
      include: { homeTeam: true, awayTeam: true, competition: true },
      orderBy: { utcDate: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.fixture.count({ where }),
  ]);

  return {
    fixtures: rows.map((fixture) => ({
      id: fixture.id,
      providerMatchId: fixture.providerMatchId,
      kickoffAt: fixture.utcDate.toISOString(),
      status: fixture.status,
      matchday: fixture.matchday,
      homeTeam: toTeamView(fixture.homeTeam),
      awayTeam: toTeamView(fixture.awayTeam),
      score: {
        home: fixture.homeScore,
        away: fixture.awayScore,
        halfTimeHome: fixture.halfTimeHomeScore,
        halfTimeAway: fixture.halfTimeAwayScore,
      },
      competition: { name: fixture.competition.name, code: fixture.competition.code },
    })),
    total,
    page,
    pageSize,
    competition: { name: competition.name, code: competition.code },
    season: season
      ? {
          providerSeasonId: season.providerSeasonId,
          startDate: season.startDate.toISOString(),
          endDate: season.endDate.toISOString(),
          current: season.current,
        }
      : null,
    lastUpdatedAt: competition.updatedAt?.toISOString() ?? null,
  };
}

export async function getStandings(options: FootballQueryOptions = {}) {
  const { competition, season } = await findSeason(options);

  if (!competition || !season) {
    return { standings: [] as StandingView[], competition: null, season: null, lastUpdatedAt: null };
  }

  const [rows, latest] = await Promise.all([
    prisma.standingEntry.findMany({
      where: { seasonId: season.id },
      include: { team: true },
      orderBy: { position: "asc" },
    }),
    prisma.standingEntry.findFirst({
      where: { seasonId: season.id },
      orderBy: { updatedAt: "desc" },
      select: { updatedAt: true },
    }),
  ]);

  return {
    standings: rows.map((row) => ({
      position: row.position,
      team: toTeamView(row.team),
      playedGames: row.playedGames,
      won: row.won,
      drawn: row.drawn,
      lost: row.lost,
      points: row.points,
      goalsFor: row.goalsFor,
      goalsAgainst: row.goalsAgainst,
      goalDifference: row.goalDifference,
      form: row.form,
    })),
    competition: { name: competition.name, code: competition.code },
    season: {
      providerSeasonId: season.providerSeasonId,
      startDate: season.startDate.toISOString(),
      endDate: season.endDate.toISOString(),
      current: season.current,
    },
    lastUpdatedAt: latest?.updatedAt.toISOString() ?? null,
  };
}
