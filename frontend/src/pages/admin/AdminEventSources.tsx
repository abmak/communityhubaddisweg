import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  ArrowUpRight,
  CheckCircle2,
  KeyRound,
  Loader2,
  Plus,
  RefreshCw,
  Rss,
  Send,
  Sparkles,
  Trash2,
  Trophy,
  X,
} from "lucide-react";
import { api, apiError } from "../../lib/api";
import { useQuery } from "../../hooks/useApi";
import { useUI } from "../../store/ui";
import type { AiUsageResponse, EventSourcesResponse, EventSourceSummary, EventTopic } from "../../types";
import { Badge, ConfirmDialog, EmptyState, PageLoader } from "../../components/ui";
import { useAdminAccess } from "./AdminLayout";
import { AdminPageHeader } from "./parts";
import { cn, formatDateTime } from "../../lib/utils";

type Adapter = "SPORTS_API" | "TELEGRAM" | "RSS" | "GEMINI";

interface SyncResult {
  name: string;
  status: "OK" | "ERROR";
  created: number;
  updated: number;
  skipped: number;
  error?: string;
}

const ADAPTERS: { value: Adapter; label: string; hint: string; icon: typeof Rss }[] = [
  {
    value: "SPORTS_API",
    label: "Sports league feed",
    hint: "Fixtures for a league on TheSportsDB — football, basketball and more.",
    icon: Trophy,
  },
  {
    value: "TELEGRAM",
    label: "Telegram channel",
    hint: "Reads the public preview of a venue or organiser channel, e.g. Cinema.",
    icon: Send,
  },
  {
    value: "RSS",
    label: "RSS / calendar feed",
    hint: "Any event calendar or news feed; optionally only posts matching keywords.",
    icon: Rss,
  },
  {
    value: "GEMINI",
    label: "AI events desk",
    hint: "Gemini searches the web for events no feed carries — world sport, theatre runs, one-off shows.",
    icon: Sparkles,
  },
];

const TOPICS: { value: EventTopic; label: string }[] = [
  { value: "CINEMA", label: "Cinema" },
  { value: "THEATRE", label: "Theatre" },
  { value: "SPORTS", label: "Sports" },
  { value: "MUSIC", label: "Music" },
  { value: "FESTIVAL", label: "Music festival" },
  { value: "SOCIAL", label: "Social" },
  { value: "TRAVEL", label: "Travel" },
  { value: "HIKING", label: "Hiking" },
  { value: "BUSINESS", label: "Business" },
  { value: "SEASONAL", label: "Seasonal" },
  { value: "COMMUNITY", label: "Community" },
  { value: "OTHER", label: "Other" },
];

function adapterIcon(adapter: Adapter) {
  return ADAPTERS.find((entry) => entry.value === adapter)?.icon ?? Rss;
}

function configValue(config: Record<string, unknown>, key: string): string {
  const value = config[key];
  if (Array.isArray(value)) return value.join(", ");
  return typeof value === "string" ? value : "";
}

const emptyForm = {
  name: "",
  adapter: "SPORTS_API" as Adapter,
  topic: "SPORTS" as EventTopic,
  channel: "",
  feedUrl: "",
  leagueId: "",
  keywords: "",
  prompt: "",
  horizonDays: "21",
  grounded: true,
  enabled: true,
};

