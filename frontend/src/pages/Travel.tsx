import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Bus,
  Car,
  CheckCircle2,
  Clock,
  Footprints,
  LocateFixed,
  MapPin,
  Navigation,
  Search,
  Sparkles,
  TrafficCone,
  X,
} from "lucide-react";
import type {
  CongestionLevel,
  GeocodeResponse,
  Place,
  PlanMode,
  PlacesResponse,
  PlannedRoute,
  RoutePoint,
  TrafficReport,
  TravelPlan,
  TravelPlanResponse,
} from "../types";
import { api, apiError } from "../lib/api";
import { locationBlock, locationFailure, locationMessage, requestPosition } from "../lib/geo";
import {
  formatRouteDistance,
  formatRouteDuration,
  googleAddressHref,
  parsePoint,
} from "../lib/navigation";
import { KIND_META } from "../lib/places";
import { useUI } from "../store/ui";
import { Spinner } from "../components/ui";
import { cn } from "../lib/utils";

interface Destination {
  point: RoutePoint;
  name: string;
  address: string | null;
}

const MODES: Array<{
  value: PlanMode;
  label: string;
  hint: string;
  icon: typeof Car;
}> = [
  { value: "taxi", label: "Taxi", hint: "Door to door · pickup wait included", icon: Car },
  { value: "bus", label: "Bus / minibus", hint: "Main roads · stop walk & wait included", icon: Bus },
  { value: "walking", label: "Walking", hint: "Your own pace · no traffic delay", icon: Footprints },
];

/** The shared location copy suggests picking an area; this page takes a typed start. */
function startLocationMessage(
  failure: Parameters<typeof locationMessage>[0],
): string {
  return locationMessage(failure)
    .replace("Pick your area and we'll sort by distance from there.", "Type a starting point below.")
    .replace("or pick your area.", "or type a starting point below.");
}

const MODE_LABEL: Record<PlanMode, string> = {
  taxi: "Taxi",
  bus: "Bus / minibus",
  walking: "Walking",
};

const TRAFFIC_TONE: Record<
  CongestionLevel,
  { dot: string; soft: string; bar: string; text: string }
> = {
  LIGHT: {
    dot: "bg-emerald-500",
    soft: "border-emerald-500/25 bg-emerald-500/10",
    bar: "bg-emerald-500",
    text: "text-emerald-700 dark:text-emerald-300",
  },
  MODERATE: {
    dot: "bg-amber-500",
    soft: "border-amber-500/30 bg-amber-500/10",
    bar: "bg-amber-500",
    text: "text-amber-700 dark:text-amber-300",
  },
  HEAVY: {
    dot: "bg-rose-500",
    soft: "border-rose-500/30 bg-rose-500/10",
    bar: "bg-rose-500",
    text: "text-rose-700 dark:text-rose-300",
  },
};

function TrafficPill({ report }: { report: TrafficReport }) {
  const tone = TRAFFIC_TONE[report.level];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
        tone.soft,
        tone.text,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", tone.dot)} />
      {report.label}
    </span>
  );
}

