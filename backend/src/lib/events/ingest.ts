import { EventKind, EventTopic, type EventSource } from "@prisma/client";
import { prisma } from "../prisma";
import { logger } from "../logger";
import { adapterFor, type NormalizedEvent, type SourceConfig } from "./adapters";

/**
 * The automatic half of the Events page: every enabled EventSource is fetched,
 * normalised and upserted as an EVENT listing. Member meetups are never touched
 * here — they are created through the API and keep kind MEETUP.
 */

// A full season slice of Europe's leagues is a few hundred fixtures; the cap is
// only here to stop a pathological feed from flooding the calendar.
const MAX_ITEMS_PER_SYNC = 400;
const PAST_GRACE_MS = 6 * 60 * 60 * 1000;
const DEFAULT_SYNC_MINUTES = 180;

/** Some topics have a natural room to file the listing under. */
const TOPIC_CATEGORY_SLUG: Partial<Record<EventTopic, string>> = {
  SPORTS: "sports-talk",
  CINEMA: "ethiopian-cinema",
  THEATRE: "ethiopian-cinema",
};

export interface SyncResult {
  sourceId: string;
  key: string;
  name: string;
  status: "OK" | "ERROR";
  created: number;
  updated: number;
  skipped: number;
  removed: number;
  error?: string;
  syncedAt: string;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 70);
}

function parseConfig(config: unknown): SourceConfig {
  return config && typeof config === "object" && !Array.isArray(config) ? (config as SourceConfig) : {};
}

/** Imported listings need an owner; the senior administrator is the curator. */
async function curatorId(): Promise<string | null> {
  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (admin) return admin.id;
  const fallback = await prisma.user.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } });
  return fallback?.id ?? null;
}

async function categoryFor(topic: EventTopic): Promise<string | null> {
  const slug = TOPIC_CATEGORY_SLUG[topic];
  if (!slug) return null;
  const category = await prisma.category.findUnique({ where: { slug }, select: { id: true } });
  return category?.id ?? null;
}

/** Stable slug per external listing, so a re-sync updates the same page. */
function listingSlug(item: NormalizedEvent): string {
  const base = slugify(item.title) || "event";
  const suffix = slugify(item.externalId).slice(-8) || Math.random().toString(36).slice(2, 8);
  return `${base}-${suffix}`;
}

async function syncSourceWith(source: EventSource, owner: string): Promise<SyncResult> {
  const config = parseConfig(source.config);
  const topic = (source.topic ?? EventTopic.OTHER) as EventTopic;

  const fetched = await adapterFor(source.adapter)(config);
  const now = Date.now();
  const items = fetched
    .filter((item) => {
      const time = item.startDate.getTime();
      return !Number.isNaN(time) && time >= now - PAST_GRACE_MS;
    })
    .slice(0, MAX_ITEMS_PER_SYNC);

  const categoryId = await categoryFor(topic);
  let created = 0;
  let updated = 0;
  let removed = 0;
  let skipped = fetched.length - items.length;

  for (const item of items) {
    const existing = await prisma.event.findFirst({
      where: { sourceId: source.id, externalId: item.externalId },
      select: { id: true, aiExtracted: true },
    });

    const data = {
      title: item.title.slice(0, 120),
      description: item.description.slice(0, 3000) || "Imported from an online source.",
      startDate: item.startDate,
      endDate: item.endDate,
      location: item.location,
      coverUrl: item.coverUrl,
      sourceUrl: item.sourceUrl,
      // A listing's own topic wins; otherwise inherit the feed's topic so a
      // cinema channel's posts do not all land in Other.
      topic: item.topic && item.topic !== EventTopic.OTHER ? item.topic : topic,
      competition: item.competition?.slice(0, 120) ?? null,
      homeLogo: item.homeLogo ?? null,
      awayLogo: item.awayLogo ?? null,
      importedAt: new Date(),
      aiExtracted: item.ai === true,
    };

    try {
      if (existing) {
        // Keep Gemini's wording when this pass could only offer a regex parse of
        // the raw post. The date refresh still matters, so only copy is skipped.
        if (existing.aiExtracted && !item.ai) {
          await prisma.event.update({
            where: { id: existing.id },
            data: { startDate: data.startDate, endDate: data.endDate, importedAt: data.importedAt },
          });
          updated += 1;
          continue;
        }
        await prisma.event.update({ where: { id: existing.id }, data });
        updated += 1;
      } else {
        await prisma.event.create({
          data: {
            ...data,
            slug: listingSlug(item),
            kind: EventKind.EVENT,
            creatorId: owner,
            sourceId: source.id,
            externalId: item.externalId,
            ...(categoryId ? { categoryId } : {}),
          },
        });
        created += 1;
      }
    } catch (error) {
      skipped += 1;
      logger.warn({ err: error, source: source.key, externalId: item.externalId }, "Skipped one imported event");
    }
  }

  // The feed is the source of truth for its own listings: drop what it no longer
  // publishes (a finished run of screenings, a rescheduled fixture). Skipped for
  // an empty fetch, which is far likelier to be a temporary scraping oddity.
  if (items.length > 0) {
    const liveIds = new Set(items.map((item) => item.externalId));
    const stale = await prisma.event.deleteMany({
      where: { sourceId: source.id, externalId: { notIn: [...liveIds] } },
    });
    removed = stale.count;
  }

  const syncedAt = new Date();
  await prisma.eventSource.update({
    where: { id: source.id },
    data: {
      lastSyncAt: syncedAt,
      lastStatus: "OK",
      lastError: null,
      lastImported: created,
    },
  });

  return {
    sourceId: source.id,
    key: source.key,
    name: source.name,
    status: "OK",
    created,
    updated,
    skipped,
    removed,
    syncedAt: syncedAt.toISOString(),
  };
}

