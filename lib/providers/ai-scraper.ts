import { load } from "cheerio";
import { z } from "zod";

export const AI_SCRAPER_PROVIDER = "ai-scraper";

const REQUEST_TIMEOUT_MS = 15_000;
// Keep the payload small: grok-4.6 is a reasoning model and large inputs push
// latency past upstream proxy timeouts. 5k chars is plenty for headline extraction.
const MAX_EXTRACT_CHARS = 5_000;
const USER_AGENT = "ArsenalFanDataHub/1.0 (+https://www.arsenal.com/)";
const AI_TIMEOUT_MS = 60_000;

/**
 * Shape of a single news item as returned by the LLM (publishedAt is still a
 * string at this stage; the sync layer converts it to a Date).
 */
export const aiNewsItemSchema = z.object({
  title: z.string().min(4),
  summary: z.string().min(8),
  publishedAt: z.string(),
  category: z.string().default("MEDIA"),
  sourceUrl: z.string(),
  imageUrl: z.string().url().optional().nullable(),
});

export type RawAiNewsItem = z.infer<typeof aiNewsItemSchema>;

const newsResponseSchema = z.object({ items: z.array(aiNewsItemSchema) });

/** Fully resolved item ready to be upserted into the OfficialNews table. */
export type StoredAiNewsItem = {
  provider: string;
  providerRecordId: string;
  title: string;
  summary: string;
  publishedAt: Date;
  category: string;
  sourceUrl: string;
  imageUrl: string | null;
  fetchedAt: Date;
};

function requireConfig() {
  const apiKey = process.env.AI_SCRAPER_API_KEY;
  if (!apiKey) throw new Error("AI_SCRAPER_API_KEY is not configured");
  return {
    baseUrl: (process.env.AI_SCRAPER_BASE_URL ?? "https://co-cdn.yes.vg/v1").replace(/\/+$/, ""),
    apiKey,
    model: process.env.AI_SCRAPER_MODEL ?? "grok-4.6",
    // Lower reasoning effort keeps extraction fast and cheap (and under proxy timeouts).
    reasoningEffort: (process.env.AI_SCRAPER_REASONING_EFFORT ?? "low") as string,
  };
}

function absoluteUrl(value: string | null | undefined, baseUrl: string): string | null {
  if (!value) return null;
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return null;
  }
}

function recordId(item: { title: string; sourceUrl: string; publishedAt: string }): string {
  // Key on the headline (+ date), not the source URL. Extracted page text
  // rarely carries distinct article links, so the LLM tends to echo the page
  // URL for every item — keying on that collapses all stories onto one row.
  // A stable hash of title+date keeps each story distinct across re-syncs.
  const key = `${item.title}::${item.publishedAt}`.toLowerCase().trim();
  let h = 5381;
  for (const ch of key) h = ((h << 5) + h + ch.charCodeAt(0)) >>> 0;
  return `t${h.toString(36)}`;
}

function saneDate(value: string, fallback: Date): Date {
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime()) && parsed.getTime() <= Date.now() + 86_400_000) {
    return parsed;
  }
  return fallback;
}

async function fetchPage(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "text/html,application/xhtml+xml", "User-Agent": USER_AGENT },
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`AI scrape source request failed with HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Strip navigation/boilerplate and pull the readable text so we send a small,
 * focused payload to the LLM instead of the full HTML document.
 */
function extractMainText(html: string): string {
  const $ = load(html);
  $(
    "script, style, noscript, svg, header, footer, nav, form, iframe, [class*='cookie'], [class*='advert'], [class*='subscriber'], [class*='newsletter']",
  ).remove();
  const root = $("main, article, [class*='content'], [class*='article'], [class*='listing'], body").first();
  return root.text().replace(/\s+/g, " ").trim().slice(0, MAX_EXTRACT_CHARS);
}

const SYSTEM_PROMPT = `You extract Arsenal FC men's first-team news items from a web page's extracted text.
Return ONLY valid JSON of shape {"items":[{"title":string,"summary":string,"publishedAt":string,"category":string,"sourceUrl":string,"imageUrl":string|null}]}.

Rules:
- Include ONLY items clearly about Arsenal FC men's first team.
- title: the article headline. If the source is non-English, write a concise Chinese headline; otherwise keep it.
- summary: a 1-3 sentence Chinese summary. Be factual and only use information present in the text; never invent facts or numbers.
- publishedAt: ISO 8601 date/time string if present in the text, else "".
- category: one of OFFICIAL, MATCHDAY, SQUAD, TRANSFER, OPINION, MEDIA (closest match; use MEDIA if unsure).
- sourceUrl: the absolute article URL.
- imageUrl: the absolute hero image URL if visible, else null.
- If no Arsenal news is present, return {"items":[]}.
- Do not include duplicate items.`;

async function extractNewsWithLlm(text: string, source: string, baseUrl: string): Promise<RawAiNewsItem[]> {
  const { baseUrl: endpointBase, apiKey, model, reasoningEffort } = requireConfig();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
  try {
    const response = await fetch(`${endpointBase}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        reasoning_effort: reasoningEffort,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `Source: ${source} (${baseUrl})\n\nExtract Arsenal-related news from the page text below and return strict JSON matching {"items":[...]}.\n\n${text}`,
          },
        ],
      }),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`AI scraper LLM request failed with HTTP ${response.status}`);
    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message?: string };
    };
    if (payload.error) throw new Error(`AI scraper LLM error: ${payload.error.message ?? "unknown error"}`);
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new Error("AI scraper LLM returned empty content");
    const parsed = newsResponseSchema.parse(JSON.parse(content));
    return parsed.items;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchAiScrapedNews(options: { url: string; source: string }): Promise<StoredAiNewsItem[]> {
  const html = await fetchPage(options.url);
  const text = extractMainText(html);
  if (!text) throw new Error(`AI scrape source ${options.url} returned no extractable text; the page may require client-side rendering`);
  const rawItems = await extractNewsWithLlm(text, options.source, options.url);
  const fetchedAt = new Date();
  const provider = `${AI_SCRAPER_PROVIDER}:${options.source}`;
  return rawItems.map((item) => {
    const sourceUrl = absoluteUrl(item.sourceUrl, options.url) ?? options.url;
    return {
      provider,
      providerRecordId: recordId(item),
      title: item.title.trim(),
      summary: item.summary.trim(),
      publishedAt: saneDate(item.publishedAt, fetchedAt),
      category: item.category.trim() || "MEDIA",
      sourceUrl,
      imageUrl: absoluteUrl(item.imageUrl, options.url),
      fetchedAt,
    };
  });
}
