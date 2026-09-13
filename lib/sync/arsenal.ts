import {
  ARSENAL_PROVIDER,
  fetchArsenalFixtures,
  fetchArsenalNews,
  fetchArsenalPlayers,
} from "@/lib/providers/arsenal";
import { prisma } from "@/lib/prisma";

async function finishRun(runId: string, values: { fetchedCount: number; upsertedCount: number; metadata?: object }) {
  await prisma.syncRun.update({
    where: { id: runId },
    data: {
      status: "SUCCEEDED",
      finishedAt: new Date(),
      fetchedCount: values.fetchedCount,
      upsertedCount: values.upsertedCount,
      metadata: values.metadata,
    },
  });
}

async function failRun(runId: string, error: unknown) {
  await prisma.syncRun.update({
    where: { id: runId },
    data: {
      status: "FAILED",
      finishedAt: new Date(),
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    },
  });
}

export async function syncArsenalNews() {
  const run = await prisma.syncRun.create({ data: { provider: ARSENAL_PROVIDER, scope: "official-news", status: "RUNNING" } });
  try {
    const items = await fetchArsenalNews();
    for (const item of items) {
      await prisma.officialNews.upsert({
        where: { provider_providerRecordId: { provider: ARSENAL_PROVIDER, providerRecordId: item.providerRecordId } },
        create: { provider: ARSENAL_PROVIDER, ...item },
        update: {
          title: item.title,
          publishedAt: item.publishedAt,
          category: item.category,
          sourceUrl: item.sourceUrl,
          imageUrl: item.imageUrl,
          summary: item.summary,
          fetchedAt: item.fetchedAt,
        },
      });
    }
    await finishRun(run.id, { fetchedCount: items.length, upsertedCount: items.length, metadata: { sourceUrl: "https://www.arsenal.com/news/all/1", fetchedAt: items[0]?.fetchedAt.toISOString() } });
    return { provider: ARSENAL_PROVIDER, scope: "official-news", count: items.length, fetchedAt: items[0]?.fetchedAt.toISOString() ?? new Date().toISOString() };
  } catch (error) {
    await failRun(run.id, error);
    throw error;
  }
}

export async function syncArsenalFixtures() {
  const run = await prisma.syncRun.create({ data: { provider: ARSENAL_PROVIDER, scope: "official-fixtures", status: "RUNNING" } });
  try {
    const items = await fetchArsenalFixtures();
    await prisma.officialFixture.updateMany({ where: { provider: ARSENAL_PROVIDER }, data: { isActive: false } });
    for (const item of items) {
      await prisma.officialFixture.upsert({
        where: { provider_providerRecordId: { provider: ARSENAL_PROVIDER, providerRecordId: item.providerRecordId } },
        create: { provider: ARSENAL_PROVIDER, ...item, isActive: true },
        update: {
          kickoffAt: item.kickoffAt,
          opponentName: item.opponentName,
          opponentCrest: item.opponentCrest,
          competition: item.competition,
          homeAway: item.homeAway,
          sourceUrl: item.sourceUrl,
          fetchedAt: item.fetchedAt,
          isActive: true,
        },
      });
    }
    await finishRun(run.id, { fetchedCount: items.length, upsertedCount: items.length, metadata: { sourceUrl: "https://www.arsenal.com/fixtures/men/fixtures", scorePolicy: "preserve-manual-or-report-score", fetchedAt: items[0]?.fetchedAt.toISOString() } });
    return { provider: ARSENAL_PROVIDER, scope: "official-fixtures", count: items.length, fetchedAt: items[0]?.fetchedAt.toISOString() ?? new Date().toISOString() };
  } catch (error) {
    await failRun(run.id, error);
    throw error;
  }
}

export async function syncArsenalPlayers() {
  const run = await prisma.syncRun.create({ data: { provider: ARSENAL_PROVIDER, scope: "official-players", status: "RUNNING" } });
  try {
    const items = await fetchArsenalPlayers();
    await prisma.playerProfile.updateMany({ where: { provider: ARSENAL_PROVIDER }, data: { isActive: false } });
    for (const item of items) {
      await prisma.playerProfile.upsert({
        where: { provider_providerRecordId: { provider: ARSENAL_PROVIDER, providerRecordId: item.providerRecordId } },
        create: { provider: ARSENAL_PROVIDER, ...item, isActive: true },
        update: {
          name: item.name,
          position: item.position,
          nationality: item.nationality,
          dateOfBirth: item.dateOfBirth,
          profileUrl: item.profileUrl,
          imageUrl: item.imageUrl,
          fetchedAt: item.fetchedAt,
          isActive: true,
        },
      });
    }
    await finishRun(run.id, { fetchedCount: items.length, upsertedCount: items.length, metadata: { sourceUrl: "https://www.arsenal.com/fixtures/men/players", fetchedAt: items[0]?.fetchedAt.toISOString() } });
    return { provider: ARSENAL_PROVIDER, scope: "official-players", count: items.length, fetchedAt: items[0]?.fetchedAt.toISOString() ?? new Date().toISOString() };
  } catch (error) {
    await failRun(run.id, error);
    throw error;
  }
}

export async function syncArsenalContent() {
  const [news, fixtures, players] = await Promise.all([
    syncArsenalNews(),
    syncArsenalFixtures(),
    syncArsenalPlayers(),
  ]);
  return { provider: ARSENAL_PROVIDER, news, fixtures, players };
}
