import { Router, type Request } from "express";
import { EventKind, EventSourceAdapter, EventTopic, PlaceKind, RsvpStatus, type Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/async-handler";
import { ApiError } from "../lib/errors";
import { requireAuth } from "../middleware/auth";
import { isStaffSync } from "../lib/roles";
import { requirePermission } from "../lib/rbac";
import { validate } from "../middleware/validate";
import { EVENT_TOPIC_VALUES } from "../lib/event-topics";
import { syncAllSources, syncSource } from "../lib/events/ingest";
import { aiKeySnapshot, geminiKeyCount, geminiModel, geminiModels } from "../lib/ai/gemini";

export const eventsRouter = Router();

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

const listEventsQuery = z.object({
  categoryId: z.string().optional(),
  placeId: z.string().optional(),
  upcoming: z.coerce.boolean().optional().default(true),
  kind: z.enum(["EVENT", "MEETUP"]).optional(),
  topic: z.enum(EVENT_TOPIC_VALUES).optional(),
  q: z.string().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
});

const createEventSchema = z.object({
  // Members host meetups; only staff can hand-create an official event.
  kind: z.enum(["EVENT", "MEETUP"]).optional().default("MEETUP"),
  topic: z.enum(EVENT_TOPIC_VALUES).optional(),
  title: z.string().trim().min(3, "Title must be at least 3 characters").max(120),
  description: z.string().trim().min(10, "Describe the gathering in at least 10 characters").max(3000),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional(),
  location: z.string().trim().max(180).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  placeId: z.string().optional(),
  categoryId: z.string().optional(),
  maxAttendees: z.coerce.number().int().min(2).max(1000).optional(),
  coverUrl: z.string().trim().max(600).optional(),
});

const updateEventSchema = z.object({
  title: z.string().trim().min(3).max(120).optional(),
  description: z.string().trim().min(10).max(3000).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().nullable().optional(),
  location: z.string().trim().max(180).optional(),
  lat: z.coerce.number().min(-90).max(90).nullable().optional(),
  lng: z.coerce.number().min(-180).max(180).nullable().optional(),
  placeId: z.string().nullable().optional(),
  categoryId: z.string().nullable().optional(),
  maxAttendees: z.coerce.number().int().min(2).max(1000).nullable().optional(),
  coverUrl: z.string().trim().max(600).nullable().optional(),
});

const rsvpSchema = z.object({
  status: z.enum(["GOING", "INTERESTED", "NONE"]),
});

const userSelect = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
};

const eventListInclude = {
  creator: { select: userSelect },
  category: { select: { id: true, name: true, slug: true, color: true, icon: true } },
  source: { select: { id: true, key: true, name: true } },
  place: {
    select: {
      id: true,
      name: true,
      slug: true,
      kind: true,
      city: true,
      area: true,
      lat: true,
      lng: true,
    },
  },
  rsvps: {
    include: {
      user: { select: userSelect },
    },
  },
} satisfies Prisma.EventInclude;

