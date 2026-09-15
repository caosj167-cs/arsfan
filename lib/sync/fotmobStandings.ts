import {
  FOTMOB_PREMIER_LEAGUE_ID,
  FOTMOB_PROVIDER,
  fetchFotmobLeagueTable,
} from "@/lib/providers/fotmob";
import { FOOTBALL_DATA_PROVIDER } from "@/lib/queries/football";
import { opponentKey } from "@/lib/sync/opponent-key";
import { prisma } from "@/lib/prisma";

/**
 * 积分榜「抓取」同步——与进球榜/助攻榜同一套路（抓 FotMob 页面），
 * 不再依赖 football-data.org 的 standings API。
 *
 * 为什么换源：football-data.org 的英超积分榜长期滞后（本季只到第 2 轮，
 * 阿森纳 6 分），而 FotMob 联赛页给的是与官网一致的最新榜（本季 4 轮、
 * 阿森纳 12 分）。两个源口径不同，页面才会出现「按已赛场次算是 12 分、
 * 榜上却只有 6 分」的矛盾。
 *
 * 落表策略（关键）：
 *   1. 复用 getStandings() 读取的那套 competition/season（football-data 的 PL +
 *      当前赛季），因此读取层与页面零改动即可展示 FotMob 数据；
 *   2. 按 opponentKey 归一化队名，把 FotMob 行映射到**既有的 football-data Team 行**，
 *      只 upsert StandingEntry —— 不会产生「同队两行」，也保住了
 *      页面「阿森纳高亮」（其判据是 team.providerTeamId === "57"）。
 *   3. 名字实在对不上（新升班马等）才建 fotmob Team 兜底，并在结果里列出，保证不丢数据。
 */

export type FotmobStandingsSyncResult = {
  provider: string;
  competition: string;
  seasonId: string;
  /** football-data 的 season id（仅作标识，非年份） */
  providerSeasonId: number;
  /** FotMob 返回的球队数 */
  fetched: number;
  upserted: number;
  /** 新建的 Team 数（正常应为 0：20 队都能按名匹配到既有球队） */
  createdTeams: number;
  /** 未能按名匹配、走了兜底建队的球队名 */
  unmatched: string[];
  /** FotMob 页面缺失字段 */
  missing: string[];
  lastSyncedAt: string;
};

export async function syncStandingsFromFotmob(
  options: { competition?: string } = {},
): Promise<FotmobStandingsSyncResult> {
  const competitionCode = options.competition ?? "PL";
  const table = await fetchFotmobLeagueTable(FOTMOB_PREMIER_LEAGUE_ID);
  if (!table.rows.length) {
    throw new Error(
      `FotMob 联赛 ${FOTMOB_PREMIER_LEAGUE_ID} 未解析到积分榜行（missing: ${table.missing.join(",") || "无"}）`,
    );
  }

  const competition = await prisma.competition.findFirst({
    where: { provider: FOOTBALL_DATA_PROVIDER, code: competitionCode },
    orderBy: { updatedAt: "desc" },
  });
  if (!competition) {
    throw new Error(`未找到竞赛 ${competitionCode}（provider=${FOOTBALL_DATA_PROVIDER}）`);
  }

  // FotMob 联赛表始终是当前赛季；这里取读取层同款「当前赛季」。
  const season = await prisma.season.findFirst({
    where: { competitionId: competition.id },
    orderBy: [{ current: "desc" }, { startDate: "desc" }],
  });
  if (!season) throw new Error(`未找到赛季（competitionId=${competition.id}）`);

  const run = await prisma.syncRun.create({
    data: {
      provider: FOTMOB_PROVIDER,
      scope: `standings:${competitionCode}:${season.providerSeasonId}`,
      status: "RUNNING",
    },
  });

  try {
    // 既有球队（按归一化名索引）——即当前赛季榜上的那批 football-data 球队
    const existing = await prisma.standingEntry.findMany({
      where: { seasonId: season.id },
      include: { team: true },
    });
    const teamByKey = new Map(existing.map((entry) => [opponentKey(entry.team.name), entry.team]));

    const unmatched: string[] = [];
    let createdTeams = 0;
    let upserted = 0;

    for (const row of table.rows) {
      const key = opponentKey(row.name);
      let team = teamByKey.get(key);
      // 队名对不上时，退一步用短名再试（如 "Brighton Hove" 之类）
      if (!team && row.shortName) team = teamByKey.get(opponentKey(row.shortName));

      if (!team) {
        unmatched.push(row.name);
        team = await prisma.team.upsert({
          where: {
            provider_providerTeamId: {
              provider: FOTMOB_PROVIDER,
              providerTeamId: String(row.teamId),
            },
          },
          create: {
            provider: FOTMOB_PROVIDER,
            providerTeamId: String(row.teamId),
            name: row.name,
            shortName: row.shortName,
            crest: null,
            lastSyncedAt: new Date(),
          },
          update: { name: row.name, shortName: row.shortName, lastSyncedAt: new Date() },
        });
        teamByKey.set(key, team);
        createdTeams += 1;
      }

      const numbers = {
        position: row.position,
        playedGames: row.played,
        won: row.won,
        drawn: row.drawn,
        lost: row.lost,
        points: row.points,
        goalsFor: row.goalsFor,
        goalsAgainst: row.goalsAgainst,
        goalDifference: row.goalDifference,
        // FotMob 不提供近期战绩串，留空而不编造（页面亦无该列）
        form: null,
      };

      await prisma.standingEntry.upsert({
        where: { seasonId_teamId: { seasonId: season.id, teamId: team.id } },
        create: { seasonId: season.id, teamId: team.id, ...numbers },
        update: numbers,
      });
      upserted += 1;
    }

    await prisma.syncRun.update({
      where: { id: run.id },
      data: {
        status: "SUCCEEDED",
        finishedAt: new Date(),
        fetchedCount: table.rows.length,
        upsertedCount: upserted,
      },
    });

    return {
      provider: FOTMOB_PROVIDER,
      competition: competitionCode,
      seasonId: season.id,
      providerSeasonId: season.providerSeasonId,
      fetched: table.rows.length,
      upserted,
      createdTeams,
      unmatched,
      missing: table.missing,
      lastSyncedAt: new Date().toISOString(),
    };
  } catch (error) {
    await prisma.syncRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        errorMessage: error instanceof Error ? error.message : "Unknown standings sync error",
      },
    });
    throw error;
  }
}
