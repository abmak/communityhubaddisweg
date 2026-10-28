import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Compass, Navigation } from "lucide-react";
import type { NearbyServicesResponse } from "../types";
import { useQuery } from "../hooks/useApi";
import { KIND_META, formatDistance } from "../lib/places";
import { navigationPath } from "../lib/navigation";
import { cn } from "../lib/utils";

interface NearbyServicesProps {
  location: { lat: number; lng: number } | null;
  className?: string;
}

/**
 * One nearest toilet, car park, charger, transit stop, bank and ATM for the
 * pin the member is standing on. Kept deliberately short: this sits beside
 * turn-by-turn directions, not in the browsing directory.
 */
export function NearbyServices({ location, className }: NearbyServicesProps) {
  const url = useMemo(() => {
    if (!location) return null;
    const params = new URLSearchParams({
      lat: String(location.lat),
      lng: String(location.lng),
      radiusKm: "8",
      perKind: "1",
    });
    return `/api/places/nearby-services?${params.toString()}`;
  }, [location?.lat, location?.lng]);

  const { data, loading } = useQuery<NearbyServicesResponse>(url);
  const groups = (data?.groups ?? []).filter((group) => group.places.length > 0);
  const total = data?.total ?? 0;

  return (
    <section className={cn("card overflow-hidden", className)}>
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
        <h2 className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink">
          <Compass className="h-3.5 w-3.5 text-brand-600 dark:text-brand-400" />
          Nearby services
        </h2>
        <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted">
          {location ? `within 8 km` : "needs location"}
        </span>
      </div>

      {!location ? (
        <p className="px-4 py-5 text-center text-xs leading-5 text-muted">
          Share your location and the closest toilets, parking, chargers, transit stops,
          banks and ATMs appear here.
        </p>
      ) : loading ? (
        <ul className="divide-y divide-line/70">
          {[0, 1, 2, 3].map((row) => (
            <li key={row} className="flex animate-pulse items-center gap-3 px-4 py-3">
              <span className="h-8 w-8 rounded-xl bg-raised" />
              <span className="h-3 flex-1 rounded bg-raised" />
            </li>
          ))}
        </ul>
      ) : groups.length === 0 ? (
        <p className="px-4 py-5 text-center text-xs leading-5 text-muted">
          No mapped services found within 8 km. The OpenStreetMap sync on the places page
          can look for more.
        </p>
      ) : (
        <ul className="divide-y divide-line/70">
          {groups.map((group) => {
            const place = group.places[0];
            const meta = KIND_META[group.kind];
            const Icon = meta.icon;
            return (
              <li key={group.kind} className="flex items-center gap-2.5 px-4 py-2.5">
                <span
                  className={cn(
                    "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-line bg-raised",
                    meta.iconTone,
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-muted">
                    {meta.label}
                  </p>
                  <p className="truncate text-xs font-semibold text-ink">{place.name}</p>
                  <p className="truncate text-[10px] text-muted">
                    {formatDistance(place.distanceKm)}
                    {place.area ? ` · ${place.area}` : ""}
                  </p>
                </div>
                <Link
                  to={navigationPath({
                    name: place.name,
                    lat: place.lat,
                    lng: place.lng,
                    placeSlug: place.slug,
                    address: place.address,
                  })}
                  aria-label={`Directions to ${place.name}`}
                  title={`Directions to ${place.name}`}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line text-muted transition hover:border-brand-500/50 hover:text-brand-700 dark:hover:text-brand-300"
                >
                  <Navigation className="h-3.5 w-3.5" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {location && total > 0 && (
        <Link
          to={`/places?lat=${location.lat}&lng=${location.lng}`}
          className="flex items-center justify-between gap-2 border-t border-line px-4 py-2.5 text-[11px] font-semibold text-brand-700 transition hover:bg-raised/60 dark:text-brand-300"
        >
          See everything nearby
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      )}

      <p className="border-t border-line/60 px-4 py-2 text-[10px] leading-4 text-muted">
        Community pins and OpenStreetMap · check opening hours before relying on one.
      </p>
    </section>
  );
}