// GET /api/events
eventsRouter.get(
  "/",
  validate(listEventsQuery, "query"),
  asyncHandler(async (req, res) => {
    const { categoryId, placeId, upcoming, kind, topic, q, limit } = req.query as unknown as z.infer<
      typeof listEventsQuery
    >;
    const currentUserId = req.userId;
    const now = new Date();
    const recent = new Date(now.getTime() - 2 * 60 * 60 * 1000);

    const filters: Prisma.EventWhereInput[] = [];
    if (categoryId) filters.push({ categoryId });
    if (placeId) filters.push({ placeId });
    if (kind) filters.push({ kind: kind as EventKind });
    if (topic) filters.push({ topic: topic as EventTopic });
    if (upcoming) {
      // Multi-day festivals and conferences stay listed until their closing
      // time, not just for two hours after they open.
      filters.push({
        OR: [
          { endDate: { gte: recent } },
          { endDate: null, startDate: { gte: recent } },
        ],
      });
    }
    if (q) {
      filters.push({
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
          { location: { contains: q, mode: "insensitive" } },
        ],
      });
    }
    const where: Prisma.EventWhereInput = filters.length > 0 ? { AND: filters } : {};

    // Imported feeds (league fixtures, cinema schedules) can fill every slot of
    // a 50-row page, which would bury the listings the community team publishes
    // from the admin events desk. Curated rows are fetched first and imported
    // rows top up the rest, so a hand-made calendar entry is never invisible.
    const curated = await prisma.event.findMany({
      where: { ...where, sourceId: null },
      take: limit,
      orderBy: { startDate: "asc" },
      include: eventListInclude,
    });
    const importedTake = Math.max(0, limit - curated.length);
    const imported = importedTake
      ? await prisma.event.findMany({
          where: { ...where, sourceId: { not: null } },
          take: importedTake,
          orderBy: { startDate: "asc" },
          include: eventListInclude,
        })
      : [];
    const events = [...curated, ...imported].sort(
      (a, b) => a.startDate.getTime() - b.startDate.getTime(),
    );

    const serialized = events.map((event) => {
      const goingCount = event.rsvps.filter((r) => r.status === RsvpStatus.GOING).length;
      const interestedCount = event.rsvps.filter((r) => r.status === RsvpStatus.INTERESTED).length;
      const myRsvp = currentUserId
        ? event.rsvps.find((r) => r.userId === currentUserId)?.status ?? null
        : null;

      const attendeesPreview = event.rsvps
        .filter((r) => r.status === RsvpStatus.GOING)
        .slice(0, 5)
        .map((r) => r.user);

      return {
        id: event.id,
        slug: event.slug,
        title: event.title,
        description: event.description,
        coverUrl: event.coverUrl,
        startDate: event.startDate.toISOString(),
        endDate: event.endDate?.toISOString() ?? null,
        location: event.location || event.place?.name || "TBA",
        lat: event.lat ?? event.place?.lat ?? null,
        lng: event.lng ?? event.place?.lng ?? null,
        maxAttendees: event.maxAttendees,
        kind: event.kind,
        topic: event.topic,
        competition: event.competition,
        source: event.source ? { id: event.source.id, key: event.source.key, name: event.source.name } : null,
        sourceUrl: event.sourceUrl,
        importedAt: event.importedAt?.toISOString() ?? null,
        creator: event.creator,
        category: event.category,
        place: event.place,
        counts: {
          going: goingCount,
          interested: interestedCount,
          total: goingCount + interestedCount,
        },
        attendeesPreview,
        myRsvp,
        createdAt: event.createdAt.toISOString(),
      };
    });

    res.json({ events: serialized });
  }),
);

// ---------------------------------------------------------------------------
// Sports schedule — the four leagues people here follow, grouped by league
// and served with kick-off times so the Sports page needs no client-side work.
// Declared before "/:slug" so "sports" is not read as an event slug.
// ---------------------------------------------------------------------------

const TOP_LEAGUES = [
  "English Premier League",
  "Spanish La Liga",
  "Italian Serie A",
  "German Bundesliga",
] as const;

function splitFixtureTitle(title: string): { homeTeam: string; awayTeam: string | null } {
  const parts = title.split(/\s+vs\.?\s+/i);
  if (parts.length === 2 && parts[0].trim() && parts[1].trim()) {
    return { homeTeam: parts[0].trim(), awayTeam: parts[1].trim() };
  }
  return { homeTeam: title, awayTeam: null };
}

