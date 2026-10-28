import { ApiError } from "../lib/errors";

export type TravelMode = "driving" | "walking";

export interface RoutePoint {
  lat: number;
  lng: number;
}

export interface RouteStep {
  /** OSRM maneuver type: depart, turn, continue, merge, roundabout, arrive… */
  type: string;
  modifier: string | null;
  exit: number | null;
  name: string;
  distanceMeters: number;
  durationSeconds: number;
  location: RoutePoint;
}

export interface DirectionsRoute {
  mode: TravelMode;
  distanceMeters: number;
  durationSeconds: number;
  /** Ready for Leaflet: every turn-by-turn route in one polyline. */
  path: RoutePoint[];
  steps: RouteStep[];
  bounds: { south: number; west: number; north: number; east: number };
}

interface OsrmStep {
  distance: number;
  duration: number;
  name: string;
  maneuver: {
    type: string;
    modifier?: string;
    exit?: number;
    location: [number, number];
  };
}

interface OsrmRoute {
  distance: number;
  duration: number;
  geometry: { coordinates: [number, number][] };
  legs: { steps: OsrmStep[] }[];
}

interface OsrmResponse {
  code: string;
  message?: string;
  routes?: OsrmRoute[];
}

/**
 * The FOSSGIS OSRM instance is the only public router that exposes a real
 * walking profile; the OSRM demo server only has cars, so it is the driving
 * fallback. Both are free and keyless, which keeps navigation working for
 * guests without an API account.
 */
const PROVIDERS: Record<TravelMode, string[]> = {
  driving: [
    "https://routing.openstreetmap.de/routed-car/route/v1/driving",
    "https://router.project-osrm.org/route/v1/driving",
  ],
  walking: ["https://routing.openstreetmap.de/routed-foot/route/v1/driving"],
};

const USER_AGENT = "AddisGebeta/1.0 (community place navigation)";
const REQUEST_TIMEOUT_MS = 12_000;
const CACHE_TTL_MS = 5 * 60_000;
const CACHE_LIMIT = 250;

const cache = new Map<string, { expires: number; routes: DirectionsRoute[] }>();

function cacheKey(from: RoutePoint, to: RoutePoint, mode: TravelMode): string {
  const round = (value: number) => value.toFixed(5);
  return `${mode}:${round(from.lat)},${round(from.lng)}:${round(to.lat)},${round(to.lng)}`;
}

function remember(key: string, routes: DirectionsRoute[]): void {
  const now = Date.now();
  for (const [entryKey, entry] of cache) {
    if (entry.expires <= now) cache.delete(entryKey);
  }
  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, { expires: now + CACHE_TTL_MS, routes });
}

function toPoint(coordinate: [number, number]): RoutePoint {
  // OSRM speaks GeoJSON, which orders coordinates longitude-first.
  return { lat: coordinate[1], lng: coordinate[0] };
}

async function requestOsrm(url: string): Promise<OsrmResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error(`Routing provider answered ${response.status}`);
    }
    return (await response.json()) as OsrmResponse;
  } finally {
    clearTimeout(timer);
  }
}

function toRoute(raw: OsrmRoute, mode: TravelMode): DirectionsRoute {
  const path = (raw.geometry?.coordinates ?? []).map(toPoint);
  if (path.length < 2) {
    throw new Error("Routing provider returned an empty geometry");
  }

  const steps: RouteStep[] = [];
  for (const leg of raw.legs ?? []) {
    for (const step of leg.steps ?? []) {
      steps.push({
        type: step.maneuver?.type ?? "continue",
        modifier: step.maneuver?.modifier ?? null,
        exit: step.maneuver?.exit ?? null,
        name: step.name ?? "",
        distanceMeters: step.distance ?? 0,
        durationSeconds: step.duration ?? 0,
        location: toPoint(step.maneuver?.location ?? [path[0].lng, path[0].lat]),
      });
    }
  }

  let south = path[0].lat;
  let north = path[0].lat;
  let west = path[0].lng;
  let east = path[0].lng;
  for (const point of path) {
    south = Math.min(south, point.lat);
    north = Math.max(north, point.lat);
    west = Math.min(west, point.lng);
    east = Math.max(east, point.lng);
  }

  return {
    mode,
    distanceMeters: raw.distance,
    durationSeconds: raw.duration,
    path,
    steps,
    bounds: { south, west, north, east },
  };
}

async function fetchRoutes(
  base: string,
  from: RoutePoint,
  to: RoutePoint,
  mode: TravelMode,
): Promise<DirectionsRoute[]> {
  const coordinates = `${from.lng.toFixed(5)},${from.lat.toFixed(5)};${to.lng.toFixed(
    5,
  )},${to.lat.toFixed(5)}`;
  const params = new URLSearchParams({
    overview: "full",
    geometries: "geojson",
    steps: "true",
    // OSRM offers at most two alternatives beyond the best route. The planner
    // lists them, and navigation re-requests the same set to honour a choice.
    alternatives: "true",
    annotations: "false",
  });
  const data = await requestOsrm(`${base}/${coordinates}?${params.toString()}`);

  if (data.code === "NoRoute" || data.code === "NoSegment") {
    throw new ApiError(
      422,
      "No road route connects those two pins. The map may be missing a road there — open Google Maps as a backup.",
      "NO_ROUTE",
    );
  }
  if (data.code !== "Ok") {
    throw new Error(`Routing provider returned ${data.code}`);
  }

  const routes = (data.routes ?? []).slice(0, 3).map((raw) => toRoute(raw, mode));
  if (routes.length === 0) throw new Error("Routing provider returned no route");
  return routes;
}

/**
 * Every route the router can offer for a pair of pins, best first. Routes are
 * cached briefly because the planner, the map and a live reroute all ask for
 * the same pair.
 */
export async function getRoutes(
  from: RoutePoint,
  to: RoutePoint,
  mode: TravelMode,
): Promise<DirectionsRoute[]> {
  const key = cacheKey(from, to, mode);
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return cached.routes;

  let lastError: unknown = null;
  let sawNoRoute: ApiError | null = null;

  for (const provider of PROVIDERS[mode]) {
    try {
      const routes = await fetchRoutes(provider, from, to, mode);
      remember(key, routes);
      return routes;
    } catch (error) {
      lastError = error;
      if (error instanceof ApiError && error.code === "NO_ROUTE") {
        sawNoRoute = error;
      }
    }
  }

  if (sawNoRoute) throw sawNoRoute;
  console.error("[directions] every routing provider failed", lastError);
  throw new ApiError(
    503,
    "The routing service is unavailable right now. You can still open this destination in Google Maps.",
    "ROUTING_UNAVAILABLE",
  );
}

/** Turn-by-turn directions for the best route between two pins. */
export async function getDirections(
  from: RoutePoint,
  to: RoutePoint,
  mode: TravelMode,
): Promise<DirectionsRoute> {
  const [first] = await getRoutes(from, to, mode);
  return first;
}
