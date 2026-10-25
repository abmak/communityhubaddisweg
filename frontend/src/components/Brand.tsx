import { useId } from "react";
import { cn } from "../lib/utils";
import { BRAND } from "../lib/brand";

/**
 * The አዲስ ገበታ emblem: one woven tilet diamond in Ethiopian gold on a deep-green
 * tile, with a gold dot at its heart. A single strong shape, so it stays crisp
 * from favicon size up to the hero lockup.
 */
export function BrandMark({ className, glow }: { className?: string; glow?: boolean }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const gold = `brand-gold-${uid}`;
  const green = `brand-green-${uid}`;

  return (
    <span
      className={cn(
        "brand-mark relative inline-flex shrink-0 items-center justify-center",
        glow && "drop-shadow-[0_14px_30px_rgba(15,107,58,0.35)]",
        className ?? "h-10 w-10",
      )}
      aria-hidden="true"
    >
      {glow ? <span className="brand-halo absolute inset-[-10%] rounded-[34%]" /> : null}

      <svg viewBox="0 0 64 64" className="brand-mark-svg relative h-full w-full">
        <defs>
          <linearGradient id={gold} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fbe7b2" />
            <stop offset="0.5" stopColor="#e9b949" />
            <stop offset="1" stopColor="#bc8419" />
          </linearGradient>
          <radialGradient id={green} cx="0.3" cy="0.18" r="0.95">
            <stop offset="0" stopColor="#16794a" />
            <stop offset="0.62" stopColor="#0b3f27" />
            <stop offset="1" stopColor="#061f14" />
          </radialGradient>
        </defs>

        <rect x="1" y="1" width="62" height="62" rx="19" fill={`url(#${green})`} />
        <rect
          x="1.7"
          y="1.7"
          width="60.6"
          height="60.6"
          rx="18.3"
          fill="none"
          stroke="#e9b949"
          strokeOpacity="0.32"
          strokeWidth="1.4"
        />

        {/* Tilet diamond: gold outline, green field, gold centre. */}
        <path d="M32 12.5 51.5 32 32 51.5 12.5 32Z" fill={`url(#${gold})`} />
        <path d="M32 21.5 42.5 32 32 42.5 21.5 32Z" fill="#0a3a24" />
        <circle cx="32" cy="32" r="3.1" fill={`url(#${gold})`} />
      </svg>
    </span>
  );
}

/**
 * The lockup: the Amharic name, a live gold dot and an optional descriptor.
 * Kept typographic so it pairs with the emblem instead of competing.
 */
export function Wordmark({
  className,
  compact,
  subtitle = "Addis Gebeta",
}: {
  className?: string;
  compact?: boolean;
  subtitle?: string;
}) {
  return (
    <span className={cn("flex min-w-0 flex-col", className)}>
      <span className="flex min-w-0 items-baseline gap-1.5">
        <span
          className={cn(
            "truncate font-ethiopic font-semibold leading-tight tracking-tight text-ink",
            compact ? "text-base" : "text-lg",
          )}
          lang="am"
        >
          {BRAND.name}
        </span>
        <span className="brand-dot inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-accent-500" />
      </span>
      {!compact && (
        <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.24em] text-muted">
          {subtitle}
        </span>
      )}
    </span>
  );
}

/** Slim green–gold–red rule used as a signature divider. */
export function EthBand({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn("eth-band block h-[3px] rounded-full", className)} />;
}

/** Woven diamond strip used behind hero sections. */
export function TiletStrip({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn("tilet-strip block h-2", className)} />;
}