function RouteOption({
  route,
  selected,
  onSelect,
}: {
  route: PlannedRoute;
  selected: boolean;
  onSelect: () => void;
}) {
  const tone = TRAFFIC_TONE[route.traffic.level];
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "w-full rounded-2xl border p-4 text-left transition",
        selected
          ? "border-brand-600 bg-brand-50/60 shadow-sm dark:border-brand-400/60 dark:bg-brand-500/10"
          : "border-line bg-surface hover:border-brand-300 hover:bg-raised/40",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-ink">{route.label}</span>
            {route.recommended && (
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-700 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                <Sparkles className="h-2.5 w-2.5" /> Recommended
              </span>
            )}
            {selected && !route.recommended && (
              <span className="inline-flex items-center gap-1 rounded-full border border-brand-600/40 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-brand-700 dark:text-brand-300">
                <CheckCircle2 className="h-2.5 w-2.5" /> Selected
              </span>
            )}
          </div>

          <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-display text-xl font-semibold leading-none text-ink">
              {formatRouteDuration(route.durationSeconds)}
            </span>
            <span className="text-xs font-medium text-muted">
              {formatRouteDistance(route.distanceMeters)}
            </span>
            <TrafficPill report={route.traffic} />
          </div>

          {route.reason && (
            <p className="mt-2 text-[11px] font-medium leading-5 text-brand-800 dark:text-brand-200">
              {route.reason}
            </p>
          )}

          <p className="mt-2 flex items-center gap-1.5 text-[11px] leading-4 text-muted">
            <Clock className="h-3 w-3 shrink-0" />
            {route.traffic.delaySeconds > 30
              ? `About +${Math.round(route.traffic.delaySeconds / 60)} min from traffic.`
              : route.traffic.note}
          </p>
        </div>

        <span
          className={cn(
            "mt-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition",
            selected ? "border-brand-700 dark:border-brand-300" : "border-line",
          )}
          aria-hidden="true"
        >
          {selected && <span className="h-2.5 w-2.5 rounded-full bg-brand-700 dark:bg-brand-300" />}
        </span>
      </div>

      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-raised" aria-hidden="true">
        <div
          className={cn("h-full rounded-full transition-all", tone.bar)}
          style={{ width: `${Math.max(6, route.traffic.score)}%` }}
        />
      </div>
    </button>
  );
}