// GET /api/events/sports?days=21
eventsRouter.get(
  "/sports",
  asyncHandler(async (req, res) => {
    const days = Math.min(Math.max(Number(req.query.days) || 21, 1), 60);
    const now = new Date();
    const from = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    const to = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    const fixtures = await prisma.event.findMany({
      where: {
        topic: EventTopic.SPORTS,
        competition: { in: [...TOP_LEAGUES] },
        startDate: { gte: from, lte: to },
      },
      orderBy: { startDate: "asc" },
      take: 400,
      select: {
        id: true,
        slug: true,
        title: true,
        startDate: true,
        endDate: true,
        location: true,
        competition: true,
        homeLogo: true,
        awayLogo: true,
        sourceUrl: true,
        coverUrl: true,
        importedAt: true,
      },
    });

    const leagues = TOP_LEAGUES.map((name) => ({
      name,
      fixtures: fixtures
        .filter((fixture) => fixture.competition === name)
        .map((fixture) => {
          const { homeTeam, awayTeam } = splitFixtureTitle(fixture.title);
          return {
            id: fixture.id,
            slug: fixture.slug,
            title: fixture.title,
            homeTeam,
            awayTeam,
            competition: name,
            startDate: fixture.startDate.toISOString(),
            endDate: fixture.endDate?.toISOString() ?? null,
            venue: fixture.location,
            homeLogo: fixture.homeLogo,
            awayLogo: fixture.awayLogo,
            coverUrl: fixture.coverUrl,
            sourceUrl: fixture.sourceUrl,
          };
        }),
    }));

    const updatedAt = fixtures.reduce<string | null>((latest, fixture) => {
      if (!fixture.importedAt) return latest;
      const value = fixture.importedAt.toISOString();
      return !latest || value > latest ? value : latest;
    }, null);

    res.json({ leagues, updatedAt, window: { days, from: from.toISOString(), to: to.toISOString() } });
  }),
);

// ---------------------------------------------------------------------------
// Cinema — popular venues plus every screening the feeds have published.
// Declared before "/:slug" so "cinemas" is not read as an event slug.
// ---------------------------------------------------------------------------

function normaliseVenue(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\u1200-\u137f]/g, "")
    .slice(0, 80);
}

// GET /api/events/cinemas?days=30
eventsRouter.get(
  "/cinemas",
  asyncHandler(async (req, res) => {
    const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 90);
    const now = new Date();
    const from = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const to = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    const [places, screenings] = await Promise.all([
      prisma.place.findMany({
        where: { kind: PlaceKind.CINEMA },
        // "Popular" means the halls people actually rate, not just paid placement.
        orderBy: [{ reviewCount: "desc" }, { rating: "desc" }, { featured: "desc" }],
        take: 80,
        select: {
          id: true,
          slug: true,
          name: true,
          kind: true,
          city: true,
          area: true,
          address: true,
          description: true,
          lat: true,
          lng: true,
          rating: true,
          reviewCount: true,
          priceLevel: true,
          tags: true,
          highlight: true,
          featured: true,
        },
      }),
      prisma.event.findMany({
        where: {
          topic: EventTopic.CINEMA,
          startDate: { gte: from, lte: to },
        },
        orderBy: { startDate: "asc" },
        take: 150,
        select: {
          id: true,
          slug: true,
          title: true,
          description: true,
          startDate: true,
          endDate: true,
          location: true,
          coverUrl: true,
          sourceUrl: true,
          importedAt: true,
          placeId: true,
        },
      }),
    ]);

    // The seed data has both English and Amharic duplicates of the same hall;
    // one card per name is what a person expects. Curated halls come before
    // OpenStreetMap imports, and an imported street is not a cinema.
    const isImported = (place: (typeof places)[number]) => /OpenStreetMap/i.test(place.description);
    const pool = places.filter(
      (place) => !(isImported(place) && /\b(street|road|avenue)\b/i.test(place.name)),
    );
    const ordered = [...pool.filter((place) => !isImported(place)), ...pool.filter((place) => isImported(place))];
    const seenNames = new Set<string>();
    const cinemas = ordered
      .filter((place) => {
        const key = normaliseVenue(place.name);
        if (!key || seenNames.has(key)) return false;
        seenNames.add(key);
        return true;
      })
      .slice(0, 6)
      .map((place) => ({ ...place, distanceKm: null }));

    const byVenue = new Map<
      string,
      {
        venue: string;
        cinema: { id: string; name: string; slug: string; area: string | null } | null;
        screenings: Array<{
          id: string;
          slug: string;
          title: string;
          startDate: string;
          endDate: string | null;
          coverUrl: string | null;
          sourceUrl: string | null;
        }>;
      }
    >();

    for (const screening of screenings) {
      const venue = screening.location?.trim() || "Venue to be announced";
      const venueKey = normaliseVenue(venue) || venue.toLowerCase();
      const matchedPlace =
        places.find((place) => place.id === screening.placeId) ??
        places.find((place) => {
          const name = normaliseVenue(place.name);
          return name.length > 2 && (venueKey.includes(name) || name.includes(venueKey));
        }) ??
        null;

      const existing = byVenue.get(venueKey) ?? {
        venue,
        cinema: matchedPlace
          ? { id: matchedPlace.id, name: matchedPlace.name, slug: matchedPlace.slug, area: matchedPlace.area }
          : null,
        screenings: [],
      };

      existing.screenings.push({
        id: screening.id,
        slug: screening.slug,
        title: screening.title,
        startDate: screening.startDate.toISOString(),
        endDate: screening.endDate?.toISOString() ?? null,
        coverUrl: screening.coverUrl,
        sourceUrl: screening.sourceUrl,
      });
      byVenue.set(venueKey, existing);
    }

    const schedules = [...byVenue.values()].sort(
      (a, b) => new Date(a.screenings[0].startDate).getTime() - new Date(b.screenings[0].startDate).getTime(),
    );

    const updatedAt = screenings.reduce<string | null>((latest, screening) => {
      if (!screening.importedAt) return latest;
      const value = screening.importedAt.toISOString();
      return !latest || value > latest ? value : latest;
    }, null);

    res.json({ cinemas, schedules, updatedAt, window: { days } });
  }),
);

