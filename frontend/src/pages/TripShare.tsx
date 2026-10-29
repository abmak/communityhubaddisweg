import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import axios from "axios";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  HeartPulse,
  MapPin,
  Navigation,
  Phone,
  Pill,
  Radio,
  Share2,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import type { DirectionsRoute, TripShareResponse, TripShareStatus } from "../types";
import { api, apiError } from "../lib/api";
import {
  formatRouteDistance,
  formatRouteDuration,
  googleDirectionsHref,
  navigationPath,
} from "../lib/navigation";
import { useUI } from "../store/ui";
import { Avatar, Spinner } from "../components/ui";
import { RouteMap } from "../components/RouteMap";
import { BrandMark, Wordmark } from "../components/Brand";
import { cn } from "../lib/utils";

const STATUS_STYLES: Record<
  TripShareStatus,
  { label: string; wrap: string; dot: string }
> = {
  ACTIVE: {
    label: "Live",
    wrap: "border-emerald-400/40 bg-emerald-500/15 text-emerald-100",
    dot: "bg-emerald-400",
  },
  ARRIVED: {
    label: "Arrived safely",
    wrap: "border-emerald-400/40 bg-emerald-500/15 text-emerald-100",
    dot: "bg-emerald-400",
  },
  ENDED: {
    label: "Sharing ended",
    wrap: "border-white/15 bg-white/5 text-white/65",
    dot: "bg-white/40",
  },
  EXPIRED: {
    label: "Link expired",
    wrap: "border-rose-400/40 bg-rose-500/15 text-rose-100",
    dot: "bg-rose-400",
  },
};

const MODE_LABEL: Record<string, string> = {
  driving: "Driving",
  walking: "Walking",
  taxi: "Taxi",
  bus: "Bus / minibus",
};

