import { useId } from "react";
import { cn } from "../lib/utils";
import { BRAND } from "../lib/brand";

/**
 * The አዲስ ገበታ (Addis Gebeta) Animated Communal Emblem:
 * Represents the Ethiopian "Gebeta" (communal gathering table) bringing together
 * the 4 pillars of the community: Places & Discovery, Events, Culture & Joke Time,
 * and Social Networking. Features smooth revolving community nodes, a counter-rotating
 * woven tilet crown, and a pulsating golden hearth at its center.
 */
export function BrandMark({ className, glow }: { className?: string; glow?: boolean }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const gold = `gebeta-gold-${uid}`;
  const green = `gebeta-green-${uid}`;
  const hearth = `gebeta-hearth-${uid}`;

  return (
    <span
      className={cn(
        "brand-mark relative inline-flex shrink-0 items-center justify-center cursor-pointer select-none",
        glow && "drop-shadow-[0_12px_28px_rgba(15,107,58,0.4)]",
        className ?? "h-10 w-10",
      )}
      aria-label="አዲስ ገበታ Logo"
      title="አዲስ ገበታ · Addis Gebeta"
    >
      {glow ? <span className="gebeta-halo absolute inset-[-14%] rounded-[38%]" /> : null}

      <svg viewBox="0 0 64 64" className="brand-mark-svg relative h-full w-full">
        <defs>
          <linearGradient id={gold} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fef3c7" />
            <stop offset="35%" stopColor="#f59e0b" />
            <stop offset="70%" stopColor="#d97706" />
            <stop offset="100%" stopColor="#92400e" />
          </linearGradient>
          <radialGradient id={green} cx="30%" cy="25%" r="85%">
            <stop offset="0%" stopColor="#15803d" />
            <stop offset="45%" stopColor="#0d5232" />
            <stop offset="80%" stopColor="#07301d" />
            <stop offset="100%" stopColor="#041a10" />
          </radialGradient>
          <radialGradient id={hearth} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="40%" stopColor="#fde68a" />
            <stop offset="75%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#b45309" />
          </radialGradient>
        </defs>

        {/* 1. Base Gebeta Table Platter / Plate Foundation */}
        <rect x="2" y="2" width="60" height="60" rx="19" fill={`url(#${green})`} />
        <rect
          x="2.5"
          y="2.5"
          width="59"
          height="59"
          rx="18.5"
          fill="none"
          stroke={`url(#${gold})`}
          strokeOpacity="0.4"
          strokeWidth="1.2"
        />

        {/* 2. Concentric Communal Ring (Woven Rim) */}
        <circle
          cx="32"
          cy="32"
          r="23"
          fill="none"
          stroke={`url(#${gold})`}
          strokeOpacity="0.25"
          strokeWidth="1"
          strokeDasharray="3.5 2.5"
        />

        {/* 3. The Animated Revolving Community Orbit (4 Service Pillars: Places, Events, Culture, Social) */}
        <g className="gebeta-orbit">
          {/* Subtle orbital path */}
          <circle
            cx="32"
            cy="32"
            r="19"
            fill="none"
            stroke={`url(#${gold})`}
            strokeOpacity="0.28"
            strokeWidth="0.8"
          />

          {/* Node 1: North (Places & Discovery) */}
          <circle cx="32" cy="13" r="2.8" fill={`url(#${gold})`} />
          <path d="M32 9 L34 13 L32 17 L30 13 Z" fill="#ffffff" fillOpacity="0.85" />

          {/* Node 2: East (Events & Gatherings) */}
          <circle cx="51" cy="32" r="2.8" fill={`url(#${gold})`} />
          <path d="M51 28 L53 32 L51 36 L49 32 Z" fill="#ffffff" fillOpacity="0.85" />

          {/* Node 3: South (Culture & Joke Time) */}
          <circle cx="32" cy="51" r="2.8" fill={`url(#${gold})`} />
          <path d="M32 47 L34 51 L32 55 L30 51 Z" fill="#ffffff" fillOpacity="0.85" />

          {/* Node 4: West (Community & Networking) */}
          <circle cx="13" cy="32" r="2.8" fill={`url(#${gold})`} />
          <path d="M13 28 L15 32 L13 36 L11 32 Z" fill="#ffffff" fillOpacity="0.85" />
        </g>

        {/* 4. Counter-Rotating Ethiopian Tilet Star Crown */}
        <g className="gebeta-inner-crown">
          {/* 8-point geometric star diamond */}
          <path
            d="M32 19 L35.5 28.5 L45 32 L35.5 35.5 L32 45 L28.5 35.5 L19 32 L28.5 28.5 Z"
            fill="none"
            stroke={`url(#${gold})`}
            strokeWidth="1.2"
            strokeOpacity="0.75"
          />
          <path
            d="M32 22 L34.5 29.5 L42 32 L34.5 34.5 L32 42 L29.5 34.5 L22 32 L29.5 29.5 Z"
            fill="#062919"
            fillOpacity="0.65"
          />
        </g>

        {/* 5. Live Community Ripple Wave */}
        <circle cx="32" cy="32" r="8" fill="none" stroke="#fef08a" strokeWidth="1" className="gebeta-ripple" />

        {/* 6. Central Table Hearth (Pulsating Golden Heart / የገበታው እምብርት) */}
        <g className="gebeta-core-pulse">
          <circle cx="32" cy="32" r="6" fill={`url(#${hearth})`} />
          {/* Center sparkle */}
          <path
            d="M32 28.5 L33.2 32 L32 35.5 L30.8 32 Z"
            fill="#ffffff"
          />
          <path
            d="M28.5 32 L32 30.8 L35.5 32 L32 33.2 Z"
            fill="#ffffff"
          />
        </g>
      </svg>
    </span>
  );
}

/**
 * The lockup: the Amharic name "አዲስ ገበታ", a pulsating live gold dot and an optional descriptor.
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
    <span className={cn("flex min-w-0 flex-col select-none", className)}>
      <span className="flex min-w-0 items-baseline gap-1.5">
        <span
          className={cn(
            "truncate font-ethiopic font-bold leading-tight tracking-tight text-ink",
            compact ? "text-base" : "text-lg",
          )}
          lang="am"
        >
          {BRAND.name}
        </span>
        <span
          className="brand-dot inline-block h-2 w-2 shrink-0 rounded-full bg-accent-500 shadow-[0_0_8px_rgba(233,185,73,0.7)]"
          title="Live Community"
        />
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
