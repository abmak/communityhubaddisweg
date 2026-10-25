import { createHash } from "node:crypto";
import { EventSourceAdapter, EventTopic } from "@prisma/client";
import { generateJson, GeminiError } from "../ai/gemini";
import { logger } from "../logger";

/**
 * One listing pulled from an online source, before it becomes an Event row.
 * Everything here has to be trustworthy enough to publish without review, so an
 * adapter returns nothing rather than guessing at an unparseable item.
 */
export interface NormalizedEvent {
  externalId: string;
  title: string;
  description: string;
  startDate: Date;
  endDate: Date | null;
  location: string | null;
  coverUrl: string | null;
  sourceUrl: string | null;
  topic: EventTopic;
  /** League or competition the listing belongs to, e.g. "English Premier League". */
  competition?: string | null;
  /** Club crests for the two sides when the source provides them. */
  homeLogo?: string | null;
  awayLogo?: string | null;
  /** Set when Gemini wrote the title and details rather than a regex parser. */
  ai?: boolean;
}

export interface SourceConfig {
  [key: string]: unknown;
}

const FETCH_TIMEOUT_MS = 15_000;
const USER_AGENT = "AddisGebetaBot/1.0 (+https://addisweg.local; event import)";
// ESPN's edge rejects obvious bots, so its public scoreboard is read with the
// header a browser sends. No personal data is involved.
const ESPN_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

function str(config: SourceConfig, key: string): string {
  const value = config[key];
  return typeof value === "string" ? value.trim() : "";
}

function strList(config: SourceConfig, key: string): string[] {
  const value = config[key];
  if (Array.isArray(value)) return value.map((entry) => String(entry).trim()).filter(Boolean);
  if (typeof value === "string") {
    return value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return [];
}

async function fetchText(url: string, userAgent = USER_AGENT): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "user-agent": userAgent, accept: "application/json, text/html, application/xml, text/xml, */*" },
    });
    if (!response.ok) {
      throw new Error(`${url} responded ${response.status}`);
    }
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

