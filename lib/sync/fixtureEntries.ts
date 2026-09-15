import type { Prisma } from "@/app/generated/prisma/client";
import { isOfficialCompetition, normalizeCompetition } from "@/lib/data/competitions";
import { seasonStartYear } from "@/lib/data/season";
import { fetchArsenalFixtures } from "@/lib/providers/arsenal";
import { fetchWikipediaFixtures } from "@/lib/providers/wikipedia";
import { crestIndexByOpponentKey, resolveOpponentCrest } from "@/lib/data/crests";
import { prisma } from "@/lib/prisma";
import type { FixtureSourceLabel } from "@/lib/sync/fixture-status";
import { deriveFixtureEntryStatus, planFixtureEntryDeletion } from "@/lib/sync/fixture-status";
import { opponentKey } from "@/lib/sync/opponent-key";
export { opponentKey } from "@/lib/sync/opponent-key";

/**
 * 合并 26/27 赛季赛程：
 *   主源 = football-data.org（读本库 Fixture，权威：时间/状态/比分）
 *   补充 = arsenal.com（官方抓取，补主源没有的欧冠/联赛杯/足总杯）
 *        = Wikipedia（赛季页 wikitext，独立第二站，交叉验证 + 补充比分）
 * 规则：同「对手 + 主客」归为一场；来源数 ≥2 → verified。
 * 结果写入 FixtureEntry，refreshAfter = kickoffAt + 3h。
 */

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

/** 比赛「当天」键（UTC 日期）：判断某来源的比分是否属于同一场比赛 */
function dayKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/** 比赛日（UTC 零点 Date），写入 FixtureEntry.matchDate */
function utcDay(value: Date): Date {
  return new Date(`${dayKey(value)}T00:00:00.000Z`);
}

