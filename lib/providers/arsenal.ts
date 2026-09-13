import { load, type Cheerio, type CheerioAPI } from "cheerio";
import type { AnyNode } from "domhandler";

export const ARSENAL_PROVIDER = "arsenal.com";
export const ARSENAL_NEWS_URL = "https://www.arsenal.com/news/all/1";
export const ARSENAL_FIXTURES_URL = "https://www.arsenal.com/fixtures/men/fixtures";
export const ARSENAL_PLAYERS_URL = "https://www.arsenal.com/fixtures/men/players";

export class ArsenalContentEmptyError extends Error {
  constructor(scope: "news" | "fixtures" | "players") {
    super(`Arsenal ${scope} page returned no parseable records; the page may require client-side rendering or its structure may have changed`);
    this.name = "ArsenalContentEmptyError";
  }
}

const REQUEST_TIMEOUT_MS = 15_000;
const USER_AGENT = "ArsenalFanDataHub/1.0 (+https://www.arsenal.com/)";
const ARSENAL_GRAPHQL_ENDPOINT = "https://afc-prd.graph.arsenal.com/graphql";

export type ArsenalNewsItem = {
  providerRecordId: string;
  title: string;
  publishedAt: Date;
  category: string;
  sourceUrl: string;
  imageUrl: string | null;
  summary: string | null;
  fetchedAt: Date;
};

export type ArsenalFixtureItem = {
  providerRecordId: string;
  kickoffAt: Date;
  opponentName: string;
  opponentCrest: string | null;
  competition: string;
  homeAway: "HOME" | "AWAY" | "UNKNOWN";
  sourceUrl: string;
  fetchedAt: Date;
};

export type ArsenalPlayerItem = {
  providerRecordId: string;
  name: string;
  position: string | null;
  nationality: string | null;
  dateOfBirth: Date | null;
  profileUrl: string;
  imageUrl: string | null;
  fetchedAt: Date;
};

function absoluteUrl(value: string | undefined, baseUrl: string) {
  if (!value) return null;
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return null;
  }
}

function clean(value: string | undefined | null) {
  return value?.replace(/\s+/g, " ").trim() || "";
}

function validDate(value: string | undefined | null) {
  if (!value) return null;
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return parsed;
  const match = value.match(/(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})/);
  if (!match) return null;
  const [, day, month, year] = match;
  const fallback = new Date(`${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T12:00:00.000Z`);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function firstText($: CheerioAPI, root: Cheerio<AnyNode>, selectors: string[]) {
  for (const selector of selectors) {
    const value = clean(root.find(selector).first().text());
    if (value) return value;
  }
  return "";
}

function firstAttribute($: CheerioAPI, root: Cheerio<AnyNode>, selectors: string[], attribute: string) {
  for (const selector of selectors) {
    const value = root.find(selector).first().attr(attribute);
    if (value) return value;
  }
  return undefined;
}

function dateFromRoot($: CheerioAPI, root: Cheerio<AnyNode>) {
  const datetime = root.find("time[datetime]").first().attr("datetime") ?? root.find("[data-date]").first().attr("data-date");
  return validDate(datetime) ?? validDate(clean(root.find("time").first().text()));
}

function recordId(sourceUrl: string) {
  const url = new URL(sourceUrl);
  return url.pathname.replace(/\/+$/, "").split("/").filter(Boolean).pop() ?? sourceUrl;
}

