import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import axios from "axios";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Car,
  Check,
  Clock,
  Copy,
  CornerUpLeft,
  CornerUpRight,
  ExternalLink,
  Flag,
  Footprints,
  GitMerge,
  LocateFixed,
  MapPin,
  Navigation,
  RefreshCw,
  RotateCcw,
  Share2,
  ShieldCheck,
  Volume2,
  VolumeX,
  XCircle,
} from "lucide-react";
import type {
  DirectionsResponse,
  DirectionsRoute,
  RoutePoint,
  TravelMode,
  TripShare,
} from "../types";
import { api, apiError } from "../lib/api";
import {
  buildRouteMetrics,
  formatRouteDistance,
  formatRouteDuration,
  arrivalClock,
  googleAddressHref,
  googleDirectionsHref,
  locateOnRoute,
  parsePoint,
  remainingMetersOf,
  remainingSecondsOf,
  stepCaption,
  stepInstruction,
  stepShape,
  type StepShape,
} from "../lib/navigation";
import { locationBlock, locationFailure, locationMessage, requestPosition } from "../lib/geo";
import { cancelSpeech, primeVoice, speak, speechSupported } from "../lib/voice";
import { useUI } from "../store/ui";
import { EmptyState, Spinner } from "../components/ui";
import { RouteMap } from "../components/RouteMap";
import { NearbyServices } from "../components/NearbyServices";
import { cn } from "../lib/utils";

interface LiveFix extends RoutePoint {
  accuracy: number | null;
  heading: number | null;
}

interface SharedTripLink {
  id: string;
  token: string;
  destinationName: string;
  destinationLat: number;
  destinationLng: number;
}

const VOICE_PREFERENCE_KEY = "ch_voice_guide";
const TRIP_SHARE_KEY = "ch_live_trip_share";

function readStoredShare(): SharedTripLink | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(TRIP_SHARE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SharedTripLink>;
    if (
      typeof parsed.id !== "string" ||
      typeof parsed.token !== "string" ||
      typeof parsed.destinationName !== "string" ||
      typeof parsed.destinationLat !== "number" ||
      typeof parsed.destinationLng !== "number"
    ) {
      return null;
    }
    return parsed as SharedTripLink;
  } catch {
    return null;
  }
}

function writeStoredShare(share: SharedTripLink | null): void {
  try {
    if (share) window.localStorage.setItem(TRIP_SHARE_KEY, JSON.stringify(share));
    else window.localStorage.removeItem(TRIP_SHARE_KEY);
  } catch {
    // Storage can be blocked; the live link still works for this visit.
  }
}

function readVoicePreference(): boolean {
  try {
    return window.localStorage.getItem(VOICE_PREFERENCE_KEY) !== "off";
  } catch {
    // Private mode can refuse storage; voice stays on for the session.
    return true;
  }
}

/**
 * The distance band a manoeuvre belongs to. Announcing happens once per band,
 * and the nearest band keeps a driver who joins mid-leg from hearing a stale
 * "in 500 metres" when the turn is only 200 m away.
 */
function cueBand(meters: number, mode: TravelMode): number | null {
  const bands = mode === "walking" ? [0, 40, 120] : [0, 60, 200, 500];
  const widest = bands[bands.length - 1];
  if (meters > widest + 50) return null;

  let nearest = bands[0];
  for (const band of bands) {
    if (Math.abs(band - meters) < Math.abs(nearest - meters)) nearest = band;
  }
  return nearest;
}

function spokenDistance(meters: number): number {
  return Math.max(10, Math.round(meters / 10) * 10);
}

function lowerFirst(text: string): string {
  return `${text.charAt(0).toLowerCase()}${text.slice(1)}`;
}

function StepIcon({ shape, className }: { shape: StepShape; className?: string }) {
  const Icon =
    shape === "left"
      ? CornerUpLeft
      : shape === "right"
        ? CornerUpRight
        : shape === "roundabout"
          ? RotateCcw
          : shape === "merge"
            ? GitMerge
            : shape === "arrive"
              ? Flag
              : shape === "depart"
                ? Navigation
                : ArrowUp;
  return <Icon className={className ?? "h-4 w-4"} />;
}

