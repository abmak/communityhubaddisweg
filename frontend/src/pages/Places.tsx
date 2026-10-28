import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  Coffee,
  Compass,
  Globe,
  Heart,
  LocateFixed,
  MapPin,
  Navigation,
  RefreshCw,
  Search,
  Sparkles,
  Star,
  X,
} from "lucide-react";
import type { Place, PlaceArea, PlaceAreasResponse, PlaceKind, PlacesResponse } from "../types";
import { useDebounced, useQuery } from "../hooks/useApi";
import { locationBlock, locationMessage, requestPosition, type LocationFailure } from "../lib/geo";
import { Badge, EmptyState } from "../components/ui";
import { KindMedia } from "../components/KindMedia";
import { useUI } from "../store/ui";
import { KIND_META, PLACE_KINDS, formatDistance, placePath } from "../lib/places";
import { navigationPath } from "../lib/navigation";
import { useSavedPlaces } from "../lib/savedPlaces";
import { useTranslation } from "../store/i18n";
import { cn } from "../lib/utils";

function PlaceCard({ place }: { place: Place }) {
  const { t, lang } = useTranslation();
  const meta = KIND_META[place.kind];
  const Icon = meta.icon;
  const distance = formatDistance(place.distanceKm);
  const { isSaved, toggle } = useSavedPlaces();
  const saved = isSaved(place.slug);
  const isLiveOsm =
    place.tags?.includes("live-osm") ||
    place.highlight?.toLowerCase().includes("openstreetmap");
  const kindLabel = t(`kind.${place.kind.toLowerCase()}`, meta.label);

  return (
    <article className="card group flex flex-col overflow-hidden transition duration-200 hover:-translate-y-1 hover:border-brand-600/25 hover:shadow-lift">
      <div className="relative">
        <Link to={placePath(place)} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
          <div className="relative h-40 overflow-hidden bg-brand-950">
            <KindMedia
              kind={place.kind}
              className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.05]"
            />
            <span
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-t from-brand-950 via-brand-950/45 to-brand-950/5"
            />
            <span aria-hidden="true" className="tilet-strip absolute inset-x-0 top-0 h-1 opacity-80" />

            <div className="absolute inset-x-0 bottom-0 p-3.5 text-white">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-black/25 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.16em] text-white backdrop-blur-sm">
                  <Icon className="h-3 w-3" /> {kindLabel}
                  {lang === "en" && (
                    <span lang="am" className="font-ethiopic text-[10px] normal-case tracking-normal text-white/70">
                      {meta.am}
                    </span>
                  )}
                </span>
                {isLiveOsm && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/50 bg-emerald-600/80 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-white backdrop-blur-sm">
                    <Globe className="h-2.5 w-2.5" /> Live OSM
                  </span>
                )}
              </div>
              <h3 className="mt-1.5 line-clamp-2 pr-12 font-display text-[1.15rem] font-semibold leading-tight text-white">
                {place.name}
              </h3>
              <p className="mt-0.5 truncate text-[11px] text-white/70">
                {place.area ? `${place.area} · ` : ""}
                {place.city}
              </p>
            </div>
          </div>
        </Link>

        <button
          type="button"
          onClick={() => toggle(place.slug)}
          aria-pressed={saved}
          aria-label={saved ? `Remove ${place.name} from saved places` : `Save ${place.name}`}
          className={cn(
            "absolute right-2.5 top-2.5 inline-flex h-8 w-8 items-center justify-center rounded-full border backdrop-blur transition",
            saved
              ? "border-rose-300/60 bg-rose-500 text-white"
              : "border-white/30 bg-black/25 text-white hover:bg-black/45",
          )}
        >
          <Heart className={cn("h-3.5 w-3.5", saved && "fill-current")} />
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-2.5 p-4">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted">
          <span className="inline-flex items-center gap-1 font-semibold text-ink">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
            {place.rating.toFixed(1)}
          </span>
          <span className="text-muted/70">({place.reviewCount})</span>
          {place.priceLevel !== null && (
            <>
              <span className="text-line">|</span>
              <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                {"$".repeat(place.priceLevel)}
              </span>
            </>
          )}
          {distance && (
            <>
              <span className="text-line">|</span>
              <span className="inline-flex items-center gap-1 font-semibold text-brand-700 dark:text-brand-300">
                <MapPin className="h-3 w-3" /> {distance}
              </span>
            </>
          )}
        </div>

        <p className="line-clamp-2 text-[13px] leading-6 text-muted">{place.description}</p>

        <div className="flex flex-wrap gap-1.5">
          {(place.highlight ? [place.highlight, ...place.tags] : place.tags)
            .slice(0, 3)
            .map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-line bg-raised px-2 py-0.5 text-[10px] font-medium text-muted"
              >
                {tag}
              </span>
            ))}
        </div>

        <div className="mt-auto flex items-center justify-between gap-2 border-t border-line/70 pt-3">
          <Link
            to={navigationPath({
              name: place.name,
              lat: place.lat,
              lng: place.lng,
              placeSlug: place.slug,
              address: place.address,
            })}
            className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-[11px] font-semibold text-muted transition hover:text-brand-700 dark:hover:text-brand-300"
          >
            <Navigation className="h-3.5 w-3.5" /> {t("places.directions", "Directions")}
          </Link>
          <Link
            to={placePath(place)}
            className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-[11px] font-semibold text-brand-700 transition hover:gap-1.5 dark:text-brand-300"
          >
            {t("places.seePlace", "See the place")} <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </article>
  );
}