export function AdminEventSources() {
  const { permissions } = useAdminAccess();
  const canManage = permissions.includes("admin.events.manage");
  const pushToast = useUI((state) => state.pushToast);
  const query = useQuery<EventSourcesResponse>("/api/events/sources");
  const aiUsage = useQuery<AiUsageResponse>("/api/events/ai-usage");

  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<EventSourceSummary | null>(null);
  const [deleting, setDeleting] = useState(false);

  const sources = query.data?.sources ?? [];
  const imported = sources.reduce((total, source) => total + source.eventCount, 0);

  const buildConfig = () => {
    if (form.adapter === "TELEGRAM") {
      return {
        channel: form.channel.replace(/^@/, "").trim(),
        ...(form.keywords.trim() ? { keywords: form.keywords.trim() } : {}),
        ...(form.topic ? { topic: form.topic } : {}),
      };
    }
    if (form.adapter === "RSS") {
      return {
        feedUrl: form.feedUrl.trim(),
        ...(form.keywords.trim() ? { keywords: form.keywords.trim() } : {}),
        ...(form.topic ? { topic: form.topic } : {}),
      };
    }
    if (form.adapter === "GEMINI") {
      return {
        ...(form.prompt.trim() ? { prompt: form.prompt.trim() } : {}),
        horizonDays: Number.isFinite(Number(form.horizonDays)) ? Number(form.horizonDays) : 21,
        grounded: form.grounded,
      };
    }
    return {
      ...(form.leagueId.trim() ? { leagueId: form.leagueId.trim() } : {}),
    };
  };

  const addSource = async (event: FormEvent) => {
    event.preventDefault();
    if (!canManage) return;
    if (form.name.trim().length < 3) {
      pushToast("Give the source a name of at least 3 characters.", { tone: "error" });
      return;
    }
    if (form.adapter === "TELEGRAM" && !form.channel.trim()) {
      pushToast("Add the Telegram channel handle.", { tone: "error" });
      return;
    }
    if (form.adapter === "RSS" && !form.feedUrl.trim()) {
      pushToast("Add the feed URL.", { tone: "error" });
      return;
    }

    setSaving(true);
    try {
      await api.post("/api/events/sources", {
        name: form.name.trim(),
        adapter: form.adapter,
        topic: form.topic,
        config: buildConfig(),
        enabled: form.enabled,
      });
      pushToast("Source added. Run a sync to pull its listings.", { tone: "success" });
      setForm(emptyForm);
      setAdding(false);
      query.refetch();
    } catch (error) {
      pushToast(apiError(error), { tone: "error" });
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (source: EventSourceSummary) => {
    try {
      await api.patch(`/api/events/sources/${source.id}`, { enabled: !source.enabled });
      pushToast(source.enabled ? `${source.name} paused.` : `${source.name} resumed.`, {
        tone: "success",
      });
      query.refetch();
    } catch (error) {
      pushToast(apiError(error), { tone: "error" });
    }
  };

  const syncOne = async (source: EventSourceSummary) => {
    setSyncingId(source.id);
    try {
      const response = await api.post<{ result: SyncResult }>(`/api/events/sources/${source.id}/sync`);
      const result = response.data.result;
      if (result.status === "ERROR") {
        pushToast(`${result.name} could not be read: ${result.error ?? "unknown error"}`, {
          tone: "error",
        });
      } else {
      pushToast(
        `${result.name}: ${result.created} new, ${result.updated} refreshed, ${result.skipped} skipped.`,
        { tone: "success" },
      );
      }
      query.refetch();
      aiUsage.refetch();
    } catch (error) {
      pushToast(apiError(error), { tone: "error" });
      query.refetch();
      aiUsage.refetch();
    } finally {
      setSyncingId(null);
    }
  };

  const syncAll = async () => {
    setSyncingAll(true);
    try {
      const response = await api.post<{ results: SyncResult[] }>("/api/events/sync");
      const results = response.data.results;
      const created = results.reduce((total, result) => total + result.created, 0);
      const failed = results.filter((result) => result.status === "ERROR").length;
      pushToast(
        `Imported ${created} new ${created === 1 ? "listing" : "listings"}${
          failed ? ` · ${failed} source${failed === 1 ? "" : "s"} failed` : ""
        }.`,
        { tone: failed ? "error" : "success" },
      );
      query.refetch();
      aiUsage.refetch();
    } catch (error) {
      pushToast(apiError(error), { tone: "error" });
      aiUsage.refetch();
    } finally {
      setSyncingAll(false);
    }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/api/events/sources/${deleteTarget.id}`);
      pushToast(`${deleteTarget.name} removed with its imported listings.`, { tone: "success" });
      setDeleteTarget(null);
      query.refetch();
    } catch (error) {
      pushToast(apiError(error), { tone: "error" });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-5">
      <AdminPageHeader
        eyebrow="Community calendar"
        title="Event sources"
        description="Feeds that publish cinema screenings, fixtures and festivals automatically. Every sync files new listings under Events; members keep creating their own meetups."
        actions={
          <div className="flex items-center gap-2">
            <Link to="/events" className="btn-secondary btn-sm">
              <ArrowUpRight className="h-3.5 w-3.5" /> View Events
            </Link>
            {canManage && (
              <button
                type="button"
                className="btn-primary btn-sm"
                onClick={() => void syncAll()}
                disabled={syncingAll || sources.length === 0}
              >
                {syncingAll ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                Sync all
              </button>
            )}
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="card p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Sources</p>
          <p className="mt-1 font-display text-2xl font-semibold text-ink">{sources.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Active</p>
          <p className="mt-1 font-display text-2xl font-semibold text-ink">
            {sources.filter((source) => source.enabled).length}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            Imported listings
          </p>
          <p className="mt-1 font-display text-2xl font-semibold text-ink">{imported}</p>
        </div>
      </div>

      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3.5">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-brand-700" />
            <h2 className="font-display text-base font-semibold text-ink">Gemini extraction pool</h2>
            {aiUsage.data?.models?.length ? (
              <Badge tone="accent">{aiUsage.data.models.join(" → ")}</Badge>
            ) : null}
          </div>
          {aiUsage.data && (
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">
              {aiUsage.data.totals.requests} calls · {aiUsage.data.totals.rateLimited} rate limits
            </span>
          )}
        </div>

        {aiUsage.loading && !aiUsage.data ? (
          <PageLoader label="Loading key usage…" />
        ) : !aiUsage.data?.configured ? (
          <p className="px-5 py-4 text-xs text-muted">
            No Gemini keys are configured. Add <code className="rounded bg-raised px-1">GEMINI_API_KEYS</code>{" "}
            to the server environment to let AI read the feeds.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {aiUsage.data.keys.map((key) => (
              <li key={key.index} className="px-5 py-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <span className="inline-flex h-7 items-center rounded-lg bg-brand-50 px-2 text-[11px] font-semibold text-brand-800 dark:bg-brand-500/10 dark:text-brand-200">
                    Key {key.index}
                  </span>
                  <code className="text-[11px] text-muted">{key.maskedKey}</code>
                  <Badge
                    tone={
                      key.cooldownUntil
                        ? "neutral"
                        : key.lastStatus === "OK"
                          ? "brand"
                          : key.lastStatus
                            ? "accent"
                            : "neutral"
                    }
                  >
                    {key.cooldownUntil
                      ? "cooling down"
                      : key.lastStatus === "RATE_LIMITED"
                        ? "on fallback"
                        : (key.lastStatus ?? "unused").toLowerCase()}
                  </Badge>
                  <span className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted">
                    <span>{key.requests} calls</span>
                    <span>{key.successes} ok</span>
                    <span>{key.rateLimited} limited</span>
                    <span>{key.tokens.toLocaleString()} tokens</span>
                    <span>{key.lastUsedAt ? formatDateTime(key.lastUsedAt) : "never used"}</span>
                  </span>
                </div>
                {key.lastError && (
                  <p
                    className={cn(
                      "mt-1.5 flex items-start gap-1.5 rounded-lg px-2 py-1.5 text-[11px]",
                      key.cooldownUntil
                        ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                        : "bg-rose-500/10 text-rose-600 dark:text-rose-300",
                    )}
                  >
                    <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
                    <span title={key.lastError}>
                      {key.lastError.length > 180 ? `${key.lastError.slice(0, 177)}…` : key.lastError}
                    </span>
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}

        <p className="border-t border-line px-5 py-2.5 text-[11px] text-muted">
          A key that reports its quota as exhausted is parked for as long as Google asks, and the
          next key in the pool takes the request — so extraction keeps working across all five.
        </p>
      </section>

      {canManage && (
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <div className="flex items-center gap-2">
              <Rss className="h-4 w-4 text-brand-700" />
              <h2 className="font-display text-base font-semibold text-ink">Add a source</h2>
            </div>
            <button
              type="button"
              className="btn-ghost btn-sm"
              onClick={() => setAdding((value) => !value)}
            >
              {adding ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
              {adding ? "Close" : "New source"}
            </button>
          </div>

          {adding && (
            <form onSubmit={addSource} className="space-y-4 p-5">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <label className="label" htmlFor="source-name">
                    Source name
                  </label>
                  <input
                    id="source-name"
                    className="input"
                    value={form.name}
                    maxLength={80}
                    onChange={(event) => setForm({ ...form, name: event.target.value })}
                    placeholder="Ethiopian Premier League fixtures"
                    required
                  />
                </div>
                <div>
                  <label className="label" htmlFor="source-topic">
                    Topic
                  </label>
                  <select
                    id="source-topic"
                    className="input"
                    value={form.topic}
                    onChange={(event) =>
                      setForm({ ...form, topic: event.target.value as EventTopic })
                    }
                  >
                    {TOPICS.map((topic) => (
                      <option key={topic.value} value={topic.value}>
                        {topic.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <span className="label">Feed type</span>
                <div className="grid gap-2 sm:grid-cols-3">
                  {ADAPTERS.map((adapter) => {
                    const Icon = adapter.icon;
                    const active = form.adapter === adapter.value;
                    return (
                      <button
                        key={adapter.value}
                        type="button"
                        onClick={() => setForm({ ...form, adapter: adapter.value })}
                        className={`rounded-xl border px-3 py-2.5 text-left transition ${
                          active
                            ? "border-brand-500 bg-brand-50/60 dark:bg-brand-500/10"
                            : "border-line bg-surface hover:bg-raised"
                        }`}
                      >
                        <span className="flex items-center gap-1.5 text-xs font-semibold text-ink">
                          <Icon className="h-3.5 w-3.5" /> {adapter.label}
                        </span>
                        <span className="mt-1 block text-[11px] leading-snug text-muted">
                          {adapter.hint}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {form.adapter === "TELEGRAM" && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="label" htmlFor="source-channel">
                      Channel handle
                    </label>
                    <input
                      id="source-channel"
                      className="input"
                      value={form.channel}
                      onChange={(event) => setForm({ ...form, channel: event.target.value })}
                      placeholder="Century_Cinema"
                      required
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor="source-keywords">
                      Only posts mentioning <span className="font-normal">(optional)</span>
                    </label>
                    <input
                      id="source-keywords"
                      className="input"
                      value={form.keywords}
                      onChange={(event) => setForm({ ...form, keywords: event.target.value })}
                      placeholder="screening, premiere"
                    />
                  </div>
                </div>
              )}

              {form.adapter === "RSS" && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="label" htmlFor="source-feed">
                      Feed URL
                    </label>
                    <input
                      id="source-feed"
                      className="input"
                      value={form.feedUrl}
                      onChange={(event) => setForm({ ...form, feedUrl: event.target.value })}
                      placeholder="https://example.com/events.ics"
                      required
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor="source-rss-keywords">
                      Only titles containing <span className="font-normal">(optional)</span>
                    </label>
                    <input
                      id="source-rss-keywords"
                      className="input"
                      value={form.keywords}
                      onChange={(event) => setForm({ ...form, keywords: event.target.value })}
                      placeholder="concert, festival"
                    />
                  </div>
                </div>
              )}

              {form.adapter === "SPORTS_API" && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="label" htmlFor="source-league">
                      League id
                    </label>
                    <input
                      id="source-league"
                      className="input"
                      value={form.leagueId}
                      onChange={(event) => setForm({ ...form, leagueId: event.target.value })}
                      placeholder="4959 (Ethiopian Premier League)"
                    />
                  </div>
                  <p className="flex items-end text-[11px] leading-snug text-muted">
                    Leave blank to use the default league id, or type {" "}
                    <code className="mx-1 rounded bg-raised px-1">international</code> in the league
                    id for every major league in one feed.
                  </p>
                </div>
              )}

              {form.adapter === "GEMINI" && (
                <div className="space-y-3">
                  <div>
                    <label className="label" htmlFor="source-prompt">
                      What should the AI look for?
                    </label>
                    <textarea
                      id="source-prompt"
                      className="input min-h-[72px] resize-y"
                      value={form.prompt}
                      onChange={(event) => setForm({ ...form, prompt: event.target.value })}
                      placeholder="International football, athletics and tennis in the next three weeks, plus cinema and theatre in Addis Ababa."
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="label" htmlFor="source-horizon">
                        Look ahead (days)
                      </label>
                      <input
                        id="source-horizon"
                        type="number"
                        min={1}
                        max={60}
                        className="input"
                        value={form.horizonDays}
                        onChange={(event) => setForm({ ...form, horizonDays: event.target.value })}
                      />
                    </div>
                    <label className="flex items-end gap-2 pb-2 text-xs font-medium text-ink">
                      <input
                        type="checkbox"
                        checked={form.grounded}
                        onChange={(event) => setForm({ ...form, grounded: event.target.checked })}
                      />
                      Verify with Google Search
                    </label>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-xs font-medium text-ink">
                  <input
                    type="checkbox"
                    checked={form.enabled}
                    onChange={(event) => setForm({ ...form, enabled: event.target.checked })}
                  />
                  Sync this source automatically
                </label>
                <button type="submit" className="btn-primary btn-sm" disabled={saving}>
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  Add source
                </button>
              </div>
            </form>
          )}
        </section>
      )}

      <section className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h2 className="font-display text-base font-semibold text-ink">Connected feeds</h2>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            {sources.length} total
          </span>
        </div>

        {query.loading && !query.data ? (
          <PageLoader label="Loading sources…" />
        ) : sources.length === 0 ? (
          <EmptyState
            icon={Rss}
            title="No event sources yet"
            description="Connect a cinema channel, a league feed or an RSS calendar and listings will post themselves."
          />
        ) : (
          <ul className="divide-y divide-line">
            {sources.map((source) => {
              const Icon = adapterIcon(source.adapter);
              return (
                <li key={source.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-start gap-3">
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-brand-600/15 dark:bg-brand-500/10 dark:text-brand-300">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
                        {source.name}
                        <Badge tone={source.enabled ? "brand" : "neutral"}>
                          {source.enabled ? "Active" : "Paused"}
                        </Badge>
                        <Badge tone="accent">{source.topic.toLowerCase()}</Badge>
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted">
                        {ADAPTERS.find((entry) => entry.value === source.adapter)?.label} ·{" "}
                        {source.eventCount} {source.eventCount === 1 ? "listing" : "listings"} ·{" "}
                        {source.lastSyncAt
                          ? `last sync ${formatDateTime(source.lastSyncAt)}`
                          : "never synced"}
                      </p>
                      {source.adapter === "TELEGRAM" && (
                        <p className="mt-0.5 text-[11px] text-muted">
                          @{configValue(source.config, "channel")}
                        </p>
                      )}
                      {source.adapter === "RSS" && (
                        <p className="mt-0.5 truncate text-[11px] text-muted">
                          {configValue(source.config, "feedUrl")}
                        </p>
                      )}
                      {source.adapter === "GEMINI" && (
                        <p className="mt-0.5 line-clamp-2 text-[11px] text-muted">
                          {configValue(source.config, "prompt") || "Default AI desk sweep"}
                        </p>
                      )}
                      {source.lastStatus === "ERROR" && source.lastError && (
                        <p className="mt-1.5 flex items-start gap-1.5 rounded-lg bg-rose-500/10 px-2 py-1.5 text-[11px] text-rose-600 dark:text-rose-300">
                          <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
                          <span>{source.lastError}</span>
                        </p>
                      )}
                      {source.lastStatus === "OK" && source.lastImported > 0 && (
                        <p className="mt-1 flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="h-3 w-3" /> {source.lastImported} new on the last
                          sync
                        </p>
                      )}
                    </div>

                    {canManage && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          className="btn-ghost btn-sm"
                          onClick={() => void syncOne(source)}
                          disabled={syncingId === source.id}
                        >
                          {syncingId === source.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <RefreshCw className="h-3.5 w-3.5" />
                          )}
                          Sync
                        </button>
                        <button
                          type="button"
                          className="btn-ghost btn-sm"
                          onClick={() => void toggle(source)}
                        >
                          {source.enabled ? "Pause" : "Resume"}
                        </button>
                        <button
                          type="button"
                          className="btn-ghost btn-sm text-rose-600"
                          onClick={() => setDeleteTarget(source)}
                          aria-label={`Delete ${source.name}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Delete this source?"
        description="The feed is removed and every listing it imported is deleted. Meetups created by members are not affected."
        busy={deleting}
        onConfirm={remove}
      />
    </div>
  );
}
