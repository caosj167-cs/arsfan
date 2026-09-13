import {
  API_FOOTBALL_PROVIDER,
  fetchApiFootballEvents,
  fetchApiFootballPlayerStats,
  fetchApiFootballPlayers,
  fetchApiFootballTeamStatistics,
} from "@/lib/providers/api-football";
import { findStoredFixture, resolveApiFixtureId } from "@/lib/queries/match";
import { prisma } from "@/lib/prisma";

// 注意：api-football 的球队 id 与 football-data 不同。
// Arsenal 在 api-football 为 42，在 football-data 为 57。
const DEFAULT_TEAM_ID = 42;
const DEFAULT_LEAGUE_ID = 39; // Premier League (api-football)

/**
 * 拉取 Arsenal(api-football team=42) 指定赛季的球员统计，落 playerSeasonStat。
 * 用 /players?team=42&league=39&season=… 一次拿全队（含进球/助攻/出场/评分/牌）。
 */
export async function syncPlayerStats(options: { league?: number; season?: number; teamId?: number } = {}) {
  const league = options.league ?? DEFAULT_LEAGUE_ID;
  const season = options.season ?? new Date().getUTCFullYear();
  const teamId = options.teamId ?? DEFAULT_TEAM_ID;

  const rows = await fetchApiFootballPlayers({ teamId, league, season });

  let upserted = 0;
  for (const row of rows) {
    const stat = row.statistics.find((s) => s.league?.id === league) ?? row.statistics[0];
    if (!stat) continue;
    const seed = {
      providerPlayerId: String(row.player.id),
      playerName: row.player.name ?? "",
      season,
      league: String(league),
      team: stat.team?.name ?? null,
      position: stat.games?.position ?? null,
      appearances: stat.games?.appearences ?? 0,
      goals: stat.goals?.total ?? 0,
      assists: stat.goals?.assists ?? 0,
      yellowCards: stat.cards?.yellow ?? 0,
      redCards: stat.cards?.red ?? 0,
      rating: stat.games?.rating ? Number.parseFloat(stat.games.rating) : null,
    };
    await prisma.playerSeasonStat.upsert({
      where: {
        provider_providerPlayerId_season: {
          provider: API_FOOTBALL_PROVIDER,
          providerPlayerId: seed.providerPlayerId,
          season: seed.season,
        },
      },
      create: { provider: API_FOOTBALL_PROVIDER, ...seed },
      update: {
        playerName: seed.playerName,
        league: seed.league,
        team: seed.team,
        position: seed.position,
        appearances: seed.appearances,
        goals: seed.goals,
        assists: seed.assists,
        yellowCards: seed.yellowCards,
        redCards: seed.redCards,
        rating: seed.rating,
        lastSyncedAt: new Date(),
      },
    });
    upserted += 1;
  }

  return {
    provider: API_FOOTBALL_PROVIDER,
    league,
    season,
    teamId,
    players: rows.length,
    upserted,
  };
}

/**
 * 按本库 fixture(内部 id) 拉取并落库比赛事件 / 球队统计 / 球员统计。
 * 先按日期+队名解析出 api-football fixtureId，再拉 events/statistics/players。
 * 幂等：每次先 deleteMany 该 fixture 再批量 create。
 */
export async function syncMatchEvents(fixtureId: string) {
  const stored = await findStoredFixture(fixtureId);
  if (!stored) throw new Error("Fixture not found in local DB");

  const apiFixtureId = await resolveApiFixtureId(stored);
  if (!apiFixtureId) throw new Error("No matching API-Football fixture for this date/teams");

  const [events, teamStats, playerStats] = await Promise.all([
    fetchApiFootballEvents(apiFixtureId),
    fetchApiFootballTeamStatistics(apiFixtureId),
    fetchApiFootballPlayerStats(apiFixtureId),
  ]);

  const providerFixtureId = String(apiFixtureId);

  const eventData = events.map((e) => ({
    fixtureId,
    provider: API_FOOTBALL_PROVIDER,
    providerFixtureId,
    minute: e.time.elapsed,
    extraMinute: e.time.extra ?? null,
    type: e.type,
    detail: e.detail ?? null,
    comments: e.comments ?? null,
    teamId: e.team?.id ? String(e.team.id) : null,
    teamName: e.team?.name ?? null,
    playerId: e.player?.id ? String(e.player.id) : null,
    playerName: e.player?.name ?? null,
    assistId: e.assist?.id ? String(e.assist.id) : null,
    assistName: e.assist?.name ?? null,
  }));

  const teamStatData = teamStats.flatMap((t) =>
    t.statistics.map((s) => ({
      fixtureId,
      provider: API_FOOTBALL_PROVIDER,
      providerFixtureId,
      teamId: t.team?.id ? String(t.team.id) : null,
      teamName: t.team?.name ?? null,
      type: s.type,
      value: s.value == null ? null : String(s.value),
    })),
  );

  const playerStatData = playerStats.flatMap((p) =>
    p.players.map((row) => {
      const stat = (row.statistics?.[0] ?? {}) as {
        games?: { minutes?: number | null; position?: string | null; rating?: string | null };
        goals?: { total?: number | null; assists?: number | null };
        cards?: { yellow?: number | null; red?: number | null };
      };
      return {
        fixtureId,
        provider: API_FOOTBALL_PROVIDER,
        providerFixtureId,
        teamId: p.team?.id ? String(p.team.id) : null,
        teamName: p.team?.name ?? null,
        playerId: row.player?.id ? String(row.player.id) : null,
        playerName: row.player?.name ?? null,
        number: row.player?.number ?? null,
        position: stat.games?.position ?? null,
        minutes: stat.games?.minutes ?? null,
        rating: stat.games?.rating ? Number.parseFloat(stat.games.rating) : null,
        goals: stat.goals?.total ?? 0,
        assists: stat.goals?.assists ?? 0,
        yellowCards: stat.cards?.yellow ?? 0,
        redCards: stat.cards?.red ?? 0,
      };
    }),
  );

  await prisma.$transaction([
    prisma.matchEvent.deleteMany({ where: { fixtureId } }),
    prisma.matchTeamStat.deleteMany({ where: { fixtureId } }),
    prisma.playerMatchStat.deleteMany({ where: { fixtureId } }),
  ]);

  if (eventData.length) await prisma.matchEvent.createMany({ data: eventData });
  if (teamStatData.length) await prisma.matchTeamStat.createMany({ data: teamStatData });
  if (playerStatData.length) await prisma.playerMatchStat.createMany({ data: playerStatData });

  return {
    fixtureId,
    apiFixtureId,
    events: eventData.length,
    teamStats: teamStatData.length,
    playerStats: playerStatData.length,
  };
}