function CardSkeleton() {
  return (
    <div className="card animate-pulse overflow-hidden">
      <div className="h-40 bg-raised" />
      <div className="space-y-3 p-4">
        <div className="h-3 w-24 rounded bg-raised" />
        <div className="h-3 w-full rounded bg-raised" />
        <div className="h-3 w-2/3 rounded bg-raised" />
        <div className="h-8 w-full rounded bg-raised" />
      </div>
    </div>
  );
}

export function PlacesPage() {
  const { t, lang } = useTranslation();
  const pushToast = useUI((state) => state.pushToast);
  const { saved } = useSavedPlaces();

  const [searchParams, setSearchParams] = useSearchParams();
  const kindParam = searchParams.get("kind");
  const kind = PLACE_KINDS.includes(kindParam as PlaceKind) ? (kindParam as PlaceKind) : null;
  const setKind = (next: PlaceKind | null) => {
    setSearchParams(
      (current) => {
        const params = new URLSearchParams(current);
        if (next) params.set("kind", next);
        else params.delete("kind");
        return params;
      },
      { replace: true },
    );
  };

  const [city, setCity] = useState("");
  // Coordinates live in the URL so a "near me" link can be shared or refreshed.
  const latParam = Number(searchParams.get("lat"));
  const lngParam = Number(searchParams.get("lng"));
  const coords =
    searchParams.has("lat") && Number.isFinite(latParam) && Number.isFinite(lngParam)
      ? { lat: latParam, lng: lngParam }
      : null;

  // A GPS fix and a picked area both live in the URL; the label only exists
  // for the latter, so the button can say where the distances start from.
  const areaParam = searchParams.get("area");

  const setCoords = (next: { lat: number; lng: number } | null) => {
    setSearchParams(
      (current) => {
        const params = new URLSearchParams(current);
        params.delete("area");
        params.delete("pickArea");
        if (next) {
          params.set("lat", String(next.lat));
          params.set("lng", String(next.lng));
        } else {
          params.delete("lat");
          params.delete("lng");
        }
        return params;
      },
      { replace: true },
    );
  };

  const [sort, setSort] = useState<"rating" | "distance" | "name">(
    coords ? "distance" : "rating",
  );
  const [term, setTerm] = useState("");
  const [savedOnly, setSavedOnly] = useState(false);
  const [liveOsm, setLiveOsm] = useState(true);
  const [syncingOsm, setSyncingOsm] = useState(false);
  const [geoState, setGeoState] = useState<"idle" | "locating" | "ready" | "error">(
    coords ? "ready" : "idle",
  );
  const [areaPicker, setAreaPicker] = useState(searchParams.has("pickArea"));
  // Phones refuse the Geolocation API on plain HTTP, so the page has to offer
  // the neighbourhood picker instead of a button that can only fail.
  const insecureOrigin = typeof window !== "undefined" && !window.isSecureContext;

  const chooseArea = (entry: PlaceArea) => {
    setSearchParams(
      (current) => {
        const params = new URLSearchParams(current);
        params.set("lat", String(entry.lat));
        params.set("lng", String(entry.lng));
        params.set("area", entry.area);
        params.delete("pickArea");
        return params;
      },
      { replace: true },
    );
    setSort("distance");
    setGeoState("ready");
    setAreaPicker(false);
    pushToast(`Sorting from ${entry.area} — approximate, from the middle of that area.`, {
      tone: "success",
    });
  };

  const debouncedTerm = useDebounced(term, 320);

  const handleSyncLiveOsm = async () => {
    setSyncingOsm(true);
    try {
      const res = await fetch("/api/places/sync-osm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: kind ?? undefined,
          city: city || undefined,
          lat: coords?.lat,
          lng: coords?.lng,
          q: debouncedTerm || undefined,
          limit: 20,
        }),
      });
      const json = await res.json();
      if (json.success) {
        pushToast(`Discovered ${json.count} live venues from OpenStreetMap!`, { tone: "success" });
        setSearchParams((prev) => {
          const p = new URLSearchParams(prev);
          p.set("_sync", String(Date.now()));
          return p;
        });
      }
    } catch {
      pushToast("Could not reach OpenStreetMap servers right now.", { tone: "error" });
    } finally {
      setSyncingOsm(false);
    }
  };

  const url = useMemo(() => {
    const params = new URLSearchParams();
    if (kind) params.set("kind", kind);
    if (city) params.set("city", city);
    if (debouncedTerm.trim().length >= 2) params.set("q", debouncedTerm.trim());
    if (liveOsm) params.set("live", "true");
    if (coords) {
      params.set("lat", String(coords.lat));
      params.set("lng", String(coords.lng));
      params.set("sort", sort === "name" ? "name" : "distance");
    } else if (sort === "name") {
      params.set("sort", "name");
    }
    return `/api/places?${params.toString()}`;
  }, [kind, city, debouncedTerm, coords, sort, liveOsm]);

  const { data, loading } = useQuery<PlacesResponse>(url);
  const { data: areasData } = useQuery<PlaceAreasResponse>(
    areaPicker ? "/api/places/areas" : null,
  );
  const areas = useMemo(() => areasData?.areas ?? [], [areasData]);
  const selectedAreaKey = useMemo(() => {
    if (!areaParam) return "";
    const match = areas.find((entry) => entry.area === areaParam);
    return match ? `${match.city}::${match.area}` : "";
  }, [areaParam, areas]);

  const counts = useMemo(() => {
    const map = new Map<PlaceKind, number>();
    for (const entry of data?.filters.kinds ?? []) map.set(entry.kind, entry.count);
    return map;
  }, [data]);

  const places = useMemo(() => {
    const rows = data?.places ?? [];
    return savedOnly ? rows.filter((place) => saved.includes(place.slug)) : rows;
  }, [data, savedOnly, saved]);

  const total = savedOnly ? places.length : data?.filters.total ?? 0;

  const locate = () => {
    const blocked = locationBlock();
    if (blocked) {
      setGeoState("error");
      setAreaPicker(true);
      pushToast(locationMessage(blocked), { tone: "error" });
      return;
    }

    setGeoState("locating");
    void requestPosition()
      .then(({ lat, lng }) => {
        setCoords({ lat, lng });
        setSort("distance");
        setGeoState("ready");
        setAreaPicker(false);
        pushToast("Sorted by what's closest to you.", { tone: "success" });
      })
      .catch((failure: LocationFailure) => {
        setGeoState("error");
        // A phone that cannot answer still deserves a way to sort by distance.
        setAreaPicker(true);
        pushToast(locationMessage(failure), { tone: "error" });
      });
  };

  const clearLocation = () => {
    setCoords(null);
    setGeoState("idle");
    if (sort === "distance") setSort("rating");
  };

  const reset = () => {
    setSearchParams(new URLSearchParams(), { replace: true });
    setCity("");
    setTerm("");
    setSort("rating");
    setSavedOnly(false);
    clearLocation();
  };

  const hasFilters = Boolean(kind || city || term || coords || savedOnly);

  return (
    <div className="space-y-7">
      <header className="relative overflow-hidden rounded-3xl border border-brand-900/10 bg-brand-950 px-6 py-8 text-white shadow-lift sm:px-9 sm:py-10">
        <span aria-hidden="true" className="tilet-strip absolute inset-x-0 top-0 h-2 opacity-80" />
        <div
          aria-hidden="true"
          className="absolute -right-16 -top-24 h-80 w-80 rounded-full bg-emerald-400/20 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-28 left-1/4 h-72 w-72 rounded-full bg-accent-500/20 blur-3xl"
        />

        <div className="relative">
          <p className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-200">
            <Compass className="h-3.5 w-3.5" /> {t("places.badge", "Nearby")}
            {lang === "en" && (
              <span lang="am" className="font-ethiopic normal-case tracking-normal text-accent-200">
                አቅራቢያ
              </span>
            )}
          </p>
          <h1 className="mt-2 max-w-2xl font-display text-3xl font-medium leading-tight tracking-tight sm:text-[2.5rem]">
            {t("places.title", "Places worth leaving the house for.")}
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-white/65">
            {t("places.subtitle", "Cinemas, stages, hotels, trailheads, gyms, galleries and coffee worth the detour — plus the hospitals, pharmacies, fuel stations and schools you actually need — sorted by what is closest to you.")}
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-2 text-xs text-white/60">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5">
              <Sparkles className="h-3.5 w-3.5 text-accent-300" /> {data?.filters.total ?? PLACE_KINDS.length * 3} {t("places.matches", "places")}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5">
              <MapPin className="h-3.5 w-3.5 text-accent-300" />{" "}
              {data?.filters.cities.length ?? 6} {t("places.allCities", "cities")}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5">
              <Coffee className="h-3.5 w-3.5 text-accent-300" /> {PLACE_KINDS.length} kinds of stop
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/15 px-3 py-1.5 text-emerald-200">
              <Globe className="h-3.5 w-3.5 text-emerald-300" /> {t("places.liveOsmSyncEnabled", "OpenStreetMap live sync")}
            </span>
          </div>
        </div>
      </header>

      <div className="card space-y-3 p-4">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setKind(null)}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
              kind === null && !savedOnly
                ? "border-brand-700 bg-brand-700 text-white shadow-sm"
                : "border-line bg-surface text-muted hover:border-brand-500/40 hover:text-ink",
            )}
          >
            <Compass className="h-3.5 w-3.5" /> {t("places.everything", "Everything")}
            <span className={cn("ml-0.5 text-[10px]", kind === null ? "text-white/70" : "text-muted/60")}>
              {data?.filters.total ?? ""}
            </span>
          </button>
          {PLACE_KINDS.map((entry) => {
            const meta = KIND_META[entry];
            const Icon = meta.icon;
            const active = kind === entry;
            const entryLabel = t(`kind.${entry.toLowerCase()}`, meta.label);
            return (
              <button
                key={entry}
                type="button"
                onClick={() => setKind(active ? null : entry)}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                  active
                    ? "border-brand-700 bg-brand-700 text-white shadow-sm"
                    : "border-line bg-surface text-muted hover:border-brand-500/40 hover:text-ink",
                )}
              >
                <Icon className={cn("h-3.5 w-3.5", active ? "text-white" : meta.iconTone)} />
                {entryLabel}
                {lang === "en" && (
                  <span
                    lang="am"
                    className={cn(
                      "font-ethiopic text-[10px]",
                      active ? "text-white/70" : "text-muted/50",
                    )}
                  >
                    {meta.am}
                  </span>
                )}
                <span className={cn("text-[10px]", active ? "text-white/70" : "text-muted/60")}>
                  {counts.get(entry) ?? 0}
                </span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setSavedOnly((value) => !value)}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
              savedOnly
                ? "border-rose-500 bg-rose-500 text-white shadow-sm"
                : "border-line bg-surface text-muted hover:border-rose-400/50 hover:text-ink",
            )}
          >
            <Heart className={cn("h-3.5 w-3.5", savedOnly && "fill-current")} /> {t("places.saved", "Saved")}
            <span className={cn("text-[10px]", savedOnly ? "text-white/75" : "text-muted/60")}>
              {saved.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setLiveOsm((v) => !v)}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
              liveOsm
                ? "border-emerald-600 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400 dark:text-emerald-300"
                : "border-line bg-surface text-muted hover:border-emerald-500/40 hover:text-ink",
            )}
            title="Enable or disable live OpenStreetMap venue discovery"
          >
            <Globe className={cn("h-3.5 w-3.5", liveOsm ? "text-emerald-600 dark:text-emerald-400" : "text-muted")} />
            {t("places.liveOpenMap", "Live OpenMap")}
            <span className={cn("inline-block h-2 w-2 rounded-full", liveOsm ? "bg-emerald-500 shadow-[0_0_6px_#10b981]" : "bg-neutral-400")} />
          </button>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="relative flex-1">
            <span className="sr-only">{t("places.searchPlaceholder", "Search places…")}</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder={t("places.searchPlaceholder", "Search places…")}
              className="input h-10 pl-9"
            />
          </label>

          <label className="sm:w-40">
            <span className="sr-only">{t("places.allCities", "All cities")}</span>
            <select
              value={city}
              onChange={(event) => setCity(event.target.value)}
              className="input h-10"
            >
              <option value="">{t("places.allCities", "All cities")}</option>
              {(data?.filters.cities ?? []).map((entry) => (
                <option key={entry} value={entry}>
                  {entry}
                </option>
              ))}
            </select>
          </label>

          <label className="sm:w-36">
            <span className="sr-only">{t("places.sortTopRated", "Sort")}</span>
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as typeof sort)}
              className="input h-10"
            >
              <option value="rating">{t("places.sortTopRated", "Top rated")}</option>
              <option value="distance">{t("places.sortNearest", "Nearest first")}</option>
              <option value="name">{t("places.sortName", "A – Z")}</option>
            </select>
          </label>

          <button
            type="button"
            onClick={handleSyncLiveOsm}
            disabled={syncingOsm}
            className={cn(
              "btn-secondary h-10 shrink-0 border-emerald-500/30 hover:border-emerald-500/60",
              syncingOsm && "opacity-70",
            )}
            title="Fetch live places from OpenStreetMap right now"
          >
            <RefreshCw className={cn("h-4 w-4 text-emerald-600 dark:text-emerald-400", syncingOsm && "animate-spin")} />
            {syncingOsm ? t("places.syncing", "Syncing…") : t("places.syncOpenMap", "Sync OpenMap")}
          </button>

          {coords ? (
            <button type="button" onClick={clearLocation} className="btn-secondary h-10 shrink-0">
              <MapPin className="h-4 w-4 text-brand-700" />
              <span className="max-w-[10rem] truncate">
                {areaParam
                  ? `${areaParam} · ${t("places.approx", "approx.")}`
                  : t("places.nearMe", "Near me")}
              </span>
              <X className="h-3.5 w-3.5 text-muted" />
            </button>
          ) : (
            <button
              type="button"
              onClick={locate}
              disabled={geoState === "locating"}
              className="btn-secondary h-10 shrink-0"
            >
              <LocateFixed className={cn("h-4 w-4", geoState === "locating" && "animate-spin")} />
              {geoState === "locating" ? t("places.findingYou", "Finding you…") : t("places.useMyLocation", "Use my location")}
            </button>
          )}

          <button
            type="button"
            onClick={() => setAreaPicker((open) => !open)}
            aria-expanded={areaPicker}
            className={cn(
              "btn-secondary h-10 shrink-0",
              areaPicker && "border-brand-500/60 text-ink",
            )}
            title={t("places.areaHelp", "No GPS? Pick the area you're in.")}
          >
            <Compass className="h-4 w-4 text-brand-700 dark:text-brand-300" />
            {t("places.pickArea", "Pick area")}
          </button>
        </div>

        {insecureOrigin && !coords && (
          <button
            type="button"
            onClick={() => setAreaPicker(true)}
            className="flex w-full items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-left text-[11px] leading-5 text-amber-800 transition hover:bg-amber-500/15 dark:text-amber-200"
          >
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {t(
              "places.insecureLocation",
              "Phones only share GPS over HTTPS. Pick your area and we'll sort by distance from there.",
            )}
          </button>
        )}

        {areaPicker && (
          <div className="rounded-xl border border-line bg-raised/50 p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="max-w-lg text-[11px] leading-5 text-muted">
                {t(
                  "places.areaHelp",
                  "No GPS? Pick the area you're in — distances are measured from the middle of it.",
                )}
              </p>
              <button
                type="button"
                onClick={() => setAreaPicker(false)}
                className="text-[11px] font-semibold text-muted transition hover:text-ink"
              >
                {t("places.close", "Close")}
              </button>
            </div>
            <select
              className="input mt-2 h-10 w-full"
              value={selectedAreaKey}
              onChange={(event) => {
                const entry = areas.find(
                  (item) => `${item.city}::${item.area}` === event.target.value,
                );
                if (entry) chooseArea(entry);
              }}
            >
              <option value="">{t("places.chooseArea", "Choose your area…")}</option>
              {areas.map((entry) => (
                <option key={`${entry.city}::${entry.area}`} value={`${entry.city}::${entry.area}`}>
                  {entry.area} · {entry.city} ({entry.count})
                </option>
              ))}
            </select>
          </div>
        )}

        {hasFilters && (
          <div className="flex items-center justify-between gap-3 text-[11px] text-muted">
            <span>
              {loading ? "Searching…" : `${total} ${total === 1 ? t("places.match", "place match") : t("places.matches", "places match")}`}
              {coords ? ` · ${t("places.sortedFromYou", "sorted from where you are")}` : ""}
            </span>
            <button
              type="button"
              onClick={reset}
              className="font-semibold text-brand-700 hover:underline dark:text-brand-300"
            >
              {t("places.clearFilters", "Clear filters")}
            </button>
          </div>
        )}
      </div>

      {loading && !data ? (
        <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <CardSkeleton key={index} />
          ))}
        </div>
      ) : places.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
          {places.map((place) => (
            <PlaceCard key={place.id} place={place} />
          ))}
        </div>
      ) : (
        <div className="card">
          <EmptyState
            icon={savedOnly ? Heart : MapPin}
            title={savedOnly ? t("places.saved", "No saved places yet") : t("places.emptyTitle", "Nothing here yet")}
            description={
              savedOnly
                ? "Tap the heart on any place to keep it here for later — the shortlist stays on this device."
                : t("places.emptyDesc", "No place matches those filters. Try a different kind of stop, or clear the search.")
            }
            action={
              <button
                type="button"
                onClick={savedOnly ? () => setSavedOnly(false) : reset}
                className="btn-secondary"
              >
                {savedOnly ? t("places.browseAll", "Browse all places") : t("places.clearFilters", "Clear filters")}
              </button>
            }
          />
        </div>
      )}

      <p className="flex flex-wrap items-center justify-center gap-2 pb-2 text-center text-[11px] text-muted">
        <Badge tone="brand">{t("places.communityList", "Community list")}</Badge>
        {t("places.disclaimer", "Pins are neighbourhood-level. Always check opening hours before you go.")}
      </p>
    </div>
  );
}