/** Marks a source as failed so the admin page can explain what went wrong. */
async function recordFailure(source: EventSource, error: unknown): Promise<SyncResult> {
  const message = error instanceof Error ? error.message : String(error);
  const syncedAt = new Date();
  await prisma.eventSource
    .update({
      where: { id: source.id },
      data: { lastSyncAt: syncedAt, lastStatus: "ERROR", lastError: message.slice(0, 500) },
    })
    .catch(() => undefined);
  logger.warn({ err: error, source: source.key }, "Event source failed to sync");
  return {
    sourceId: source.id,
    key: source.key,
    name: source.name,
    status: "ERROR",
    created: 0,
    updated: 0,
    skipped: 0,
    removed: 0,
    error: message,
    syncedAt: syncedAt.toISOString(),
  };
}

/** A broken feed is reported, not thrown: the failure belongs to that source. */
export async function syncSource(sourceId: string): Promise<SyncResult> {
  const source = await prisma.eventSource.findUnique({ where: { id: sourceId } });
  if (!source) throw new Error("Event source not found");

  try {
    const owner = await curatorId();
    if (!owner) throw new Error("No account is available to own imported events");
    return await syncSourceWith(source, owner);
  } catch (error) {
    return recordFailure(source, error);
  }
}

/** Fetches every enabled source. A failing feed never stops the others. */
export async function syncAllSources(): Promise<SyncResult[]> {
  const sources = await prisma.eventSource.findMany({
    where: { enabled: true },
    orderBy: { createdAt: "asc" },
  });
  if (sources.length === 0) return [];

  const owner = await curatorId();
  if (!owner) {
    logger.warn("Event import skipped: no user account to own imported events");
    return [];
  }

  const results: SyncResult[] = [];
  for (const source of sources) {
    try {
      const result = await syncSourceWith(source, owner);
      results.push(result);
      logger.info(
        {
          source: result.key,
          created: result.created,
          updated: result.updated,
          skipped: result.skipped,
          removed: result.removed,
        },
        "Event source synced",
      );
    } catch (error) {
      results.push(await recordFailure(source, error));
    }
  }
  return results;
}

let timer: NodeJS.Timeout | null = null;

/**
 * Runs a sync on boot (so a fresh install has listings without waiting) and then
 * on a fixed interval. Timers are unref'd so tests and scripts can exit.
 */
export function startEventIngest(intervalMinutes: number = DEFAULT_SYNC_MINUTES): void {
  void syncAllSources().catch((error) => {
    logger.warn({ err: error }, "Initial event import failed");
  });

  if (intervalMinutes <= 0 || timer) return;
  timer = setInterval(() => {
    void syncAllSources().catch((error) => {
      logger.warn({ err: error }, "Scheduled event import failed");
    });
  }, intervalMinutes * 60 * 1000);
  timer.unref?.();
}