export function NavigatePage() {
  const [searchParams] = useSearchParams();
  const pushToast = useUI((state) => state.pushToast);
  const search = searchParams.toString();

  const requested = useMemo(() => {
    const params = new URLSearchParams(search);
    return {
      point: parsePoint(params.get("to")),
      name: params.get("name")?.trim() || null,
      address: params.get("address")?.trim() || null,
      placeSlug: params.get("place"),
      eventSlug: params.get("event"),
    };
  }, [search]);

  // Listings imported from other sources often name a venue without a pin, so
  // the page asks the API to geocode the address before it can build a route.
  const venueQuery = requested.point ? null : requested.address || requested.name;
  const [resolvedPin, setResolvedPin] = useState<{ query: string; point: RoutePoint } | null>(null);
  const [resolveError, setResolveError] = useState<{ query: string; message: string } | null>(null);

  useEffect(() => {
    if (!venueQuery) {
      setResolveError(null);
      return;
    }

    let cancelled = false;
    setResolveError(null);

    api
      .get<{ location: { lat: number; lng: number } }>(
        `/api/geocode?${new URLSearchParams({ q: venueQuery }).toString()}`,
      )
      .then((response) => {
        if (cancelled) return;
        const { lat, lng } = response.data.location;
        setResolvedPin({ query: venueQuery, point: { lat, lng } });
      })
      .catch((error) => {
        if (!cancelled) setResolveError({ query: venueQuery, message: apiError(error) });
      });

    return () => {
      cancelled = true;
    };
  }, [venueQuery]);

  const target = useMemo(() => {
    if (requested.point) {
      return {
        ...requested.point,
        name: requested.name || "Destination",
        address: requested.address,
        placeSlug: requested.placeSlug,
        eventSlug: requested.eventSlug,
      };
    }
    if (!resolvedPin || resolvedPin.query !== venueQuery) return null;
    return {
      ...resolvedPin.point,
      name: requested.name || venueQuery || "Destination",
      address: requested.address,
      placeSlug: requested.placeSlug,
      eventSlug: requested.eventSlug,
    };
  }, [requested, resolvedPin, venueQuery]);

  const errorMessage =
    resolveError && resolveError.query === venueQuery ? resolveError.message : null;
  const resolving = Boolean(venueQuery) && !target && !errorMessage;

  const initialFrom = useMemo(() => parsePoint(new URLSearchParams(search).get("from")), [search]);
  // The planner names the start it pinned; a bare "from" stays generic.
  const initialFromName = useMemo(() => {
    const raw = new URLSearchParams(search).get("fromName")?.trim();
    return raw && raw.length <= 80 ? raw : null;
  }, [search]);
  const initialMode = useMemo<TravelMode>(
    () => (new URLSearchParams(search).get("mode") === "walking" ? "walking" : "driving"),
    [search],
  );
  // A planner link names the alternative it wants; navigation re-requests the
  // same set from the router so the driver keeps the route they picked.
  const routeParam = useMemo(() => {
    const raw = new URLSearchParams(search).get("route");
    if (raw === null) return null;
    const index = Number(raw);
    return Number.isInteger(index) && index >= 0 && index <= 2 ? index : null;
  }, [search]);
  const planMode = useMemo(() => {
    const raw = new URLSearchParams(search).get("plan");
    return raw === "taxi" || raw === "bus" || raw === "walking" ? raw : null;
  }, [search]);

  const [origin, setOrigin] = useState<RoutePoint | null>(initialFrom);
  const [originName, setOriginName] = useState(
    initialFrom ? initialFromName ?? "Pinned start" : "Your location",
  );
  const routeLoadedAtRef = useRef(0);
  const [locating, setLocating] = useState(!initialFrom);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [mode, setMode] = useState<TravelMode>(initialMode);
  const [route, setRoute] = useState<DirectionsRoute | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const [position, setPosition] = useState<LiveFix | null>(null);
  // The planner can ask for a specific alternative. A reroute drops that pick
  // so the router is free to return the best way from the new position.
  const [selectedRouteIndex, setSelectedRouteIndex] = useState<number | null>(routeParam);
  const [routeNonce, setRouteNonce] = useState(0);
  const [rerouting, setRerouting] = useState(false);
  const [voiceOn, setVoiceOn] = useState(readVoicePreference);
  const voiceAvailable = useMemo(() => speechSupported(), []);
  const voiceOnRef = useRef(voiceOn);
  voiceOnRef.current = voiceOn;
  // A restored link is validated below; start empty so an expired token never
  // flashes a live-sharing panel on a fresh visit.
  const [share, setShare] = useState<SharedTripLink | null>(null);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [shareTick, setShareTick] = useState(0);
  const lastShareSentRef = useRef(0);
  const sharedRouteRef = useRef<DirectionsRoute | null>(null);
  const spokenCuesRef = useRef<Set<string>>(new Set());
  const arrivalAnnouncedRef = useRef(false);

  // Recover a link after a refresh. The API is the authority: a stored token
  // that has expired or belongs to another account is dropped instead of shown.
  useEffect(() => {
    const stored = readStoredShare();
    if (!stored) return;

    let cancelled = false;
    api
      .get<{ trip: TripShare }>(`/api/trip-shares/${encodeURIComponent(stored.token)}`)
      .then((response) => {
        if (cancelled) return;
        if (response.data.trip.status === "ACTIVE" && response.data.trip.isOwner) {
          setShare(stored);
        } else {
          writeStoredShare(null);
          setShare(null);
        }
      })
      .catch(() => {
        if (cancelled) return;
        writeStoredShare(null);
        setShare(null);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // The way back follows wherever the link came from: an event page wins over
  // the venue it is attached to, so the reader lands where they started.
  const backPath = planMode
    ? "/travel"
    : requested.eventSlug
      ? `/events/${requested.eventSlug}`
      : requested.placeSlug
        ? `/places/${requested.placeSlug}`
        : "/places";
  const backLabel = planMode
    ? "Back to Let's Travel"
    : requested.eventSlug
      ? "Back to the event"
      : requested.placeSlug
        ? "Back to the place"
        : "Nearby places";

  // First fix on arrival. A start passed in the link (a shared route, or a
  // desktop test) wins over asking the device.
  useEffect(() => {
    if (initialFrom) return;
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
        setOriginName("Your location");
        setPosition({ ...fix, accuracy: null, heading: null });
      })
      .catch((failure: unknown) => {
        if (!cancelled) setLocationError(locationMessage(failure as Parameters<typeof locationMessage>[0]));
      })
      .finally(() => {
        if (!cancelled) setLocating(false);
      });

    return () => {
      cancelled = true;
    };
  }, [initialFrom]);

  // The route itself. Reloads when the start, destination or travel mode moves.
  useEffect(() => {
    if (!origin || !target) return;

    let cancelled = false;
    setRouteLoading(true);
    setRouteError(null);

    const params = new URLSearchParams({
      from: `${origin.lat},${origin.lng}`,
      to: `${target.lat},${target.lng}`,
      mode,
    });
    if (selectedRouteIndex !== null) params.set("alternatives", "1");

    api
      .get<DirectionsResponse>(`/api/directions?${params.toString()}`)
      .then((response) => {
        if (cancelled) return;
        const alternatives = response.data.routes;
        setRoute(
          selectedRouteIndex !== null && alternatives?.[selectedRouteIndex]
            ? alternatives[selectedRouteIndex]
            : response.data.route,
        );
        routeLoadedAtRef.current = Date.now();
      })
      .catch((error) => {
        if (cancelled) return;
        setRoute(null);
        setRouteError(apiError(error));
      })
      .finally(() => {
        if (cancelled) return;
        setRouteLoading(false);
        setRerouting(false);
      });

    return () => {
      cancelled = true;
    };
  }, [origin?.lat, origin?.lng, target?.lat, target?.lng, mode, selectedRouteIndex, routeNonce]);

  const retryLocation = useCallback(async () => {
    setLocationError(null);
    setLocating(true);
    try {
      const fix = await requestPosition();
      setOrigin(fix);
      setOriginName("Your location");
      setPosition({ ...fix, accuracy: null, heading: null });
    } catch (failure) {
      setLocationError(locationMessage(failure as Parameters<typeof locationMessage>[0]));
    } finally {
      setLocating(false);
    }
  }, []);

  const pickStart = useCallback((point: RoutePoint) => {
    setOrigin(point);
    setOriginName("Dropped pin");
    setPicking(false);
    setLocationError(null);
    // A hand-picked start is a plan, not a live fix: drop the old GPS position
    // so the summary describes the new trip instead of the previous one.
    setPosition(null);
  }, []);

  // Keep the latest route-dependent work available to the GPS watcher without
  // re-registering the watch every time a route reloads.
  const onFix = useCallback((fix: LiveFix) => setPosition(fix), []);
  const onFixRef = useRef(onFix);
  onFixRef.current = onFix;

  useEffect(() => {
    if (!live) return;
    if (!("geolocation" in navigator)) {
      pushToast("This browser cannot share a location.", { tone: "error" });
      setLive(false);
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (update) =>
        onFixRef.current({
          lat: update.coords.latitude,
          lng: update.coords.longitude,
          accuracy: Number.isFinite(update.coords.accuracy) ? update.coords.accuracy : null,
          heading:
            update.coords.heading !== null && Number.isFinite(update.coords.heading)
              ? update.coords.heading
              : null,
        }),
      (error) => {
        pushToast(locationMessage(locationFailure(error)), { tone: "error" });
        if (error.code === error.PERMISSION_DENIED) setLive(false);
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 20_000 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [live, pushToast]);

  const metrics = useMemo(() => (route ? buildRouteMetrics(route.path) : null), [route]);

  /**
   * Distance along the route at which each manoeuvre begins. Progress is kept
   * monotonic: on a route that crosses itself, a later step can project onto
   * an earlier segment, and directions must never jump backwards.
   */
  const stepProgress = useMemo(() => {
    if (!route || !metrics) return [];
    let previous = 0;
    return route.steps.map((step) => {
      previous = Math.max(previous, locateOnRoute(route.path, metrics, step.location).traveledMeters);
      return previous;
    });
  }, [route, metrics]);

  const location = useMemo(
    () => (route && metrics && position ? locateOnRoute(route.path, metrics, position) : null),
    [route, metrics, position],
  );

  const remaining = useMemo(() => {
    if (!route) return null;
    if (!location) return { meters: route.distanceMeters, seconds: route.durationSeconds };
    return {
      meters: remainingMetersOf(route, location.traveledMeters),
      seconds: remainingSecondsOf(route, location.traveledMeters),
    };
  }, [route, location]);

  // Push a throttled fix to the live safety link while navigation is running.
  // A link created for another destination is deliberately left alone, so a
  // stale tab can never move someone else's shared trip.
  useEffect(() => {
    if (!share || !live || !position) return;
    if (
      target &&
      (Math.abs(share.destinationLat - target.lat) > 0.0002 ||
        Math.abs(share.destinationLng - target.lng) > 0.0002)
    ) {
      return;
    }

    const now = Date.now();
    if (now - lastShareSentRef.current < 7000) return;
    lastShareSentRef.current = now;

    const body: Record<string, unknown> = {
      fix: {
        lat: position.lat,
        lng: position.lng,
        accuracy: position.accuracy,
        heading: position.heading,
      },
      remainingMeters: remaining?.meters ?? null,
      remainingSeconds: remaining?.seconds ?? null,
    };

    if (route && sharedRouteRef.current !== route) {
      body.routePath = route.path;
      body.routeDistanceMeters = route.distanceMeters;
      body.routeDurationSeconds = route.durationSeconds;
      sharedRouteRef.current = route;
    }

    void api.patch(`/api/trip-shares/${share.id}`, body).catch((error) => {
      if (axios.isAxiosError(error) && [404, 409].includes(error.response?.status ?? 0)) {
        writeStoredShare(null);
        sharedRouteRef.current = null;
        setShare(null);
      }
    });
  }, [share, live, position, remaining?.meters, remaining?.seconds, route, target, shareTick]);

  // Keep the watcher fresh even when the phone is stationary and the GPS
  // watcher has no new fix to report.
  useEffect(() => {
    if (!share || !live) return;
    const timer = window.setInterval(() => setShareTick((value) => value + 1), 8000);
    return () => window.clearInterval(timer);
  }, [share, live]);

  const nextStepIndex = useMemo(() => {
    if (!route) return 0;
    if (!location) return 0;
    for (let index = 0; index < route.steps.length; index += 1) {
      if (stepProgress[index] > location.traveledMeters + 6) return index;
    }
    return Math.max(0, route.steps.length - 1);
  }, [route, location, stepProgress]);

  // OSRM emits a roundabout entry and a matching "exit roundabout" step. One
  // instruction is enough; the exit row is dropped from the list.
  const visibleSteps = useMemo(() => {
    if (!route) return [];
    return route.steps
      .map((step, index) => ({ step, index }))
      .filter(({ step }) => step.type !== "exit roundabout" && step.type !== "exit rotary");
  }, [route]);

  const nextStep = route?.steps[nextStepIndex] ?? null;
  const distanceToManoeuvre =
    location && nextStep
      ? Math.max(0, (stepProgress[nextStepIndex] ?? 0) - location.traveledMeters)
      : 0;

  // Off-route detection: a sustained gap from the line means the driver has
  // taken another road. The gap that counts grows with the GPS accuracy, so a
  // noisy fix in a dense block cannot trigger a reroute on its own.
  const offRouteSinceRef = useRef<number | null>(null);
  const lastRerouteRef = useRef(0);
  const offRouteMeters = location?.offRouteMeters ?? null;
  const offRouteThreshold = useMemo(
    () => Math.max(50, Math.min(120, Math.round((position?.accuracy ?? 0) * 1.5))),
    [position?.accuracy],
  );
  const offRoute = Boolean(
    live &&
      offRouteMeters !== null &&
      // A fresh route starts at the GPS point; OSRM may snap that point to a
      // road a little way off, so give the driver a moment to settle on it
      // before calling them lost again.
      Date.now() - routeLoadedAtRef.current > 4000 &&
      offRouteMeters > offRouteThreshold &&
      (remaining?.meters ?? 0) > 40,
  );

  const rerouteFrom = useCallback(
    (reason: "auto" | "manual") => {
      if (!position) {
        pushToast("Waiting for a fresh location before we can reroute.", { tone: "error" });
        return;
      }

      lastRerouteRef.current = Date.now();
      offRouteSinceRef.current = null;
      setSelectedRouteIndex(null);
      setRouteNonce((value) => value + 1);
      setOrigin({ lat: position.lat, lng: position.lng });
      setOriginName("Your location");
      setRerouting(true);
      spokenCuesRef.current.clear();
      arrivalAnnouncedRef.current = false;

      if (voiceOnRef.current) {
        speak(
          reason === "auto"
            ? "You're off the route. Rerouting from your current location."
            : "Rerouting from your current location.",
        );
      }
      pushToast("Rerouting from where you are…");
    },
    [position, pushToast],
  );

  useEffect(() => {
    if (!live || !route || !position || !offRoute) {
      offRouteSinceRef.current = null;
      return;
    }

    const now = Date.now();
    if (offRouteSinceRef.current === null) {
      offRouteSinceRef.current = now;
      return;
    }
    // A single bad fix is noise; four seconds away from the line is a missed turn.
    if (now - offRouteSinceRef.current < 4000) return;
    if (now - lastRerouteRef.current < 12_000) return;
    if (routeLoading || rerouting) return;

    rerouteFrom("auto");
  }, [live, route, position, offRoute, routeLoading, rerouting, rerouteFrom]);

  // Voice guidance keeps its own memory: one cue per step and distance band.
  useEffect(() => {
    spokenCuesRef.current.clear();
    arrivalAnnouncedRef.current = false;
  }, [route]);

  useEffect(() => {
    if (live) return;
    cancelSpeech();
    spokenCuesRef.current.clear();
    arrivalAnnouncedRef.current = false;
  }, [live]);

  useEffect(() => () => cancelSpeech(), []);

  useEffect(() => {
    if (!live || !route || !position || !nextStep || !voiceOn) return;
    if (nextStep.type === "arrive") return;

    const band = cueBand(distanceToManoeuvre, mode);
    if (band === null) return;

    const key = `${nextStepIndex}:${band}`;
    if (spokenCuesRef.current.has(key)) return;
    spokenCuesRef.current.add(key);

    const instruction = stepInstruction(nextStep, target?.name ?? "your destination");
    const spoken = lowerFirst(instruction);
    speak(
      band === 0
        ? `Now, ${spoken}`
        : `In ${spokenDistance(distanceToManoeuvre)} metres, ${spoken}`,
    );
  }, [
    live,
    route,
    position,
    nextStep,
    nextStepIndex,
    distanceToManoeuvre,
    voiceOn,
    mode,
    target?.name,
  ]);

  // The last few metres are often a gate or a yard the router cannot see.
  const metersLeft = remaining?.meters ?? Number.POSITIVE_INFINITY;
  useEffect(() => {
    if (!live || !route || !target) return;
    if (metersLeft > 35 || arrivalAnnouncedRef.current) return;
    arrivalAnnouncedRef.current = true;
    if (voiceOnRef.current) speak(`You have arrived at ${target.name}.`);
  }, [live, route, target, metersLeft]);

  const toggleVoice = useCallback(() => {
    if (!voiceAvailable) {
      pushToast("Voice guidance isn't supported in this browser.", { tone: "error" });
      return;
    }

    const next = !voiceOnRef.current;
    voiceOnRef.current = next;
    setVoiceOn(next);
    try {
      window.localStorage.setItem(VOICE_PREFERENCE_KEY, next ? "on" : "off");
    } catch {
      // Storage can be blocked; the toggle still works for this visit.
    }

    if (!next) {
      cancelSpeech();
      return;
    }
    primeVoice();
    speak("Voice guidance on.");
  }, [voiceAvailable, pushToast]);

  const startNavigation = useCallback(() => {
    if (!route) return;
    if (!("geolocation" in navigator)) {
      pushToast("This browser cannot share a location.", { tone: "error" });
      return;
    }
    if (!position && origin) {
      setPosition({ ...origin, accuracy: null, heading: null });
    }
    spokenCuesRef.current.clear();
    arrivalAnnouncedRef.current = false;
    setLive(true);

    if (voiceOnRef.current && voiceAvailable) {
      primeVoice();

      // Resolve the step the driver is about to meet at the starting point,
      // not step zero, so the opening line cannot be cut off by a cue fired
      // from the first GPS fix.
      const startPoint = position ?? origin;
      let startIndex = 0;
      let startDistance = 0;
      if (startPoint && metrics) {
        const at = locateOnRoute(route.path, metrics, startPoint);
        const found = stepProgress.findIndex((progress) => progress > at.traveledMeters + 6);
        startIndex = found === -1 ? Math.max(0, route.steps.length - 1) : found;
        startDistance = Math.max(0, (stepProgress[startIndex] ?? 0) - at.traveledMeters);
      }

      const openingStep = route.steps[startIndex] ?? null;
      const band = cueBand(startDistance, mode);
      if (openingStep && openingStep.type !== "arrive" && band !== null) {
        const spoken = lowerFirst(
          stepInstruction(openingStep, target?.name ?? "your destination"),
        );
        speak(
          band > 0
            ? `Navigation started. In ${spokenDistance(startDistance)} metres, ${spoken}`
            : `Navigation started. Now, ${spoken}`,
        );
        spokenCuesRef.current.add(`${startIndex}:${band}`);
      } else {
        speak("Navigation started.");
      }
    }
  }, [
    route,
    position,
    origin,
    pushToast,
    voiceAvailable,
    metrics,
    stepProgress,
    mode,
    target?.name,
  ]);

  const forgetShare = useCallback(() => {
    writeStoredShare(null);
    sharedRouteRef.current = null;
    setShare(null);
  }, []);

  const copyShareLink = useCallback(async () => {
    if (!share) return;
    const url = `${window.location.origin}/trip/${share.token}`;
    try {
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      pushToast("Live safety link copied.", { tone: "success" });
      window.setTimeout(() => setShareCopied(false), 2000);
    } catch {
      window.prompt("Copy this live safety link", url);
    }
  }, [pushToast, share]);

  const createShare = useCallback(async () => {
    if (share) return;
    if (!route || !origin || !target || !position) {
      pushToast("Start navigation first so the link has a live position.", { tone: "error" });
      return;
    }

    setShareBusy(true);
    try {
      const response = await api.post<{ share: TripShare }>("/api/trip-shares", {
        origin: { lat: origin.lat, lng: origin.lng },
        originName,
        destination: { lat: target.lat, lng: target.lng },
        destinationName: target.name,
        destinationAddress: target.address ?? undefined,
        mode,
        routePath: route.path,
        routeDistanceMeters: route.distanceMeters,
        routeDurationSeconds: route.durationSeconds,
        fix: {
          lat: position.lat,
          lng: position.lng,
          accuracy: position.accuracy,
          heading: position.heading,
        },
        remainingMeters: remaining?.meters,
        remainingSeconds: remaining?.seconds,
      });

      const created = response.data.share;
      const next: SharedTripLink = {
        id: created.id,
        token: created.token,
        destinationName: created.destination.name,
        destinationLat: created.destination.lat,
        destinationLng: created.destination.lng,
      };
      writeStoredShare(next);
      sharedRouteRef.current = route;
      lastShareSentRef.current = Date.now();
      setShare(next);
      setShareCopied(false);

      const url = `${window.location.origin}/trip/${next.token}`;
      try {
        await navigator.clipboard.writeText(url);
        setShareCopied(true);
        pushToast("Live safety link created and copied.", { tone: "success" });
      } catch {
        pushToast("Live safety link created. Copy it from Trip safety.", { tone: "success" });
      }
    } catch (error) {
      pushToast(apiError(error), { tone: "error" });
    } finally {
      setShareBusy(false);
    }
  }, [mode, origin, originName, position, pushToast, remaining?.meters, remaining?.seconds, route, share, target]);

  const stopShare = useCallback(
    async (quiet = false) => {
      if (!share) return;
      setShareBusy(true);
      try {
        await api.post(`/api/trip-shares/${share.id}/end`);
        forgetShare();
        if (!quiet) pushToast("Live sharing stopped.", { tone: "success" });
      } catch (error) {
        if (axios.isAxiosError(error) && [404, 409].includes(error.response?.status ?? 0)) {
          forgetShare();
          if (!quiet) pushToast("This live link was already closed.", { tone: "success" });
        } else if (!quiet) {
          pushToast(apiError(error), { tone: "error" });
        }
      } finally {
        setShareBusy(false);
      }
    },
    [forgetShare, pushToast, share],
  );

  const stopNavigation = useCallback(() => {
    if (share) void stopShare(true);
    setLive(false);
  }, [share, stopShare]);

  if (!target && resolving) {
    return (
      <div className="card flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
        <Spinner className="h-7 w-7 text-brand-600" />
        <p className="text-sm font-semibold text-ink">Finding the venue on the map…</p>
        <p className="max-w-sm text-xs leading-5 text-muted">
          {requested.address ?? requested.name}
        </p>
      </div>
    );
  }

  if (!target && errorMessage) {
    return (
      <div className="card mx-auto max-w-lg px-6 py-12 text-center">
        <AlertTriangle className="mx-auto h-10 w-10 text-amber-500" />
        <h2 className="mt-3 text-lg font-bold text-ink">We couldn&apos;t pin that venue</h2>
        <p className="mt-1 text-xs leading-5 text-muted">{errorMessage}</p>
        <p className="mt-4 text-xs font-semibold text-ink">
          {requested.address ?? requested.name}
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <Link to={backPath} className="btn-secondary btn-sm">
            <ArrowLeft className="h-3.5 w-3.5" /> {backLabel}
          </Link>
          {venueQuery && (
            <a
              href={googleAddressHref(venueQuery)}
              target="_blank"
              rel="noreferrer noopener"
              className="btn-primary btn-sm"
            >
              Google Maps <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>
    );
  }

  if (!target) {
    return (
      <div className="card">
        <EmptyState
          icon={MapPin}
          title="Where are we going?"
          description="Open a place or a scheduled event and choose Navigate — the route, distance and turn-by-turn steps appear here."
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Link to="/places" className="btn-primary">
                Browse nearby places
              </Link>
              <Link to="/events" className="btn-secondary">
                See upcoming events
              </Link>
            </div>
          }
        />
      </div>
    );
  }

  const googleHref = googleDirectionsHref(target, mode);
  const arrival = remaining ? arrivalClock(remaining.seconds) : null;
  const activeIndex = live ? nextStepIndex : -1;
  const shareMatchesTrip = Boolean(
    share &&
      Math.abs(share.destinationLat - target.lat) < 0.0002 &&
      Math.abs(share.destinationLng - target.lng) < 0.0002,
  );
  const shareUrl = share ? `${window.location.origin}/trip/${share.token}` : "";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          to={backPath}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted transition hover:text-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> {backLabel}
        </Link>
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
          Street map
        </span>
      </div>

      {/* Destination and the trip summary */}
      <header className="relative overflow-hidden rounded-3xl border border-brand-800/40 bg-brand-950 text-white shadow-lift">
        <span aria-hidden="true" className="tilet-strip absolute inset-x-0 top-0 h-1.5 opacity-80" />
        <div className="relative p-5 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white/80">
                  <Navigation className="h-3 w-3" /> Navigation
                </span>
                {planMode && planMode !== "walking" && (
                  <span className="inline-flex items-center rounded-full border border-accent-300/30 bg-accent-400/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-accent-200">
                    {planMode === "taxi" ? "Taxi plan" : "Bus plan"}
                  </span>
                )}
              </div>
              <h1 className="mt-3 max-w-xl font-display text-2xl font-semibold leading-tight tracking-tight sm:text-[2rem]">
                {target.name}
              </h1>
              <p className="mt-1.5 flex items-center gap-1.5 text-xs text-white/65">
                <MapPin className="h-3.5 w-3.5" />
                {target.address && target.address !== target.name
                  ? target.address
                  : `${target.lat.toFixed(4)}, ${target.lng.toFixed(4)}`}
              </p>
              {planMode && planMode !== "walking" && (
                <p className="mt-2 max-w-md text-[11px] leading-5 text-white/50">
                  The planner&apos;s estimate included{" "}
                  {planMode === "taxi" ? "pickup wait" : "stop wait"} and traffic — the time
                  below is road time from here.
                </p>
              )}
              {target.placeSlug && (
                <Link
                  to={`/places/${target.placeSlug}`}
                  className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-white/70 underline-offset-4 hover:text-white hover:underline"
                >
                  View place details <ArrowRight className="h-3 w-3" />
                </Link>
              )}
            </div>

            <div className="flex items-stretch gap-4 sm:gap-6">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/50">
                  Distance
                </p>
                <p className="mt-1 font-display text-2xl font-semibold leading-none">
                  {route ? formatRouteDistance(remaining?.meters ?? route.distanceMeters) : "—"}
                </p>
              </div>
              <div className="w-px bg-white/15" aria-hidden="true" />
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/50">
                  Time
                </p>
                <p className="mt-1 font-display text-2xl font-semibold leading-none">
                  {route ? formatRouteDuration(remaining?.seconds ?? route.durationSeconds) : "—"}
                </p>
              </div>
              {arrival && (
                <>
                  <div className="hidden w-px bg-white/15 sm:block" aria-hidden="true" />
                  <div className="hidden sm:block">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/50">
                      Arrive
                    </p>
                    <p className="mt-1 font-display text-2xl font-semibold leading-none">{arrival}</p>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={live ? stopNavigation : startNavigation}
              disabled={!route || locating || Boolean(routeError)}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50",
                live
                  ? "bg-rose-500 text-white hover:bg-rose-600"
                  : "bg-white text-brand-950 hover:bg-brand-50",
              )}
            >
              {live ? (
                <>
                  <ArrowLeft className="h-4 w-4" /> End navigation
                </>
              ) : (
                <>
                  <Navigation className="h-4 w-4" /> Start navigation
                </>
              )}
            </button>

            <div className="inline-flex rounded-xl border border-white/20 bg-white/10 p-0.5">
              {(["driving", "walking"] as TravelMode[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setMode(option)}
                  aria-pressed={mode === option}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-[10px] px-3 py-1.5 text-[11px] font-semibold transition",
                    mode === option
                      ? "bg-white text-brand-950 shadow-sm"
                      : "text-white/70 hover:text-white",
                  )}
                >
                  {option === "driving" ? (
                    <Car className="h-3.5 w-3.5" />
                  ) : (
                    <Footprints className="h-3.5 w-3.5" />
                  )}
                  {option === "driving" ? "Driving" : "Walking"}
                </button>
              ))}
            </div>

            {voiceAvailable && (
              <button
                type="button"
                onClick={toggleVoice}
                aria-pressed={voiceOn}
                title={voiceOn ? "Mute voice guidance" : "Turn on voice guidance"}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[11px] font-semibold transition",
                  voiceOn
                    ? "border-white/30 bg-white/15 text-white"
                    : "border-white/20 bg-white/5 text-white/60 hover:text-white",
                )}
              >
                {voiceOn ? (
                  <Volume2 className="h-3.5 w-3.5" />
                ) : (
                  <VolumeX className="h-3.5 w-3.5" />
                )}
                {voiceOn ? "Voice on" : "Voice off"}
              </button>
            )}

            <button
              type="button"
              onClick={share ? () => void copyShareLink() : () => void createShare()}
              disabled={!share && (!live || !route || !position || shareBusy)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-white/75 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {shareBusy ? (
                <Spinner className="h-3.5 w-3.5" />
              ) : share ? (
                shareCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />
              ) : (
                <Share2 className="h-3.5 w-3.5" />
              )}
              {share ? (shareCopied ? "Copied" : "Copy live link") : "Share live"}
            </button>

            <a
              href={googleHref}
              target="_blank"
              rel="noreferrer noopener"
              className="ml-auto inline-flex items-center gap-1.5 text-[11px] font-semibold text-white/60 transition hover:text-white"
            >
              Google Maps <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          {routeLoading && (
            <div className="mt-4 flex items-center gap-2 text-[11px] text-white/60">
              <Spinner className="h-3.5 w-3.5" />
              {route ? "Recalculating the route…" : "Finding the best route…"}
            </div>
          )}
        </div>
      </header>

      {live && (offRoute || rerouting) && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-300/70 bg-amber-50 p-4 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/15">
            {rerouting ? (
              <Spinner className="h-4 w-4" />
            ) : (
              <AlertTriangle className="h-4 w-4" />
            )}
          </span>
          <div className="min-w-0 flex-1 text-xs leading-5">
            <p className="text-sm font-semibold">
              {rerouting ? "Rerouting…" : "You've left the route"}
            </p>
            <p className="mt-0.5">
              {rerouting
                ? "Finding a new way from where you are now."
                : "Keep moving — we'll reroute automatically in a moment, or start now."}
            </p>
          </div>
          {!rerouting && (
            <button
              type="button"
              onClick={() => rerouteFrom("manual")}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-amber-400/80 bg-white px-3 py-2 text-[11px] font-semibold text-amber-900 shadow-sm transition hover:bg-amber-100 dark:bg-amber-400/10 dark:text-amber-200 dark:hover:bg-amber-400/20"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Reroute now
            </button>
          )}
        </div>
      )}

      {live && nextStep && route && (
        <div className="sticky top-[68px] z-20 flex items-center gap-3 rounded-2xl border border-brand-700/40 bg-brand-800 px-4 py-3 text-white shadow-lift">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10">
            <StepIcon shape={stepShape(nextStep)} className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/55">
              {distanceToManoeuvre > 8
                ? `In ${formatRouteDistance(distanceToManoeuvre)}`
                : "Now"}
            </p>
            <p className="truncate text-sm font-semibold">
              {stepInstruction(nextStep, target.name)}
            </p>
            <p className="text-[11px] text-white/60">
              {formatRouteDistance(remaining?.meters ?? route.distanceMeters)} left ·{" "}
              {formatRouteDuration(remaining?.seconds ?? route.durationSeconds)}
              {arrival ? ` · arrive ${arrival}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={() => rerouteFrom("manual")}
            aria-label="Reroute from my location"
            title="Reroute from my location"
            className="shrink-0 rounded-lg border border-white/25 p-2 text-white/85 transition hover:bg-white/10"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={stopNavigation}
            className="shrink-0 rounded-lg border border-white/25 px-2.5 py-1.5 text-[11px] font-semibold text-white/85 transition hover:bg-white/10"
          >
            End
          </button>
        </div>
      )}

      {routeError && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-300/70 bg-amber-50 p-4 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0 text-xs leading-5">
            <p className="font-semibold">We couldn&apos;t build a route</p>
            <p className="mt-0.5">{routeError}</p>
            <a
              href={googleHref}
              target="_blank"
              rel="noreferrer noopener"
              className="mt-1.5 inline-flex items-center gap-1 font-semibold underline underline-offset-4"
            >
              Open in Google Maps <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="card overflow-hidden">
          <div className="relative">
            <div className="nav-map relative z-0 h-[340px] w-full sm:h-[460px]">
              <RouteMap
                className="h-full w-full"
                route={route}
                origin={origin}
                destination={target}
                user={position}
                follow={live}
                picking={picking}
                onPick={pickStart}
              />
            </div>

            {!origin && !picking && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-brand-950/45 p-4 backdrop-blur-[2px]">
                <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-5 text-center shadow-lift">
                  {locating ? (
                    <>
                      <Spinner className="mx-auto h-6 w-6" />
                      <p className="mt-3 text-sm font-semibold text-ink">Finding your location…</p>
                      <p className="mt-1 text-xs leading-5 text-muted">
                        Allow location access so we can start the route from where you are.
                      </p>
                    </>
                  ) : (
                    <>
                      <span className="mx-auto inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
                        <LocateFixed className="h-5 w-5" />
                      </span>
                      <p className="mt-2.5 text-sm font-semibold text-ink">
                        We need a starting point
                      </p>
                      <p className="mt-1 text-xs leading-5 text-muted">
                        {locationError ?? "Location is unavailable on this device."}
                      </p>
                      <div className="mt-3.5 flex flex-wrap items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => void retryLocation()}
                          className="btn-primary btn-sm"
                        >
                          <LocateFixed className="h-3.5 w-3.5" /> Use my location
                        </button>
                        <button
                          type="button"
                          onClick={() => setPicking(true)}
                          className="btn-secondary btn-sm"
                        >
                          <MapPin className="h-3.5 w-3.5" /> Set start on map
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {picking && (
              <div className="pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-full bg-brand-950/90 px-3.5 py-1.5 text-[11px] font-semibold text-white shadow-lift">
                Tap the map to set your starting point
              </div>
            )}

            {live && (
              <span className="absolute right-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-full bg-brand-950/85 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white shadow-lift">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> Live
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-3 text-[11px] text-muted">
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" /> From {originName}, to {target.name}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> Pins are neighbourhood-level — check the door before you
              commit.
            </span>
          </div>
        </section>

        <aside className="space-y-4">
          <section className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <h2 className="text-sm font-semibold text-ink">Turn-by-turn</h2>
              <span className="text-[11px] text-muted">
                {route ? `${visibleSteps.length} steps` : routeLoading ? "…" : "—"}
              </span>
            </div>

            {route ? (
              <ol className="max-h-[360px] divide-y divide-line overflow-y-auto lg:max-h-[520px]">
                {visibleSteps.map(({ step, index }) => {
                  const active = index === activeIndex;
                  return (
                    <li
                      key={`${index}-${step.location.lat}-${step.location.lng}`}
                      className={cn(
                        "flex gap-3 px-4 py-3 transition",
                        active && "bg-brand-50 dark:bg-brand-500/10",
                      )}
                    >
                      <span
                        className={cn(
                          "mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border",
                          active
                            ? "border-brand-700 bg-brand-700 text-white"
                            : "border-line bg-raised text-muted",
                        )}
                        aria-hidden="true"
                      >
                        <StepIcon shape={stepShape(step)} />
                      </span>
                      <div className="min-w-0">
                        <p
                          className={cn(
                            "text-[13px] leading-5",
                            active ? "font-semibold text-ink" : "font-medium text-ink/90",
                          )}
                        >
                          {stepInstruction(step, target.name)}
                        </p>
                        <p className="text-[11px] text-muted">{stepCaption(step)}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="px-4 py-6 text-center text-xs text-muted">
                {routeLoading
                  ? "Finding the best route…"
                  : "The steps appear here once we know where you are."}
              </p>
            )}
          </section>

          <section className="card p-4">
            <h2 className="text-sm font-semibold text-ink">This trip</h2>
            <dl className="mt-3 space-y-2.5 text-[12px]">
              <div className="flex items-start justify-between gap-3">
                <dt className="text-muted">From</dt>
                <dd className="text-right font-medium text-ink">
                  {originName}
                  {origin && (
                    <span className="block text-[10px] font-normal text-muted">
                      {origin.lat.toFixed(4)}, {origin.lng.toFixed(4)}
                    </span>
                  )}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-muted">To</dt>
                <dd className="text-right font-medium text-ink">{target.name}</dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-muted">Mode</dt>
                <dd className="text-right font-medium text-ink">
                  {mode === "driving" ? "Driving" : "Walking"}
                </dd>
              </div>
              {route && (
                <>
                  <div className="flex items-start justify-between gap-3 border-t border-line pt-2.5">
                    <dt className="text-muted">Distance</dt>
                    <dd className="text-right font-medium text-ink">
                      {formatRouteDistance(route.distanceMeters)}
                    </dd>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <dt className="text-muted">Estimated time</dt>
                    <dd className="text-right font-medium text-ink">
                      {formatRouteDuration(route.durationSeconds)}
                    </dd>
                  </div>
                </>
              )}
            </dl>

            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => void retryLocation()}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-line px-3 py-2 text-[11px] font-semibold text-ink transition hover:border-brand-500/40 hover:bg-raised"
              >
                <LocateFixed className="h-3.5 w-3.5" /> Start from my location
              </button>
              <button
                type="button"
                onClick={() => setPicking(true)}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-line px-3 py-2 text-[11px] font-semibold text-ink transition hover:border-brand-500/40 hover:bg-raised"
              >
                <MapPin className="h-3.5 w-3.5" /> Drop a different start
              </button>
            </div>
          </section>

          <section className="card overflow-hidden">
            <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
              <h2 className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink">
                <ShieldCheck className="h-3.5 w-3.5 text-brand-700 dark:text-brand-300" />
                Trip safety
              </h2>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em]",
                  share
                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                    : "bg-raised text-muted",
                )}
              >
                {share ? "Live link on" : "Off"}
              </span>
            </div>

            <div className="p-4">
              {share ? (
                <>
                  <p className="text-[11px] leading-5 text-muted">
                    {shareMatchesTrip
                      ? "A trusted contact can follow this trip, see your ETA and find the nearest hospital without signing in."
                      : `A live link to ${share.destinationName} is still active. It is not receiving updates from this trip.`}
                  </p>

                  <div className="mt-2.5 flex items-center gap-1.5">
                    <input
                      readOnly
                      value={shareUrl}
                      aria-label="Live safety link"
                      onFocus={(event) => event.currentTarget.select()}
                      className="input h-9 min-w-0 flex-1 text-[10px]"
                    />
                    <button
                      type="button"
                      onClick={() => void copyShareLink()}
                      className="btn-secondary btn-sm shrink-0 px-2.5"
                    >
                      {shareCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      {shareCopied ? "Copied" : "Copy"}
                    </button>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <a
                      href={`/trip/${share.token}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-2.5 py-2 text-[11px] font-semibold text-ink transition hover:border-brand-500/40 hover:bg-raised"
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> Open safety page
                    </a>
                    <button
                      type="button"
                      onClick={() => void stopShare()}
                      disabled={shareBusy}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-2 text-[11px] font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/20"
                    >
                      {shareBusy ? <Spinner className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                      Stop sharing
                    </button>
                  </div>

                  {shareMatchesTrip && live && (
                    <p className="mt-2 inline-flex items-center gap-1.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                      Updating from this device every few seconds.
                    </p>
                  )}
                </>
              ) : (
                <>
                  <p className="text-[11px] leading-5 text-muted">
                    Share a live link with someone you trust. They can follow your route, see your
                    ETA and get the nearest hospital — no account needed.
                  </p>
                  <button
                    type="button"
                    onClick={() => void createShare()}
                    disabled={!live || !route || !position || shareBusy}
                    className="btn-primary btn-sm mt-3 w-full"
                  >
                    {shareBusy ? <Spinner className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />}
                    Share live trip
                  </button>
                  <p className="mt-1.5 text-[10px] leading-4 text-muted">
                    {live
                      ? "The link is copied when it is created. It stops when you end navigation or press Stop sharing."
                      : "Start navigation first — the link goes live with your position."}
                  </p>
                </>
              )}
            </div>
          </section>

          <NearbyServices
            location={
              position
                ? {
                    lat: Number(position.lat.toFixed(3)),
                    lng: Number(position.lng.toFixed(3)),
                  }
                : origin
            }
          />
        </aside>
      </div>
    </div>
  );
}
