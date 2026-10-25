import { Router } from "express";
import { PlaceKind } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/async-handler";
import { ApiError } from "../lib/errors";
import { validate } from "../middleware/validate";

export const placesRouter = Router();

const EARTH_RADIUS_KM = 6371;

/** Great-circle distance, the only maths a "near me" list needs. */
export function distanceKm(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

const listQuery = z.object({
  kind: z.nativeEnum(PlaceKind).optional(),
  city: z.string().min(1).max(80).optional(),
  q: z.string().min(1).max(120).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  sort: z.enum(["distance", "rating", "name"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  live: z.coerce.boolean().optional(),
});

placesRouter.post(
  "/sync-osm",
  validate(
    z.object({
      kind: z.nativeEnum(PlaceKind).optional(),
      city: z.string().min(1).max(80).optional(),
      lat: z.number().min(-90).max(90).optional(),
      lng: z.number().min(-180).max(180).optional(),
      q: z.string().min(1).max(120).optional(),
      limit: z.number().int().min(1).max(50).optional(),
    }),
    "body",
  ),
  asyncHandler(async (req, res) => {
    const { syncLivePlacesFromOsm } = await import("../services/osm");
    const { kind, city, lat, lng, q, limit } = req.body;
    const places = await syncLivePlacesFromOsm({ kind, city, lat, lng, q, limit });
    res.json({
      success: true,
      count: places.length,
      places,
    });
  }),
);

placesRouter.get(
  "/",
  validate(listQuery, "query"),
  asyncHandler(async (req, res) => {
    const { kind, city, q, lat, lng, sort, limit, live } = req.query as unknown as z.infer<
      typeof listQuery
    >;
    const term = q?.trim();

    // If live OpenStreetMap sync is explicitly requested, fetch and persist to DB first
    if (live) {
      try {
        const { syncLivePlacesFromOsm } = await import("../services/osm");
        await syncLivePlacesFromOsm({ kind, city, lat, lng, q: term, limit: limit ?? 20 });
      } catch (err) {
        console.warn("[placesRouter] Live OSM sync failed:", err);
      }
    }

    const [rows, kindCounts, cityRows] = await Promise.all([
      prisma.place.findMany({
        where: {
          ...(kind ? { kind } : {}),
          ...(city ? { city } : {}),
          ...(term
            ? {
                OR: [
                  { name: { contains: term, mode: "insensitive" } },
                  { area: { contains: term, mode: "insensitive" } },
                  { description: { contains: term, mode: "insensitive" } },
                  { tags: { has: term.toLowerCase() } },
                ],
              }
            : {}),
        },
        orderBy: [{ featured: "desc" }, { rating: "desc" }, { name: "asc" }],
      }),
      prisma.place.groupBy({ by: ["kind"], _count: { _all: true } }),
      prisma.place.findMany({ distinct: ["city"], select: { city: true }, orderBy: { city: "asc" } }),
    ]);

    const origin = lat !== undefined && lng !== undefined ? { lat, lng } : null;

    const places = rows.map((place) => ({
      ...place,
      distanceKm: origin ? Number(distanceKm(origin, place).toFixed(1)) : null,
    }));

    if (sort === "name") {
      places.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sort === "distance" && origin) {
      places.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
    }

    res.json({
      places: places.slice(0, limit ?? 60),
      filters: {
        kinds: kindCounts.map((row) => ({ kind: row.kind, count: row._count._all })),
        cities: cityRows.map((row) => row.city),
        total: rows.length,
        origin,
      },
    });
  }),
);

placesRouter.get(
  "/areas",
  asyncHandler(async (_req, res) => {
    // A coordinate per neighbourhood, averaged over the places already in the
    // directory. Phones refuse to share GPS over plain HTTP, so this is how a
    // "near me" sort still works there: pick an area instead.
    const groups = await prisma.place.groupBy({
      by: ["city", "area"],
      where: { area: { not: null } },
      _avg: { lat: true, lng: true },
      _count: { _all: true },
    });

    const areas = groups
      .filter(
        (group) =>
          group.area &&
          // A single place with an odd OSM label ("4", "foot path") is noise in
          // a picker; two or more means people actually know the area.
          group._count._all >= 2 &&
          group.area.trim().length >= 3 &&
          group._avg.lat !== null &&
          group._avg.lng !== null,
      )
      .map((group) => ({
        city: group.city,
        area: group.area as string,
        lat: Number(group._avg.lat!.toFixed(5)),
        lng: Number(group._avg.lng!.toFixed(5)),
        count: group._count._all,
      }))
      .sort((a, b) => b.count - a.count || a.area.localeCompare(b.area))
      .slice(0, 60);

    res.json({ areas });
  }),
);

placesRouter.get(
  "/:slug",
  validate(z.object({ slug: z.string().min(1).max(120) }), "params"),
  asyncHandler(async (req, res) => {
    const place = await prisma.place.findUnique({ where: { slug: String(req.params.slug) } });
    if (!place) throw ApiError.notFound("We don't have that place yet.");

    const nearby = await prisma.place.findMany({
      where: { kind: place.kind, id: { not: place.id } },
      take: 4,
      orderBy: { rating: "desc" },
    });

    res.json({
      place,
      nearby: nearby.map((item) => ({
        ...item,
        distanceKm: Number(distanceKm(place, item).toFixed(1)),
      })),
    });
  }),
);
