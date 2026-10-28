export type CongestionLevel = "LIGHT" | "MODERATE" | "HEAVY";

export interface TrafficReport {
  level: CongestionLevel;
  label: string;
  /** 0–100, where higher means busier roads. */
  score: number;
  delaySeconds: number;
  note: string;
  source: "estimated";
}

export interface TrafficContext {
  day: string;
  localTime: string;
  period: "morning peak" | "midday" | "evening peak" | "off-peak" | "weekend";
  label: string;
  summary: string;
  source: "estimated";
}

interface AddisClock {
  weekday: number;
  minutes: number;
  day: string;
  time: string;
}

const ADX_TIME_ZONE = "Africa/Addis_Ababa";

/**
 * The planner has no live traffic feed, so congestion is modelled the way a
 * local would describe it: Addis peak windows, the day of the week and how
 * dense the road network on this particular route is (average speed).
 */
function addisClock(now: Date): AddisClock {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: ADX_TIME_ZONE,
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";

  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const day = get("weekday");
  const weekday = Math.max(0, days.indexOf(day));
  const hour = Number(get("hour")) % 24;
  const minute = Number(get("minute")) || 0;

  return {
    weekday,
    minutes: hour * 60 + minute,
    day,
    time: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
  };
}

function periodOf(clock: AddisClock): TrafficContext["period"] {
  const { weekday, minutes } = clock;
  const weekend = weekday === 0 || weekday === 6;
  if (weekend) return "weekend";
  if (minutes >= 7 * 60 && minutes < 9 * 60 + 30) return "morning peak";
  if (minutes >= 11 * 60 + 30 && minutes < 14 * 60) return "midday";
  if (minutes >= 16 * 60 + 30 && minutes < 19 * 60 + 30) return "evening peak";
  return "off-peak";
}

const PERIOD_LABEL: Record<TrafficContext["period"], string> = {
  "morning peak": "Morning peak",
  midday: "Midday traffic",
  "evening peak": "Evening peak",
  "off-peak": "Quiet roads",
  weekend: "Weekend traffic",
};

function baseLoad(clock: AddisClock, period: TrafficContext["period"]): number {
  const { weekday } = clock;
  switch (period) {
    case "morning peak":
      return 0.78;
    case "midday":
      return weekday === 5 ? 0.68 : 0.56;
    case "evening peak":
      return weekday === 5 ? 0.9 : 0.82;
    case "weekend":
      return clock.minutes >= 10 * 60 && clock.minutes < 18 * 60 ? 0.42 : 0.24;
    default:
      return clock.minutes >= 20 * 60 || clock.minutes < 6 * 60 ? 0.14 : 0.3;
  }
}

export function trafficContext(now: Date = new Date()): TrafficContext {
  const clock = addisClock(now);
  const period = periodOf(clock);
  return {
    day: clock.day,
    localTime: clock.time,
    period,
    label: PERIOD_LABEL[period],
    summary: `${clock.day} ${clock.time} in Addis Ababa · ${PERIOD_LABEL[period].toLowerCase()}`,
    source: "estimated",
  };
}

function levelOf(score: number): CongestionLevel {
  if (score >= 70) return "HEAVY";
  if (score >= 40) return "MODERATE";
  return "LIGHT";
}

const LEVEL_LABEL: Record<CongestionLevel, string> = {
  LIGHT: "Light traffic",
  MODERATE: "Moderate traffic",
  HEAVY: "Heavy traffic",
};

const LEVEL_NOTE: Record<CongestionLevel, string> = {
  LIGHT: "Roads are moving freely for this time of day.",
  MODERATE: "Steady traffic with a few slow stretches.",
  HEAVY: "Slow going on the main corridors — allow extra time.",
};

/**
 * Estimates congestion for one route. A low average speed means the router is
 * using tighter city streets, which is where queues build.
 */
export function estimateCongestion(
  route: { distanceMeters: number; durationSeconds: number },
  now: Date = new Date(),
): TrafficReport {
  const clock = addisClock(now);
  const period = periodOf(clock);
  const load = baseLoad(clock, period);

  const kmh =
    route.durationSeconds > 0
      ? route.distanceMeters / 1000 / (route.durationSeconds / 3600)
      : 0;

  let adjusted = load;
  if (kmh > 0 && kmh < 16) adjusted += 0.12;
  else if (kmh > 0 && kmh < 24) adjusted += 0.06;
  else if (kmh > 42) adjusted -= 0.08;

  const score = Math.min(95, Math.max(5, Math.round(adjusted * 100)));
  const level = levelOf(score);
  const delaySeconds = Math.round(route.durationSeconds * load * 0.45);

  return {
    level,
    label: LEVEL_LABEL[level],
    score,
    delaySeconds,
    note: LEVEL_NOTE[level],
    source: "estimated",
  };
}

/** A walk is not held up by cars, so the report says so instead of guessing. */
export function walkingReport(): TrafficReport {
  return {
    level: "LIGHT",
    label: "No traffic delay",
    score: 0,
    delaySeconds: 0,
    note: "Walking time is not affected by road traffic.",
    source: "estimated",
  };
}
