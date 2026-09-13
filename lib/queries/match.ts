import {
  fetchApiFootballMatchDetails,
  fetchApiFootballFixturesByDate,
  type ApiFootballEvent,
  type ApiFootballFixture,
  type ApiFootballLineup,
  type ApiFootballPlayerStats,
  type ApiFootballTeamStatistics,
} from "@/lib/providers/api-football";
import { prisma } from "@/lib/prisma";

type StoredFixture = Awaited<ReturnType<typeof findStoredFixture>>;

export async function findStoredFixture(fixtureId: string) {
  return prisma.fixture.findFirst({
    where: {
      OR: [{ id: fixtureId }, { providerMatchId: fixtureId }],
    },
    include: {
      competition: true,
      homeTeam: true,
      awayTeam: true,
    },
  });
}

function teamView(team: { id: string; providerTeamId: string; name: string; shortName: string | null; crest: string | null }) {
  return {
    id: team.id,
    providerTeamId: team.providerTeamId,
    name: team.name,
    shortName: team.shortName,
    crest: team.crest,
  };
}

function storedFixtureView(fixture: NonNullable<StoredFixture>) {
  return {
    id: fixture.id,
    providerMatchId: fixture.providerMatchId,
    kickoffAt: fixture.utcDate.toISOString(),
    status: fixture.status,
    matchday: fixture.matchday,
    competition: { name: fixture.competition.name, code: fixture.competition.code },
    homeTeam: teamView(fixture.homeTeam),
    awayTeam: teamView(fixture.awayTeam),
    score: {
      home: fixture.homeScore,
      away: fixture.awayScore,
      halfTimeHome: fixture.halfTimeHomeScore,
      halfTimeAway: fixture.halfTimeAwayScore,
    },
  };
}

function apiFixtureView(fixture: ApiFootballFixture | null) {
  if (!fixture) return null;
  return {
    providerMatchId: String(fixture.fixture.id),
    kickoffAt: fixture.fixture.date,
    status: fixture.fixture.status.short,
    statusLabel: fixture.fixture.status.long,
    elapsed: fixture.fixture.status.elapsed,
    venue: fixture.fixture.venue,
    referee: fixture.fixture.referee,
    round: fixture.league.round,
    competition: {
      id: fixture.league.id,
      name: fixture.league.name,
      country: fixture.league.country,
      season: fixture.league.season,
      logo: fixture.league.logo,
    },
    homeTeam: fixture.teams.home,
    awayTeam: fixture.teams.away,
    score: {
      home: fixture.score.fulltime?.home ?? fixture.goals.home,
      away: fixture.score.fulltime?.away ?? fixture.goals.away,
      halfTimeHome: fixture.score.halftime?.home ?? null,
      halfTimeAway: fixture.score.halftime?.away ?? null,
    },
  };
}

export function normalizeTeamName(name: string) {
  return name.toLowerCase().replace(/\b(fc|afc|women|wfc)\b/g, "").replace(/[^a-z0-9]/g, "");
}

/**
 * api-football 的赛季用起始年份（2026-27 赛季 → 2026）。
 * 7 月及以后算当年，1-6 月算上一年，避免 2027 年 1 月的比赛被当成 2027 赛季。
 */
export function apiFootballSeasonFromDate(date: Date) {
  const year = date.getUTCFullYear();
  return date.getUTCMonth() >= 6 ? year : year - 1;
}

export async function resolveApiFixtureId(storedFixture: NonNullable<StoredFixture>) {
  const date = storedFixture.utcDate.toISOString().slice(0, 10);
  const season = apiFootballSeasonFromDate(storedFixture.utcDate);
  const candidates = await fetchApiFootballFixturesByDate({ date, season });
  const storedHome = normalizeTeamName(storedFixture.homeTeam.name);
  const storedAway = normalizeTeamName(storedFixture.awayTeam.name);
  const match = candidates.find((candidate) => {
    const home = normalizeTeamName(candidate.teams.home.name);
    const away = normalizeTeamName(candidate.teams.away.name);
    return home === storedHome && away === storedAway;
  });
  return match?.fixture.id ?? null;
}

function mapEvent(event: ApiFootballEvent) {
  return {
    minute: event.time.elapsed,
    extraMinute: event.time.extra,
    type: event.type,
    detail: event.detail,
    comments: event.comments,
    team: event.team,
    player: event.player,
    assist: event.assist,
  };
}

