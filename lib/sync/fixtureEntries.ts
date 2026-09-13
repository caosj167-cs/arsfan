import type { Prisma } from "@/app/generated/prisma/client";
import { isOfficialCompetition, normalizeCompetition } from "@/lib/data/competitions";
import { seasonStartYear } from "@/lib/data/season";
import { fetchArsenalFixtures } from "@/lib/providers/arsenal";
import { fetchWikipediaFixtures } from "@/lib/providers/wikipedia";
import { prisma } from "@/lib/prisma";

/**
 * 合并 26/27 赛季赛程：
 *   主源 = football-data.org（读本库 Fixture，权威：时间/状态/比分）
 *   补充 = arsenal.com（官方抓取，补主源没有的欧冠/联赛杯/足总杯）
 *        = Wikipedia（赛季页 wikitext，独立第二站，交叉验证 + 补充比分）
 * 规则：同「对手 + 主客」归为一场；来源数 ≥2 → verified。
 * 结果写入 FixtureEntry，refreshAfter = kickoffAt + 3h。
 */

export type FixtureSourceLabel = "football-data.org" | "arsenal.com" | "wikipedia";

const SOURCE_RANK: Record<FixtureSourceLabel, number> = {
  "football-data.org": 0,
  "arsenal.com": 1,
  wikipedia: 2,
};

const ARSENAL_PROVIDER_TEAM_ID = "57";

type Candidate = {
  source: FixtureSourceLabel;
  kickoffAt: Date;
  opponentName: string;
  opponentCrest: string | null;
  homeAway: "HOME" | "AWAY";
  competition: string;
  competitionCode: string | null;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
  fixtureId: string | null;
};

function seasonWindow(season: number) {
  return {
    start: new Date(Date.UTC(season, 6, 1)), // 7/1
    end: new Date(Date.UTC(season + 1, 5, 30, 23, 59, 59)), // 次年 6/30
  };
}

/** 对手归一化 key：去变音符、去 F.C./AFC/FC 等后缀与符号 */
export function opponentKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[øØ]/g, "o")
    .replace(/[đĐ]/g, "d")
    .replace(/[łŁ]/g, "l")
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\b(a ?f ?c|f ?c|w ?f ?c)\b/g, "")
    .replace(/\b(afc|fc|wfc|women|ladies|reserves|u21|u18)\b/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]/g, "");
}

async function footballDataCandidates(season: number): Promise<Candidate[]> {
  const { start, end } = seasonWindow(season);
  const rows = await prisma.fixture.findMany({
    where: { utcDate: { gte: start, lte: end } },
    include: { homeTeam: true, awayTeam: true },
  });
  return rows
    .filter((f) => f.homeTeam.providerTeamId === ARSENAL_PROVIDER_TEAM_ID || f.awayTeam.providerTeamId === ARSENAL_PROVIDER_TEAM_ID)
    .map((f) => {
      const arsenalHome = f.homeTeam.providerTeamId === ARSENAL_PROVIDER_TEAM_ID;
      const opponent = arsenalHome ? f.awayTeam : f.homeTeam;
      return {
        source: "football-data.org" as const,
        kickoffAt: f.utcDate,
        opponentName: opponent.name,
        opponentCrest: opponent.crest,
        homeAway: arsenalHome ? ("HOME" as const) : ("AWAY" as const),
        competition: "Premier League",
        competitionCode: "PL",
        status: f.status,
        homeScore: f.homeScore,
        awayScore: f.awayScore,
        fixtureId: f.id,
      };
    });
}

async function arsenalCandidates(season: number): Promise<Candidate[]> {
  const { start, end } = seasonWindow(season);
  const items = await fetchArsenalFixtures();
  const out: Candidate[] = [];
  for (const item of items) {
    if (item.kickoffAt < start || item.kickoffAt > end) continue;
    if (!isOfficialCompetition(item.competition)) continue;
    if (item.homeAway !== "HOME" && item.homeAway !== "AWAY") continue;
    const competition = normalizeCompetition(item.competition);
    out.push({
      source: "arsenal.com",
      kickoffAt: item.kickoffAt,
      opponentName: item.opponentName,
      opponentCrest: item.opponentCrest,
      homeAway: item.homeAway,
      competition: competition.name,
      competitionCode: competition.code,
      status: "SCHEDULED",
      homeScore: null,
      awayScore: null,
      fixtureId: null,
    });
  }
  return out;
}

async function wikipediaCandidates(season: number): Promise<Candidate[]> {
  const { start, end } = seasonWindow(season);
  const items = await fetchWikipediaFixtures({ season });
  const out: Candidate[] = [];
  for (const item of items) {
    if (item.kickoffAt < start || item.kickoffAt > end) continue;
    if (!isOfficialCompetition(item.competition)) continue;
    out.push({
      source: "wikipedia",
      kickoffAt: item.kickoffAt,
      opponentName: item.opponentName,
      opponentCrest: null,
      homeAway: item.homeAway,
      competition: item.competition,
      competitionCode: item.competitionCode,
      status: item.homeScore !== null && item.awayScore !== null ? "FINISHED" : "SCHEDULED",
      homeScore: item.homeScore,
      awayScore: item.awayScore,
      fixtureId: null,
    });
  }
  return out;
}

export type SourcePreview = { source: FixtureSourceLabel; count: number; official: number };

