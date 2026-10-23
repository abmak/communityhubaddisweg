import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, Minus, type LucideIcon } from "lucide-react";
import { cn, formatCount } from "../../lib/utils";
import type { PeriodDelta, TrendPoint } from "../../lib/adminTypes";

export function AdminPageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-700 dark:text-brand-300">
          {eyebrow}
        </p>
        <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight text-ink sm:text-[1.75rem]">
          {title}
        </h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

const TONES = {
  brand: "bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300",
  accent: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
  danger: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300",
  neutral: "bg-raised text-muted",
  sky: "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300",
} as const;

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "brand",
  delta,
  hint,
  suffix,
}: {
  label: string;
  value: number | string;
  icon: LucideIcon;
  tone?: keyof typeof TONES;
  delta?: PeriodDelta;
  hint?: string;
  suffix?: string;
}) {
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-2">
        <span className={cn("inline-flex h-9 w-9 items-center justify-center rounded-xl", TONES[tone])}>
          <Icon className="h-4 w-4" />
        </span>
        {delta && <DeltaBadge delta={delta} />}
      </div>
      <p className="mt-3 font-display text-2xl font-semibold text-ink">
        {typeof value === "number" ? formatCount(value) : value}
        {suffix && <span className="ml-1 text-sm font-medium text-muted">{suffix}</span>}
      </p>
      <p className="text-[11px] font-medium text-muted">{label}</p>
      {hint && <p className="mt-1 text-[11px] leading-4 text-muted/80">{hint}</p>}
    </div>
  );
}

export function DeltaBadge({ delta }: { delta: PeriodDelta }) {
  const { current, previous } = delta;
  const change = previous === 0 ? (current > 0 ? 100 : 0) : ((current - previous) / previous) * 100;
  const rounded = Math.round(Math.abs(change));
  const Icon = change > 0 ? ArrowUpRight : change < 0 ? ArrowDownRight : Minus;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
        change > 0
          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
          : change < 0
            ? "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"
            : "bg-raised text-muted",
      )}
      title={`${current} this period · ${previous} previous period`}
    >
      <Icon className="h-3 w-3" />
      {rounded}%
    </span>
  );
}

export function MiniStat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-line bg-raised/40 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">{label}</p>
      <p className="mt-1 font-display text-lg font-semibold text-ink">{value}</p>
      {hint && <p className="text-[10px] leading-4 text-muted/80">{hint}</p>}
    </div>
  );
}

export interface ChartLine {
  key: keyof Pick<TrendPoint, "members" | "posts" | "comments" | "reports">;
  label: string;
  color: string;
}