async function fetchPage(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "text/html,application/xhtml+xml", "User-Agent": USER_AGENT },
      next: { revalidate: 900 },
    });
    if (!response.ok) throw new Error(`Arsenal page request failed with HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchArsenalGraphQL<T>(query: string, variables: Record<string, unknown>) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(ARSENAL_GRAPHQL_ENDPOINT, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": USER_AGENT,
        ...(process.env.ARSENAL_GRAPHQL_TOKEN ? { "x-hasura-ddn-token": process.env.ARSENAL_GRAPHQL_TOKEN } : {}),
      },
      body: JSON.stringify({ query, variables }),
      next: { revalidate: 900 },
    });
    if (!response.ok) throw new Error(`Arsenal GraphQL request failed with HTTP ${response.status}`);
    const payload = await response.json() as { data?: T; errors?: Array<{ message?: string }> };
    if (payload.errors?.length) throw new Error(`Arsenal GraphQL query failed: ${payload.errors[0]?.message ?? "unknown error"}`);
    return payload.data;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchGraphQLNews(fetchedAt: Date): Promise<ArsenalNewsItem[]> {
  const data = await fetchArsenalGraphQL<{
    getArticlesByTaxonomy?: {
      articles?: Array<{
        articleId?: number;
        title?: string;
        path?: string;
        publicationDate?: string;
        primaryTaxonomyName?: string;
        promoImage?: string;
        promoImageRenditions?: Array<{ src?: string }>;
      }>;
    };
  }>(
    `query OfficialArsenalNews($pageNumber: Float!, $pageSize: Float!, $platform: String!) {
      getArticlesByTaxonomy(taxonomy: "", pageNumber: $pageNumber, pageSize: $pageSize, platform: $platform) {
        articles { articleId title path publicationDate primaryTaxonomyName promoImage promoImageRenditions { src } }
      }
    }`,
    { pageNumber: 1, pageSize: 50, platform: "web" },
  );
  const rows = data?.getArticlesByTaxonomy?.articles ?? [];
  return rows.flatMap((article) => {
    const sourceUrl = absoluteUrl(article.path, ARSENAL_NEWS_URL);
    const publishedAt = validDate(article.publicationDate);
    if (!article.articleId || !article.title || !sourceUrl || !publishedAt) return [];
    return [{
      providerRecordId: String(article.articleId),
      title: clean(article.title),
      publishedAt,
      category: clean(article.primaryTaxonomyName) || "阿森纳官方",
      sourceUrl,
      imageUrl: absoluteUrl(article.promoImageRenditions?.[0]?.src ?? article.promoImage, ARSENAL_NEWS_URL),
      summary: null,
      fetchedAt,
    }];
  });
}

async function fetchGraphQLPlayers(fetchedAt: Date): Promise<ArsenalPlayerItem[]> {
  const data = await fetchArsenalGraphQL<{
    getPlayers?: Array<{
      players?: Array<{
        playerId?: string;
        firstName?: string;
        lastName?: string;
        position?: string;
        nationality?: { countryName?: string };
        profileImage?: string;
        path?: string;
        promoImageRenditions?: Array<{ src?: string }>;
      }>;
    }>;
  }>(
    `query OfficialArsenalPlayers($pageNumber: Float!, $pageSize: Float!, $team: Team!) {
      getPlayers(pageNumber: $pageNumber, pageSize: $pageSize, team: $team) {
        players {
          playerId
          firstName
          lastName
          position
          nationality { countryName }
          profileImage
          path
          promoImageRenditions { src }
        }
      }
    }`,
    // The Arsenal endpoint uses zero-based paging even though the variable is
    // named pageNumber; page 1 currently returns an empty final page.
    { pageNumber: 0, pageSize: 100, team: "Mens" },
  );
  const rows = data?.getPlayers?.flatMap((group) => group.players ?? []) ?? [];
  return rows.flatMap((player) => {
    if (!player.playerId) return [];
    const name = clean(`${player.firstName ?? ""} ${player.lastName ?? ""}`);
    if (!name) return [];
    const profileUrl = absoluteUrl(player.path, ARSENAL_PLAYERS_URL)
      ?? `https://www.arsenal.com/fixtures/men/players/${player.playerId}`;
    return [{
      providerRecordId: player.playerId,
      name,
      position: clean(player.position) || null,
      nationality: clean(player.nationality?.countryName) || null,
      dateOfBirth: null,
      profileUrl,
      imageUrl: absoluteUrl(player.profileImage ?? player.promoImageRenditions?.[0]?.src, ARSENAL_PLAYERS_URL),
      fetchedAt,
    }];
  });
}