function mapLineup(lineup: ApiFootballLineup) {
  return {
    team: lineup.team,
    coach: lineup.coach,
    formation: lineup.formation,
    startXI: lineup.startXI.map((entry) => entry.player),
    substitutes: lineup.substitutes.map((entry) => entry.player),
  };
}

function mapTeamStatistics(statistics: ApiFootballTeamStatistics) {
  return {
    team: statistics.team,
    statistics: statistics.statistics,
  };
}

function mapPlayerStats(stats: ApiFootballPlayerStats) {
  return {
    team: stats.team,
    players: stats.players.map((row) => ({ player: row.player, statistics: row.statistics[0] ?? null })),
  };
}

export type MatchDetailView = {
  requestedId: string;
  storedFixture: ReturnType<typeof storedFixtureView> | null;
  fixture: ReturnType<typeof apiFixtureView>;
  events: ReturnType<typeof mapEvent>[];
  lineups: ReturnType<typeof mapLineup>[];
  teamStatistics: ReturnType<typeof mapTeamStatistics>[];
  playerStats: ReturnType<typeof mapPlayerStats>[];
  apiFootballAvailable: boolean;
  apiFootballError: string | null;
};

export async function getMatchDetail(requestedId: string): Promise<MatchDetailView> {
  const storedFixture = await findStoredFixture(requestedId);
  const parsedApiFixtureId = Number.parseInt(requestedId, 10);
  const hasNumericId = Number.isSafeInteger(parsedApiFixtureId) && parsedApiFixtureId > 0;

  // 既不是数字 api-football id、本库也没有对应 fixture 时，才算非法 id。
  // 若是本库 cuid，则仍可通过 storedFixture 反查 api-football fixture。
  if (!hasNumericId && !storedFixture) {
    return {
      requestedId,
      storedFixture: null,
      fixture: null,
      events: [],
      lineups: [],
      teamStatistics: [],
      playerStats: [],
      apiFootballAvailable: false,
      apiFootballError: "Invalid fixture ID",
    };
  }

  try {
    let apiFixtureId = parsedApiFixtureId;
    if (storedFixture) {
      const resolvedApiFixtureId = await resolveApiFixtureId(storedFixture);
      if (!resolvedApiFixtureId) {
        return {
          requestedId,
          storedFixture: storedFixtureView(storedFixture),
          fixture: null,
          events: [],
          lineups: [],
          teamStatistics: [],
          playerStats: [],
          apiFootballAvailable: false,
          apiFootballError: "No matching API-Football fixture found",
        };
      }
      apiFixtureId = resolvedApiFixtureId;
    }
    const details = await fetchApiFootballMatchDetails(apiFixtureId);
    return {
      requestedId,
      storedFixture: storedFixture ? storedFixtureView(storedFixture) : null,
      fixture: apiFixtureView(details.fixture),
      events: details.events.map(mapEvent),
      lineups: details.lineups.map(mapLineup),
      teamStatistics: details.teamStatistics.map(mapTeamStatistics),
      playerStats: details.playerStats.map(mapPlayerStats),
      apiFootballAvailable: details.fixture !== null,
      apiFootballError: details.fixture ? null : "Fixture not found in API-Football",
    };
  } catch (error) {
    return {
      requestedId,
      storedFixture: storedFixture ? storedFixtureView(storedFixture) : null,
      fixture: null,
      events: [],
      lineups: [],
      teamStatistics: [],
      playerStats: [],
      apiFootballAvailable: false,
      apiFootballError: error instanceof Error ? error.message : "API-Football unavailable",
    };
  }
}

/**
 * 从本库读取已落库的比赛事件/统计（由 syncMatchEvents 写入）。
 * 优先用库内数据，避免每次都打 API-Football；未落库时返回空数组。
 */
export async function getStoredMatchData(fixtureId: string) {
  const [events, teamStats, playerStats] = await Promise.all([
    prisma.matchEvent.findMany({ where: { fixtureId }, orderBy: { minute: "asc" } }),
    prisma.matchTeamStat.findMany({ where: { fixtureId }, orderBy: { teamName: "asc" } }),
    prisma.playerMatchStat.findMany({ where: { fixtureId } }),
  ]);
  return { events, teamStats, playerStats, hasStored: events.length + teamStats.length + playerStats.length > 0 };
}
