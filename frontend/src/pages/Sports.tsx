import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, ArrowRight, CalendarDays, Clock, MapPin, RefreshCw, Shield, Trophy } from "lucide-react";
import { useQuery } from "../hooks/useApi";
import { useTranslation } from "../store/i18n";
import type { SportFixture, SportsLeague, SportsResponse } from "../types";
import { Spinner } from "../components/ui";
import { cn, timeAgo } from "../lib/utils";

const LEAGUES = [
  { name: "English Premier League", short: "Premier League", tone: "bg-violet-700" },
  { name: "Spanish La Liga", short: "La Liga", tone: "bg-amber-600" },
  { name: "Italian Serie A", short: "Serie A", tone: "bg-sky-700" },
  { name: "German Bundesliga", short: "Bundesliga", tone: "bg-rose-700" },
] as const;

type LeagueName = (typeof LEAGUES)[number]["name"];

function leagueMeta(name: string) {
  return LEAGUES.find((league) => league.name === name) ?? { name, short: name, tone: "bg-emerald-700" };
}

function localDayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function dayHeading(date: Date, today: Date, tomorrow: Date): string {
  if (localDayKey(date) === localDayKey(today)) return "Today";
  if (localDayKey(date) === localDayKey(tomorrow)) return "Tomorrow";
  return date.toLocaleDateString(undefined, { weekday: "long" });
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function timeZoneLabel(date: Date): string {
  const part = new Intl.DateTimeFormat(undefined, { timeZoneName: "short" })
    .formatToParts(date)
    .find((entry) => entry.type === "timeZoneName");
  return part?.value ?? "";
}

interface DayGroup {
  key: string;
  date: Date;
  fixtures: SportFixture[];
}

/** A club crest from the fixture feed; a neutral shield when it is missing. */
function TeamCrest({ src, name }: { src: string | null; name: string }) {
  if (!src) return <Shield className="h-4 w-4 shrink-0 text-muted/40" aria-hidden="true" />;
  return (
    <img
      src={src}
      alt=""
      title={`${name} crest`}
      loading="lazy"
      className="h-5 w-5 shrink-0 object-contain"
    />
  );
}

/**
 * The league-by-league fixture schedule, without the page hero. Shared by the
 * dedicated /sports page and the Sport category on the Events page.
 */
export function SportsSchedule({
  leagues,
  loading = false,
  error = null,
  onRetry,
  showEmptyLink = true,
}: {
  leagues: SportsLeague[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  showEmptyLink?: boolean;
}) {
  const [league, setLeague] = useState<LeagueName | "ALL">("ALL");
  const fixtureCount = leagues.reduce((total, entry) => total + entry.fixtures.length, 0);

  const fixtures = useMemo(() => {
    const selected = league === "ALL" ? leagues : leagues.filter((entry) => entry.name === league);
    return selected
      .flatMap((entry) => entry.fixtures)
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  }, [leagues, league]);

  const days = useMemo<DayGroup[]>(() => {
    const groups = new Map<string, DayGroup>();
    for (const fixture of fixtures) {
      const date = new Date(fixture.startDate);
      const key = localDayKey(date);
      const existing = groups.get(key);
      if (existing) existing.fixtures.push(fixture);
      else groups.set(key, { key, date, fixtures: [fixture] });
    }
    return [...groups.values()];
  }, [fixtures]);

  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const zone = timeZoneLabel(now);

  return (
    <div className="space-y-5">
      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Leagues">
        <button
          type="button"
          role="tab"
          aria-selected={league === "ALL"}
          onClick={() => setLeague("ALL")}
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition",
            league === "ALL"
              ? "border-transparent bg-brand-800 text-white shadow-sm"
              : "chip border-line bg-surface",
          )}
        >
          All leagues <span className="ml-1 opacity-60">{fixtureCount}</span>
        </button>
        {LEAGUES.map((entry) => {
          const count = leagues.find((item) => item.name === entry.name)?.fixtures.length ?? 0;
          return (
            <button
              key={entry.name}
              type="button"
              role="tab"
              aria-selected={league === entry.name}
              onClick={() => setLeague(entry.name)}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition",
                league === entry.name
                  ? "border-transparent bg-brand-800 text-white shadow-sm"
                  : "chip border-line bg-surface",
              )}
            >
              {entry.short} <span className="ml-1 opacity-60">{count}</span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex min-h-[280px] flex-col items-center justify-center gap-3">
          <Spinner className="h-8 w-8 text-emerald-600" />
          <p className="text-xs text-muted">Loading fixtures…</p>
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-6 text-center text-sm text-rose-500">
          <AlertCircle className="mx-auto mb-2 h-6 w-6" />
          <p>{error}</p>
          <button
            type="button"
            onClick={() => onRetry?.()}
            className="mt-3 rounded-xl bg-surface px-4 py-2 text-xs font-semibold text-ink shadow-sm"
          >
            Try again
          </button>
        </div>
      ) : days.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-line bg-surface/50 p-12 text-center">
          <Trophy className="mx-auto mb-3 h-10 w-10 text-muted/60" />
          <h2 className="text-base font-bold text-ink">No fixtures in this window yet</h2>
          <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-muted">
            The league feed refreshes every few hours. New matchweeks appear here as soon as they are published.
          </p>
          {showEmptyLink && (
            <Link to="/events" className="btn-secondary btn-sm mt-5 inline-flex">
              Browse all events <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          {days.map((day) => (
            <section key={day.key} className="space-y-2">
              <div className="flex items-baseline justify-between px-1">
                <h2 className="text-sm font-bold text-ink">{dayHeading(day.date, now, tomorrow)}</h2>
                <p className="text-[11px] font-medium text-muted">
                  {day.date.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}
                </p>
              </div>

              <div className="card divide-y divide-line overflow-hidden">
                {day.fixtures.map((fixture) => {
                  const start = new Date(fixture.startDate);
                  const meta = leagueMeta(fixture.competition);
                  return (
                    <Link
                      key={fixture.id}
                      to={`/events/${fixture.slug}`}
                      className="group flex items-center gap-3 px-4 py-3.5 transition hover:bg-raised/60 sm:gap-5 sm:px-5"
                    >
                      <div className="w-14 shrink-0 text-center sm:w-16">
                        <p className="text-sm font-bold tabular-nums text-ink">{formatTime(start)}</p>
                        <p className="text-[9px] font-medium uppercase tracking-wide text-muted/70">{zone}</p>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
                          <div className="flex min-w-0 items-center gap-2 sm:flex-1">
                            <TeamCrest src={fixture.homeLogo} name={fixture.homeTeam} />
                            <span className="min-w-0 truncate text-[13px] font-semibold text-ink sm:text-sm">
                              {fixture.homeTeam}
                            </span>
                          </div>
                          <span className="hidden shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted/60 sm:inline">
                            vs
                          </span>
                          <div className="flex min-w-0 items-center gap-2 sm:flex-1">
                            <TeamCrest src={fixture.awayLogo} name={fixture.awayTeam ?? "Away team"} />
                            <span className="min-w-0 truncate text-[13px] text-ink sm:text-sm sm:font-semibold">
                              {fixture.awayTeam ?? "TBC"}
                            </span>
                          </div>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-muted">
                          <span className={cn("inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white", meta.tone)}>
                            {meta.short}
                          </span>
                          {fixture.venue ? (
                            <span className="inline-flex min-w-0 items-center gap-1">
                              <MapPin className="h-3 w-3 shrink-0" />
                              <span className="truncate">{fixture.venue}</span>
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <ArrowRight className="h-4 w-4 shrink-0 text-muted/40 transition group-hover:translate-x-0.5 group-hover:text-ink" />
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

export function SportsPage() {
  const { t } = useTranslation();
  const { data, loading, error, refetch } = useQuery<SportsResponse>("/api/events/sports?days=21");
  const leagues = data?.leagues ?? [];
  const fixtureCount = leagues.reduce((total, entry) => total + entry.fixtures.length, 0);
  const zone = timeZoneLabel(new Date());

  return (
    <div className="space-y-6">
      <header className="relative overflow-hidden rounded-2xl border border-white/10 bg-brand-950 px-6 py-8 text-white shadow-soft sm:px-9">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(110%_120%_at_0%_0%,rgba(31,163,87,0.3),transparent_58%),radial-gradient(80%_90%_at_100%_100%,rgba(233,185,73,0.16),transparent_60%)]"
        />
        <span aria-hidden="true" className="app-grid absolute inset-0 opacity-[0.16]" />
        <span aria-hidden="true" className="tilet-strip absolute inset-x-0 top-0 h-1 opacity-50" />
        <div className="relative max-w-2xl">
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-300">
            <Trophy className="h-3.5 w-3.5" /> Football schedules
          </p>
          <h1 className="mt-2 font-display text-[1.9rem] font-semibold leading-tight tracking-tight sm:text-[2.15rem]">
            The next three weeks, league by league.
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-white/60">
            {t(
              "sports.subtitle",
              "Every fixture in the Premier League, La Liga, Serie A and Bundesliga, with kick-off times in your own timezone.",
            )}
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] font-medium text-white/55">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5 text-accent-300" /> Next 21 days
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-accent-300" /> {zone ? `All times ${zone}` : "Your local kick-off times"}
            </span>
            {data?.updatedAt ? (
              <span className="inline-flex items-center gap-1.5">
                <RefreshCw className="h-3.5 w-3.5 text-accent-300" /> Updated {timeAgo(data.updatedAt)}
              </span>
            ) : null}
          </div>
        </div>
      </header>

      <SportsSchedule leagues={leagues} loading={loading} error={error} onRetry={refetch} />
    </div>
  );
}
