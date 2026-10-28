import type { DirectionsRoute, RoutePoint, RouteStep, TravelMode } from "../types";

export interface NavigationTarget extends RoutePoint {
  name: string;
  address?: string | null;
  placeSlug?: string | null;
  eventSlug?: string | null;
}

/** A shareable link that opens in-app navigation straight to a pin. */
export function navigationPath(target: NavigationTarget): string {
  const params = new URLSearchParams();
  params.set("to", `${target.lat.toFixed(6)},${target.lng.toFixed(6)}`);
  if (target.name) params.set("name", target.name);
  if (target.address) params.set("address", target.address);
  if (target.placeSlug) params.set("place", target.placeSlug);
  if (target.eventSlug) params.set("event", target.eventSlug);
  return `/navigate?${params.toString()}`;
}

export function parsePoint(value: string | null): RoutePoint | null {
  if (!value) return null;
  const [latRaw, lngRaw] = value.split(",");
  const lat = Number(latRaw);
  const lng = Number(lngRaw);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

/** The backup people reach for when the router has no answer. */
export function googleDirectionsHref(point: RoutePoint, mode: TravelMode = "driving"): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${point.lat},${point.lng}&travelmode=${
    mode === "walking" ? "walking" : "driving"
  }`;
}

export function googleAddressHref(address: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
}

export interface AddressTarget {
  name: string;
  address: string;
  placeSlug?: string | null;
  eventSlug?: string | null;
}

/** A navigation link for a venue we only know by name — the API geocodes it. */
export function addressNavigationPath(target: AddressTarget): string {
  const params = new URLSearchParams();
  params.set("name", target.name);
  params.set("address", target.address);
  if (target.placeSlug) params.set("place", target.placeSlug);
  if (target.eventSlug) params.set("event", target.eventSlug);
  return `/navigate?${params.toString()}`;
}

const PLACEHOLDER_VENUE =
  /^(tba|tbc|n\/?a|to be (announced|confirmed)|venue to be announced|online|virtual)$/i;

/**
 * Where an event or meetup's Navigate action points. Linked places and stored
 * coordinates win; a free-text venue is handed to the address geocoder.
 */
export function eventNavigationPath(event: {
  slug: string;
  location: string;
  lat: number | null;
  lng: number | null;
  place: { name: string; slug: string; lat: number; lng: number } | null;
}): string | null {
  if (event.place) {
    return navigationPath({
      name: event.place.name,
      lat: event.place.lat,
      lng: event.place.lng,
      placeSlug: event.place.slug,
      address: event.location,
      eventSlug: event.slug,
    });
  }

  if (event.lat !== null && event.lng !== null) {
    return navigationPath({
      name: event.location,
      lat: event.lat,
      lng: event.lng,
      address: event.location,
      eventSlug: event.slug,
    });
  }

  const address = event.location.trim();
  if (address.length < 3 || PLACEHOLDER_VENUE.test(address)) return null;
  return addressNavigationPath({ name: address, address, eventSlug: event.slug });
}

const EARTH_RADIUS_M = 6_371_008.8;
const METERS_PER_DEGREE = (Math.PI / 180) * EARTH_RADIUS_M;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function metersBetween(a: RoutePoint, b: RoutePoint): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const meanLat = toRadians((a.lat + b.lat) / 2);
  const x = dLng * Math.cos(meanLat);
  return Math.sqrt(x * x + dLat * dLat) * EARTH_RADIUS_M;
}

export interface RouteMetrics {
  /** Distance from the start of the route to each vertex, in metres. */
  cumulative: number[];
  totalMeters: number;
}

export function buildRouteMetrics(path: RoutePoint[]): RouteMetrics {
  const cumulative = [0];
  for (let index = 1; index < path.length; index += 1) {
    cumulative.push(cumulative[index - 1] + metersBetween(path[index - 1], path[index]));
  }
  return { cumulative, totalMeters: cumulative[cumulative.length - 1] ?? 0 };
}

export interface RouteLocation {
  /** How far along the route the nearest point lies. */
  traveledMeters: number;
  /** Straight-line distance from the position to the route. */
  offRouteMeters: number;
  snapped: RoutePoint;
}

/**
 * Projects a GPS fix onto the route polyline. Keeping the projection in local
 * metres is accurate enough at city scale and avoids per-vertex trigonometry.
 */
export function locateOnRoute(
  path: RoutePoint[],
  metrics: RouteMetrics,
  point: RoutePoint,
): RouteLocation {
  if (path.length === 0) {
    return { traveledMeters: 0, offRouteMeters: Number.POSITIVE_INFINITY, snapped: point };
  }
  if (path.length === 1) {
    return {
      traveledMeters: 0,
      offRouteMeters: metersBetween(point, path[0]),
      snapped: path[0],
    };
  }

  const metersPerLng = METERS_PER_DEGREE * Math.cos(toRadians(point.lat));
  let bestDistanceSq = Number.POSITIVE_INFINITY;
  let bestIndex = 0;
  let bestT = 0;

  for (let index = 0; index < path.length - 1; index += 1) {
    const a = path[index];
    const b = path[index + 1];
    const ax = (a.lng - point.lng) * metersPerLng;
    const ay = (a.lat - point.lat) * METERS_PER_DEGREE;
    const bx = (b.lng - point.lng) * metersPerLng;
    const by = (b.lat - point.lat) * METERS_PER_DEGREE;
    const dx = bx - ax;
    const dy = by - ay;
    const lengthSq = dx * dx + dy * dy;
    const t = lengthSq === 0 ? 0 : Math.min(1, Math.max(0, -(ax * dx + ay * dy) / lengthSq));
    const px = ax + t * dx;
    const py = ay + t * dy;
    const distanceSq = px * px + py * py;
    if (distanceSq < bestDistanceSq) {
      bestDistanceSq = distanceSq;
      bestIndex = index;
      bestT = t;
    }
  }

  const start = path[bestIndex];
  const end = path[bestIndex + 1];
  const segmentMeters = metersBetween(start, end);
  return {
    traveledMeters: metrics.cumulative[bestIndex] + segmentMeters * bestT,
    offRouteMeters: Math.sqrt(bestDistanceSq),
    snapped: {
      lat: start.lat + (end.lat - start.lat) * bestT,
      lng: start.lng + (end.lng - start.lng) * bestT,
    },
  };
}

export function remainingMetersOf(route: DirectionsRoute, traveledMeters: number): number {
  return Math.max(0, route.distanceMeters - traveledMeters);
}

/** Route ETA is derived from the same distance/time ratio the router returned. */
export function remainingSecondsOf(route: DirectionsRoute, traveledMeters: number): number {
  if (route.distanceMeters <= 0) return 0;
  const ratio = Math.min(1, Math.max(0, traveledMeters / route.distanceMeters));
  return Math.max(0, route.durationSeconds * (1 - ratio));
}

export function formatRouteDistance(meters: number): string {
  if (!Number.isFinite(meters)) return "—";
  if (meters < 950) return `${Math.max(10, Math.round(meters / 10) * 10)} m`;
  if (meters < 10_000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters / 1000)} km`;
}