export function TrendChart({ points, lines }: { points: TrendPoint[]; lines: ChartLine[] }) {
  const width = 640;
  const height = 190;
  const padding = { top: 12, right: 8, bottom: 24, left: 32 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const max = Math.max(1, ...points.flatMap((point) => lines.map((line) => point[line.key])));
  const ceiling = Math.max(4, Math.ceil(max / 4) * 4);

  const xAt = (index: number) =>
    padding.left + (points.length <= 1 ? plotWidth / 2 : (index / (points.length - 1)) * plotWidth);
  const yAt = (value: number) => padding.top + plotHeight - (value / ceiling) * plotHeight;

  const linePath = (key: ChartLine["key"]) =>
    points.map((point, index) => `${index === 0 ? "M" : "L"}${xAt(index).toFixed(1)},${yAt(point[key]).toFixed(1)}`).join(" ");

  const labelEvery = Math.max(1, Math.ceil(points.length / 7));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-3">
          {lines.map((line) => (
            <span key={line.key} className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: line.color }} />
              {line.label}
              <span className="font-semibold text-ink">
                {formatCount(points.reduce((sum, point) => sum + point[line.key], 0))}
              </span>
            </span>
          ))}
        </div>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="mt-2 h-44 w-full"
        role="img"
        aria-label={`Trend for ${lines.map((line) => line.label).join(", ")}`}
      >
        {[0, 0.25, 0.5, 0.75, 1].map((step) => {
          const value = Math.round(ceiling * step);
          const y = yAt(value);
          return (
            <g key={step}>
              <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="currentColor" className="text-line" strokeDasharray={step === 0 ? undefined : "3 5"} strokeWidth="1" />
              <text x={padding.left - 6} y={y + 3} textAnchor="end" className="fill-current text-[9px] text-muted">
                {value}
              </text>
            </g>
          );
        })}
        {points.map((point, index) =>
          index % labelEvery === 0 || index === points.length - 1 ? (
            <text
              key={point.day}
              x={xAt(index)}
              y={height - 6}
              textAnchor="middle"
              className="fill-current text-[9px] text-muted"
            >
              {new Date(`${point.day}T00:00:00`).toLocaleDateString(undefined, {
                day: "numeric",
                month: "short",
              })}
            </text>
          ) : null,
        )}
        <path
          d={`${linePath(lines[0].key)} L${xAt(points.length - 1)},${padding.top + plotHeight} L${xAt(0)},${padding.top + plotHeight} Z`}
          fill={lines[0].color}
          opacity="0.1"
        />
        {lines.map((line) => (
          <path
            key={line.key}
            d={linePath(line.key)}
            fill="none"
            stroke={line.color}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
    </div>
  );
}

export function BarList({
  rows,
  emptyLabel = "Nothing here yet.",
}: {
  rows: Array<{ label: string; value: number; hint?: string; color?: string }>;
  emptyLabel?: string;
}) {
  if (rows.length === 0) return <p className="py-4 text-sm text-muted">{emptyLabel}</p>;
  const max = Math.max(...rows.map((row) => row.value), 1);

  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={row.label}>
          <div className="mb-1 flex items-center justify-between gap-2 text-xs">
            <span className="truncate text-muted">{row.label}</span>
            <span className="shrink-0 font-semibold text-ink">{formatCount(row.value)}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-raised">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.max(3, (row.value / max) * 100)}%`,
                backgroundColor: row.color ?? "#0f6b3a",
              }}
            />
          </div>
          {row.hint && <p className="mt-1 text-[10px] text-muted/80">{row.hint}</p>}
        </div>
      ))}
    </div>
  );
}

export function RoleDonut({
  rows,
}: {
  rows: Array<{ role: string; count: number }>;
}) {
  const colors: Record<string, string> = {
    ADMIN: "#0f6b3a",
    MODERATOR: "#d97706",
    USER: "#94a3b8",
  };
  const labels: Record<string, string> = {
    ADMIN: "Administrators",
    MODERATOR: "Moderators",
    USER: "Members",
  };
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="flex items-center gap-5">
      <svg viewBox="0 0 110 110" className="h-28 w-28 shrink-0 -rotate-90">
        <circle cx="55" cy="55" r={radius} fill="none" stroke="currentColor" className="text-raised" strokeWidth="13" />
        {rows.map((row) => {
          const length = total ? (row.count / total) * circumference : 0;
          const dash = `${length} ${circumference - length}`;
          const element = (
            <circle
              key={row.role}
              cx="55"
              cy="55"
              r={radius}
              fill="none"
              stroke={colors[row.role] ?? "#94a3b8"}
              strokeWidth="13"
              strokeDasharray={dash}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
            />
          );
          offset += length;
          return element;
        })}
      </svg>
      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.role} className="flex items-center gap-2 text-xs">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: colors[row.role] ?? "#94a3b8" }}
            />
            <span className="text-muted">{labels[row.role] ?? row.role}</span>
            <span className="ml-auto font-semibold text-ink">{formatCount(row.count)}</span>
          </div>
        ))}
        <p className="pt-1 text-[10px] text-muted/80">{formatCount(total)} accounts</p>
      </div>
    </div>
  );
}

export function Panel({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("card p-5", className)}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-display text-base font-semibold text-ink">{title}</h2>
          {description && <p className="mt-0.5 text-xs leading-5 text-muted">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function formatHours(hours: number | null): string {
  if (hours === null) return "No data";
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 48) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}