/** 只抓取三源并返回统计（不写库），用于诊断/预览 */
export async function previewFixtureSources(season = seasonStartYear()): Promise<SourcePreview[]> {
  const [fd, ars, wiki] = await Promise.all([
    footballDataCandidates(season),
    arsenalCandidates(season).catch(() => [] as Candidate[]),
    wikipediaCandidates(season).catch(() => [] as Candidate[]),
  ]);
  return [
    { source: "football-data.org", count: fd.length, official: fd.length },
    { source: "arsenal.com", count: ars.length, official: ars.filter((c) => isOfficialCompetition(c.competition)).length },
    { source: "wikipedia", count: wiki.length, official: wiki.length },
  ];
}

export type FixtureEntrySyncResult = {
  season: number;
  total: number;
  verified: number;
  unverified: number;
  bySource: Record<string, number>;
  preview: SourcePreview[];
};

export async function syncFixtureEntries(options: { season?: number } = {}): Promise<FixtureEntrySyncResult> {
  const season = options.season ?? seasonStartYear();

  const [fd, ars, wiki] = await Promise.all([
    footballDataCandidates(season),
    arsenalCandidates(season).catch((error) => {
      console.error("arsenal.com candidates failed", error);
      return [] as Candidate[];
    }),
    wikipediaCandidates(season).catch((error) => {
      console.error("wikipedia candidates failed", error);
      return [] as Candidate[];
    }),
  ]);

  const all = [...fd, ...ars, ...wiki];

  // 一次分组：对手归一化名 + 主客
  const byOpponent = new Map<string, Candidate[]>();
  for (const candidate of all) {
    const key = `${opponentKey(candidate.opponentName)}|${candidate.homeAway}`;
    const bucket = byOpponent.get(key);
    if (bucket) bucket.push(candidate);
    else byOpponent.set(key, [candidate]);
  }

  // 二次合并：同一「主客 + 同一天」= 同一场。解决本地化命名差异造成的重复
  // （如 Bayern München / Bayern Munich、Slavia Praha / Slavia Prague）。
  const byDay = new Map<string, Candidate[]>();
  for (const candidates of byOpponent.values()) {
    const key = `${candidates[0].homeAway}|${candidates[0].kickoffAt.toISOString().slice(0, 10)}`;
    const bucket = byDay.get(key);
    if (bucket) bucket.push(...candidates);
    else byDay.set(key, [...candidates]);
  }

  let verified = 0;
  const bySource: Record<string, number> = {};
  const rows: Prisma.FixtureEntryCreateManyInput[] = [];

  for (const candidates of byDay.values()) {
    const ranked = [...candidates].sort((a, b) => SOURCE_RANK[a.source] - SOURCE_RANK[b.source]);
    const canonical = ranked[0];
    const sources = Array.from(new Set(ranked.map((c) => c.source)));
    const isVerified = sources.length >= 2;
    if (isVerified) verified += 1;
    for (const source of sources) bySource[source] = (bySource[source] ?? 0) + 1;

    // 比分：取最高优先级且已填比分的来源
    const scored = ranked.find((c) => c.homeScore !== null && c.awayScore !== null) ?? null;
    const status = ranked.find((c) => c.source === "football-data.org")?.status ?? (scored ? "FINISHED" : "SCHEDULED");
    const crest = ranked.find((c) => c.opponentCrest)?.opponentCrest ?? null;
    const key = opponentKey(canonical.opponentName);

    rows.push({
      season,
      kickoffAt: canonical.kickoffAt,
      competition: canonical.competition,
      competitionCode: canonical.competitionCode,
      opponentName: canonical.opponentName,
      opponentKey: key,
      opponentCrest: crest,
      homeAway: canonical.homeAway,
      status,
      homeScore: scored?.homeScore ?? null,
      awayScore: scored?.awayScore ?? null,
      scoreSource: scored ? scored.source : null,
      scoreUpdatedAt: scored ? new Date() : null,
      sources,
      verified: isVerified,
      primarySource: canonical.source,
      footballDataFixtureId: ranked.find((c) => c.fixtureId)?.fixtureId ?? null,
      refreshAfter: new Date(canonical.kickoffAt.getTime() + 3 * 60 * 60 * 1000),
    });
  }

  // 幂等重建：先清空该赛季再批量写入，避免命名差异修正后残留旧行
  await prisma.fixtureEntry.deleteMany({ where: { season } });
  if (rows.length) {
    await prisma.fixtureEntry.createMany({ data: rows });
  }

  return {
    season,
    total: rows.length,
    verified,
    unverified: rows.length - verified,
    bySource,
    preview: [
      { source: "football-data.org", count: fd.length, official: fd.length },
      { source: "arsenal.com", count: ars.length, official: ars.length },
      { source: "wikipedia", count: wiki.length, official: wiki.length },
    ],
  };
}

/**
 * 「开赛 + 3 小时」刷新：找出已过 refreshAfter 且无比分的场次，
 * 重跑三源合并（football-data 读库 + 抓取源实时）回填比分/状态，并记录 lastRefreshedAt。
 */
export async function refreshFixtureResults(options: { season?: number; limit?: number } = {}) {
  const season = options.season ?? seasonStartYear();
  const now = new Date();
  const due = await prisma.fixtureEntry.findMany({
    where: {
      season,
      refreshAfter: { lte: now },
      OR: [{ homeScore: null }, { awayScore: null }],
    },
    orderBy: { kickoffAt: "asc" },
    take: options.limit ?? 50,
    select: { id: true },
  });

  const result = await syncFixtureEntries({ season });

  if (due.length) {
    await prisma.fixtureEntry.updateMany({
      where: { id: { in: due.map((entry) => entry.id) } },
      data: { lastRefreshedAt: new Date() },
    });
  }

  const filled = await prisma.fixtureEntry.count({
    where: { id: { in: due.map((entry) => entry.id) }, homeScore: { not: null }, awayScore: { not: null } },
  });

  return { season, due: due.length, filled, sync: result };
}
