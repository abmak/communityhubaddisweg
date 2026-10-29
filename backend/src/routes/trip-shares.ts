import { randomBytes } from "node:crypto";
import { Router } from "express";
import { PlaceKind, Prisma, TripShareStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/async-handler";
import { ApiError } from "../lib/errors";
import { requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { writeLimiter } from "../lib/rate-limit";

export const tripSharesRouter = Router();

const EARTH_RADIUS_KM = 6371;
const MAX_ROUTE_POINTS = 220;
const DEFAULT_EXPIRY_MINUTES = 12 * 60;

const pointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const fixSchema = pointSchema.extend({
  accuracy: z.number().min(0).max(5000).nullable().optional(),
  heading: z.number().min(0).max(360).nullable().optional(),
});

// OSRM reports distances and durations as decimals; the database stores
// whole metres/seconds, so the route rounds them instead of rejecting a valid
// measurement for not being an integer.
const routeSchema = {
  routePath: z.array(pointSchema).max(4000).optional(),
  routeDistanceMeters: z.number().min(0).max(2_000_000).optional(),
  routeDurationSeconds: z.number().min(0).max(604_800).optional(),
};

const createSchema = z.object({
  origin: pointSchema,
  originName: z.string().trim().max(160).optional(),
  destination: pointSchema,
  destinationName: z.string().trim().min(1).max(160),
  destinationAddress: z.string().trim().max(300).nullable().optional(),
  mode: z.enum(["driving", "walking", "taxi", "bus"]).optional().default("driving"),
  ...routeSchema,
  fix: fixSchema.optional(),
  remainingMeters: z.number().min(0).max(2_000_000).optional(),
  remainingSeconds: z.number().min(0).max(604_800).optional(),
  expiresInMinutes: z
    .number()
    .int()
    .min(15)
    .max(24 * 60)
    .optional()
    .default(DEFAULT_EXPIRY_MINUTES),
});

const updateSchema = z.object({
  fix: fixSchema,
  remainingMeters: z.number().min(0).max(2_000_000).nullable().optional(),
  remainingSeconds: z.number().min(0).max(604_800).nullable().optional(),
  ...routeSchema,
});

const tokenParams = z.object({
  token: z.string().min(20).max(80).regex(/^[A-Za-z0-9_-]+$/),
});

const idParams = z.object({ id: z.string().min(1).max(64) });

const lateSchema = z.object({
  minutes: z.number().int().min(5).max(180),
  note: z.string().trim().max(200).optional(),
});

type RoutePoint = { lat: number; lng: number };

type ShareWithUser = Prisma.TripShareGetPayload<{
  include: {
    user: { select: { id: true; username: true; displayName: true; avatarUrl: true } };
  };
}>;

function newToken(): string {
  return randomBytes(24).toString("base64url");
}

/** Keep a long OSRM line small enough to return on every public poll. */
function simplifyRoute(points: RoutePoint[]): RoutePoint[] {
  if (points.length <= MAX_ROUTE_POINTS) return points;
  const step = (points.length - 1) / (MAX_ROUTE_POINTS - 1);
  return Array.from({ length: MAX_ROUTE_POINTS }, (_, index) => {
    const point = points[Math.round(index * step)];
    return { lat: point.lat, lng: point.lng };
  });
}

/** Read the JSON column defensively; a malformed row must not break the page. */
function readRoutePath(value: Prisma.JsonValue | null): RoutePoint[] | null {
  if (!Array.isArray(value)) return null;
  const points: RoutePoint[] = [];
  for (const entry of value) {
    if (
      entry &&
      typeof entry === "object" &&
      !Array.isArray(entry) &&
      typeof (entry as Record<string, unknown>).lat === "number" &&
      typeof (entry as Record<string, unknown>).lng === "number"
    ) {
      const point = entry as Record<string, number>;
      points.push({ lat: point.lat, lng: point.lng });
    }
  }
  return points.length >= 2 ? points : null;
}

function distanceKm(from: RoutePoint, to: RoutePoint): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

interface SafetyPlace {
  name: string;
  slug: string;
  address: string | null;
  area: string | null;
  city: string;
  lat: number;
  lng: number;
}

async function nearestSafetyPlaces(point: RoutePoint) {
  const rows = await prisma.place.findMany({
    where: { kind: { in: [PlaceKind.HOSPITAL, PlaceKind.PHARMACY] } },
    select: {
      name: true,
      slug: true,
      kind: true,
      address: true,
      area: true,
      city: true,
      lat: true,
      lng: true,
    },
  });

  const ranked = rows
    .map((row) => ({ ...row, distanceKm: distanceKm(point, row) }))
    .sort((a, b) => a.distanceKm - b.distanceKm);

  const shape = (row: (typeof ranked)[number] | undefined) => {
    if (!row) return null;
    const place: SafetyPlace & { kind: PlaceKind; distanceKm: number } = {
      name: row.name,
      slug: row.slug,
      address: row.address,
      area: row.area,
      city: row.city,
      lat: row.lat,
      lng: row.lng,
      kind: row.kind,
      distanceKm: Number(row.distanceKm.toFixed(1)),
    };
    return place;
  };

  return {
    hospital: shape(ranked.find((row) => row.kind === PlaceKind.HOSPITAL)),
    pharmacy: shape(ranked.find((row) => row.kind === PlaceKind.PHARMACY)),
  };
}

async function ownedShare(userId: string, id: string) {
  const share = await prisma.tripShare.findUnique({ where: { id } });
  if (!share) throw ApiError.notFound("That live link no longer exists.");
  if (share.userId !== userId) throw ApiError.forbidden("This live link belongs to someone else.");
  return share;
}

function serializeShare(
  share: ShareWithUser | null,
  options: { viewerId?: string; serverNow: Date },
) {
  if (!share) return null;

  const active = share.status === TripShareStatus.ACTIVE;
  const lastFixAgoSeconds = share.lastFixAt
    ? Math.max(0, Math.round((options.serverNow.getTime() - share.lastFixAt.getTime()) / 1000))
    : null;
  const live = active && lastFixAgoSeconds !== null && lastFixAgoSeconds <= 120;
  const baseSeconds = active ? share.remainingSeconds : null;
  const estimatedArrivalAt =
    baseSeconds !== null
      ? new Date(
          options.serverNow.getTime() + (baseSeconds + share.delayMinutes * 60) * 1000,
        ).toISOString()
      : null;

  return {
    id: share.id,
    token: share.token,
    status: share.status,
    mode: share.mode,
    origin: {
      name: share.originName,
      lat: share.originLat,
      lng: share.originLng,
    },
    destination: {
      name: share.destinationName,
      address: share.destinationAddress,
      lat: share.destinationLat,
      lng: share.destinationLng,
    },
    traveler: {
      username: share.user.username,
      displayName: share.user.displayName,
      avatarUrl: share.user.avatarUrl,
    },
    current:
      active && share.currentLat !== null && share.currentLng !== null
        ? {
            lat: share.currentLat,
            lng: share.currentLng,
            accuracy: share.accuracyMeters,
            heading: share.headingDegrees,
          }
        : null,
    routePath: active ? readRoutePath(share.routePath) : null,
    routeDistanceMeters: share.routeDistanceMeters,
    routeDurationSeconds: share.routeDurationSeconds,
    remainingMeters: active ? share.remainingMeters : null,
    remainingSeconds: active ? share.remainingSeconds : null,
    delayMinutes: share.delayMinutes,
    note: share.note,
    lastFixAt: share.lastFixAt?.toISOString() ?? null,
    lastFixAgoSeconds,
    live,
    estimatedArrivalAt,
    arrivedAt: share.arrivedAt?.toISOString() ?? null,
    endedAt: share.endedAt?.toISOString() ?? null,
    expiresAt: share.expiresAt.toISOString(),
    createdAt: share.createdAt.toISOString(),
    isOwner: share.userId === options.viewerId,
  };
}

const shareInclude = {
  user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
} satisfies Prisma.TripShareInclude;

// POST /api/trip-shares
tripSharesRouter.post(
  "/",
  requireAuth,
  writeLimiter,
  validate(createSchema),
  asyncHandler(async (req, res) => {
    const data = req.body as z.infer<typeof createSchema>;
    const expiresAt = new Date(Date.now() + data.expiresInMinutes * 60 * 1000);
    const routePath = data.routePath?.length
      ? (simplifyRoute(data.routePath) as Prisma.InputJsonValue)
      : undefined;

    const share = await prisma.tripShare.create({
      data: {
        token: newToken(),
        userId: req.userId!,
        originName: data.originName,
        originLat: data.origin.lat,
        originLng: data.origin.lng,
        destinationName: data.destinationName,
        destinationAddress: data.destinationAddress ?? null,
        destinationLat: data.destination.lat,
        destinationLng: data.destination.lng,
        mode: data.mode,
        routePath,
        routeDistanceMeters:
          data.routeDistanceMeters !== undefined ? Math.round(data.routeDistanceMeters) : undefined,
        routeDurationSeconds:
          data.routeDurationSeconds !== undefined ? Math.round(data.routeDurationSeconds) : undefined,
        currentLat: data.fix?.lat,
        currentLng: data.fix?.lng,
        accuracyMeters: data.fix?.accuracy ?? null,
        headingDegrees: data.fix?.heading ?? null,
        lastFixAt: data.fix ? new Date() : null,
        remainingMeters:
          data.remainingMeters !== undefined ? Math.round(data.remainingMeters) : undefined,
        remainingSeconds:
          data.remainingSeconds !== undefined ? Math.round(data.remainingSeconds) : undefined,
        expiresAt,
      },
      include: shareInclude,
    });

    res.status(201).json({
      share: serializeShare(share, { viewerId: req.userId, serverNow: new Date() }),
    });
  }),
);

// PATCH /api/trip-shares/:id — the traveler's phone posts a fresh fix.
tripSharesRouter.patch(
  "/:id",
  requireAuth,
  writeLimiter,
  validate(idParams, "params"),
  validate(updateSchema),
  asyncHandler(async (req, res) => {
    const share = await ownedShare(req.userId!, req.params.id);
    if (share.status !== TripShareStatus.ACTIVE) {
      throw new ApiError(409, "This live link is no longer active.", "TRIP_NOT_ACTIVE");
    }

    const data = req.body as z.infer<typeof updateSchema>;
    const routePath = data.routePath?.length
      ? (simplifyRoute(data.routePath) as Prisma.InputJsonValue)
      : undefined;

    const updated = await prisma.tripShare.update({
      where: { id: share.id },
      data: {
        currentLat: data.fix.lat,
        currentLng: data.fix.lng,
        accuracyMeters: data.fix.accuracy ?? null,
        headingDegrees: data.fix.heading ?? null,
        lastFixAt: new Date(),
        remainingMeters:
          data.remainingMeters !== undefined && data.remainingMeters !== null
            ? Math.round(data.remainingMeters)
            : undefined,
        remainingSeconds:
          data.remainingSeconds !== undefined && data.remainingSeconds !== null
            ? Math.round(data.remainingSeconds)
            : undefined,
        ...(routePath !== undefined
          ? {
              routePath,
              routeDistanceMeters:
                data.routeDistanceMeters !== undefined
                  ? Math.round(data.routeDistanceMeters)
                  : undefined,
              routeDurationSeconds:
                data.routeDurationSeconds !== undefined
                  ? Math.round(data.routeDurationSeconds)
                  : undefined,
            }
          : {}),
      },
      include: shareInclude,
    });

    res.json({
      share: serializeShare(updated, { viewerId: req.userId, serverNow: new Date() }),
    });
  }),
);

// POST /api/trip-shares/:id/arrive — the traveler has reached the destination.
tripSharesRouter.post(
  "/:id/arrive",
  requireAuth,
  writeLimiter,
  validate(idParams, "params"),
  asyncHandler(async (req, res) => {
    const share = await ownedShare(req.userId!, req.params.id);
    if (share.status !== TripShareStatus.ACTIVE) {
      throw new ApiError(409, "This live link is no longer active.", "TRIP_NOT_ACTIVE");
    }

    const updated = await prisma.tripShare.update({
      where: { id: share.id },
      data: {
        status: TripShareStatus.ARRIVED,
        arrivedAt: new Date(),
        remainingMeters: 0,
        remainingSeconds: 0,
      },
      include: shareInclude,
    });

    res.json({
      share: serializeShare(updated, { viewerId: req.userId, serverNow: new Date() }),
    });
  }),
);

// POST /api/trip-shares/:id/end — stop sharing immediately.
tripSharesRouter.post(
  "/:id/end",
  requireAuth,
  writeLimiter,
  validate(idParams, "params"),
  asyncHandler(async (req, res) => {
    const share = await ownedShare(req.userId!, req.params.id);
    if (share.status === TripShareStatus.ENDED || share.status === TripShareStatus.EXPIRED) {
      throw new ApiError(409, "This live link is already closed.", "TRIP_CLOSED");
    }

    const updated = await prisma.tripShare.update({
      where: { id: share.id },
      data: {
        status: TripShareStatus.ENDED,
        endedAt: new Date(),
        currentLat: null,
        currentLng: null,
        accuracyMeters: null,
        headingDegrees: null,
      },
      include: shareInclude,
    });

    res.json({
      share: serializeShare(updated, { viewerId: req.userId, serverNow: new Date() }),
    });
  }),
);

// POST /api/trip-shares/:id/late — a short, human status for the watcher.
tripSharesRouter.post(
  "/:id/late",
  requireAuth,
  writeLimiter,
  validate(idParams, "params"),
  validate(lateSchema),
  asyncHandler(async (req, res) => {
    const share = await ownedShare(req.userId!, req.params.id);
    if (share.status !== TripShareStatus.ACTIVE) {
      throw new ApiError(409, "This live link is no longer active.", "TRIP_NOT_ACTIVE");
    }

    const data = req.body as z.infer<typeof lateSchema>;
    const updated = await prisma.tripShare.update({
      where: { id: share.id },
      data: {
        delayMinutes: data.minutes,
        note: data.note ?? `Running about ${data.minutes} minutes late.`,
      },
      include: shareInclude,
    });

    res.json({
      share: serializeShare(updated, { viewerId: req.userId, serverNow: new Date() }),
    });
  }),
);

// GET /api/trip-shares/:token — the public safety page polls this.
tripSharesRouter.get(
  "/:token",
  validate(tokenParams, "params"),
  asyncHandler(async (req, res) => {
    const serverNow = new Date();
    let share = await prisma.tripShare.findUnique({
      where: { token: req.params.token },
      include: shareInclude,
    });

    if (!share) throw ApiError.notFound("This live link is not valid.");

    if (share.status === TripShareStatus.ACTIVE && share.expiresAt <= serverNow) {
      share = await prisma.tripShare.update({
        where: { id: share.id },
        data: {
          status: TripShareStatus.EXPIRED,
          currentLat: null,
          currentLng: null,
          accuracyMeters: null,
          headingDegrees: null,
        },
        include: shareInclude,
      });
    }

    if (share.status === TripShareStatus.EXPIRED) {
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("X-Robots-Tag", "noindex, nofollow");
      throw new ApiError(
        410,
        "This live link has expired. Ask the traveler to share a new one.",
        "TRIP_EXPIRED",
      );
    }

    const point =
      share.currentLat !== null && share.currentLng !== null
        ? { lat: share.currentLat, lng: share.currentLng }
        : share.status === TripShareStatus.ARRIVED
          ? { lat: share.destinationLat, lng: share.destinationLng }
          : { lat: share.originLat, lng: share.originLng };

    const safety = await nearestSafetyPlaces(point).catch(() => ({
      hospital: null,
      pharmacy: null,
    }));

    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
    res.json({
      trip: serializeShare(share, { viewerId: req.userId, serverNow }),
      safety,
      serverTime: serverNow.toISOString(),
    });
  }),
);