export function stripHtml(value: string): string {
  return decodeEntities(
    value
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li)>/gi, "\n")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function decodeEntities(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

// ---------------------------------------------------------------------------
// Sports fixtures — TheSportsDB public API (Ethiopian Premier League by default)
// ---------------------------------------------------------------------------

interface SportsDbEvent {
  idEvent?: string;
  strEvent?: string;
  strHomeTeam?: string;
  strAwayTeam?: string;
  strLeague?: string;
  strSeason?: string;
  strTimestamp?: string;
  dateEvent?: string;
  strTime?: string;
  strVenue?: string;
  strThumb?: string;
  strLeagueBadge?: string;
  intRound?: string;
  strStatus?: string | null;
}

/**
 * TheSportsDB league ids for the competitions people in Addis actually follow.
 * A source with `preset: "international"` pulls all of them in one sync.
 */
const INTERNATIONAL_LEAGUES: Array<{ id: string; name: string }> = [
  { id: "4328", name: "English Premier League" },
  { id: "4335", name: "Spanish La Liga" },
  { id: "4332", name: "Italian Serie A" },
  { id: "4331", name: "German Bundesliga" },
  { id: "4334", name: "French Ligue 1" },
  { id: "4480", name: "UEFA Champions League" },
  { id: "4481", name: "UEFA Europa League" },
  { id: "4387", name: "NBA" },
];

function leagueTargets(config: SourceConfig): string[] {
  if (str(config, "preset") === "international") return INTERNATIONAL_LEAGUES.map((league) => league.id);
  const listed = strList(config, "leagueIds");
  if (listed.length > 0) return listed;
  return [str(config, "leagueId") || "4959"];
}

async function fetchLeagueFixtures(
  leagueId: string,
  apiKey: string,
  baseUrl: string,
  endpoint: string,
): Promise<SportsDbEvent[]> {
  const payload = JSON.parse(
    await fetchText(`${baseUrl}/${apiKey}/${endpoint}?id=${encodeURIComponent(leagueId)}`),
  ) as { events?: SportsDbEvent[] | null };
  return payload.events ?? [];
}

export async function fetchSportsFixtures(config: SourceConfig): Promise<NormalizedEvent[]> {
  const provider = str(config, "provider").toLowerCase();
  // ESPN's public scoreboard carries whole matchweeks without an API key; the
  // international preset uses it so a league shows a real schedule, not the one
  // fixture TheSportsDB's free key returns.
  if (provider === "espn" || str(config, "preset") === "international") {
    return fetchEspnFixtures(config);
  }

  const apiKey = str(config, "apiKey") || "123";
  const baseUrl = str(config, "baseUrl") || "https://www.thesportsdb.com/api/v1/json";
  const includePast = config.includePast === true;
  const endpoint = includePast ? "eventspastleague.php" : "eventsnextleague.php";
  const targets = leagueTargets(config);

  // One broken league must not blank the whole card.
  const settled = await Promise.allSettled(
    targets.map((leagueId) => fetchLeagueFixtures(leagueId, apiKey, baseUrl, endpoint)),
  );
  const failed = settled.filter((result) => result.status === "rejected") as PromiseRejectedResult[];
  const fixtures = settled
    .filter((result): result is PromiseFulfilledResult<SportsDbEvent[]> => result.status === "fulfilled")
    .flatMap((result) => result.value);

  if (fixtures.length === 0 && failed.length > 0) {
    const reason = failed[0]?.reason;
    throw new Error(reason instanceof Error ? reason.message : "No league feed could be read");
  }

  const seen = new Set<string>();
  const events: NormalizedEvent[] = [];

  for (const fixture of fixtures) {
    const externalId = fixture.idEvent?.trim();
    if (!externalId || seen.has(externalId)) continue;

    const home = fixture.strHomeTeam?.trim();
    const away = fixture.strAwayTeam?.trim();
    const title = home && away ? `${home} vs ${away}` : fixture.strEvent?.trim();
    if (!title) continue;

    const startDate = parseFixtureDate(fixture);
    if (!startDate) continue;

    seen.add(externalId);
    const league = fixture.strLeague?.trim() || "Football";
    const season = fixture.strSeason?.trim();
    const round = fixture.intRound ? `Round ${fixture.intRound}` : null;
    const details = [
      [league, season].filter(Boolean).join(" · "),
      round,
      fixture.strVenue ? `Kick-off at ${fixture.strVenue}` : null,
      "Fixtures pulled automatically from TheSportsDB; times can change — check with the league before travelling.",
    ].filter(Boolean);

    events.push({
      externalId,
      title,
      description: details.join("\n"),
      startDate,
      endDate: new Date(startDate.getTime() + 2 * 60 * 60 * 1000),
      location: fixture.strVenue?.trim() || "Addis Ababa",
      coverUrl: fixture.strThumb?.trim() || fixture.strLeagueBadge?.trim() || null,
      sourceUrl: `https://www.thesportsdb.com/event/${externalId}`,
      topic: EventTopic.SPORTS,
      competition: league,
    });
  }

  return events;
}

// ---------------------------------------------------------------------------
// ESPN fixtures — full matchweeks for Europe's big leagues and the NBA.
// The scoreboard endpoint is public (no key), so the schedule stays complete
// instead of being cut to one fixture per league.
// ---------------------------------------------------------------------------

interface EspnTeam {
  displayName?: string;
  shortDisplayName?: string;
  logo?: string;
}

interface EspnCompetitor {
  homeAway?: "home" | "away";
  team?: EspnTeam;
}

interface EspnEvent {
  id?: string;
  date?: string;
  name?: string;
  links?: Array<{ href?: string }>;
  competitions?: Array<{
    date?: string;
    startDate?: string;
    status?: { type?: { state?: string; completed?: boolean } };
    venue?: { fullName?: string; address?: { city?: string; country?: string } };
    competitors?: EspnCompetitor[];
  }>;
}

interface EspnScoreboard {
  leagues?: Array<{ name?: string; logos?: Array<{ href?: string }> }>;
  events?: EspnEvent[] | null;
}

interface EspnLeague {
  path: string;
  name: string;
}

const ESPN_INTERNATIONAL: EspnLeague[] = [
  { path: "soccer/eng.1", name: "English Premier League" },
  { path: "soccer/esp.1", name: "Spanish La Liga" },
  { path: "soccer/ita.1", name: "Italian Serie A" },
  { path: "soccer/ger.1", name: "German Bundesliga" },
  { path: "soccer/fra.1", name: "French Ligue 1" },
  { path: "soccer/uefa.champions", name: "UEFA Champions League" },
  { path: "soccer/uefa.europa", name: "UEFA Europa League" },
  { path: "basketball/nba", name: "NBA" },
];

function espnLeagues(config: SourceConfig): EspnLeague[] {
  if (str(config, "preset") === "international") return ESPN_INTERNATIONAL;
  const listed = strList(config, "leagues");
  if (listed.length === 0) return ESPN_INTERNATIONAL;
  return listed.map((path) => {
    const known = ESPN_INTERNATIONAL.find((league) => league.path === path || league.path.endsWith(`/${path}`));
    return known ?? { path, name: path };
  });
}

function espnMonths(horizonDays: number): string[] {
  const now = new Date();
  const end = new Date(now.getTime() + horizonDays * 24 * 60 * 60 * 1000);
  const months: string[] = [];
  const cursor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  while (cursor.getTime() <= end.getTime() && months.length < 4) {
    months.push(`${cursor.getUTCFullYear()}${String(cursor.getUTCMonth() + 1).padStart(2, "0")}`);
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return months;
}

async function fetchJsonWithRetry<T>(url: string, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return JSON.parse(await fetchText(url, ESPN_USER_AGENT)) as T;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`${url} could not be read`);
}

export async function fetchEspnFixtures(config: SourceConfig): Promise<NormalizedEvent[]> {
  const baseUrl = str(config, "baseUrl") || "https://site.api.espn.com/apis/site/v2/sports";
  const horizonDays = Math.min(Math.max(Number(config.horizonDays) || 21, 1), 60);
  const leagues = espnLeagues(config);
  const months = espnMonths(horizonDays);
  const now = Date.now();
  const until = now + horizonDays * 24 * 60 * 60 * 1000;

  const requests = leagues.flatMap((league) =>
    months.map(async (month) => {
      const url = `${baseUrl}/${league.path}/scoreboard?dates=${month}`;
      const data = await fetchJsonWithRetry<EspnScoreboard>(url);
      return { league, data };
    }),
  );

  const settled = await Promise.allSettled(requests);
  const failed = settled.filter((result) => result.status === "rejected") as PromiseRejectedResult[];
  const pages = settled
    .filter(
      (result): result is PromiseFulfilledResult<{ league: EspnLeague; data: EspnScoreboard }> =>
        result.status === "fulfilled",
    )
    .map((result) => result.value);

  if (pages.length === 0 && failed.length > 0) {
    const reason = failed[0]?.reason;
    throw new Error(reason instanceof Error ? reason.message : "ESPN's fixture feed could not be read");
  }

  const seen = new Set<string>();
  const events: NormalizedEvent[] = [];

  for (const { league, data } of pages) {
    // ESPN labels La Liga as "Spanish LALIGA"; use our own stable names so the
    // sports page's league groups never depend on their branding.
    const competition = league.name;
    const leagueLogo = data.leagues?.[0]?.logos?.[0]?.href?.trim() || null;

    for (const event of data.events ?? []) {
      const externalId = event.id?.trim();
      if (!externalId || seen.has(externalId)) continue;

      const contest = event.competitions?.[0];
      if (!contest) continue;
      // Completed matches belong in results, not in an upcoming schedule.
      if (contest.status?.type?.completed || contest.status?.type?.state === "post") continue;

      const startDate = new Date(contest.startDate || contest.date || event.date || "");
      if (Number.isNaN(startDate.getTime())) continue;
      if (startDate.getTime() < now - 3 * 60 * 60 * 1000 || startDate.getTime() > until) continue;

      const homeTeam = contest.competitors?.find((team) => team.homeAway === "home")?.team;
      const awayTeam = contest.competitors?.find((team) => team.homeAway === "away")?.team;
      const home = homeTeam?.displayName?.trim();
      const away = awayTeam?.displayName?.trim();
      const title = home && away ? `${home} vs ${away}` : (home ?? event.name?.trim());
      if (!title) continue;

      seen.add(externalId);
      const venue = contest.venue?.fullName?.trim() || null;
      const city = [contest.venue?.address?.city, contest.venue?.address?.country].filter(Boolean).join(", ");
      const details = [
        competition,
        venue ? `At ${venue}${city ? `, ${city}` : ""}` : null,
        "Fixture from ESPN's public schedule; kick-off times can change — check with the league before travelling.",
      ].filter(Boolean);

      events.push({
        externalId: `espn-${externalId}`,
        title,
        description: details.join("\n"),
        startDate,
        endDate: new Date(startDate.getTime() + 2 * 60 * 60 * 1000),
        location: venue,
        coverUrl: leagueLogo,
        sourceUrl:
          event.links?.find((link) => typeof link.href === "string" && /^https?:/.test(link.href))?.href ?? null,
        topic: EventTopic.SPORTS,
        competition,
        homeLogo: homeTeam?.logo?.trim() ?? null,
        awayLogo: awayTeam?.logo?.trim() ?? null,
      });
    }
  }

  events.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  return events;
}

function parseFixtureDate(fixture: SportsDbEvent): Date | null {
  const timestamp = fixture.strTimestamp?.trim();
  if (timestamp) {
    // TheSportsDB timestamps are UTC without a zone suffix.
    const withZone = /[zZ]|[+-]\d{2}:\d{2}$/.test(timestamp) ? timestamp : `${timestamp}Z`;
    const parsed = new Date(withZone);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  if (fixture.dateEvent) {
    const time = fixture.strTime?.trim() || "15:00:00";
    const parsed = new Date(`${fixture.dateEvent}T${time}Z`);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Telegram — public channel previews (t.me/s/<channel>) used by Addis venues
// ---------------------------------------------------------------------------

export async function fetchTelegramEvents(config: SourceConfig): Promise<NormalizedEvent[]> {
  const channel = str(config, "channel").replace(/^@/, "").replace(/^https?:\/\/t\.me\/(s\/)?/, "");
  if (!channel) throw new Error("Telegram source needs a channel handle");

  const html = await fetchText(`https://t.me/s/${encodeURIComponent(channel)}`);
  const messages = [...html.matchAll(/data-post="([^"]+)"([\s\S]*?)(?=data-post="|$)/g)];

  const posts: Array<{ channel: string; id: string; text: string; poster: string | null }> = [];
  for (const [, dataPost, body] of messages) {
    const [postChannel, postId] = dataPost.split("/");
    if (!postChannel || !postId) continue;

    const textHtml = body.match(/<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/)?.[1];
    if (!textHtml) continue;
    const text = stripHtml(textHtml);
    if (!text) continue;

    const poster = body.match(/tgme_widget_message_photo_wrap[^>]*background-image:url\('([^']+)'\)/)?.[1];
    posts.push({ channel: postChannel, id: postId, text, poster: poster ?? null });
  }

  if (posts.length === 0) return [];

  // Gemini reads the whole batch at once: it handles the formats the emoji
  // regexes miss (theatre runs, multi-date announcements, Amharic wording). When
  // the keys are all cooling down the regex pass still produces what it can.
  const useAi = config.useAi !== false;
  const extracted = useAi ? await extractTelegramPostsWithAi(posts.map((post) => post.text)) : new Map<number, AiTelegramEvent>();

  const fallbackTopic = (str(config, "topic") as EventTopic) || EventTopic.OTHER;
  const events: NormalizedEvent[] = [];

  for (const [index, post] of posts.entries()) {
    const ai = extracted.get(index);
    const regex = describeTelegramEvent(post.text);
    if (!ai && !regex) continue;

    const externalId = `${post.channel}/${post.id}`;
    const sourceUrl = `https://t.me/${post.channel}/${post.id}`;

    if (ai) {
      events.push({
        externalId,
        title: ai.title.slice(0, 120),
        description: `${ai.description || post.text.slice(0, 900)}\n\n— Imported from @${channel} on Telegram. Details and ticket links come from the organiser.`,
        startDate: ai.startDate,
        endDate: ai.endDate,
        location: ai.venue,
        coverUrl: post.poster,
        sourceUrl,
        topic: ai.topic ?? fallbackTopic,
        ai: true,
      });
      continue;
    }

    if (!regex) continue;
    events.push({
      externalId,
      title: regex.title,
      description: `${post.text}\n\n— Imported from @${channel} on Telegram. Details and ticket links come from the organiser.`,
      startDate: regex.startDate,
      endDate: regex.endDate,
      location: regex.location,
      coverUrl: post.poster,
      sourceUrl,
      topic: fallbackTopic,
      ai: false,
    });
  }

  return events;
}

interface AiTelegramEvent {
  title: string;
  description: string | null;
  venue: string | null;
  startDate: Date;
  endDate: Date | null;
  topic: EventTopic | null;
}

const AI_TOPICS = new Set(Object.values(EventTopic));

function parseAiDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Asks Gemini to turn a batch of channel posts into event rows. Returns a map
 * keyed by post index; an empty map means "no usable answer" rather than an
 * error, so a quota problem never costs the source its regex results.
 */
async function extractTelegramPostsWithAi(texts: string[]): Promise<Map<number, AiTelegramEvent>> {
  const out = new Map<number, AiTelegramEvent>();
  const batch = texts.slice(0, 12).map((text, index) => ({ index, text: text.slice(0, 1400) }));
  if (batch.length === 0) return out;

  const today = new Date().toISOString().slice(0, 10);
  const prompt = [
    `Today is ${today}. These are numbered Telegram posts from an Addis Ababa venue or organiser.`,
    "Extract every post that announces a real, upcoming event (screening, concert, theatre run, match, exhibition, festival, community gathering).",
    'Return JSON exactly like {"items":[{"index":0,"isEvent":true,"title":"","description":"","start":"2026-11-01T17:00:00+03:00","end":"2026-11-01T19:00:00+03:00","venue":"","topic":"CINEMA"}]}.',
    "Rules:",
    "- Times in these posts are Addis Ababa time (UTC+3) unless the post says otherwise; always give start/end with an explicit +03:00 offset.",
    "- `start` must be the event's own start, never the post date. If no date is stated, set isEvent false.",
    "- `end` may be null. `venue` is the named place only. `description` is one or two plain sentences.",
    "- `topic` is one of CINEMA, THEATRE, SPORTS, MUSIC, FESTIVAL, COMMUNITY, OTHER.",
    "- Titles stay under 110 characters and must not include emoji or ticket links.",
    "- For posts that are not events (questions, sold-out notices, chats), return isEvent false.",
    "",
    "Posts:",
    JSON.stringify(batch),
  ].join("\n");

  try {
    const result = await generateJson<{ items?: Array<Record<string, unknown>> }>({ prompt, temperature: 0.1 });
    for (const item of result.data.items ?? []) {
      const index = Number(item.index);
      if (!Number.isInteger(index) || index < 0 || index >= texts.length) continue;
      if (item.isEvent === false) continue;

      const title = typeof item.title === "string" ? item.title.trim() : "";
      const startDate = parseAiDate(item.start);
      if (!title || !startDate) continue;

      const rawTopic = typeof item.topic === "string" ? item.topic.toUpperCase() : "";
      const topic = AI_TOPICS.has(rawTopic as EventTopic) ? (rawTopic as EventTopic) : null;
      const venue = typeof item.venue === "string" && item.venue.trim() ? item.venue.trim().slice(0, 160) : null;
      const description =
        typeof item.description === "string" && item.description.trim() ? item.description.trim() : null;

      out.set(index, {
        title,
        description,
        venue,
        startDate,
        endDate: parseAiDate(item.end),
        topic,
      });
    }
  } catch (error) {
    if (error instanceof GeminiError) {
      logger.warn({ code: error.code, message: error.message }, "Gemini extraction unavailable, using regex parsing");
    } else {
      logger.warn({ err: error }, "Gemini extraction failed, using regex parsing");
    }
  }

  return out;
}

const ADDIS_OFFSET_HOURS = 3;

const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

function describeTelegramEvent(text: string): { title: string; startDate: Date; endDate: Date; location: string | null } | null {
  const dateLine = text.match(/(?:📆|📅|🗓)\s*([^\n]+)/)?.[1];
  const startOfDay = dateLine ? parseDayMonth(dateLine) : null;
  if (!startOfDay) return null;

  const timeLine = text.match(/(?:🕰|🕒|🕐|🕑|🕓|🕔|🕕|⏰|🕖)\ufe0f?\s*([^\n]+)/)?.[1] ?? "";
  const range = parseTimeRange(timeLine);

  const startDate = addisTime(startOfDay, range.startHour, range.startMinute);
  const endDate = addisTime(startOfDay, range.endHour, range.endMinute);
  if (endDate <= startDate) endDate.setTime(endDate.getTime() + 12 * 60 * 60 * 1000);

  const venue = text.match(/(?:📍|🏟|🏛)\ufe0f?\s*([^\n]+)/)?.[1]?.trim() ?? null;

  const titleLine =
    text
      .split("\n")
      .map((line) => line.replace(/[^\p{L}\p{N}\s'&:!?.,()–-]/gu, "").trim())
      .find((line) => line.length >= 6) ?? "";
  const title = (titleLine || "Community event").slice(0, 110);

  return { title, startDate, endDate, location: venue };
}

/**
 * A date whose UTC calendar day is the right one, with the wall-clock time in
 * Addis Ababa (UTC+3, no DST) converted to a real instant.
 */
function addisTime(day: Date, hour: number, minute: number): Date {
  return new Date(
    Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), hour - ADDIS_OFFSET_HOURS, minute),
  );
}

/** "October 18", "Oct 31", "18 October 2026". Undated years must still be ahead. */
function parseDayMonth(raw: string): Date | null {
  const cleaned = raw.replace(/\s+/g, " ").trim();
  const monthFirst = cleaned.match(/([A-Za-z]{3,9})\s+(\d{1,2})(?:,?\s*(\d{4}))?/);
  const dayFirst = cleaned.match(/(\d{1,2})\s+([A-Za-z]{3,9})(?:,?\s*(\d{4}))?/);

  let monthText = "";
  let day = 0;
  let year = 0;
  if (monthFirst) {
    monthText = monthFirst[1];
    day = Number(monthFirst[2]);
    year = monthFirst[3] ? Number(monthFirst[3]) : 0;
  } else if (dayFirst) {
    day = Number(dayFirst[1]);
    monthText = dayFirst[2];
    year = dayFirst[3] ? Number(dayFirst[3]) : 0;
  } else {
    return null;
  }

  const month = MONTHS.findIndex((name) => name.startsWith(monthText.toLowerCase().slice(0, 3)));
  if (month < 0 || !day || day > 31) return null;

  const now = new Date();
  const candidate = new Date(Date.UTC(year || now.getUTCFullYear(), month, day));
  // A channel preview only carries recent posts, so a date that has already
  // passed without a year is a finished event — do not bump it to next year.
  if (!year && candidate.getTime() < now.getTime() - 24 * 60 * 60 * 1000) return null;
  return candidate;
}

/**
 * Reads things like "5–7 PM", "11:00–1:00 LT" and "19:00–22:00". Ethiopian
 * clock times ("LT", also written ሰዓት) are six hours behind the 24-hour clock,
 * so 11 LT becomes 17:00.
 */
function parseTimeRange(raw: string): { startHour: number; startMinute: number; endHour: number; endMinute: number } {
  const fallback = { startHour: 18, startMinute: 0, endHour: 20, endMinute: 0 };
  if (!raw) return fallback;

  // Posters often write both clocks ("5–7 PM | 11:00–1:00 LT"); one is enough.
  const primary = raw.split("|")[0].trim() || raw.trim();
  const meridiem = primary.match(/\b(am|pm)\b/i)?.[1]?.toLowerCase();
  const ethiopianClock = !meridiem && (/\bLT\b/i.test(primary) || /ሰዓት/.test(primary));
  const cleaned = primary.replace(/ሰዓት/g, " ").replace(/\b(LT|EAT)\b/gi, " ").replace(/\s+/g, " ").trim();
  const parts = cleaned.split(/[–—-]/).map((part) => part.trim()).filter(Boolean);

  const read = (value: string | undefined): { hour: number; minute: number } | null => {
    if (!value) return null;
    const match = value.match(/(\d{1,2})(?::(\d{2}))?/);
    if (!match) return null;
    let hour = Number(match[1]);
    const minute = match[2] ? Number(match[2]) : 0;
    if (hour > 23) return null;
    if (meridiem === "pm" && hour < 12) hour += 12;
    if (meridiem === "am" && hour === 12) hour = 0;
    if (ethiopianClock) hour = (hour + 6) % 24;
    return { hour, minute };
  };

  const start = read(parts[0]);
  const end = read(parts[1] ?? parts[0]);
  if (!start) return fallback;

  // Without any marker, a small hour on an events channel means the evening.
  if (!meridiem && !ethiopianClock && start.hour > 0 && start.hour <= 6) {
    start.hour += 12;
    if (end && end.hour <= 12) end.hour += 12;
  }

  return {
    startHour: start.hour,
    startMinute: start.minute,
    endHour: end ? end.hour : Math.min(23, start.hour + 2),
    endMinute: end ? end.minute : 0,
  };
}

// ---------------------------------------------------------------------------
// RSS / Atom — any feed an admin points at (culture blogs, cinema calendars…)
// ---------------------------------------------------------------------------

export async function fetchRssEvents(config: SourceConfig): Promise<NormalizedEvent[]> {
  const feedUrl = str(config, "feedUrl");
  if (!feedUrl) throw new Error("RSS source needs a feedUrl");
  const keywords = strList(config, "keywords").map((entry) => entry.toLowerCase());
  const topic = (str(config, "topic") as EventTopic) || EventTopic.OTHER;

  const xml = await fetchText(feedUrl);
  const blocks = [...xml.matchAll(/<(item|entry)\b[\s\S]*?<\/\1>/gi)].map((match) => match[0]);

  return blocks.flatMap((block) => {
    const title = stripHtml(readTag(block, "title") ?? "");
    if (!title) return [];

    const rawDescription =
      readTag(block, "description") ?? readTag(block, "summary") ?? readTag(block, "content:encoded") ?? "";
    const description = stripHtml(rawDescription).slice(0, 1500);
    const link =
      readTag(block, "link") ??
      block.match(/<link[^>]*href="([^"]+)"/)?.[1] ??
      readTag(block, "guid") ??
      "";

    if (keywords.length > 0) {
      const haystack = `${title} ${description}`.toLowerCase();
      if (!keywords.some((keyword) => haystack.includes(keyword))) return [];
    }

    const rawDate =
      readTag(block, "pubDate") ?? readTag(block, "dc:date") ?? readTag(block, "published") ?? readTag(block, "updated");
    const startDate = rawDate ? new Date(rawDate) : null;
    if (!startDate || Number.isNaN(startDate.getTime())) return [];

    const externalId = readTag(block, "guid") ?? link ?? `${title}-${startDate.toISOString()}`;

    return [
      {
        externalId: externalId.slice(0, 300),
        title: title.slice(0, 120),
        description: description || "Imported from an online event feed.",
        startDate,
        endDate: null,
        location: null,
        coverUrl: readTag(block, "media:content")?.match(/url="([^"]+)"/)?.[1] ?? null,
        sourceUrl: link || feedUrl,
        topic,
      } satisfies NormalizedEvent,
    ];
  });
}