export function TravelPage() {
  const [searchParams] = useSearchParams();
  const pushToast = useUI((state) => state.pushToast);
  const search = searchParams.toString();

  const requested = useMemo(() => {
    const params = new URLSearchParams(search);
    return {
      from: parsePoint(params.get("from")),
      to: parsePoint(params.get("to")),
      name: params.get("name")?.trim() || null,
      address: params.get("address")?.trim() || null,
    };
  }, [search]);

  const [origin, setOrigin] = useState<RoutePoint | null>(requested.from);
  const [originLabel, setOriginLabel] = useState(requested.from ? "Pinned start" : "Your current location");
  const [locating, setLocating] = useState(!requested.from);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [startQuery, setStartQuery] = useState("");
  const [startBusy, setStartBusy] = useState(false);

  const [destination, setDestination] = useState<Destination | null>(
    requested.to
      ? {
          point: requested.to,
          name: requested.name || "Destination",
          address: requested.address,
        }
      : null,
  );
  const [query, setQuery] = useState(requested.name ?? "");
  const [suggestions, setSuggestions] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const destinationBoxRef = useRef<HTMLDivElement | null>(null);

  const [mode, setMode] = useState<PlanMode>("taxi");
  const [plan, setPlan] = useState<TravelPlan | null>(null);
  const [planning, setPlanning] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [attempt, setAttempt] = useState(0);

  // First fix on arrival; a shared link with a pinned start wins.
  useEffect(() => {
    if (requested.from) return;
    const blocked = locationBlock();
    if (blocked) {
      setLocating(false);
      setLocationError(locationMessage(blocked));
      return;
    }

    let cancelled = false;
    requestPosition()
      .then((fix) => {
        if (cancelled) return;
        setOrigin(fix);
        setOriginLabel("Your current location");
      })
      .catch((failure: unknown) => {
        if (!cancelled) {
          setLocationError(
            startLocationMessage(failure as Parameters<typeof locationMessage>[0]),
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLocating(false);
      });

    return () => {
      cancelled = true;
    };
  }, [requested.from]);

  const retryLocation = useCallback(async () => {
    setLocationError(null);
    setLocating(true);
    try {
      const fix = await requestPosition();
      setOrigin(fix);
      setOriginLabel("Your current location");
    } catch (failure) {
      setLocationError(startLocationMessage(failure as Parameters<typeof locationMessage>[0]));
    } finally {
      setLocating(false);
    }
  }, []);

  // GPS is blocked on plain-HTTP phones and in some desktop browsers, so the
  // planner still lets people type where they are starting from.
  const setManualStart = useCallback(async () => {
    const term = startQuery.trim();
    if (term.length < 3) return;

    setStartBusy(true);
    try {
      const response = await api.get<GeocodeResponse>(
        `/api/geocode?${new URLSearchParams({ q: term }).toString()}`,
      );
      setOrigin({ lat: response.data.location.lat, lng: response.data.location.lng });
      setOriginLabel(term);
      setLocationError(null);
    } catch (error) {
      pushToast(apiError(error), { tone: "error" });
    } finally {
      setStartBusy(false);
    }
  }, [startQuery, pushToast]);

  // A tap anywhere else should put the suggestion list away.
  useEffect(() => {
    if (!searchOpen) return;
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (!destinationBoxRef.current?.contains(event.target as Node)) setSearchOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePress);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePress);
  }, [searchOpen]);

  // Venue search: names in the directory first, free-text addresses after.
  useEffect(() => {
    const term = query.trim();
    if (!searchOpen || term.length < 2) {
      setSuggestions([]);
      setSearching(false);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      setSearching(true);
      api
        .get<PlacesResponse>(
          `/api/places?${new URLSearchParams({ q: term, limit: "6" }).toString()}`,
        )
        .then((response) => {
          if (!cancelled) setSuggestions(response.data.places ?? []);
        })
        .catch(() => {
          if (!cancelled) setSuggestions([]);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, searchOpen]);

  const choosePlace = (place: Place) => {
    setDestination({
      point: { lat: place.lat, lng: place.lng },
      name: place.name,
      address: [place.area, place.city].filter(Boolean).join(", ") || place.city,
    });
    setQuery(place.name);
    setSuggestions([]);
    setSearchOpen(false);
  };

  const resolveTypedDestination = useCallback(async (): Promise<Destination | null> => {
    const term = query.trim();
    if (term.length < 3) return null;

    setGeocoding(true);
    try {
      const response = await api.get<GeocodeResponse>(
        `/api/geocode?${new URLSearchParams({ q: term }).toString()}`,
      );
      const resolved: Destination = {
        point: { lat: response.data.location.lat, lng: response.data.location.lng },
        name: term,
        address: response.data.location.displayName,
      };
      setDestination(resolved);
      setQuery(term);
      setSearchOpen(false);
      return resolved;
    } catch (error) {
      pushToast(apiError(error), { tone: "error" });
      return null;
    } finally {
      setGeocoding(false);
    }
  }, [query, pushToast]);

  // Plan automatically whenever the pins or the transport mode change.
  useEffect(() => {
    if (!origin || !destination) {
      setPlanning(false);
      setPlan(null);
      setSelected(null);
      setPlanError(null);
      return;
    }

    let cancelled = false;
    setPlanning(true);
    setPlanError(null);

    const params = new URLSearchParams({
      from: `${origin.lat},${origin.lng}`,
      to: `${destination.point.lat},${destination.point.lng}`,
      mode,
    });

    api
      .get<TravelPlanResponse>(`/api/travel/plan?${params.toString()}`)
      .then((response) => {
        if (cancelled) return;
        setPlan(response.data.plan);
        setSelected(response.data.plan.recommendedIndex);
      })
      .catch((error) => {
        if (cancelled) return;
        setPlan(null);
        setSelected(null);
        setPlanError(apiError(error));
      })
      .finally(() => {
        if (!cancelled) setPlanning(false);
      });

    return () => {
      cancelled = true;
    };
  }, [origin?.lat, origin?.lng, destination?.point.lat, destination?.point.lng, mode, attempt]);

  const routes = plan?.routes ?? [];
  const selectedRoute = routes.find((route) => route.index === selected) ?? null;

  const startHref = useMemo(() => {
    if (!plan || !selectedRoute || !origin || !destination) return null;
    const params = new URLSearchParams({
      from: `${origin.lat},${origin.lng}`,
      to: `${destination.point.lat},${destination.point.lng}`,
      name: destination.name,
      mode: mode === "walking" ? "walking" : "driving",
      route: String(selectedRoute.index),
      plan: mode,
    });
    if (destination.address && destination.address !== destination.name) {
      params.set("address", destination.address);
    }
    return `/navigate?${params.toString()}`;
  }, [plan, selectedRoute, origin, destination, mode]);

  const fastest = routes.reduce<PlannedRoute | null>(
    (best, route) => (!best || route.durationSeconds < best.durationSeconds ? route : best),
    null,
  );

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-20">
      <header className="relative overflow-hidden rounded-3xl border border-brand-800/40 bg-brand-950 text-white shadow-lift">
        <span aria-hidden="true" className="tilet-strip absolute inset-x-0 top-0 h-1.5 opacity-80" />
        <div className="relative p-5 sm:p-7">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white/80">
            <Navigation className="h-3 w-3" /> Let&apos;s Travel
          </span>
          <h1 className="mt-3 max-w-2xl font-display text-2xl font-semibold leading-tight tracking-tight sm:text-[2rem]">
            Plan the whole trip, not just the drive.
          </h1>
          <p className="mt-2 max-w-2xl text-xs leading-5 text-white/65 sm:text-sm">
            Start from where you are, search any venue or address, then compare taxi, bus and
            walking routes with an estimated traffic outlook before you go.
          </p>

          <div className="mt-5 grid gap-2 text-[11px] text-white/75 sm:grid-cols-3">
            {[
              "Every route in km and minutes",
              "Traffic outlook per road",
              "Best option picked for you",
            ].map((item) => (
              <span
                key={item}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-2.5 py-2"
              >
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" /> {item}
              </span>
            ))}
          </div>
        </div>
      </header>

      <section className="card p-5 sm:p-6">
        {/* Starting point */}
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
            {locating ? <Spinner className="h-4 w-4" /> : <LocateFixed className="h-4 w-4" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">From</p>
            <p className="mt-0.5 truncate text-sm font-semibold text-ink">
              {origin ? originLabel : locating ? "Finding your location…" : "Starting point needed"}
            </p>
            {origin && (
              <p className="mt-0.5 text-[11px] text-muted">
                {origin.lat.toFixed(4)}, {origin.lng.toFixed(4)}
              </p>
            )}
            {locationError && (
              <p className="mt-1 text-[11px] leading-4 text-amber-700 dark:text-amber-300">
                {locationError}
              </p>
            )}
            {!origin && !locating && (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void setManualStart();
                }}
                className="mt-2 flex flex-wrap items-center gap-2"
              >
                <input
                  value={startQuery}
                  onChange={(event) => setStartQuery(event.target.value)}
                  placeholder="Or type a starting point, e.g. Bole…"
                  className="input h-9 min-w-0 flex-1 text-xs"
                  aria-label="Starting point"
                />
                <button
                  type="submit"
                  disabled={startBusy || startQuery.trim().length < 3}
                  className="btn-secondary btn-sm shrink-0"
                >
                  {startBusy ? <Spinner className="h-3.5 w-3.5" /> : <MapPin className="h-3.5 w-3.5" />}
                  Set start
                </button>
              </form>
            )}
          </div>
          <button
            type="button"
            onClick={() => void retryLocation()}
            disabled={locating}
            className="btn-secondary btn-sm shrink-0"
          >
            <LocateFixed className="h-3.5 w-3.5" />
            {locating ? "Finding…" : "Use my location"}
          </button>
        </div>

        <div className="ml-[18px] h-5 border-l border-dashed border-line" aria-hidden="true" />

        {/* Destination */}
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300">
            <MapPin className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <label
              htmlFor="travel-destination"
              className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted"
            >
              To
            </label>
            <div ref={destinationBoxRef} className="relative mt-1.5">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                id="travel-destination"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setDestination(null);
                  setPlan(null);
                  setSelected(null);
                  setSearchOpen(true);
                }}
                onFocus={() => setSearchOpen(true)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") setSearchOpen(false);
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void resolveTypedDestination();
                  }
                }}
                placeholder="Search a café, venue, landmark or address…"
                className="input h-11 w-full pl-9 pr-9 text-sm"
                autoComplete="off"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setDestination(null);
                    setPlan(null);
                    setSuggestions([]);
                  }}
                  aria-label="Clear destination"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted transition hover:bg-raised hover:text-ink"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}

              {searchOpen && query.trim().length >= 2 && (
                <div className="absolute left-0 right-0 top-full z-30 mt-1.5 overflow-hidden rounded-2xl border border-line bg-surface shadow-lift">
                  {searching && (
                    <p className="flex items-center gap-2 px-3 py-2.5 text-[11px] text-muted">
                      <Spinner className="h-3.5 w-3.5" /> Searching the directory…
                    </p>
                  )}

                  {suggestions.map((place) => {
                    const meta = KIND_META[place.kind];
                    const Icon = meta.icon;
                    return (
                      <button
                        key={place.id}
                        type="button"
                        onClick={() => choosePlace(place)}
                        className="flex w-full items-center gap-2.5 border-b border-line/60 px-3 py-2.5 text-left transition last:border-0 hover:bg-raised"
                      >
                        <span
                          className={cn(
                            "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line bg-raised",
                            meta.iconTone,
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-semibold text-ink">
                            {place.name}
                          </span>
                          <span className="block truncate text-[11px] text-muted">
                            {meta.label} · {[place.area, place.city].filter(Boolean).join(", ")}
                          </span>
                        </span>
                        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted" />
                      </button>
                    );
                  })}

                  {query.trim().length >= 3 && (
                    <button
                      type="button"
                      onClick={() => void resolveTypedDestination()}
                      disabled={geocoding}
                      className="flex w-full items-center gap-2.5 px-3 py-3 text-left transition hover:bg-raised disabled:opacity-60"
                    >
                      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line bg-raised text-brand-700 dark:text-brand-300">
                        {geocoding ? <Spinner className="h-4 w-4" /> : <MapPin className="h-4 w-4" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold text-ink">
                          Use “{query.trim()}” as the destination
                        </span>
                        <span className="block text-[11px] text-muted">
                          Look the address up on the map
                        </span>
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted" />
                    </button>
                  )}
                </div>
              )}
            </div>

            {destination && (
              <div className="mt-2 flex items-start gap-1.5 text-[11px] leading-4 text-brand-800 dark:text-brand-200">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span className="min-w-0">
                  <span className="font-semibold">{destination.name}</span>
                  {destination.address && destination.address !== destination.name && (
                    <span className="block truncate text-muted">{destination.address}</span>
                  )}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Transport mode */}
        <div className="mt-6 border-t border-line/70 pt-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
            Travel by
          </p>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {MODES.map((option) => {
              const Icon = option.icon;
              const active = mode === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    setMode(option.value);
                    setPlan(null);
                    setSelected(null);
                  }}
                  className={cn(
                    "flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left transition",
                    active
                      ? "border-brand-600 bg-brand-50/70 dark:border-brand-400/60 dark:bg-brand-500/10"
                      : "border-line bg-surface hover:border-brand-300 hover:bg-raised/40",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                      active
                        ? "bg-brand-700 text-white"
                        : "bg-raised text-muted",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-semibold text-ink">{option.label}</span>
                    <span className="block text-[10px] leading-4 text-muted">{option.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {planning && (
          <p className="mt-4 flex items-center gap-2 text-[11px] text-muted" aria-live="polite">
            <Spinner className="h-3.5 w-3.5" /> Comparing routes and checking the roads…
          </p>
        )}

        {planError && (
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-amber-300/70 bg-amber-50 px-3 py-2.5 text-[11px] text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span className="min-w-0 flex-1">{planError}</span>
            <button
              type="button"
              onClick={() => setAttempt((value) => value + 1)}
              className="font-bold underline underline-offset-4"
            >
              Try again
            </button>
          </div>
        )}

        {!destination && !planning && (
          <p className="mt-4 text-[11px] leading-5 text-muted">
            Pick a destination and we&apos;ll compare every route we can find. Your starting point
            is your current location unless the link pinned one.
          </p>
        )}
      </section>

      {/* Traffic outlook */}
      {plan && (
        <section
          className={cn(
            "flex flex-wrap items-start gap-3 rounded-2xl border p-4",
            TRAFFIC_TONE[plan.traffic.level].soft,
          )}
        >
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface/80 text-ink shadow-sm">
            <TrafficCone className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-ink">
              {plan.context.label} in Addis right now
              <span className={cn("ml-2 text-[12px] font-semibold", TRAFFIC_TONE[plan.traffic.level].text)}>
                {plan.traffic.label}
              </span>
            </p>
            <p className="mt-0.5 text-[11px] leading-5 text-muted">{plan.context.summary}</p>
            <p className="mt-1 text-[10px] leading-4 text-muted/90">{plan.disclaimer}</p>
          </div>
          <span className="rounded-full border border-line bg-surface px-2.5 py-1 text-[10px] font-bold text-muted">
            {timeSavedLabel(routes, fastest)}
          </span>
        </section>
      )}

      {/* Routes */}
      {plan && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-lg font-semibold text-ink">
                {routes.length} {routes.length === 1 ? "route" : "routes"} to choose from
              </h2>
              <p className="text-[11px] text-muted">
                {MODE_LABEL[mode]} from{" "}
                {originLabel === "Your current location" ? "your current location" : originLabel} · pick
                one to start navigation.
              </p>
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
              OpenStreetMap · OSRM
            </span>
          </div>

          <div
            role="radiogroup"
            aria-label="Available routes"
            className="grid gap-3 lg:grid-cols-2"
          >
            {routes.map((route) => (
              <RouteOption
                key={`${route.index}-${route.label}`}
                route={route}
                selected={selected === route.index}
                onSelect={() => setSelected(route.index)}
              />
            ))}
          </div>

          {routes.length === 1 && (
            <p className="text-[11px] text-muted">
              Only one road route exists for this trip — the map data has no safe alternative.
            </p>
          )}

          <div className="sticky bottom-20 z-20 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface/95 p-3.5 shadow-lift backdrop-blur lg:bottom-4">
            <div className="min-w-0 flex-1">
              {selectedRoute ? (
                <>
                  <p className="truncate text-[13px] font-bold text-ink">
                    {selectedRoute.label} · {formatRouteDistance(selectedRoute.distanceMeters)}
                  </p>
                  <p className="text-[11px] text-muted">
                    {MODE_LABEL[mode]} · about {formatRouteDuration(selectedRoute.durationSeconds)}
                    {selectedRoute.recommended ? " · our pick" : ""}
                  </p>
                </>
              ) : (
                <p className="text-[12px] text-muted">Choose a route above to continue.</p>
              )}
            </div>

            {startHref ? (
              <Link to={startHref} className="btn-primary shrink-0">
                <Navigation className="h-4 w-4" /> Start navigation
              </Link>
            ) : (
              <button type="button" disabled className="btn-primary shrink-0 opacity-50">
                <Navigation className="h-4 w-4" /> Start navigation
              </button>
            )}

            {!origin && !locating && (
              <a
                href={
                  destination
                    ? googleAddressHref(
                        [destination.name, destination.address].filter(Boolean).join(", "),
                      )
                    : "#"
                }
                target="_blank"
                rel="noreferrer noopener"
                className="btn-secondary btn-sm shrink-0"
              >
                Open in Google Maps
              </a>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function timeSavedLabel(routes: PlannedRoute[], fastest: PlannedRoute | null): string {
  if (!routes.length || !fastest) return "No routes yet";
  if (routes.length === 1) return "1 route available";
  const slowest = routes.reduce((worst, route) =>
    route.durationSeconds > worst.durationSeconds ? route : worst,
  );
  const saving = Math.round((slowest.durationSeconds - fastest.durationSeconds) / 60);
  return saving >= 1 ? `Save up to ${saving} min` : "Similar times";
}
