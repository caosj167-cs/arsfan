import { getFixtures, getStandings, type StandingView } from "@/lib/queries/football";

export type SplitRecord = {
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
};

export type SeasonAnalysis = {
  found: boolean;
  season: { providerSeasonId: number; competition: { name: string; code: string | null } } | null;
  standingsTop: StandingView[];
  arsenal: StandingView | null;
  home: SplitRecord;
  away: SplitRecord;
  metrics: {
    winRate: number;
    drawRate: number;
    lossRate: number;
    pointsPerGame: number;
    avgGoalsFor: number;
    avgGoalsAgainst: number;
  };
  notes: string[];
  lastUpdatedAt: string | null;
};

function emptySplit(): SplitRecord {
  return { played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0 };
}

function mergeSplit(target: SplitRecord, won: boolean, drawn: boolean, gf: number, ga: number) {
  target.played += 1;
  target.goalsFor += gf;
  target.goalsAgainst += ga;
  if (won) target.won += 1;
  else if (drawn) target.drawn += 1;
  else target.lost += 1;
}

/**
 * 按赛季(football-data providerSeasonId)做赛季分析。
 * - 积分榜快照来自 getStandings（权威：名次/积分/进失球）。
 * - 主客场拆分来自本季已结束比赛(fixtures)，按阿森纳主客队匹配推算。
 * - 自算指标带 notes 说明：本库未保存逐轮积分走势，趋势类为基于快照的估算。
 */
export async function getSeasonAnalysis(season: number): Promise<SeasonAnalysis> {
  const [standings, fixtures] = await Promise.all([
    getStandings({ season }),
    getFixtures({ season, pageSize: 200 }),
  ]);

  const base: SeasonAnalysis = {
    found: false,
    season: null,
    standingsTop: [],
    arsenal: null,
    home: emptySplit(),
    away: emptySplit(),
    metrics: { winRate: 0, drawRate: 0, lossRate: 0, pointsPerGame: 0, avgGoalsFor: 0, avgGoalsAgainst: 0 },
    notes: [],
    lastUpdatedAt: standings.lastUpdatedAt ?? fixtures.lastUpdatedAt ?? null,
  };

  if (!standings.competition || !standings.season) {
    return { ...base, notes: ["该赛季在 football-data.org 无积分榜数据，无法分析"] };
  }

  const arsenalRow = standings.standings.find((s) => s.team.name.includes("Arsenal")) ?? null;
  const arsenalTeamId = arsenalRow?.team.id ?? null;

  const home = emptySplit();
  const away = emptySplit();

  for (const f of fixtures.fixtures) {
    if (f.status !== "FINISHED" || !arsenalTeamId) continue;
    if (f.homeTeam.id !== arsenalTeamId && f.awayTeam.id !== arsenalTeamId) continue;

    const isHome = f.homeTeam.id === arsenalTeamId;
    const gf = isHome ? (f.score.home ?? 0) : (f.score.away ?? 0);
    const ga = isHome ? (f.score.away ?? 0) : (f.score.home ?? 0);
    const won = gf > ga;
    const drawn = gf === ga;
    mergeSplit(isHome ? home : away, won, drawn, gf, ga);
  }

  const playedTotal = home.played + away.played;
  const wonTotal = home.won + away.won;
  const drawnTotal = home.drawn + away.drawn;
  const lostTotal = home.lost + away.lost;
  const gfTotal = home.goalsFor + away.goalsFor;
  const gaTotal = home.goalsAgainst + away.goalsAgainst;

  const metrics = {
    winRate: playedTotal ? +((wonTotal / playedTotal) * 100).toFixed(1) : 0,
    drawRate: playedTotal ? +((drawnTotal / playedTotal) * 100).toFixed(1) : 0,
    lossRate: playedTotal ? +((lostTotal / playedTotal) * 100).toFixed(1) : 0,
    pointsPerGame: playedTotal ? +(((wonTotal * 3 + drawnTotal) / playedTotal).toFixed(2)) : 0,
    avgGoalsFor: playedTotal ? +(gfTotal / playedTotal).toFixed(2) : 0,
    avgGoalsAgainst: playedTotal ? +(gaTotal / playedTotal).toFixed(2) : 0,
  };

  const notes = [
    "积分榜名次/积分/进失球取自 football-data.org 当前赛季快照（权威）。",
    "主客场战绩由本季已结束比赛按阿森纳主客队匹配推算。",
    "本库未保存逐轮积分走势，胜率/场均进球等为基于快照的估算指标，非逐轮真实趋势。",
  ];

  return {
    found: true,
    season: {
      providerSeasonId: standings.season.providerSeasonId,
      competition: { name: standings.competition.name, code: standings.competition.code },
    },
    standingsTop: standings.standings.slice(0, 5),
    arsenal: arsenalRow,
    home,
    away,
    metrics,
    notes,
    lastUpdatedAt: standings.lastUpdatedAt ?? null,
  };
}
