import { KIND_META } from "../lib/places";
import { cn } from "../lib/utils";
import type { PlaceKind } from "../types";

interface KindMediaProps {
  kind: PlaceKind;
  className?: string;
  iconClassName?: string;
}

/**
 * Kind artwork for cards and heroes. Kinds with photography show it; the
 * everyday services (hospitals, pharmacies, fuel stations, schools) get a
 * tinted tile with their icon instead of a photograph of some other city.
 */
export function KindMedia({ kind, className, iconClassName }: KindMediaProps) {
  const meta = KIND_META[kind];
  const Icon = meta.icon;

  if (meta.photo) {
    return (
      <img
        src={meta.photo}
        alt={meta.photoAlt}
        loading="lazy"
        width={1200}
        height={800}
        className={className}
      />
    );
  }

  return (
    <div
      aria-hidden="true"
      className={cn(
        "relative flex items-center justify-center overflow-hidden bg-gradient-to-br",
        meta.tile ?? "from-brand-700 via-brand-800 to-brand-950",
        className,
      )}
    >
      <span className="tilet-strip absolute inset-x-0 top-0 h-1 opacity-60" />
      <Icon className={cn("h-16 w-16 text-white/40", iconClassName)} />
    </div>
  );
}