function clockTime(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function dateTime(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function ageLabel(seconds: number | null): string {
  if (seconds === null) return "No location received yet";
  if (seconds < 5) return "Updated just now";
  if (seconds < 60) return `Updated ${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Updated ${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return `Updated ${hours} hr ago`;
}

function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-line bg-surface/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link to="/home" className="flex items-center gap-2.5 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
            <BrandMark className="h-8 w-8" />
            <Wordmark compact />
          </Link>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-brand-800 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-200">
            <ShieldCheck className="h-3.5 w-3.5" /> Trip safety
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-5 px-4 py-5 sm:px-6 sm:py-8">{children}</main>

      <footer className="mx-auto max-w-5xl px-4 pb-8 text-[11px] leading-5 text-muted sm:px-6">
        <span lang="am" className="font-ethiopic text-ink/80">አዲስ ገበታ</span> · Share this link only with
        someone you trust. It expires on its own.
      </footer>
    </div>
  );
}

function SafetyPlace({
  label,
  icon,
  place,
}: {
  label: string;
  icon: ReactNode;
  place: TripShareResponse["safety"]["hospital"];
}) {
  if (!place) {
    return (
      <div className="rounded-xl border border-line bg-raised/40 p-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">{label}</p>
        <p className="mt-1 text-xs text-muted">No mapped option found nearby.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-line bg-raised/40 p-3">
      <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
        {icon} {label}
      </p>
      <p className="mt-1 text-[13px] font-semibold leading-5 text-ink">{place.name}</p>
      <p className="mt-0.5 text-[11px] leading-4 text-muted">
        {place.distanceKm.toFixed(1)} km
        {place.area ? ` · ${place.area}` : place.city ? ` · ${place.city}` : ""}
      </p>
      <Link
        to={navigationPath({
          name: place.name,
          lat: place.lat,
          lng: place.lng,
          placeSlug: place.slug,
          address: place.address,
        })}
        className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700 transition hover:underline dark:text-brand-300"
      >
        <Navigation className="h-3 w-3" /> Directions
      </Link>
    </div>
  );
}

function EmergencyCard({
  safety,
  showPlaces = true,
}: {
  safety: TripShareResponse["safety"];
  /** False when the link is closed: the numbers still matter, the pins cannot be trusted. */
  showPlaces?: boolean;
}) {
  return (
    <section className="card overflow-hidden">
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300">
          <HeartPulse className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-ink">If something goes wrong</h2>
          <p className="text-[10px] text-muted">
            {showPlaces
              ? "Emergency services and the closest care."
              : "Call for help, even now that this link is closed."}
          </p>
        </div>
      </div>

      <div className="p-4">
        <div className="grid grid-cols-3 gap-2">
          <a
            href="tel:911"
            className="inline-flex flex-col items-center justify-center gap-1 rounded-xl bg-rose-600 px-2 py-2.5 text-center text-[10px] font-bold text-white transition hover:bg-rose-700"
          >
            <Phone className="h-4 w-4" /> Emergency
            <span className="text-[13px] leading-none">911</span>
          </a>
          <a
            href="tel:907"
            className="inline-flex flex-col items-center justify-center gap-1 rounded-xl border border-line bg-surface px-2 py-2.5 text-center text-[10px] font-bold text-ink transition hover:bg-raised"
          >
            <HeartPulse className="h-4 w-4 text-rose-500" /> Ambulance
            <span className="text-[13px] leading-none">907</span>
          </a>
          <a
            href="tel:991"
            className="inline-flex flex-col items-center justify-center gap-1 rounded-xl border border-line bg-surface px-2 py-2.5 text-center text-[10px] font-bold text-ink transition hover:bg-raised"
          >
            <ShieldAlert className="h-4 w-4 text-brand-700 dark:text-brand-300" /> Police
            <span className="text-[13px] leading-none">991</span>
          </a>
        </div>

        {showPlaces && (
          <div className="mt-3 space-y-2">
            <SafetyPlace
              label="Nearest hospital"
              icon={<HeartPulse className="h-3 w-3" />}
              place={safety.hospital}
            />
            <SafetyPlace
              label="Nearest pharmacy"
              icon={<Pill className="h-3 w-3" />}
              place={safety.pharmacy}
            />
          </div>
        )}

        <p className="mt-3 text-[10px] leading-4 text-muted">
          Location comes from the traveler&apos;s phone and can be delayed or inaccurate. In an
          emergency, call 911 directly — don&apos;t wait for this page to update.
        </p>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
      <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/45">{label}</p>
      <p className="mt-0.5 truncate text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function Unavailable({ message }: { message: string }) {
  return (
    <>
      <section className="card p-6 text-center sm:p-8">
        <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300">
          <ShieldAlert className="h-6 w-6" />
        </span>
        <h1 className="mt-3 font-display text-xl font-semibold text-ink">
          This live link isn&apos;t available
        </h1>
        <p className="mx-auto mt-1.5 max-w-md text-sm leading-6 text-muted">{message}</p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <Link to="/home" className="btn-primary">
            Open Addis Gebeta
          </Link>
          <a href="tel:911" className="btn-secondary">
            <Phone className="h-3.5 w-3.5" /> Call 911
          </a>
        </div>
      </section>
      <EmergencyCard safety={{ hospital: null, pharmacy: null }} showPlaces={false} />
    </>
  );
}

export function TripSharePage() {
  const { token } = useParams<{ token: string }>();
  const pushToast = useUI((state) => state.pushToast);
  const [data, setData] = useState<TripShareResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchedAt, setFetchedAt] = useState(0);
  const [clock, setClock] = useState(() => Date.now());
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState<"arrive" | "end" | "late" | null>(null);
  const [lateMinutes, setLateMinutes] = useState(10);
  const stoppedRef = useRef(false);

  const fetchTrip = useCallback(
    async (quiet = false) => {
      if (!token) return;
      if (!quiet) setLoading(true);

      try {
        const response = await api.get<TripShareResponse>(
          `/api/trip-shares/${encodeURIComponent(token)}`,
        );
        setData(response.data);
        setFetchedAt(Date.now());
        setError(null);
      } catch (err) {
        let code: string | undefined;
        let status: number | undefined;
        if (axios.isAxiosError(err)) {
          status = err.response?.status;
          code = (
            err.response?.data as { error?: { code?: string } } | undefined
          )?.error?.code;
        }
        if (status === 404 || code === "TRIP_EXPIRED" || status === 410) {
          stoppedRef.current = true;
          setData(null);
        }
        setError(apiError(err, "This live link could not be loaded."));
      } finally {
        if (!quiet) setLoading(false);
      }
    },
    [token],
  );

  useEffect(() => {
    stoppedRef.current = false;
    setData(null);
    setError(null);
    setLoading(true);
    void fetchTrip();

    const poll = window.setInterval(() => {
      if (!stoppedRef.current) void fetchTrip(true);
    }, 8000);
    const tick = window.setInterval(() => setClock(Date.now()), 1000);

    return () => {
      window.clearInterval(poll);
      window.clearInterval(tick);
    };
  }, [fetchTrip]);

  const trip = data?.trip ?? null;

  useEffect(() => {
    const previous = document.title;
    document.title = trip
      ? `${trip.traveler.displayName} · Live trip`
      : "Live trip safety · Addis Gebeta";
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    return () => {
      document.title = previous;
      meta.remove();
    };
  }, [trip?.traveler.displayName]);

  const copyLink = useCallback(async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      pushToast("Live link copied.", { tone: "success" });
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this live link", url);
    }
  }, [pushToast]);

  const act = useCallback(
    async (action: "arrive" | "end" | "late") => {
      if (!trip) return;
      setBusy(action);
      try {
        await api.post(
          `/api/trip-shares/${trip.id}/${action}`,
          action === "late" ? { minutes: lateMinutes } : {},
        );
        pushToast(
          action === "arrive"
            ? "Marked as arrived. Your contact can see it."
            : action === "end"
              ? "Live sharing stopped."
              : "Your contact will see you are running late.",
          { tone: "success" },
        );
        await fetchTrip(true);
      } catch (err) {
        pushToast(apiError(err), { tone: "error" });
      } finally {
        setBusy(null);
      }
    },
    [fetchTrip, lateMinutes, pushToast, trip],
  );

  const routeKey = trip?.routePath
    ? `${trip.routePath.length}:${trip.routePath[0]?.lat}:${trip.routePath[0]?.lng}:${
        trip.routePath[trip.routePath.length - 1]?.lat
      }:${trip.routePath[trip.routePath.length - 1]?.lng}`
    : "none";

  const mapRoute = useMemo<DirectionsRoute | null>(() => {
    if (!trip?.routePath || trip.routePath.length < 2) return null;
    const path = trip.routePath;
    const lats = path.map((point) => point.lat);
    const lngs = path.map((point) => point.lng);
    return {
      mode: trip.mode === "walking" ? "walking" : "driving",
      distanceMeters: trip.routeDistanceMeters ?? 0,
      durationSeconds: trip.routeDurationSeconds ?? 0,
      path,
      steps: [],
      bounds: {
        south: Math.min(...lats),
        west: Math.min(...lngs),
        north: Math.max(...lats),
        east: Math.max(...lngs),
      },
    };
    // The map only needs a new route object when the line itself changes; the
    // live marker is updated separately by RouteMap.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKey]);

  if (!token) {
    return (
      <PageShell>
        <Unavailable message="This link is missing its trip code." />
      </PageShell>
    );
  }

  if (loading && !data) {
    return (
      <PageShell>
        <div className="card flex min-h-[280px] flex-col items-center justify-center gap-3 p-8 text-center">
          <Spinner className="h-7 w-7 text-brand-600" />
          <p className="text-sm font-semibold text-ink">Finding this live trip…</p>
          <p className="max-w-sm text-xs leading-5 text-muted">
            We are checking the link and the latest location shared by the traveler.
          </p>
        </div>
      </PageShell>
    );
  }

  if (!data || !trip) {
    return (
      <PageShell>
        <Unavailable message={error ?? "This live link has expired or is no longer active."} />
      </PageShell>
    );
  }

  const active = trip.status === "ACTIVE";
  const paused = active && (!trip.live || (trip.lastFixAgoSeconds ?? 0) > 120);
  const meta = STATUS_STYLES[trip.status];
  const statusLabel = paused ? "Location paused" : meta.label;
  const statusWrap = paused
    ? "border-amber-400/40 bg-amber-500/15 text-amber-100"
    : meta.wrap;
  const statusDot = paused ? "bg-amber-400" : meta.dot;

  const ageSeconds =
    trip.lastFixAgoSeconds === null
      ? null
      : trip.lastFixAgoSeconds + Math.max(0, Math.floor((clock - fetchedAt) / 1000));

  const remainingMeters = trip.remainingMeters ?? trip.routeDistanceMeters;
  const remainingSeconds = trip.remainingSeconds ?? trip.routeDurationSeconds;
  const arrival = clockTime(trip.estimatedArrivalAt);
  const arrived = clockTime(trip.arrivedAt);
  const ended = dateTime(trip.endedAt);
  const expires = dateTime(trip.expiresAt);

  const liveNote = active
    ? paused
      ? ageSeconds === null
        ? "Waiting for the traveler's first location."
        : `Location paused — ${ageLabel(ageSeconds).toLowerCase()}. The link is still active.`
      : ageLabel(ageSeconds)
    : trip.status === "ARRIVED"
      ? `Arrived${arrived ? ` at ${arrived}` : ""}.`
      : trip.status === "ENDED"
        ? `Sharing stopped${ended ? ` ${ended}` : ""}.`
        : "This link is no longer active.";

  return (
    <PageShell>
      {error && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-amber-300/70 bg-amber-50 p-3 text-[11px] leading-5 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>Couldn&apos;t refresh just now. Showing the last update we received.</span>
        </div>
      )}

      <section className="relative overflow-hidden rounded-3xl border border-brand-800/40 bg-brand-950 text-white shadow-lift">
        <span aria-hidden="true" className="tilet-strip absolute inset-x-0 top-0 h-1.5 opacity-80" />
        <div className="relative p-5 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em]",
                statusWrap,
              )}
            >
              <span className={cn("h-2 w-2 rounded-full", statusDot, active && !paused && "animate-pulse")} />
              {statusLabel}
            </span>
            <button
              type="button"
              onClick={() => void copyLink()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-white/85 transition hover:bg-white/15"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy live link"}
            </button>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <Avatar
              name={trip.traveler.displayName}
              username={trip.traveler.username}
              src={trip.traveler.avatarUrl}
              size="lg"
            />
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/45">
                Shared by
              </p>
              <p className="truncate font-display text-xl font-semibold leading-tight">
                {trip.traveler.displayName}
              </p>
              <p className="truncate text-[11px] text-white/55">@{trip.traveler.username}</p>
            </div>
          </div>

          <h1 className="mt-5 max-w-2xl font-display text-2xl font-semibold leading-tight tracking-tight sm:text-[2rem]">
            {active ? "On the way to " : trip.status === "ARRIVED" ? "Arrived at " : "Trip to "}
            {trip.destination.name}
          </h1>
          <p className="mt-1.5 flex items-start gap-1.5 text-xs leading-5 text-white/65">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {trip.destination.address ?? `${trip.destination.lat.toFixed(4)}, ${trip.destination.lng.toFixed(4)}`}
          </p>

          <p className={cn("mt-3 inline-flex items-center gap-1.5 text-[11px]", paused ? "text-amber-200" : "text-white/55")}>
            {active && !paused ? (
              <Radio className="h-3 w-3" />
            ) : paused ? (
              <AlertTriangle className="h-3 w-3" />
            ) : trip.status === "ARRIVED" ? (
              <CheckCircle2 className="h-3 w-3 text-emerald-300" />
            ) : (
              <XCircle className="h-3 w-3" />
            )}
            {liveNote}
          </p>

          {trip.delayMinutes > 0 && active && (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-[10px] font-semibold text-amber-100">
              <Clock className="h-3 w-3" />
              {trip.note ?? `Running about ${trip.delayMinutes} minutes late.`}
            </p>
          )}

          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat
              label={trip.status === "ARRIVED" ? "Arrived" : "Arrive"}
              value={
                trip.status === "ARRIVED"
                  ? (arrived ?? "Yes")
                  : active
                    ? (arrival ?? "—")
                    : "—"
              }
            />
            <Stat
              label="Distance"
              value={
                trip.status === "ARRIVED"
                  ? "0 km"
                  : active && remainingMeters !== null
                    ? formatRouteDistance(remainingMeters)
                    : "—"
              }
            />
            <Stat
              label="Time left"
              value={
                active && remainingSeconds !== null ? formatRouteDuration(remainingSeconds) : "—"
              }
            />
            <Stat label="Mode" value={MODE_LABEL[trip.mode] ?? trip.mode} />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-white/45">
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" /> Link expires {expires ?? "soon"}
            </span>
            {trip.status === "ACTIVE" && (
              <span className="inline-flex items-center gap-1">
                <ShieldCheck className="h-3 w-3" /> Updates every few seconds
              </span>
            )}
          </div>
        </div>
      </section>

      {trip.isOwner && (trip.status === "ACTIVE" || trip.status === "ARRIVED") && (
        <section className="card p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink">
                <ShieldCheck className="h-4 w-4 text-brand-700 dark:text-brand-300" />
                You&apos;re sharing this trip
              </h2>
              <p className="mt-0.5 text-[11px] leading-5 text-muted">
                Only people with this link can see it. Stop sharing as soon as you arrive.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void act("end")}
              disabled={busy !== null}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-[11px] font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/20"
            >
              {busy === "end" ? <Spinner className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
              Stop sharing
            </button>
          </div>

          {trip.status === "ACTIVE" && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void act("arrive")}
                disabled={busy !== null}
                className="btn-primary btn-sm"
              >
                {busy === "arrive" ? <Spinner className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                I&apos;ve arrived
              </button>
              <div className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-2 py-1.5">
                <Clock className="h-3.5 w-3.5 text-muted" />
                <label htmlFor="late-minutes" className="sr-only">
                  Minutes late
                </label>
                <select
                  id="late-minutes"
                  value={lateMinutes}
                  onChange={(event) => setLateMinutes(Number(event.target.value))}
                  className="bg-transparent text-[11px] font-semibold text-ink outline-none"
                >
                  {[5, 10, 15, 30].map((minutes) => (
                    <option key={minutes} value={minutes}>
                      {minutes} min late
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => void act("late")}
                  disabled={busy !== null}
                  className="text-[11px] font-bold text-brand-700 disabled:opacity-50 dark:text-brand-300"
                >
                  {busy === "late" ? "Sending…" : "Tell them"}
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
            <h2 className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink">
              <Navigation className="h-3.5 w-3.5 text-brand-700 dark:text-brand-300" />
              Live position
            </h2>
            <a
              href={googleDirectionsHref(
                trip.destination,
                trip.mode === "walking" ? "walking" : "driving",
              )}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1 text-[10px] font-semibold text-muted transition hover:text-ink"
            >
              Open in Maps <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          {mapRoute ? (
            <div className="nav-map relative h-[320px] w-full sm:h-[420px]">
              <RouteMap
                className="h-full w-full"
                route={mapRoute}
                origin={trip.origin}
                destination={{ ...trip.destination, name: trip.destination.name }}
                user={trip.current}
                follow={false}
                picking={false}
                onPick={() => undefined}
              />
              {active && (
                <span className="absolute left-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-full bg-brand-950/85 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white shadow-lift">
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      paused ? "bg-amber-400" : "animate-pulse bg-emerald-400",
                    )}
                  />
                  {paused ? "Paused" : "Live"}
                </span>
              )}
            </div>
          ) : (
            <div className="flex min-h-[220px] flex-col items-center justify-center gap-2 p-6 text-center">
              <MapPin className="h-7 w-7 text-muted" />
              <p className="text-sm font-semibold text-ink">Map not available</p>
              <p className="max-w-xs text-xs leading-5 text-muted">
                {trip.status === "ACTIVE"
                  ? "The traveler didn't attach a road route to this link. Their destination is still shown above."
                  : "The live map is closed now that this trip has ended. The destination is still shown above."}
              </p>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-3 text-[10px] text-muted">
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-3 w-3" /> {trip.origin.name ?? "Starting point"} → {trip.destination.name}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Share2 className="h-3 w-3" /> Only people with this link can watch
            </span>
          </div>
        </section>

        <div className="space-y-5">
          <EmergencyCard safety={data.safety} />

          <section className="card p-4">
            <h2 className="text-sm font-semibold text-ink">About this link</h2>
            <p className="mt-1.5 text-[11px] leading-5 text-muted">
              The traveler started this link from in-app navigation. Their phone sends a new
              position while navigation is running. If the page says paused, the phone may be
              out of signal, the tab may be closed, or navigation may have stopped.
            </p>
            <p className="mt-2 text-[11px] leading-5 text-muted">
              The link stops working when the traveler arrives, ends sharing, or the expiry time
              passes. For anything urgent, call the traveler or emergency services directly.
            </p>
          </section>
        </div>
      </div>
    </PageShell>
  );
}
