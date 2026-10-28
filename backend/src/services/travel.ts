import { getRoutes, type RoutePoint } from "./directions";
import {
  estimateCongestion,
  trafficContext,
  walkingReport,
  type TrafficContext,
  type TrafficReport,
} from "./traffic";

export type PlanMode = "taxi" | "bus" | "walking";

export interface PlannedRoute {
  /** Position in the router's alternative list — navigation re-requests it. */
  index: number;
  label: string;
  mode: PlanMode;
  distanceMeters: number;
  /** Router time before traffic and boarding overhead. */
  baseDurationSeconds: number;
  durationSeconds: number;
  path: RoutePoint[];
  traffic: TrafficReport;
  recommended: boolean;
  reason: string | null;
}

export interface TravelPlan {
  from: RoutePoint;
  to: RoutePoint;
  mode: PlanMode;
  routes: PlannedRoute[];
  recommendedIndex: number;
  traffic: TrafficReport;
  context: TrafficContext;
  disclaimer: string;
}

/** Taxi: a few minutes to be picked up. Bus: walk to the stop and wait. */
const PICKUP_SECONDS = 3 * 60;
const BUS_WAIT_SECONDS = 8 * 60;
const BUS_ROAD_FACTOR = 1.2;

const LETTERS = "ABCDEFGH";

function mainRoad(steps: { name: string; distanceMeters: number; type: string }[]): string {
  const usable = steps.filter(
    (step) => step.name.trim().length >= 3 && step.type !== "arrive" && step.type !== "depart",
  );
  const longest = usable.reduce<(typeof usable)[number] | null>(
    (best, step) => (!best || step.distanceMeters > best.distanceMeters ? step : best),
    null,
  );
  return longest?.name.trim() ?? "";
}

function adjustedDuration(
  mode: PlanMode,
  baseSeconds: number,
  traffic: TrafficReport,
): number {
  if (mode === "walking") return baseSeconds;
  if (mode === "taxi") return baseSeconds + traffic.delaySeconds + PICKUP_SECONDS;
  return Math.round(baseSeconds * BUS_ROAD_FACTOR) + traffic.delaySeconds + BUS_WAIT_SECONDS;
}

export async function planTrip(
  from: RoutePoint,
  to: RoutePoint,
  mode: PlanMode,
  now: Date = new Date(),
): Promise<TravelPlan> {
  const routes = await getRoutes(from, to, mode === "walking" ? "walking" : "driving");

  const planned: PlannedRoute[] = routes.map((route, index) => {
    const traffic = mode === "walking" ? walkingReport() : estimateCongestion(route, now);
    const road = mainRoad(route.steps);
    return {
      index,
      label: road ? `via ${road}` : `Route ${LETTERS[index] ?? index + 1}`,
      mode,
      distanceMeters: Math.round(route.distanceMeters),
      baseDurationSeconds: Math.round(route.durationSeconds),
      durationSeconds: Math.round(adjustedDuration(mode, route.durationSeconds, traffic)),
      path: route.path,
      traffic,
      recommended: false,
      reason: null,
    };
  });

  const ranked = [...planned].sort(
    (a, b) => a.durationSeconds - b.durationSeconds || a.distanceMeters - b.distanceMeters,
  );
  const best = ranked[0];
  best.recommended = true;

  const shortest = planned.reduce((min, route) =>
    route.distanceMeters < min.distanceMeters ? route : min,
  );
  const next = ranked[1];
  const savedSeconds = next ? next.durationSeconds - best.durationSeconds : 0;
  const savingMinutes = Math.round(savedSeconds / 60);

  const parts = ["Fastest at this hour"];
  if (savingMinutes >= 1) parts.push(`saves ${savingMinutes} min over the next option`);
  if (shortest.index === best.index) parts.push("and the shortest distance");
  best.reason = parts.join(" — ").replace(/ — and/, " and");

  return {
    from,
    to,
    mode,
    routes: ranked,
    recommendedIndex: best.index,
    traffic: best.traffic,
    context: trafficContext(now),
    disclaimer:
      "Times and congestion are estimates from the time of day and the road network — not a live traffic or transit feed.",
  };
}