type ArsenalGraphQLFixture = {
  matchInfo?: {
    id?: string;
    date?: string;
    time?: string;
    localDate?: string | null;
    localTime?: string | null;
    competition?: { name?: string } | null;
    contestant?: Array<{
      id?: string;
      name?: string;
      code?: string;
      clubLogo?: string | null;
    }>;
  };
};

function monthStartDates(now: Date) {
  const seasonStartYear = now.getUTCMonth() < 4 ? now.getUTCFullYear() - 1 : now.getUTCFullYear();
  return Array.from({ length: 12 }, (_, index) => {
    const month = 4 + index;
    const year = seasonStartYear + Math.floor(month / 12);
    return `${year}-${String((month % 12) + 1).padStart(2, "0")}-01`;
  });
}

function fixtureKickoff(matchInfo: NonNullable<ArsenalGraphQLFixture["matchInfo"]>) {
  const date = matchInfo.date?.replace(/Z$/, "");
  const time = matchInfo.time?.replace(/Z$/, "");
  const localDate = matchInfo.localDate;
  const localTime = matchInfo.localTime;
  const value = date && time ? `${date}T${time}Z` : localDate && localTime ? `${localDate}T${localTime}` : date;
  return validDate(value);
}

/**
 * arsenal.com's GraphQL feed with `teamIds: "all"` returns every Arsenal side —
 * men's first team, women's team, U21/U18 academy sides. The site is a men's
 * first-team hub, so drop anything that isn't the senior men's team.
 * (The women's team is also literally named "Arsenal", so a name check alone
 * cannot separate them — the competition name is the reliable signal.)
 */
const NON_SENIOR_MENS_COMPETITION = [
  /women/i,
  /wsl/i,
  /\bu\s?\d{2}\b/i,
  /under-?\d{2}/i,
  /youth/i,
  /academy/i,
  /premier league 2/i,
  /\bpl2\b/i,
];

function isSeniorMensCompetition(name: string) {
  return !NON_SENIOR_MENS_COMPETITION.some((pattern) => pattern.test(name));
}

async function fetchGraphQLFixtures(fetchedAt: Date): Promise<ArsenalFixtureItem[]> {
  const query = `query OfficialArsenalFixtures(
      $date: String!
      $competitions: String!
      $rangeType: String!
      $teamIds: String!
      $timeOffset: Float
    ) {
      fixturesByIds(
        date: $date
        competitions: $competitions
        rangeType: $rangeType
        teamIds: $teamIds
        timeOffset: $timeOffset
      ) {
        matches {
          matchInfo {
            id
            date
            time
            localDate
            localTime
            competition { name }
            contestant { id name code clubLogo }
          }
        }
      }
    }`;

  const monthlyResults = await Promise.all(monthStartDates(fetchedAt).map((date) =>
    fetchArsenalGraphQL<{
      fixturesByIds?: { matches?: ArsenalGraphQLFixture[] };
    }>(query, {
      date,
      competitions: "all",
      rangeType: "month",
      teamIds: "all",
      timeOffset: new Date().getTimezoneOffset(),
    }),
  ));

  const seen = new Set<string>();
  return monthlyResults.flatMap((result) => result?.fixturesByIds?.matches ?? []).flatMap((match) => {
    const matchInfo = match.matchInfo;
    const contestants = matchInfo?.contestant ?? [];
    const contestantName = (value: string | undefined) => clean(value).toLowerCase();
    const arsenalIndex = contestants.findIndex((contestant) =>
      ["arsenal", "arsenal fc"].includes(contestantName(contestant.name))
    );
    const competition = clean(matchInfo?.competition?.name);
    if (!matchInfo?.id || arsenalIndex < 0 || contestants.length !== 2 || seen.has(matchInfo.id)) return [];
    if (!isSeniorMensCompetition(competition)) return [];
    const opponent = contestants[arsenalIndex === 0 ? 1 : 0];
    const kickoffAt = fixtureKickoff(matchInfo);
    if (!opponent?.name || !kickoffAt) return [];
    seen.add(matchInfo.id);
    return [{
      providerRecordId: matchInfo.id,
      kickoffAt,
      opponentName: clean(opponent.name),
      opponentCrest: absoluteUrl(opponent.clubLogo ?? undefined, ARSENAL_FIXTURES_URL),
      competition: competition || "未分类赛事",
      homeAway: arsenalIndex === 0 ? "HOME" : "AWAY",
      sourceUrl: `https://www.arsenal.com/fixtures/men/fixtures/match/${matchInfo.id}`,
      fetchedAt,
    } satisfies ArsenalFixtureItem];
  }).sort((left, right) => left.kickoffAt.getTime() - right.kickoffAt.getTime());
}

