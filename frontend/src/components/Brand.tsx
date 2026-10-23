import { useId } from "react";
import { cn } from "../lib/utils";
import { BRAND } from "../lib/brand";

/** The eight tilet diamonds that orbit the medallion. */
const ORBIT: Array<[number, number]> = [
  [32, 7.5],
  [48.5, 14.5],
  [56.5, 32],
  [48.5, 49.5],
  [32, 56.5],
  [15.5, 49.5],
  [7.5, 32],
  [15.5, 14.5],
];

/**
 * The አዲስ ወግ emblem: a woven tilet star in Ethiopian green and gold with the
 * Amharic "ወ" at its centre. The orbit turns slowly, the medallion breathes and
 * a light sheen passes across it, so the mark feels alive without being noisy.
 */
export function BrandMark({
  className,
  glow,
  animated = true,
}: {
  className?: string;
  glow?: boolean;
  animated?: boolean;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const gold = `brand-gold-${uid}`;
  const green = `brand-green-${uid}`;
  const band = `brand-band-${uid}`;
  const clip = `brand-clip-${uid}`;

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
            <stop offset="0" stopColor="#fbeab8" />
            <stop offset="0.42" stopColor="#eec25c" />
            <stop offset="0.78" stopColor="#d9a02d" />
            <stop offset="1" stopColor="#b97e19" />
          </linearGradient>
          <radialGradient id={green} cx="0.28" cy="0.18" r="0.95">
            <stop offset="0" stopColor="#1c7a4a" />
            <stop offset="0.55" stopColor="#0d432a" />
            <stop offset="1" stopColor="#061d12" />
          </radialGradient>
          <linearGradient id={band} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#0f6b3a" />
            <stop offset="0.5" stopColor="#e9b949" />
            <stop offset="1" stopColor="#c8102e" />
          </linearGradient>
          <clipPath id={clip}>
            <rect x="1" y="1" width="62" height="62" rx="19" />
          </clipPath>
        </defs>

        <rect x="1" y="1" width="62" height="62" rx="19" fill={`url(#${green})`} />

        <g clipPath={`url(#${clip})`}>
          {/* Woven linen texture. */}
          <g opacity="0.1" stroke="#fdf6e3" strokeWidth="0.55">
            {Array.from({ length: 11 }, (_, index) => (
              <line
                key={`a${index}`}
                x1={-10 + index * 8}
                y1="-4"
                x2={18 + index * 8}
                y2="68"
              />
            ))}
            {Array.from({ length: 11 }, (_, index) => (
              <line
                key={`b${index}`}
                x1={74 - index * 8}
                y1="-4"
                x2={46 - index * 8}
                y2="68"
              />
            ))}
          </g>

          <circle
            cx="32"
            cy="32"
            r="25.4"
            fill="none"
            stroke="rgba(233,185,73,0.34)"
            strokeWidth="0.7"
            strokeDasharray="1.2 4.2"
          />

          {/* Rotating diamonds keep the tilet pattern in motion. */}
          <g className={animated ? "brand-orbit" : undefined}>
            {ORBIT.map(([x, y], index) => (
              <rect
                key={`${x}-${y}`}
                x={x - (index % 2 === 0 ? 2.2 : 1.6)}
                y={y - (index % 2 === 0 ? 2.2 : 1.6)}
                width={index % 2 === 0 ? 4.4 : 3.2}
                height={index % 2 === 0 ? 4.4 : 3.2}
                rx="0.9"
                fill={`url(#${gold})`}
                opacity={index % 2 === 0 ? 0.95 : 0.52}
                transform={`rotate(45 ${x} ${y})`}
              />
            ))}
          </g>

          {/* The woven star and the ወ medallion. */}
          <g className={animated ? "brand-breathe" : undefined} style={{ transformOrigin: "32px 32px" }}>
            <path
              d="M32 6 40.2 23.8 58 32 40.2 40.2 32 58 23.8 40.2 6 32 23.8 23.8Z"
              fill={`url(#${gold})`}
            />
            <path
              d="M32 16.4 37.9 26.1 47.6 32 37.9 37.9 32 47.6 26.1 37.9 16.4 32 26.1 26.1Z"
              fill="#082d1c"
            />
            <circle cx="32" cy="32" r="7.7" fill={`url(#${gold})`} />
            <circle cx="32" cy="32" r="7.7" fill="none" stroke="rgba(8,45,28,0.35)" strokeWidth="0.6" />
            <text
              x="32"
              y="36.3"
              textAnchor="middle"
              fontFamily="'Noto Serif Ethiopic', 'Noto Sans Ethiopic', serif"
              fontWeight="700"
              fontSize="10.6"
              fill="#082d1c"
            >
              ወ
            </text>
          </g>

          {/* A single soft highlight sweeping across the glass. */}
          {animated ? (
            <g className="brand-sheen">
              <rect
                x="-24"
                y="-14"
                width="13"
                height="92"
                fill="rgba(255,255,255,0.24)"
                transform="rotate(20 32 32)"
              />
            </g>
          ) : null}

          <rect x="1" y="57.8" width="62" height="5.2" fill={`url(#${band})`} />
        </g>

        <rect
          x="1.35"
          y="1.35"
          width="61.3"
          height="61.3"
          rx="18.65"
          fill="none"
          stroke="rgba(255,255,255,0.18)"
          strokeWidth="0.7"
        />
      </svg>
    </span>
  );
}

/**
 * The lockup: the Amharic name, a live gold dot and an optional descriptor.
 * Kept typographic so it pairs with the animated emblem instead of competing.
 */
export function Wordmark({
  className,
  compact,
  subtitle = "Addis Weg",
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
