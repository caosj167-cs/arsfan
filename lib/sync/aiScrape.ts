import { AI_SCRAPER_PROVIDER, fetchAiScrapedNews } from "@/lib/providers/ai-scraper";
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

export async function syncAiNews(options: { source: string; url: string }) {
  const provider = `${AI_SCRAPER_PROVIDER}:${options.source}`;
  const run = await prisma.syncRun.create({ data: { provider, scope: "ai-news", status: "RUNNING" } });
  try {
    const items = await fetchAiScrapedNews({ url: options.url, source: options.source });
    let upserted = 0;
    for (const item of items) {
      await prisma.officialNews.upsert({
        where: { provider_providerRecordId: { provider: item.provider, providerRecordId: item.providerRecordId } },
        create: {
          provider: item.provider,
          providerRecordId: item.providerRecordId,
          title: item.title,
          summary: item.summary,
          publishedAt: item.publishedAt,
          category: item.category,
          sourceUrl: item.sourceUrl,
          imageUrl: item.imageUrl,
          fetchedAt: item.fetchedAt,
        },
        update: {
          title: item.title,
          summary: item.summary,
          publishedAt: item.publishedAt,
          category: item.category,
          sourceUrl: item.sourceUrl,
          imageUrl: item.imageUrl,
          fetchedAt: item.fetchedAt,
        },
      });
      upserted += 1;
    }
    await finishRun(run.id, {
      fetchedCount: items.length,
      upsertedCount: upserted,
      metadata: { source: options.source, sourceUrl: options.url, fetchedAt: itemTimestamp(items) },
    });
    return {
      provider,
      scope: "ai-news",
      count: items.length,
      upserted,
      fetchedAt: itemTimestamp(items),
    };
  } catch (error) {
    await failRun(run.id, error);
    throw error;
  }
}

function itemTimestamp(items: { fetchedAt: Date }[]): string {
  return items[0]?.fetchedAt.toISOString() ?? new Date().toISOString();
}