// ---------------------------------------------------------------------------
// Online sources — the feeds that publish events automatically (staff only).
// Declared before "/:slug" so "sources" is not read as an event slug.
// ---------------------------------------------------------------------------

const createSourceSchema = z.object({
  name: z.string().trim().min(3, "Give the source a name").max(80),
  adapter: z.enum(["SPORTS_API", "TELEGRAM", "RSS", "GEMINI"]),
  topic: z.enum(EVENT_TOPIC_VALUES).optional().default("OTHER"),
  config: z.record(z.unknown()).optional().default({}),
  enabled: z.boolean().optional().default(true),
});

const updateSourceSchema = z.object({
  name: z.string().trim().min(3).max(80).optional(),
  topic: z.enum(EVENT_TOPIC_VALUES).optional(),
  config: z.record(z.unknown()).optional(),
  enabled: z.boolean().optional(),
  syncNow: z.boolean().optional(),
});

function assertSourceConfig(adapter: EventSourceAdapter, config: Record<string, unknown>): void {
  const has = (key: string) => typeof config[key] === "string" && String(config[key]).trim().length > 0;
  if (adapter === EventSourceAdapter.TELEGRAM && !has("channel")) {
    throw ApiError.badRequest("A Telegram source needs a channel handle, for example Century_Cinema.");
  }
  if (adapter === EventSourceAdapter.RSS && !has("feedUrl")) {
    throw ApiError.badRequest("An RSS source needs a feed URL.");
  }
  if (adapter === EventSourceAdapter.SPORTS_API && !has("leagueId")) {
    throw ApiError.badRequest("A sports source needs a league id, for example 4959.");
  }
}

async function logSourceAction(req: Request, action: string, targetId: string, summary: string): Promise<void> {
  if (!req.userId || !req.userRole) return;
  await prisma.adminAction
    .create({
      data: {
        actorId: req.userId,
        actorRole: req.userRole,
        action,
        targetType: "eventSource",
        targetId,
        summary,
      },
    })
    .catch(() => undefined);
}

const sourceSelect = {
  id: true,
  key: true,
  name: true,
  adapter: true,
  topic: true,
  config: true,
  enabled: true,
  lastSyncAt: true,
  lastStatus: true,
  lastError: true,
  lastImported: true,
  createdAt: true,
} as const;

// GET /api/events/sources
eventsRouter.get(
  "/sources",
  requireAuth,
  requirePermission("admin.events.view"),
  asyncHandler(async (_req, res) => {
    const sources = await prisma.eventSource.findMany({
      orderBy: { createdAt: "asc" },
      select: sourceSelect,
    });
    const counts = await prisma.event.groupBy({
      by: ["sourceId"],
      where: { sourceId: { not: null } },
      _count: { _all: true },
    });
    const bySource = new Map(counts.map((row) => [row.sourceId, row._count._all]));
    res.json({
      sources: sources.map((source) => ({ ...source, eventCount: bySource.get(source.id) ?? 0 })),
    });
  }),
);