async function footballDataCandidates(season: number): Promise<Candidate[]> {
  const { start, end } = seasonWindow(season);
  const rows = await prisma.fixture.findMany({
    where: { utcDate: { gte: start, lte: end } },
    include: { homeTeam: true, awayTeam: true, competition: true },
  });
  return rows
    .filter((f) => f.homeTeam.providerTeamId === ARSENAL_PROVIDER_TEAM_ID || f.awayTeam.providerTeamId === ARSENAL_PROVIDER_TEAM_ID)
    .map((f) => {
      const arsenalHome = f.homeTeam.providerTeamId === ARSENAL_PROVIDER_TEAM_ID;
      const opponent = arsenalHome ? f.awayTeam : f.homeTeam;
      // 赛事名从 Fixture 的 competition 关系推导——**不要硬编码 Premier League**：
      // 否则日后 football-data 侧同步了别的赛事（改 FOOTBALL_DATA_COMPETITION 等），
      // 这些行会被一律标成英超。当前 Fixture 全是 PL，行为与硬编码完全一致。
      const competition = normalizeCompetition(f.competition.name);
      return {
        source: "football-data.org" as const,
        kickoffAt: f.utcDate,
        opponentName: opponent.name,
        opponentCrest: opponent.crest,
        homeAway: arsenalHome ? ("HOME" as const) : ("AWAY" as const),
        competition: competition.name,
        competitionCode: competition.code,
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

  // 记录哪些抓取源本趟失败：失败源独有的行不能被「差集删除」清掉（见下方 delete 守卫）。
  let arsenalFailed = false;
  let wikipediaFailed = false;
  const [fd, ars, wiki, teams] = await Promise.all([
    footballDataCandidates(season),
    arsenalCandidates(season).catch((error) => {
      arsenalFailed = true;
      console.error("arsenal.com candidates failed", error);
      return [] as Candidate[];
    }),
    wikipediaCandidates(season).catch((error) => {
      wikipediaFailed = true;
      console.error("wikipedia candidates failed", error);
      return [] as Candidate[];
    }),
    // 球队表（20 支英超队，football-data 提供）——按队名给「无来源队徽」的场次兜底
    prisma.team.findMany({ select: { name: true, crest: true } }),
  ]);
  const teamCrests = crestIndexByOpponentKey(teams);

  const all = [...fd, ...ars, ...wiki];

  // 一次分组：「主客 + 同一天」= 同一场。
  //   - 按天分组可把本地化命名差异造成的重复合并掉
  //     （如 Bayern München / Bayern Munich、Slavia Praha / Slavia Prague 同一天同一主客）
  //   - 必须逐条候选用自己的日期当键：早期实现是先按「对手+主客」分桶、再用桶里第一条的日期
  //     当整个桶的键，结果把「同一对手、同一主客、不同日期」的两个回合并成了一场
  //     （8/16 与 11/28 都是主场对曼城 → 11/28 那行拿到了 8/16 的 3-0）。
  const byMatch = new Map<string, Candidate[]>();
  for (const candidate of all) {
    const key = `${candidate.homeAway}|${dayKey(candidate.kickoffAt)}`;
    const bucket = byMatch.get(key);
    if (bucket) bucket.push(candidate);
    else byMatch.set(key, [candidate]);
  }

  let verified = 0;
  const bySource: Record<string, number> = {};
  const rows: Prisma.FixtureEntryCreateManyInput[] = [];
  /** 与 rows 一一对应的比赛唯一键（season 内唯一），用于保持 id 稳定的 upsert */
  const rowKeys: string[] = [];

  for (const candidates of byMatch.values()) {
    const ranked = [...candidates].sort((a, b) => SOURCE_RANK[a.source] - SOURCE_RANK[b.source]);
    const canonical = ranked[0];
    const sources = Array.from(new Set(ranked.map((c) => c.source)));
    const isVerified = sources.length >= 2;
    if (isVerified) verified += 1;
    for (const source of sources) bySource[source] = (bySource[source] ?? 0) + 1;

    // 比分：只认「同一天 + 已开球」的来源。
    // 分组已按天切分，这里再校验一次日期是防御性的（候选源可能报出跨天的开球时间）。
    const started = canonical.kickoffAt.getTime() <= Date.now();
    const canonicalDay = dayKey(canonical.kickoffAt);
    const scored = started
      ? ranked.find(
          (c) => c.homeScore !== null && c.awayScore !== null && dayKey(c.kickoffAt) === canonicalDay
        ) ?? null
      : null;

    const fdStatus = ranked.find((c) => c.source === "football-data.org")?.status;
    const status = deriveFixtureEntryStatus({
      fdStatus,
      sourceStatuses: ranked.map((c) => c.status),
      started,
      hasSameDayScore: scored !== null,
    });

    const key = opponentKey(canonical.opponentName);
    // 队徽兜底：来源给的 → 球队表按名回查 → 静态固化表（欧冠/杯赛 8 队）→ null
    const crest = resolveOpponentCrest({
      fromSources: ranked.find((c) => c.opponentCrest)?.opponentCrest,
      opponentKey: key,
      teamCrests,
    });

    rows.push({
      season,
      kickoffAt: canonical.kickoffAt,
      matchDate: utcDay(canonical.kickoffAt),
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
    rowKeys.push(`${key}|${canonical.homeAway}|${canonicalDay}`);
  }

  // 幂等写入：按唯一键 (season, opponentKey, homeAway, matchDate) 逐行 upsert，**保持 id 稳定**。
  // 说明：早期用 deleteMany + createMany 整体重建，会让每次合并都生成全新 cuid，
  // 导致 MatchReport.fixtureEntryId 变成悬挂引用、已分享的 /matches/<id> 链接失效
  // （表现为「比赛中心点进去是空的」）。改为 upsert 后 id 不再变化。
  // matchDate 为空的旧行回退用 kickoffAt 的日期计算键，迁移后第一轮同步即可对上、不会换 id。
  const existing = await prisma.fixtureEntry.findMany({
    where: { season },
    select: { id: true, opponentKey: true, homeAway: true, matchDate: true, kickoffAt: true },
  });
  const idByKey = new Map(
    existing.map((e) => [
      `${e.opponentKey}|${e.homeAway}|${dayKey(e.matchDate ?? e.kickoffAt)}`,
      e.id,
    ]),
  );

  const ops = rows.map((row, index) => {
    const id = idByKey.get(rowKeys[index]);
    return id
      ? prisma.fixtureEntry.update({ where: { id }, data: row, select: { id: true } })
      : prisma.fixtureEntry.create({ data: row, select: { id: true } });
  });

  const saved = ops.length ? await prisma.$transaction(ops) : [];
  const keepIds = saved.map((s) => s.id);

  // 破坏性删除守卫：本趟同步只会「差集删除」那些——
  //   ① 这次没被重新生成（不在 keepIds），且
  //   ② 其主来源（primarySource）本趟成功抓取到了的比赛。
  // 凡是 primarySource 属于「本趟失败源」的行一律保留：否则一旦 wikipedia/arsenal.com
  // 抓取失败，它们独有的 8 场欧战/杯赛就会被整体删掉（数据丢失，已发生过的 bug）。
  const failedSources: FixtureSourceLabel[] = [];
  if (arsenalFailed) failedSources.push("arsenal.com");
  if (wikipediaFailed) failedSources.push("wikipedia");

  // 破坏性删除守卫（P1-③）：用纯函数算出本趟应当删除的 id，
  // 失败源独有的行不会被删（详见 lib/sync/fixture-status.ts）。
  const existingRows = await prisma.fixtureEntry.findMany({
    where: { season },
    select: { id: true, primarySource: true },
  });
  const deleteIds = planFixtureEntryDeletion({
    keepIds,
    failedSources,
    existingRows: existingRows.map((r) => ({ id: r.id, primarySource: r.primarySource as FixtureSourceLabel })),
  });
  if (deleteIds.length) {
    await prisma.fixtureEntry.deleteMany({ where: { id: { in: deleteIds } } });
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
