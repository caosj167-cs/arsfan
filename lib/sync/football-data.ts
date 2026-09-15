import {
  fetchFootballDataCompetition,
  fetchFootballDataMatches,
  fetchFootballDataStandings,
  fetchFootballDataTeam,
  FOOTBALL_DATA_PROVIDER,
  type FootballDataMatch,
  type FootballDataTeam,
} from "@/lib/providers/football-data";
import { normalizeTeamName } from "@/lib/queries/match";
import { prisma } from "@/lib/prisma";

const DEFAULT_TEAM_ID = 57;
const DEFAULT_COMPETITION = "PL";
const ARSENAL_NAME_TOKEN = "arsenal";

function dateOnlyToDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function mapFixtureStatus(status: FootballDataMatch["status"]) {
  return status;
}

async function upsertTeam(team: FootballDataTeam) {
  return prisma.team.upsert({
    where: {
      provider_providerTeamId: {
        provider: FOOTBALL_DATA_PROVIDER,
        providerTeamId: String(team.id),
      },
    },
    create: {
      provider: FOOTBALL_DATA_PROVIDER,
      providerTeamId: String(team.id),
      name: team.name,
      shortName: team.shortName ?? null,
      tla: team.tla ?? null,
      crest: team.crest ?? null,
      address: team.address ?? null,
      website: team.website ?? null,
      founded: team.founded ?? null,
      clubColors: team.clubColors ?? null,
      venue: team.venue ?? null,
      lastSyncedAt: new Date(),
    },
    update: {
      name: team.name,
      shortName: team.shortName ?? null,
      tla: team.tla ?? null,
      crest: team.crest ?? null,
      address: team.address ?? null,
      website: team.website ?? null,
      founded: team.founded ?? null,
      clubColors: team.clubColors ?? null,
      venue: team.venue ?? null,
      lastSyncedAt: new Date(),
    },
  });
}

/**
 * 比分回填：以 football-data 的 Fixture(homeScore/awayScore) 为权威源，
 * 按「开赛日期 + 对手名称」匹配 arsenal.com 的 officialFixture，回填其空比分。
 *
 * 纯 DB 操作（Fixture 已含真实比分），不依赖外部 API，可随时重复执行。
 * 匹配规则：同日期下找到涉及阿森纳的比赛，且对手归一化名互为包含；
 * 阿森纳的进球取自该场 fixture 中阿森纳所在一侧（不盲信 officialFixture.homeAway）。
 */
export async function reconcileScores(): Promise<{ total: number; matched: number; updated: number; skipped: number }> {
  // 只处理「空比分」或「上次由 football-data 回填」的行，人工录入(manual/report)不覆盖
  const official = await prisma.officialFixture.findMany({
    where: {
      isActive: true,
      NOT: { scoreSource: { in: ["manual", "report"] } },
      OR: [{ homeScore: null }, { awayScore: null }, { scoreSource: "football-data.org" }],
    },
  });
  const fixtures = await prisma.fixture.findMany({
    where: { status: "FINISHED", NOT: { homeScore: null, awayScore: null } },
    include: { homeTeam: true, awayTeam: true },
  });

  let matched = 0;
  let updated = 0;
  for (const row of official) {
    const dateKey = row.kickoffAt.toISOString().slice(0, 10);
    const offOpp = normalizeTeamName(row.opponentName);
    const candidate = fixtures.find((f) => {
      if (f.utcDate.toISOString().slice(0, 10) !== dateKey) return false;
      const arsenalIsHome = normalizeTeamName(f.homeTeam.name).includes(ARSENAL_NAME_TOKEN);
      const fixtureOpp = normalizeTeamName(arsenalIsHome ? f.awayTeam.name : f.homeTeam.name);
      return fixtureOpp.includes(offOpp) || offOpp.includes(fixtureOpp);
    });
    if (!candidate) continue;
    matched += 1;

    // visual/homeAway 语义：homeScore/awayScore 是「主队/客队」的进球数（字面值），
    // 由 UI 结合 homeAway 判断阿森纳胜负，因此直接照抄 fixture 的主客比分。
    await prisma.officialFixture.update({
      where: { id: row.id },
      data: {
        homeScore: candidate.homeScore,
        awayScore: candidate.awayScore,
        scoreSource: "football-data.org",
        scoreSourceUrl: null,
        scoreUpdatedAt: new Date(),
      },
    });
    updated += 1;
  }

  return { total: official.length, matched, updated, skipped: official.length - matched };
}