// POST /api/events/sources
eventsRouter.post(
  "/sources",
  requireAuth,
  requirePermission("admin.events.manage"),
  validate(createSourceSchema, "body"),
  asyncHandler(async (req, res) => {
    const data = req.body as z.infer<typeof createSourceSchema>;
    const config = data.config as Record<string, unknown>;
    assertSourceConfig(data.adapter as EventSourceAdapter, config);

    const baseKey = slugify(data.name).slice(0, 40) || "source";
    const key = `${baseKey}-${Math.random().toString(36).slice(2, 7)}`;
    const source = await prisma.eventSource.create({
      data: {
        key,
        name: data.name,
        adapter: data.adapter as EventSourceAdapter,
        topic: data.topic as EventTopic,
        config: config as Prisma.InputJsonValue,
        enabled: data.enabled,
      },
      select: sourceSelect,
    });

    await logSourceAction(req, "eventSource.create", source.id, `Added event source ${source.name}`);
    res.status(201).json({ source: { ...source, eventCount: 0 } });
  }),
);

// PATCH /api/events/sources/:id
eventsRouter.patch(
  "/sources/:id",
  requireAuth,
  requirePermission("admin.events.manage"),
  validate(updateSourceSchema, "body"),
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const existing = await prisma.eventSource.findUnique({ where: { id } });
    if (!existing) throw ApiError.notFound("That event source could not be found.");

    const data = req.body as z.infer<typeof updateSourceSchema>;
    if (data.config) assertSourceConfig(existing.adapter, data.config as Record<string, unknown>);

    const source = await prisma.eventSource.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.topic !== undefined ? { topic: data.topic as EventTopic } : {}),
        ...(data.config !== undefined ? { config: data.config as Prisma.InputJsonValue } : {}),
        ...(data.enabled !== undefined ? { enabled: data.enabled } : {}),
      },
      select: sourceSelect,
    });

    const sync = data.syncNow ? await syncSource(id).catch(() => null) : null;
    await logSourceAction(
      req,
      "eventSource.update",
      source.id,
      `${source.enabled ? "Updated" : "Paused"} event source ${source.name}`,
    );

    res.json({ source, sync });
  }),
);

// DELETE /api/events/sources/:id — removes the feed and the listings it posted.
eventsRouter.delete(
  "/sources/:id",
  requireAuth,
  requirePermission("admin.events.manage"),
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const existing = await prisma.eventSource.findUnique({ where: { id }, select: { id: true, name: true } });
    if (!existing) throw ApiError.notFound("That event source could not be found.");

    await prisma.event.deleteMany({ where: { sourceId: id } });
    await prisma.eventSource.delete({ where: { id } });
    await logSourceAction(req, "eventSource.delete", id, `Removed event source ${existing.name}`);
    res.json({ success: true });
  }),
);

// POST /api/events/sources/:id/sync
eventsRouter.post(
  "/sources/:id/sync",
  requireAuth,
  requirePermission("admin.events.manage"),
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const result = await syncSource(id);
    await logSourceAction(req, "eventSource.sync", id, `Synced event source ${result.name}`);
    res.json({ result });
  }),
);

// GET /api/events/ai-usage — how each Gemini key in the pool is being spent.
eventsRouter.get(
  "/ai-usage",
  requireAuth,
  requirePermission("admin.events.view"),
  asyncHandler(async (_req, res) => {
    const keys = await aiKeySnapshot();
    const totals = await prisma.aiKeyUsage.aggregate({
      _sum: { requests: true, successes: true, rateLimited: true, failures: true, tokens: true },
    });
    res.json({
      configured: geminiKeyCount() > 0,
      model: geminiModel(),
      models: geminiModels(),
      keys,
      totals: {
        requests: totals._sum.requests ?? 0,
        successes: totals._sum.successes ?? 0,
        rateLimited: totals._sum.rateLimited ?? 0,
        failures: totals._sum.failures ?? 0,
        tokens: totals._sum.tokens ?? 0,
      },
    });
  }),
);

