import { ApiError } from "../lib/errors";
import { prisma } from "../lib/prisma";

export interface GeocodeLocation {
  lat: number;
  lng: number;
  displayName: string;
}

const ENDPOINT = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "AddisGebeta/1.0 (community place navigation)";
const CACHE_TTL_MS = 7 * 24 * 60 * 60_000;
const MISS_TTL_MS = 6 * 60 * 60_000;
const CACHE_LIMIT = 500;
/** Nominatim's usage policy asks for at most one request per second. */
const MIN_INTERVAL_MS = 1100;
const DEFAULT_TIMEOUT_MS = 6000;

interface NominatimRow {
  lat: string;
  lon: string;
  display_name?: string;
  name?: string;
  address?: { country_code?: string };
}

const cache = new Map<string, { expires: number; value: GeocodeLocation | null }>();

let lastRequestAt = 0;
let queue: Promise<unknown> = Promise.resolve();

/** Serialises lookups so a burst of event clicks never floods Nominatim. */
function schedule<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const wait = MIN_INTERVAL_MS - (Date.now() - lastRequestAt);
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    lastRequestAt = Date.now();
    return task();
  });
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

/** "Venue to be announced" is a placeholder, not a place worth geocoding. */
const NOT_A_VENUE =
  /^(tba|tbc|n\/?a|to be (announced|confirmed)|venue to be announced|online|virtual)$/i;

export function isGeocodable(query: string): boolean {
  const value = query.trim();
  return value.length >= 3 && !NOT_A_VENUE.test(value);
}

function normalise(query: string): string {
  return query.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Nominatim treats "Venue, City" as one string and often finds nothing, while
 * the venue alone resolves cleanly. The city is skipped as a standalone
 * candidate: it would only produce a city-centre pin kilometres from the door.
 */
const CITY_NAMES = new Set([
  "addis ababa",
  "adama",
  "hawassa",
  "bahir dar",
  "gondar",
  "mekelle",
  "mekele",
  "dire dawa",
  "jimma",
  "harar",
  "arba minch",
  "bishoftu",
  "dessie",
  "jijiga",
  "shashemene",
  "sodo",
  "axum",
  "lalibela",
  "yirga alem",
]);

function candidateQueries(query: string): string[] {
  const full = query.trim();
  const candidates = [full];

  for (const raw of full.split(",")) {
    const part = raw.trim();
    if (part.length < 3 || CITY_NAMES.has(part.toLowerCase())) continue;
    if (candidates.some((candidate) => normalise(candidate) === normalise(part))) continue;
    candidates.push(part);
  }

  return candidates.slice(0, 4);
}

/**
 * The directory already knows the exact pin for hundreds of venues, so an
 * event location that names one of them never needs an external lookup.
 */
async function matchKnownPlace(candidates: string[]): Promise<GeocodeLocation | null> {
  if (candidates.length === 0) return null;
  const place = await prisma.place.findFirst({
    where: {
      OR: candidates.map((name) => ({ name: { equals: name, mode: "insensitive" as const } })),
    },
    select: { name: true, lat: true, lng: true, address: true, city: true },
  });
  if (!place) return null;
  return {
    lat: place.lat,
    lng: place.lng,
    displayName: place.address ? `${place.name}, ${place.address}` : `${place.name}, ${place.city}`,
  };
}

async function request(query: string, timeoutMs: number): Promise<GeocodeLocation | null> {
  const params = new URLSearchParams({
    q: query,
    format: "jsonv2",
    // Imported sport fixtures name stadiums around the world, so the lookup is
    // global; an Ethiopian result is preferred when both exist.
    limit: "5",
    addressdetails: "1",
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${ENDPOINT}?${params.toString()}`, {
      signal: controller.signal,
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`Nominatim answered ${response.status}`);

    const rows = (await response.json()) as NominatimRow[];
    const first = rows.find((row) => row.address?.country_code === "et") ?? rows[0];
    if (!first) return null;

    const lat = Number(first.lat);
    const lng = Number(first.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    return { lat, lng, displayName: first.display_name ?? first.name ?? query };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Resolves a free-text venue ("Bole Medhane Alem, Addis Ababa") to a pin.
 * Results, including misses, are cached so the same event never asks twice.
 */
export async function geocodeVenue(
  query: string,
  options: { timeoutMs?: number } = {},
): Promise<GeocodeLocation | null> {
  if (!isGeocodable(query)) return null;

  const key = normalise(query);
  const candidates = candidateQueries(query);

  const remember = (cacheKey: string, value: GeocodeLocation | null) => {
    cache.set(cacheKey, {
      expires: Date.now() + (value ? CACHE_TTL_MS : MISS_TTL_MS),
      value,
    });
    if (cache.size > CACHE_LIMIT) {
      const oldest = cache.keys().next().value;
      if (oldest) cache.delete(oldest);
    }
  };

  const known = await matchKnownPlace(candidates);
  if (known) {
    remember(key, known);
    return known;
  }

  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;

  for (const candidate of candidates) {
    const candidateKey = normalise(candidate);
    const cachedCandidate = cache.get(candidateKey);
    if (cachedCandidate && cachedCandidate.expires > Date.now()) {
      if (!cachedCandidate.value) continue;
      remember(key, cachedCandidate.value);
      return cachedCandidate.value;
    }

    let value: GeocodeLocation | null;
    try {
      value = await schedule(() =>
        request(candidate, options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
      );
    } catch (error) {
      console.error("[geocode] lookup failed", error);
      throw new ApiError(
        503,
        "The address lookup service is unavailable right now. Try again in a moment.",
        "GEOCODE_UNAVAILABLE",
      );
    }

    remember(candidateKey, value);
    if (value) {
      remember(key, value);
      return value;
    }
  }

  remember(key, null);
  return null;
}
