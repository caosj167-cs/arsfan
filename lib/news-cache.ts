import type { GuardianNewsResult, NewsCategory } from "@/lib/providers/guardian";

type NewsCacheEntry = {
  value: GuardianNewsResult;
  cachedAt: string;
};

const cache = new Map<string, NewsCacheEntry>();

export function newsCacheKey(options: {
  query?: string;
  category?: NewsCategory;
  page?: number;
  pageSize?: number;
}) {
  return JSON.stringify({
    query: options.query?.trim() || "Arsenal",
    category: options.category ?? "all",
    page: options.page ?? 1,
    pageSize: options.pageSize ?? 10,
  });
}

export function getCachedNews(key: string): NewsCacheEntry | undefined {
  return cache.get(key);
}

export function setCachedNews(key: string, value: GuardianNewsResult) {
  const entry = { value, cachedAt: new Date().toISOString() };
  cache.set(key, entry);
  return entry;
}