// POST /api/events/sync — pulls every enabled source on demand.
eventsRouter.post(
  "/sync",
  requireAuth,
  requirePermission("admin.events.manage"),
  asyncHandler(async (_req, res) => {
    const results = await syncAllSources();
    res.json({ results });
  }),
);

// GET /api/events/:slug
eventsRouter.get(
  "/:slug",
  asyncHandler(async (req, res) => {
    const currentUserId = req.userId;
    const event = await prisma.event.findUnique({
      where: { slug: String(req.params.slug) },
      include: {
        creator: { select: userSelect },
        category: { select: { id: true, name: true, slug: true, color: true, icon: true } },
        source: { select: { id: true, key: true, name: true } },
        place: true,
        rsvps: {
          include: { user: { select: userSelect } },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!event) throw ApiError.notFound("We couldn't find that gathering.");

    const going = event.rsvps.filter((r) => r.status === RsvpStatus.GOING).map((r) => r.user);
    const interested = event.rsvps.filter((r) => r.status === RsvpStatus.INTERESTED).map((r) => r.user);
    const myRsvp = currentUserId
      ? event.rsvps.find((r) => r.userId === currentUserId)?.status ?? null
      : null;

    res.json({
      event: {
        id: event.id,
        slug: event.slug,
        title: event.title,
        description: event.description,
        coverUrl: event.coverUrl,
        startDate: event.startDate.toISOString(),
        endDate: event.endDate?.toISOString() ?? null,
        location: event.location || event.place?.name || "TBA",
        lat: event.lat ?? event.place?.lat ?? null,
        lng: event.lng ?? event.place?.lng ?? null,
        maxAttendees: event.maxAttendees,
        kind: event.kind,
        topic: event.topic,
        competition: event.competition,
        source: event.source ? { id: event.source.id, key: event.source.key, name: event.source.name } : null,
        sourceUrl: event.sourceUrl,
        importedAt: event.importedAt?.toISOString() ?? null,
        creator: event.creator,
        category: event.category,
        place: event.place,
        counts: {
          going: going.length,
          interested: interested.length,
          total: going.length + interested.length,
        },
        attendees: { going, interested },
        myRsvp,
        createdAt: event.createdAt.toISOString(),
      },
    });
  }),
);

// POST /api/events
eventsRouter.post(
  "/",
  requireAuth,
  validate(createEventSchema, "body"),
  asyncHandler(async (req, res) => {
    const data = req.body as z.infer<typeof createEventSchema>;
    const userId = req.userId!;

    // The Events tab is fed by the importer; members host meetups.
    if (data.kind === "EVENT" && !isStaffSync(req.userRole)) {
      throw ApiError.forbidden("Official events are published by the community team. Host a meetup instead.");
    }

    // If placeId provided, pull location & coordinates if not manually given
    let place = null;
    if (data.placeId) {
      place = await prisma.place.findUnique({ where: { id: data.placeId } });
    }

    const baseSlug = slugify(data.title) || "event";
    const uniqueSlug = `${baseSlug}-${Math.random().toString(36).slice(2, 7)}`;

    const event = await prisma.event.create({
      data: {
        slug: uniqueSlug,
        title: data.title,
        description: data.description,
        coverUrl: data.coverUrl,
        startDate: data.startDate,
        endDate: data.endDate,
        location: data.location || place?.name || null,
        lat: data.lat ?? place?.lat ?? null,
        lng: data.lng ?? place?.lng ?? null,
        placeId: data.placeId,
        categoryId: data.categoryId,
        maxAttendees: data.maxAttendees,
        kind: data.kind === "EVENT" ? EventKind.EVENT : EventKind.MEETUP,
        ...(data.topic ? { topic: data.topic as EventTopic } : {}),
        creatorId: userId,
        rsvps: {
          create: {
            userId,
            status: RsvpStatus.GOING,
          },
        },
      },
      include: {
        creator: { select: userSelect },
        category: { select: { id: true, name: true, slug: true, color: true, icon: true } },
        place: {
          select: {
            id: true,
            name: true,
            slug: true,
            kind: true,
            city: true,
            area: true,
            lat: true,
            lng: true,
          },
        },
      },
    });

    res.status(201).json({ event });
  }),
);

// POST /api/events/:id/rsvp
eventsRouter.post(
  "/:id/rsvp",
  requireAuth,
  validate(rsvpSchema, "body"),
  asyncHandler(async (req, res) => {
    const { status } = req.body as z.infer<typeof rsvpSchema>;
    const eventId = String(req.params.id);
    const userId = req.userId!;

    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw ApiError.notFound("Event not found.");

    if (status === "NONE") {
      await prisma.eventRsvp.deleteMany({
        where: { eventId, userId },
      });
    } else {
      await prisma.eventRsvp.upsert({
        where: { eventId_userId: { eventId, userId } },
        update: { status: status as RsvpStatus },
        create: {
          eventId,
          userId,
          status: status as RsvpStatus,
        },
      });
    }

    const counts = await prisma.eventRsvp.groupBy({
      by: ["status"],
      where: { eventId },
      _count: { _all: true },
    });

    const going = counts.find((c) => c.status === RsvpStatus.GOING)?._count._all ?? 0;
    const interested = counts.find((c) => c.status === RsvpStatus.INTERESTED)?._count._all ?? 0;

    res.json({
      success: true,
      myRsvp: status === "NONE" ? null : status,
      counts: { going, interested, total: going + interested },
    });
  }),
);

// PATCH /api/events/:id
eventsRouter.patch(
  "/:id",
  requireAuth,
  validate(updateEventSchema, "body"),
  asyncHandler(async (req, res) => {
    const eventId = String(req.params.id);
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw ApiError.notFound("Event not found.");

    const isCreator = event.creatorId === req.userId;
    const isStaff = isStaffSync(req.userRole);
    if (!isCreator && !isStaff) throw ApiError.forbidden("You cannot edit this gathering.");
    if (event.kind === EventKind.EVENT && !isStaff) {
      throw ApiError.forbidden("Imported events can only be adjusted by the community team.");
    }

    const data = req.body as z.infer<typeof updateEventSchema>;
    let place = null;
    if (data.placeId) {
      place = await prisma.place.findUnique({ where: { id: data.placeId } });
    }

    const updated = await prisma.event.update({
      where: { id: eventId },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.startDate !== undefined ? { startDate: data.startDate } : {}),
        ...(data.endDate !== undefined ? { endDate: data.endDate } : {}),
        ...(data.location !== undefined ? { location: data.location || place?.name } : {}),
        ...(data.lat !== undefined ? { lat: data.lat ?? place?.lat } : {}),
        ...(data.lng !== undefined ? { lng: data.lng ?? place?.lng } : {}),
        ...(data.placeId !== undefined ? { placeId: data.placeId } : {}),
        ...(data.categoryId !== undefined ? { categoryId: data.categoryId } : {}),
        ...(data.maxAttendees !== undefined ? { maxAttendees: data.maxAttendees } : {}),
        ...(data.coverUrl !== undefined ? { coverUrl: data.coverUrl } : {}),
      },
      include: {
        creator: { select: userSelect },
        category: { select: { id: true, name: true, slug: true, color: true, icon: true } },
        place: {
          select: {
            id: true,
            name: true,
            slug: true,
            kind: true,
            city: true,
            area: true,
            lat: true,
            lng: true,
          },
        },
      },
    });

    res.json({ event: updated });
  }),
);

// DELETE /api/events/:id
eventsRouter.delete(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const event = await prisma.event.findUnique({ where: { id: String(req.params.id) } });
    if (!event) throw ApiError.notFound("Event not found.");

    const isCreator = event.creatorId === req.userId;
    const isStaff = isStaffSync(req.userRole);
    if (!isCreator && !isStaff) throw ApiError.forbidden("You cannot delete this gathering.");

    await prisma.event.delete({ where: { id: event.id } });
    res.json({ success: true, message: "Event removed." });
  }),
);