export function formatRouteDuration(seconds: number): string {
  if (!Number.isFinite(seconds)) return "—";
  const minutes = Math.round(seconds / 60);
  if (minutes < 1) return "<1 min";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
}

export function arrivalClock(secondsFromNow: number): string {
  const arrival = new Date(Date.now() + Math.max(0, secondsFromNow) * 1000);
  return arrival.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

const MODIFIER_WORDS: Record<string, string> = {
  left: "left",
  right: "right",
  "slight left": "slightly left",
  "slight right": "slightly right",
  "sharp left": "sharply left",
  "sharp right": "sharply right",
  straight: "straight",
  uturn: "around",
};

export type StepShape =
  | "depart"
  | "arrive"
  | "left"
  | "right"
  | "straight"
  | "roundabout"
  | "merge"
  | "ramp";

/** One sentence people can act on, in the order a driver needs it. */
export function stepInstruction(
  step: RouteStep,
  destinationName: string,
): string {
  const name = step.name.trim();
  const modifier = step.modifier ? MODIFIER_WORDS[step.modifier] ?? step.modifier : "";
  const onto = name ? ` onto ${name}` : "";
  const on = name ? ` on ${name}` : "";

  switch (step.type) {
    case "depart":
      return name ? `Start on ${name}` : "Start here";
    case "arrive":
      return `Arrive at ${destinationName}`;
    case "turn":
      return modifier ? `Turn ${modifier}${onto}` : `Turn${onto}`;
    case "end of road":
      return modifier ? `At the end of the road, turn ${modifier}${onto}` : `Continue${onto}`;
    case "continue":
      return modifier && modifier !== "straight"
        ? `Continue ${modifier}${onto}`
        : `Continue${on}`;
    case "new name":
      return `Continue${onto}`;
    case "merge":
      return modifier ? `Merge ${modifier}${onto}` : `Merge${onto}`;
    case "fork":
      return modifier ? `Keep ${modifier}${onto}` : `Keep straight${onto}`;
    case "on ramp":
      return `Take the ramp${onto}`;
    case "off ramp":
      return `Take the exit${onto}`;
    case "roundabout":
    case "rotary": {
      const exit = step.exit ? `take exit ${step.exit}` : "continue";
      return `At the roundabout, ${exit}${onto}`;
    }
    case "roundabout turn":
      return `At the roundabout, turn ${modifier || "ahead"}${onto}`;
    case "notification":
      return `Continue${onto || on}`;
    default:
      return `${step.type.charAt(0).toUpperCase()}${step.type.slice(1)}${onto}`;
  }
}

export function stepShape(step: RouteStep): StepShape {
  if (step.type === "depart") return "depart";
  if (step.type === "arrive") return "arrive";
  if (step.type === "roundabout" || step.type === "rotary" || step.type === "roundabout turn") {
    return "roundabout";
  }
  if (step.type === "merge" || step.type === "fork") return "merge";
  if (step.type === "on ramp" || step.type === "off ramp") return "ramp";
  if (step.modifier?.includes("left")) return "left";
  if (step.modifier?.includes("right")) return "right";
  return "straight";
}

/** Short line under an instruction: the street, then the length of the leg. */
export function stepCaption(step: RouteStep): string {
  const length = step.distanceMeters > 5 ? formatRouteDistance(step.distanceMeters) : "";
  if (step.type === "arrive") return "You have arrived";
  return length ? `Continue for ${length}` : "Then continue";
}