function pageImage($: CheerioAPI, root: Cheerio<AnyNode>, baseUrl: string) {
  const source = firstAttribute($, root, ["img[data-src]", "img[data-lazy-src]", "img[src]"], "data-src")
    ?? firstAttribute($, root, ["img[data-lazy-src]"], "data-lazy-src")
    ?? firstAttribute($, root, ["img[src]"], "src");
  return absoluteUrl(source, baseUrl);
}

export async function fetchArsenalNews(): Promise<ArsenalNewsItem[]> {
  const fetchedAt = new Date();
  const html = await fetchPage(ARSENAL_NEWS_URL);
  const $ = load(html);
  const seen = new Set<string>();
  const items: ArsenalNewsItem[] = [];
  $("a[href]").each((_, anchor) => {
    const sourceUrl = absoluteUrl($(anchor).attr("href"), ARSENAL_NEWS_URL);
    if (!sourceUrl || !new URL(sourceUrl).pathname.includes("/news/") || seen.has(sourceUrl)) return;
    const link = $(anchor);
    const root = link.closest("article, li, [class*='card'], [class*='listing']").first();
    const scope = root.length ? root : link;
    const title = firstText($, scope, ["h1", "h2", "h3", "h4", "[class*='title']"]) || clean(link.text());
    const publishedAt = dateFromRoot($, scope);
    if (!title || !publishedAt || title.length < 4) return;
    const category = firstText($, scope, ["[data-category]", "[class*='category']", "[class*='tag']"]) || "阿森纳官方";
    const summary = firstText($, scope, ["[class*='summary']", "[class*='description']", "p"]);
    seen.add(sourceUrl);
    items.push({
      providerRecordId: recordId(sourceUrl),
      title,
      publishedAt,
      category,
      sourceUrl,
      imageUrl: pageImage($, scope, ARSENAL_NEWS_URL),
      summary: summary || null,
      fetchedAt,
    });
  });
  if (!items.length) {
    try {
      const graphqlItems = await fetchGraphQLNews(fetchedAt);
      if (graphqlItems.length) return graphqlItems;
    } catch {
      // Keep the public-page failure explicit instead of hiding it behind an empty success.
    }
    throw new ArsenalContentEmptyError("news");
  }
  return items;
}

function fixtureOpponent($: CheerioAPI, root: Cheerio<AnyNode>) {
  const explicit = firstText($, root, ["[data-opponent]", "[class*='opponent']", "[class*='team-name']"]);
  if (explicit) return explicit.replace(/\bArsenal\b/gi, "").replace(/\s+/g, " ").trim();
  const headings = root.find("h1,h2,h3,h4,strong").map((_, element) => clean($(element).text())).get().filter((value) => value && !/arsenal/i.test(value));
  return headings[0] ?? "未知对手";
}

function homeAway($: CheerioAPI, root: Cheerio<AnyNode>): ArsenalFixtureItem["homeAway"] {
  const value = `${root.attr("class") ?? ""} ${root.text()}`.toLowerCase();
  if (/\b(home|主场|主)\b/.test(value)) return "HOME";
  if (/\b(away|客场|客)\b/.test(value)) return "AWAY";
  return "UNKNOWN";
}

