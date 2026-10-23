import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  Copy,
  Heart,
  MapPin,
  Navigation,
  Share2,
  Sparkles,
  Star,
  Ticket,
} from "lucide-react";
import type { PlaceDetailResponse } from "../types";
import { useQuery } from "../hooks/useApi";
import { Badge, EmptyState, Spinner } from "../components/ui";
import { useUI } from "../store/ui";
import {
  KIND_META,
  directionsHref,
  formatDistance,
  mapsHref,
  placePath,
} from "../lib/places";
import { useSavedPlaces } from "../lib/savedPlaces";
import { cn } from "../lib/utils";

/** Small static map, no API key needed. Falls back to a link if it will not load. */
function mapEmbedUrl(lat: number, lng: number): string {
  const pad = 0.012;
  const bbox = [lng - pad, lat - pad / 2, lng + pad, lat + pad / 2].join("%2C");
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lng}`;
}

function priceText(level: number | null): string {
  if (level === null) return "Not listed";
  return `${"$".repeat(level)} · ${["budget", "moderate", "smart", "splurge"][level - 1] ?? "moderate"}`;
}

export function PlaceDetailPage() {
  const { slug = "" } = useParams();
  const pushToast = useUI((state) => state.pushToast);
  const { isSaved, toggle } = useSavedPlaces();
  const { data, loading, error } = useQuery<PlaceDetailResponse>(
    slug ? `/api/places/${encodeURIComponent(slug)}` : null,
  );

  const place = data?.place;
  const meta = place ? KIND_META[place.kind] : null;
  const Icon = meta?.icon ?? MapPin;
  const saved = place ? isSaved(place.slug) : false;

  const nearby = useMemo(() => data?.nearby ?? [], [data]);

  const share = async () => {
    if (!place) return;
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: place.name, text: place.description, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      pushToast("Link copied — send it to whoever is coming with you.", { tone: "success" });
    } catch {
      // A cancelled share sheet is not an error worth shouting about.
    }
  };

  if (loading && !place) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  if (error || !place || !meta) {
    return (
      <div className="card">
        <EmptyState
          icon={MapPin}
          title="That place is not on the list"
          description={error ?? "The link may be old, or the place was removed from the directory."}
          action={
            <Link to="/places" className="btn-primary">
              Browse nearby places
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        to="/places"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted transition hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> All places
      </Link>

      {/* Hero */}
      <header className="relative overflow-hidden rounded-3xl border border-line bg-brand-950 shadow-lift">
        <img
          src={meta.photo}
          alt={meta.photoAlt}
          width={1600}
          height={720}
          className="h-[280px] w-full object-cover opacity-90 sm:h-[360px]"
        />
        <span
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-brand-950 via-brand-950/55 to-transparent"
        />
        <span aria-hidden="true" className="tilet-strip absolute inset-x-0 top-0 h-2 opacity-80" />

        <div className="absolute inset-x-0 bottom-0 p-5 text-white sm:p-7">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-black/25 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] backdrop-blur-sm">
              <Icon className="h-3 w-3" /> {meta.label}
            </span>
            <span
              lang="am"
              className="font-ethiopic rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] text-white/75"
            >
              {meta.am}
            </span>
            {place.featured && (
              <span className="inline-flex items-center gap-1 rounded-full bg-accent-400 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-brand-950">
                <Sparkles className="h-3 w-3" /> Editor&apos;s pick
              </span>
            )}
          </div>

          <h1 className="mt-2.5 max-w-2xl font-display text-3xl font-semibold leading-tight tracking-tight sm:text-[2.6rem]">
            {place.name}
          </h1>

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/70">
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" />
              {[place.area, place.city].filter(Boolean).join(", ")}
            </span>
            <span className="inline-flex items-center gap-1 font-semibold text-white">
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
              {place.rating.toFixed(1)}
              <span className="font-normal text-white/60">({place.reviewCount} reviews)</span>
            </span>
            {place.priceLevel !== null && <span>{priceText(place.priceLevel)}</span>}
          </div>
        </div>
      </header>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2">
        <a href={directionsHref(place)} target="_blank" rel="noreferrer noopener" className="btn-primary">
          <Navigation className="h-4 w-4" /> Get directions
        </a>
        <button
          type="button"
          onClick={() => toggle(place.slug)}
          aria-pressed={saved}
          className={cn(
            "btn-secondary",
            saved && "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-300",
          )}
        >
          <Heart className={cn("h-4 w-4", saved && "fill-current")} />
          {saved ? "Saved" : "Save for later"}
        </button>
        <button type="button" onClick={() => void share()} className="btn-secondary">
          <Share2 className="h-4 w-4" /> Share
        </button>
        <a
          href={mapsHref(place)}
          target="_blank"
          rel="noreferrer noopener"
          className="btn-ghost ml-auto"
        >
          <MapPin className="h-4 w-4" /> Open in Maps
        </a>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <section className="card p-5 sm:p-6">
            <p className="kicker">Why it&apos;s on the list</p>
            <p className="mt-3 text-[15px] leading-7 text-ink/90">{place.description}</p>

            <div className="mt-4 flex flex-wrap gap-1.5">
              {place.highlight && (
                <Badge tone="brand">
                  <Sparkles className="mr-1 h-3 w-3" /> {place.highlight}
                </Badge>
              )}
              {place.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-line bg-raised px-2.5 py-1 text-[11px] font-medium text-muted"
                >
                  #{tag}
                </span>
              ))}
            </div>

            <dl className="mt-6 grid gap-3 border-t border-line pt-5 sm:grid-cols-2">
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
                  Address
                </dt>
                <dd className="mt-1 text-sm text-ink">{place.address ?? "Not pinned yet"}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
                  City
                </dt>
                <dd className="mt-1 text-sm text-ink">{place.city}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
                  Price
                </dt>
                <dd className="mt-1 text-sm text-ink">{priceText(place.priceLevel)}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
                  Coordinates
                </dt>
                <dd className="mt-1 inline-flex items-center gap-1.5 text-sm text-ink">
                  {place.lat.toFixed(4)}, {place.lng.toFixed(4)}
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard
                        .writeText(`${place.lat},${place.lng}`)
                        .then(() =>
                          pushToast("Coordinates copied.", { tone: "success" }),
                        )
                        .catch(() => pushToast("Could not copy the pin.", { tone: "error" }));
                    }}
                    className="text-muted transition hover:text-ink"
                    aria-label="Copy coordinates"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </dd>
              </div>
            </dl>
          </section>

          <section className="card overflow-hidden">
            <iframe
              title={`Map of ${place.name}`}
              src={mapEmbedUrl(place.lat, place.lng)}
              className="h-[320px] w-full border-0"
              loading="lazy"
              referrerPolicy="no-referrer"
            />
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-3 text-[11px] text-muted">
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" /> Neighbourhood-level pin · verify before you
                navigate
              </span>
              <a
                href={mapsHref(place)}
                target="_blank"
                rel="noreferrer noopener"
                className="font-semibold text-brand-700 hover:underline dark:text-brand-300"
              >
                Open in Google Maps
              </a>
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="card p-5">
            <h2 className="text-sm font-semibold text-ink">Before you go</h2>
            <ul className="mt-3 space-y-2.5 text-[12px] leading-5 text-muted">
              <li className="flex items-start gap-2">
                <CalendarClock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-700 dark:text-brand-300" />
                Check today&apos;s opening hours — community listings go stale.
              </li>
              <li className="flex items-start gap-2">
                <Ticket className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-700 dark:text-brand-300" />
                {place.kind === "CINEMA" || place.kind === "THEATRE"
                  ? "Book seats ahead on weekends; evening shows fill up."
                  : place.kind === "HIKING"
                    ? "Start early, carry water, and tell someone your route."
                    : "Weekday afternoons are the quietest window."}
              </li>
              <li className="flex items-start gap-2">
                <Star className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-700 dark:text-brand-300" />
                Rated {place.rating.toFixed(1)} by {place.reviewCount} visitors.
              </li>
            </ul>
            <Link
              to={`/places?kind=${place.kind}`}
              className="mt-4 flex items-center justify-center gap-1.5 rounded-xl border border-line px-3 py-2 text-[11px] font-semibold text-ink transition hover:border-brand-500/40 hover:bg-raised"
            >
              More {meta.label.toLowerCase()} spots <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </section>

          <section className="card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink">Nearby, same kind</h2>
              <Link
                to="/places"
                className="text-[11px] font-semibold text-brand-700 hover:underline dark:text-brand-300"
              >
                All
              </Link>
            </div>
            <ul className="space-y-1">
              {nearby.map((item) => (
                <li key={item.id}>
                  <Link
                    to={placePath(item)}
                    className="flex items-center gap-2.5 rounded-xl px-1.5 py-2 transition hover:bg-raised"
                  >
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-raised text-[10px] font-bold text-muted">
                      {item.name.slice(0, 2).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-ink">
                        {item.name}
                      </span>
                      <span className="block truncate text-[11px] text-muted">
                        {item.city}
                        {item.distanceKm !== null ? ` · ${formatDistance(item.distanceKm)}` : ""}
                      </span>
                    </span>
                    <Star className="h-3 w-3 shrink-0 fill-amber-400 text-amber-400" />
                  </Link>
                </li>
              ))}
              {nearby.length === 0 && (
                <li className="px-1.5 py-2 text-xs text-muted">Nothing else like it yet.</li>
              )}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