// ---------------------------------------------------------------------------
// Gemini discovery — asks the model (optionally with Google Search) to list
// upcoming events for a focus area. Used for the parts of the calendar no
// structured feed covers; off by default on new sources unless grounded.
// ---------------------------------------------------------------------------

interface AiDiscoveryItem {
  title?: unknown;
  start?: unknown;
  end?: unknown;
  venue?: unknown;
  city?: unknown;
  country?: unknown;
  description?: unknown;
  url?: unknown;
  topic?: unknown;
}

const DEFAULT_DISCOVERY_PROMPT =
  "Major international sport in the next few weeks (football, athletics, basketball, Formula 1, tennis) plus cinema, theatre and music events happening in Addis Ababa.";

export async function fetchGeminiEvents(config: SourceConfig): Promise<NormalizedEvent[]> {
  const focus = str(config, "prompt") || DEFAULT_DISCOVERY_PROMPT;
  const horizonDays = Math.min(Math.max(Number(config.horizonDays) || 21, 1), 60);
  const fallbackTopic = (str(config, "topic") as EventTopic) || EventTopic.OTHER;
  const today = new Date().toISOString().slice(0, 10);

  const prompt = [
    `Today is ${today}. You are the events desk for a community app in Addis Ababa, Ethiopia.`,
    `Find real, scheduled events that start within the next ${horizonDays} days. Focus: ${focus}`,
    config.grounded === false ? "Answer from what you know; do not invent venues or dates." : "Use Google Search to verify each event.",
    'Return JSON exactly like {"events":[{"title":"","start":"2026-11-01T18:00:00+03:00","end":"2026-11-01T20:00:00+03:00","venue":"","city":"","country":"","description":"","url":"","topic":"SPORTS"}]}.',
    "Rules:",
    "- Only include events you can attribute to a real organiser or venue; omit anything uncertain.",
    "- `start` must include an explicit timezone offset. Ethiopian events use +03:00.",
    "- `topic` is one of CINEMA, THEATRE, SPORTS, MUSIC, FESTIVAL, COMMUNITY, OTHER.",
    "- Descriptions are one or two plain sentences, no emoji, no ticket prices.",
    "- `url` must be the organiser or ticket page you found, or null.",
    "- Return at most 20 events, ordered by start time.",
  ].join("\n");

  let result: Awaited<ReturnType<typeof generateJson<{ events?: AiDiscoveryItem[] }>>>;
  try {
    result = await generateJson<{ events?: AiDiscoveryItem[] }>({
      prompt,
      grounded: config.grounded !== false,
      temperature: 0.2,
    });
  } catch (error) {
    // Grounded requests draw on a smaller search quota than plain generation;
    // say that plainly instead of leaving a bare "429" on the source.
    if (error instanceof GeminiError && error.code === "RATE_LIMITED" && config.grounded !== false) {
      throw new Error(
        "Google Search grounding is out of quota on the current Gemini keys, and the AI desk will not publish unverified events. It retries automatically on the next sync.",
      );
    }
    throw error;
  }

  const events: NormalizedEvent[] = [];
  for (const item of result.data.events ?? []) {
    const title = typeof item.title === "string" ? item.title.trim() : "";
    const startDate = parseAiDate(item.start);
    if (!title || !startDate) continue;

    const venue = typeof item.venue === "string" ? item.venue.trim() : "";
    const city = typeof item.city === "string" ? item.city.trim() : "";
    const country = typeof item.country === "string" ? item.country.trim() : "";
    const place = [venue, [city, country].filter(Boolean).join(", ")].filter(Boolean).join(", ");
    const description =
      typeof item.description === "string" && item.description.trim()
        ? item.description.trim()
        : "Discovered by the AI events desk; check the organiser before travelling.";
    const rawTopic = typeof item.topic === "string" ? item.topic.toUpperCase() : "";
    const topic = AI_TOPICS.has(rawTopic as EventTopic) ? (rawTopic as EventTopic) : fallbackTopic;
    const url = typeof item.url === "string" && /^https?:\/\//.test(item.url) ? item.url : null;

    events.push({
      externalId: `ai-${createHash("sha1").update(`${title}|${startDate.toISOString()}`).digest("hex").slice(0, 16)}`,
      title: title.slice(0, 120),
      description: description.slice(0, 1200),
      startDate,
      endDate: parseAiDate(item.end),
      location: place || null,
      coverUrl: null,
      sourceUrl: url,
      topic,
      ai: true,
    });
  }

  return events;
}

function readTag(block: string, tag: string): string | null {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = block.match(new RegExp(`<${escaped}[^>]*>([\\s\\S]*?)</${escaped}>`, "i"));
  if (!match) return null;
  const value = match[1].replace(/^\s*<!\[CDATA\[/, "").replace(/\]\]>\s*$/, "").trim();
  return value || null;
}

// ---------------------------------------------------------------------------

export function adapterFor(adapter: EventSourceAdapter): (config: SourceConfig) => Promise<NormalizedEvent[]> {
  switch (adapter) {
    case EventSourceAdapter.SPORTS_API:
      return fetchSportsFixtures;
    case EventSourceAdapter.TELEGRAM:
      return fetchTelegramEvents;
    case EventSourceAdapter.RSS:
      return fetchRssEvents;
    case EventSourceAdapter.GEMINI:
      return fetchGeminiEvents;
    default:
      throw new Error(`Unknown event source adapter: ${adapter as string}`);
  }
}