export async function fetchArsenalFixtures(): Promise<ArsenalFixtureItem[]> {
  const fetchedAt = new Date();
  const html = await fetchPage(ARSENAL_FIXTURES_URL);
  const $ = load(html);
  const seen = new Set<string>();
  const items: ArsenalFixtureItem[] = [];
  $("a[href]").each((_, anchor) => {
    const sourceUrl = absoluteUrl($(anchor).attr("href"), ARSENAL_FIXTURES_URL);
    if (!sourceUrl || !new URL(sourceUrl).pathname.includes("/fixtures") || new URL(sourceUrl).pathname === "/fixtures" || seen.has(sourceUrl)) return;
    const link = $(anchor);
    const root = link.closest("article, li, [class*='fixture'], [class*='match'], [class*='card']").first();
    const scope = root.length ? root : link;
    const kickoffAt = dateFromRoot($, scope);
    if (!kickoffAt) return;
    const opponentName = fixtureOpponent($, scope);
    if (!opponentName || opponentName === "未知对手") return;
    const competition = firstText($, scope, ["[data-competition]", "[class*='competition']", "[class*='tournament']"]) || "未分类赛事";
    seen.add(sourceUrl);
    items.push({
      providerRecordId: recordId(sourceUrl),
      kickoffAt,
      opponentName,
      opponentCrest: pageImage($, scope, ARSENAL_FIXTURES_URL),
      competition,
      homeAway: homeAway($, scope),
      sourceUrl,
      fetchedAt,
    });
  });
  if (!items.length) {
    try {
      const graphqlItems = await fetchGraphQLFixtures(fetchedAt);
      if (graphqlItems.length) return graphqlItems;
    } catch {
      // Keep the public-page failure explicit instead of hiding it behind an empty success.
    }
    throw new ArsenalContentEmptyError("fixtures");
  }
  return items;
}

function playerDateOfBirth($: CheerioAPI, root: Cheerio<AnyNode>) {
  const value = firstAttribute($, root, ["time[datetime]", "[data-date-of-birth]"], "datetime")
    ?? root.find("[data-date-of-birth]").first().attr("data-date-of-birth")
    ?? firstText($, root, ["[class*='date-of-birth']", "[class*='dob']"]);
  return validDate(value);
}

export async function fetchArsenalPlayers(): Promise<ArsenalPlayerItem[]> {
  const fetchedAt = new Date();
  const html = await fetchPage(ARSENAL_PLAYERS_URL);
  const $ = load(html);
  const seen = new Set<string>();
  const items: ArsenalPlayerItem[] = [];
  $("a[href]").each((_, anchor) => {
    const profileUrl = absoluteUrl($(anchor).attr("href"), ARSENAL_PLAYERS_URL);
    if (!profileUrl || !/\/men\/players\//.test(new URL(profileUrl).pathname) || seen.has(profileUrl)) return;
    const link = $(anchor);
    const root = link.closest("article, li, [class*='player'], [class*='card']").first();
    const scope = root.length ? root : link;
    const name = firstText($, scope, ["h1", "h2", "h3", "h4", "[class*='name']"]) || clean(link.text());
    if (!name || name.length < 2) return;
    const position = firstText($, scope, ["[class*='position']", "[data-position]"]) || null;
    const nationality = firstText($, scope, ["[class*='nationality']", "[data-nationality]"]) || null;
    seen.add(profileUrl);
    items.push({
      providerRecordId: recordId(profileUrl),
      name,
      position,
      nationality,
      dateOfBirth: playerDateOfBirth($, scope),
      profileUrl,
      imageUrl: pageImage($, scope, ARSENAL_PLAYERS_URL),
      fetchedAt,
    });
  });
  if (!items.length) {
    try {
      const graphqlItems = await fetchGraphQLPlayers(fetchedAt);
      if (graphqlItems.length) return graphqlItems;
    } catch {
      // Keep the public-page failure explicit instead of hiding it behind an empty success.
    }
    throw new ArsenalContentEmptyError("players");
  }
  return items;
}
