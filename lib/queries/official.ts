import { prisma } from "@/lib/prisma";

export const OFFICIAL_SOURCE = "arsenal.com";

export async function getOfficialNews(options: { page?: number; pageSize?: number; category?: string } = {}) {
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, options.pageSize ?? 20));
  const where = { provider: OFFICIAL_SOURCE, ...(options.category ? { category: options.category } : {}) };
  const [rows, total, latest] = await Promise.all([
    prisma.officialNews.findMany({ where, orderBy: { publishedAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.officialNews.count({ where }),
    prisma.officialNews.findFirst({ where, orderBy: { fetchedAt: "desc" }, select: { fetchedAt: true } }),
  ]);
  return {
    articles: rows.map((row) => ({
      id: row.id,
      providerRecordId: row.providerRecordId,
      title: row.title,
      publishedAt: row.publishedAt.toISOString(),
      category: row.category,
      source: row.provider,
      sourceUrl: row.sourceUrl,
      imageUrl: row.imageUrl,
      summary: row.summary,
      fetchedAt: row.fetchedAt.toISOString(),
    })),
    page,
    pageSize,
    total,
    pages: Math.ceil(total / pageSize),
    lastFetchedAt: latest?.fetchedAt.toISOString() ?? null,
  };
}

export async function getOfficialFixtures(options: { page?: number; pageSize?: number } = {}) {
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 50));
  const where = { provider: OFFICIAL_SOURCE, isActive: true };
  const [rows, total, latest] = await Promise.all([
    prisma.officialFixture.findMany({ where, orderBy: { kickoffAt: "asc" }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.officialFixture.count({ where }),
    prisma.officialFixture.findFirst({ where, orderBy: { fetchedAt: "desc" }, select: { fetchedAt: true } }),
  ]);
  return {
    fixtures: rows.map((row) => ({
      id: row.id,
      providerRecordId: row.providerRecordId,
      kickoffAt: row.kickoffAt.toISOString(),
      opponentName: row.opponentName,
      opponentCrest: row.opponentCrest,
      competition: row.competition,
      homeAway: row.homeAway,
      sourceUrl: row.sourceUrl,
      score: row.homeScore === null || row.awayScore === null ? null : { home: row.homeScore, away: row.awayScore },
      scoreSource: row.scoreSource,
      scoreUpdatedAt: row.scoreUpdatedAt?.toISOString() ?? null,
      fetchedAt: row.fetchedAt.toISOString(),
    })),
    page,
    pageSize,
    total,
    pages: Math.ceil(total / pageSize),
    lastFetchedAt: latest?.fetchedAt.toISOString() ?? null,
  };
}

export async function getAiNews(options: { page?: number; pageSize?: number; source?: string } = {}) {
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, options.pageSize ?? 20));
  const provider = options.source ? `ai-scraper:${options.source}` : { startsWith: "ai-scraper" };
  const where = { provider };
  const [rows, total, latest] = await Promise.all([
    prisma.officialNews.findMany({ where, orderBy: { publishedAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.officialNews.count({ where }),
    prisma.officialNews.findFirst({ where, orderBy: { fetchedAt: "desc" }, select: { fetchedAt: true } }),
  ]);
  return {
    articles: rows.map((row) => ({
      id: row.id,
      provider: row.provider,
      providerRecordId: row.providerRecordId,
      title: row.title,
      publishedAt: row.publishedAt.toISOString(),
      category: row.category,
      source: row.provider,
      sourceUrl: row.sourceUrl,
      imageUrl: row.imageUrl,
      summary: row.summary,
      fetchedAt: row.fetchedAt.toISOString(),
    })),
    page,
    pageSize,
    total,
    pages: Math.ceil(total / pageSize),
    lastFetchedAt: latest?.fetchedAt.toISOString() ?? null,
  };
}

export async function getOfficialPlayers() {
  const [rows, latest] = await Promise.all([
    prisma.playerProfile.findMany({ where: { provider: OFFICIAL_SOURCE, isActive: true }, orderBy: { name: "asc" } }),
    prisma.playerProfile.findFirst({ where: { provider: OFFICIAL_SOURCE, isActive: true }, orderBy: { fetchedAt: "desc" }, select: { fetchedAt: true } }),
  ]);
  return {
    players: rows.map((row) => ({
      id: row.id,
      providerRecordId: row.providerRecordId,
      name: row.name,
      position: row.position,
      nationality: row.nationality,
      dateOfBirth: row.dateOfBirth?.toISOString() ?? null,
      profileUrl: row.profileUrl,
      imageUrl: row.imageUrl,
      fetchedAt: row.fetchedAt.toISOString(),
    })),
    lastFetchedAt: latest?.fetchedAt.toISOString() ?? null,
  };
}