export async function syncFootballData(options: {
  teamId?: number;
  competition?: string;
  season?: number;
} = {}) {
  const teamId = options.teamId ?? Number(process.env.FOOTBALL_DATA_TEAM_ID ?? DEFAULT_TEAM_ID);
  const competitionCode = options.competition ?? process.env.FOOTBALL_DATA_COMPETITION ?? DEFAULT_COMPETITION;
  const scope = `${competitionCode}:${options.season ?? "current"}:team-${teamId}`;
  const run = await prisma.syncRun.create({
    data: { provider: FOOTBALL_DATA_PROVIDER, scope, status: "RUNNING" },
  });

  try {
    const [teamPayload, competitionPayload, matches, standingsPayload] = await Promise.all([
      fetchFootballDataTeam(teamId),
      fetchFootballDataCompetition(competitionCode),
      fetchFootballDataMatches({
        teamId,
        competition: competitionCode,
        season: options.season,
      }),
      fetchFootballDataStandings({ competition: competitionCode, season: options.season }),
    ]);

    const teamIds = new Map<number, Awaited<ReturnType<typeof upsertTeam>>>();
    const teams = [
      teamPayload,
      ...matches.flatMap((match) => [match.homeTeam, match.awayTeam]),
      ...standingsPayload.standings.flatMap((standing) => standing.table.map((row) => row.team)),
    ];
    for (const team of teams) {
      if (!teamIds.has(team.id)) teamIds.set(team.id, await upsertTeam(team));
    }

    const competition = await prisma.competition.upsert({
      where: {
        provider_providerCompetitionId: {
          provider: FOOTBALL_DATA_PROVIDER,
          providerCompetitionId: String(competitionPayload.id),
        },
      },
      create: {
        provider: FOOTBALL_DATA_PROVIDER,
        providerCompetitionId: String(competitionPayload.id),
        name: competitionPayload.name,
        code: competitionPayload.code ?? null,
        type: competitionPayload.type ?? null,
        emblem: competitionPayload.emblem ?? null,
        plan: competitionPayload.plan ?? null,
      },
      update: {
        name: competitionPayload.name,
        code: competitionPayload.code ?? null,
        type: competitionPayload.type ?? null,
        emblem: competitionPayload.emblem ?? null,
        plan: competitionPayload.plan ?? null,
      },
    });

    const seasonPayload = standingsPayload.season;
    const season = await prisma.season.upsert({
      where: {
        competitionId_providerSeasonId: {
          competitionId: competition.id,
          providerSeasonId: seasonPayload.id,
        },
      },
      create: {
        competitionId: competition.id,
        providerSeasonId: seasonPayload.id,
        startDate: dateOnlyToDate(seasonPayload.startDate),
        endDate: dateOnlyToDate(seasonPayload.endDate),
        current: competitionPayload.currentSeason?.id === seasonPayload.id,
        currentMatchday: seasonPayload.currentMatchday ?? null,
      },
      update: {
        startDate: dateOnlyToDate(seasonPayload.startDate),
        endDate: dateOnlyToDate(seasonPayload.endDate),
        current: competitionPayload.currentSeason?.id === seasonPayload.id,
        currentMatchday: seasonPayload.currentMatchday ?? null,
      },
    });

    for (const match of matches) {
      const homeTeam = teamIds.get(match.homeTeam.id);
      const awayTeam = teamIds.get(match.awayTeam.id);
      if (!homeTeam || !awayTeam) throw new Error(`Missing team relation for fixture ${match.id}`);

      await prisma.fixture.upsert({
        where: {
          provider_providerMatchId: {
            provider: FOOTBALL_DATA_PROVIDER,
            providerMatchId: String(match.id),
          },
        },
        create: {
          provider: FOOTBALL_DATA_PROVIDER,
          providerMatchId: String(match.id),
          competitionId: competition.id,
          seasonId: season.id,
          utcDate: new Date(match.utcDate),
          status: mapFixtureStatus(match.status),
          matchday: match.matchday ?? null,
          stage: match.stage ?? null,
          group: match.group ?? null,
          winner: match.score.winner ?? null,
          duration: match.score.duration ?? null,
          homeTeamId: homeTeam.id,
          awayTeamId: awayTeam.id,
          homeScore: match.score.fullTime.home ?? null,
          awayScore: match.score.fullTime.away ?? null,
          halfTimeHomeScore: match.score.halfTime?.home ?? null,
          halfTimeAwayScore: match.score.halfTime?.away ?? null,
          extraTimeHomeScore: match.score.extraTime?.home ?? null,
          extraTimeAwayScore: match.score.extraTime?.away ?? null,
          penaltiesHomeScore: match.score.penalties?.home ?? null,
          penaltiesAwayScore: match.score.penalties?.away ?? null,
          lastUpdated: match.lastUpdated ? new Date(match.lastUpdated) : null,
        },
        update: {
          competitionId: competition.id,
          seasonId: season.id,
          utcDate: new Date(match.utcDate),
          status: mapFixtureStatus(match.status),
          matchday: match.matchday ?? null,
          stage: match.stage ?? null,
          group: match.group ?? null,
          winner: match.score.winner ?? null,
          duration: match.score.duration ?? null,
          homeTeamId: homeTeam.id,
          awayTeamId: awayTeam.id,
          homeScore: match.score.fullTime.home ?? null,
          awayScore: match.score.fullTime.away ?? null,
          halfTimeHomeScore: match.score.halfTime?.home ?? null,
          halfTimeAwayScore: match.score.halfTime?.away ?? null,
          extraTimeHomeScore: match.score.extraTime?.home ?? null,
          extraTimeAwayScore: match.score.extraTime?.away ?? null,
          penaltiesHomeScore: match.score.penalties?.home ?? null,
          penaltiesAwayScore: match.score.penalties?.away ?? null,
          lastUpdated: match.lastUpdated ? new Date(match.lastUpdated) : null,
        },
      });
    }

    // ⚠️ 此处**不再写 standingEntry**：积分榜已改由 `syncStandingsFromFotmob()`
    // （抓 FotMob 联赛表）负责，football-data 的 standings 长期滞后（本季只到第 2 轮），
    // 写入会覆盖掉 FotMob 的最新榜。standingsPayload 仅用于取赛季元数据（providerSeasonId/起止日期）。

    const scores = await reconcileScores();

    await prisma.syncRun.update({
      where: { id: run.id },
      data: {
        status: "SUCCEEDED",
        finishedAt: new Date(),
        fetchedCount: matches.length,
        upsertedCount: matches.length,
        metadata: { teamId, competition: competitionCode, seasonId: seasonPayload.id, scoresReconciled: scores },
      },
    });

    return {
      syncRunId: run.id,
      provider: FOOTBALL_DATA_PROVIDER,
      competition: competitionCode,
      seasonId: seasonPayload.id,
      matches: matches.length,
      /** 积分榜不在此同步（唯一写入源是 syncStandingsFromFotmob），恒为 0 */
      standings: 0,
      scores,
    };
  } catch (error) {
    await prisma.syncRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        errorMessage: error instanceof Error ? error.message : "Unknown sync error",
      },
    });
    throw error;
  }
}
