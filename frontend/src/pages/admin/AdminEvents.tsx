import { useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  Briefcase,
  CalendarDays,
  CalendarPlus,
  Film,
  Loader2,
  MapPin,
  Mountain,
  Music2,
  PartyPopper,
  Pencil,
  Plane,
  Plus,
  Snowflake,
  Sparkles,
  Theater,
  Trash2,
  Trophy,
  Users,
} from "lucide-react";
import { api, apiError } from "../../lib/api";
import { useQuery } from "../../hooks/useApi";
import { useUI } from "../../store/ui";
import type { EventTopic } from "../../types";
import type { AdminEvent, AdminEventsResponse } from "../../lib/adminTypes";
import { Badge, ConfirmDialog, EmptyState, PageLoader } from "../../components/ui";
import { useAdminAccess } from "./AdminLayout";
import { AdminPageHeader } from "./parts";
import { cn, formatDateTime } from "../../lib/utils";

/** The event kinds the desk offers, in the order the brief lists them. */
const TOPICS: Array<{
  value: EventTopic;
  label: string;
  icon: typeof Film;
  className: string;
}> = [
  { value: "FESTIVAL", label: "Music festival", icon: PartyPopper, className: "bg-amber-600" },
  { value: "CINEMA", label: "Cinema", icon: Film, className: "bg-rose-600" },
  { value: "THEATRE", label: "Theatre", icon: Theater, className: "bg-purple-600" },
  { value: "SOCIAL", label: "Social", icon: Users, className: "bg-teal-600" },
  { value: "TRAVEL", label: "Travel", icon: Plane, className: "bg-sky-600" },
  { value: "HIKING", label: "Hiking", icon: Mountain, className: "bg-lime-700" },
  { value: "BUSINESS", label: "Business conference", icon: Briefcase, className: "bg-slate-700" },
  { value: "SEASONAL", label: "Seasonal event", icon: Snowflake, className: "bg-indigo-600" },
  { value: "MUSIC", label: "Concert", icon: Music2, className: "bg-blue-600" },
  { value: "SPORTS", label: "Sports", icon: Trophy, className: "bg-emerald-600" },
  { value: "COMMUNITY", label: "Community", icon: Sparkles, className: "bg-brand-600" },
  { value: "OTHER", label: "Other", icon: CalendarDays, className: "bg-neutral-600" },
];

function topicMeta(topic: EventTopic) {
  return TOPICS.find((entry) => entry.value === topic) ?? TOPICS[TOPICS.length - 1];
}

const PRESET_COVERS = [
  {
    name: "Festival crowd",
    url: "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?auto=format&fit=crop&w=1200&q=75",
  },
  {
    name: "Cinema",
    url: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1200&q=75",
  },
  {
    name: "Trail",
    url: "https://images.unsplash.com/photo-1551632811-561732d1e306?auto=format&fit=crop&w=1200&q=75",
  },
  {
    name: "Conference",
    url: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1200&q=75",
  },
];

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** ISO string → the local "YYYY-MM-DDTHH:mm" a datetime-local input expects. */
function toInputValue(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

function emptyForm() {
  return {
    title: "",
    description: "",
    topic: "FESTIVAL" as EventTopic,
    startDate: "",
    endDate: "",
    location: "",
    coverUrl: PRESET_COVERS[0].url,
    maxAttendees: "",
  };
}

function dayChip(value: string): { day: string; month: string } {
  const date = new Date(value);
  return {
    day: date.toLocaleDateString(undefined, { day: "2-digit" }),
    month: date.toLocaleDateString(undefined, { month: "short" }).toUpperCase(),
  };
}

export function AdminEvents() {
  const { permissions } = useAdminAccess();
  const canManage = permissions.includes("admin.events.manage");
  const pushToast = useUI((state) => state.pushToast);
  const formRef = useRef<HTMLFormElement>(null);

  const [scope, setScope] = useState<"upcoming" | "past">("upcoming");
  const [topicFilter, setTopicFilter] = useState<"ALL" | EventTopic>("ALL");
  const [includeImported, setIncludeImported] = useState(false);
  const query = useQuery<AdminEventsResponse>(
    `/api/admin/events?scope=${scope}${includeImported ? "&source=all" : ""}${
      topicFilter === "ALL" ? "" : `&topic=${topicFilter}`
    }`,
  );

  const [editing, setEditing] = useState<AdminEvent | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminEvent | null>(null);
  const [deleting, setDeleting] = useState(false);

  const events = query.data?.events ?? [];

  const reset = () => {
    setEditing(null);
    setForm(emptyForm());
  };

  const startEdit = (event: AdminEvent) => {
    setEditing(event);
    setForm({
      title: event.title,
      description: event.description,
      topic: event.topic,
      startDate: toInputValue(event.startDate),
      endDate: event.endDate ? toInputValue(event.endDate) : "",
      location: event.location ?? "",
      coverUrl: event.coverUrl ?? "",
      maxAttendees: event.maxAttendees ? String(event.maxAttendees) : "",
    });
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const submit = async (submitEvent: FormEvent) => {
    submitEvent.preventDefault();
    if (!canManage) return;

    if (!form.startDate) {
      pushToast("Choose when the event starts.", { tone: "error" });
      return;
    }
    const startDate = new Date(form.startDate);
    const endDate = form.endDate ? new Date(form.endDate) : null;
    if (endDate && endDate <= startDate) {
      pushToast("The end time must be after the start.", { tone: "error" });
      return;
    }

    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      topic: form.topic,
      startDate: startDate.toISOString(),
      endDate: endDate ? endDate.toISOString() : null,
      location: form.location.trim() || null,
      coverUrl: form.coverUrl.trim() || null,
      maxAttendees: form.maxAttendees ? Number(form.maxAttendees) : null,
    };

    setBusy(true);
    try {
      if (editing) {
        await api.patch(`/api/admin/events/${editing.id}`, payload);
        pushToast("Event updated.", { tone: "success" });
      } else {
        await api.post("/api/admin/events", payload);
        pushToast(`“${payload.title}” is on the calendar.`, { tone: "success" });
      }
      reset();
      query.refetch();
    } catch (error) {
      pushToast(apiError(error), { tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/api/admin/events/${deleteTarget.id}`);
      pushToast("Event removed from the calendar.", { tone: "success" });
      setDeleteTarget(null);
      if (editing?.id === deleteTarget.id) reset();
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
        eyebrow="City calendar"
        title="Events"
        description="Publish official listings — music festivals, cinema and theatre runs, socials, travel and hiking outings, business conferences and seasonal celebrations. They appear on the community Events page as soon as you save."
        actions={
          <Link to="/events" className="btn-secondary btn-sm">
            <ArrowUpRight className="h-3.5 w-3.5" /> View Events
          </Link>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        {canManage ? (
          <form ref={formRef} onSubmit={submit} className="card h-fit scroll-mt-20 p-5">
            <div className="flex items-center gap-2">
              <CalendarPlus className="h-4 w-4 text-brand-700 dark:text-brand-300" />
              <h2 className="font-display text-base font-semibold text-ink">
                {editing ? "Edit event" : "Publish an event"}
              </h2>
              {editing && (
                <button type="button" className="btn-ghost btn-sm ml-auto" onClick={reset}>
                  Cancel
                </button>
              )}
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <label className="label" htmlFor="event-title">
                  Title
                </label>
                <input
                  id="event-title"
                  className="input"
                  value={form.title}
                  maxLength={120}
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                  placeholder="Addis Jazz Festival 2026"
                  required
                />
              </div>

              <fieldset>
                <legend className="label">Category</legend>
                <div className="mt-1 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                  {TOPICS.map((topic) => {
                    const Icon = topic.icon;
                    const active = form.topic === topic.value;
                    return (
                      <button
                        key={topic.value}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setForm({ ...form, topic: topic.value })}
                        className={cn(
                          "flex items-center gap-1.5 rounded-xl border px-2.5 py-2 text-left text-[11px] font-semibold leading-4 transition",
                          active
                            ? `${topic.className} border-transparent text-white shadow-sm`
                            : "border-line bg-surface text-muted hover:bg-raised hover:text-ink",
                        )}
                      >
                        <Icon className="h-3.5 w-3.5 shrink-0" />
                        <span>{topic.label}</span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <div>
                <label className="label" htmlFor="event-description">
                  Description
                </label>
                <textarea
                  id="event-description"
                  className="input min-h-[92px] resize-y"
                  value={form.description}
                  maxLength={3000}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                  placeholder="Who is it for, what happens, and how members can join."
                  required
                />
                <p className="mt-1 text-[11px] text-muted">At least 10 characters.</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="event-start">
                    Starts
                  </label>
                  <input
                    id="event-start"
                    type="datetime-local"
                    className="input"
                    value={form.startDate}
                    onChange={(event) => setForm({ ...form, startDate: event.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="label" htmlFor="event-end">
                    Ends <span className="font-normal text-muted/70">(optional)</span>
                  </label>
                  <input
                    id="event-end"
                    type="datetime-local"
                    className="input"
                    value={form.endDate}
                    onChange={(event) => setForm({ ...form, endDate: event.target.value })}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="event-location">
                    Venue
                  </label>
                  <input
                    id="event-location"
                    className="input"
                    value={form.location}
                    maxLength={180}
                    onChange={(event) => setForm({ ...form, location: event.target.value })}
                    placeholder="Millennium Hall, Addis Ababa"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="event-capacity">
                    Capacity <span className="font-normal text-muted/70">(optional)</span>
                  </label>
                  <input
                    id="event-capacity"
                    type="number"
                    min={2}
                    max={100000}
                    className="input"
                    value={form.maxAttendees}
                    onChange={(event) => setForm({ ...form, maxAttendees: event.target.value })}
                    placeholder="500"
                  />
                </div>
              </div>

              <div>
                <label className="label" htmlFor="event-cover">
                  Cover image
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {PRESET_COVERS.map((preset) => (
                    <button
                      key={preset.url}
                      type="button"
                      onClick={() => setForm({ ...form, coverUrl: preset.url })}
                      title={preset.name}
                      className={cn(
                        "group relative overflow-hidden rounded-lg ring-2 transition",
                        form.coverUrl === preset.url
                          ? "ring-brand-600"
                          : "ring-transparent hover:ring-line",
                      )}
                    >
                      <img
                        src={preset.url}
                        alt={preset.name}
                        loading="lazy"
                        className="h-16 w-full object-cover"
                      />
                      <span className="absolute inset-x-0 bottom-0 bg-black/55 px-1 py-0.5 text-[9px] font-semibold text-white">
                        {preset.name}
                      </span>
                    </button>
                  ))}
                </div>
                <input
                  id="event-cover"
                  className="input mt-2"
                  value={form.coverUrl}
                  maxLength={600}
                  onChange={(event) => setForm({ ...form, coverUrl: event.target.value })}
                  placeholder="https://…"
                />
              </div>
            </div>

            <div className="mt-5 flex items-center gap-2">
              <button type="submit" className="btn-primary flex-1" disabled={busy}>
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : editing ? (
                  <Pencil className="h-4 w-4" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                {editing ? "Save changes" : "Publish event"}
              </button>
              {editing && (
                <button type="button" className="btn-secondary" onClick={reset}>
                  Discard
                </button>
              )}
            </div>
            <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted">
              <CalendarDays className="h-3 w-3" /> Times use this device's time zone. Publishing
              shows the listing to everyone on the Events page.
            </p>
          </form>
        ) : (
          <section className="card h-fit p-5">
            <h2 className="font-display text-base font-semibold text-ink">Read-only calendar</h2>
            <p className="mt-1 text-sm leading-6 text-muted">
              Your role can review the events desk but not publish or change listings. An
              administrator can grant “Manage events” from Roles &amp; access.
            </p>
          </section>
        )}

        <section className="card flex h-fit flex-col overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
            <div className="flex rounded-lg border border-line bg-surface p-0.5">
              {(["upcoming", "past"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setScope(value)}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-[11px] font-semibold capitalize transition",
                    scope === value ? "bg-brand-700 text-white" : "text-muted hover:text-ink",
                  )}
                >
                  {value}
                </button>
              ))}
            </div>
            <button
              type="button"
              aria-pressed={includeImported}
              onClick={() => setIncludeImported((value) => !value)}
              className={cn(
                "ml-auto rounded-lg border px-2 py-1 text-[11px] font-semibold transition",
                includeImported
                  ? "border-brand-600/30 bg-brand-50 text-brand-800 dark:bg-brand-500/10 dark:text-brand-200"
                  : "border-line bg-surface text-muted hover:text-ink",
              )}
              title="Imported listings come from event sources; curated ones are published here."
            >
              {includeImported ? "All sources" : "Curated only"}
            </button>
            <select
              className="input w-auto py-1.5 text-[11px]"
              value={topicFilter}
              onChange={(event) => setTopicFilter(event.target.value as "ALL" | EventTopic)}
              aria-label="Filter by category"
            >
              <option value="ALL">All categories</option>
              {TOPICS.map((topic) => (
                <option key={topic.value} value={topic.value}>
                  {topic.label}
                </option>
              ))}
            </select>
          </div>

          {query.loading && !query.data ? (
            <PageLoader label="Loading the calendar…" />
          ) : query.error ? (
            <p className="px-4 py-8 text-sm text-rose-600">{query.error}</p>
          ) : events.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title={
                scope === "upcoming"
                  ? includeImported
                    ? "Nothing on the calendar"
                    : "Nothing curated yet"
                  : "No past events"
              }
              description={
                canManage
                  ? "Publish a listing with the form and it appears here and on the community Events page. Imported listings stay on the Event sources page."
                  : "Listings published by the community team will show up here."
              }
            />
          ) : (
            <ul className="max-h-[820px] divide-y divide-line overflow-y-auto">
              {events.map((event) => {
                const meta = topicMeta(event.topic);
                const Icon = meta.icon;
                const chip = dayChip(event.startDate);
                return (
                  <li key={event.id} className="flex gap-3 px-4 py-3.5">
                    <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl border border-line bg-raised/60">
                      <span className="font-display text-base font-semibold leading-none text-ink">
                        {chip.day}
                      </span>
                      <span className="text-[9px] font-semibold tracking-wider text-muted">
                        {chip.month}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-ink">
                        <span className="truncate">{event.title}</span>
                        {event.source ? (
                          <Badge tone="neutral">Imported</Badge>
                        ) : (
                          <Badge tone="brand">Curated</Badge>
                        )}
                      </p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted">
                        <span className="inline-flex items-center gap-1 font-semibold text-ink/70">
                          <Icon className="h-3 w-3" /> {meta.label}
                        </span>
                        <span>{formatDateTime(event.startDate)}</span>
                        {event.location && (
                          <span className="inline-flex items-center gap-0.5">
                            <MapPin className="h-3 w-3" /> {event.location}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-0.5">
                          <Users className="h-3 w-3" /> {event.attendeeCount} going
                        </span>
                      </p>
                      {event.endDate && (
                        <p className="mt-0.5 text-[10px] text-muted/80">
                          Ends {formatDateTime(event.endDate)}
                          {event.maxAttendees ? ` · capacity ${event.maxAttendees}` : ""}
                        </p>
                      )}
                    </div>
                    {canManage && (
                      <div className="flex shrink-0 items-start gap-0.5">
                        <button
                          type="button"
                          className="btn-ghost btn-sm"
                          onClick={() => startEdit(event)}
                          title="Edit event"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          className="btn-ghost btn-sm text-rose-600"
                          onClick={() => setDeleteTarget(event)}
                          title="Delete event"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <div className="mt-auto flex items-center justify-between gap-2 border-t border-line px-4 py-2.5 text-[11px] text-muted">
            <span>
              {events.length} {events.length === 1 ? "listing" : "listings"}
            </span>
            {events.length > 0 && (
              <span>
                {scope === "upcoming" ? "Next" : "Latest"}: {edgeDateLabel(events[0])}
              </span>
            )}
          </div>
        </section>
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Remove this event?"
        description="The listing and its RSVPs are deleted for everyone. Imported listings may return the next time their source syncs."
        busy={deleting}
        onConfirm={remove}
      />
    </div>
  );
}

/** The next listing, or the most recent one when looking at the past. */
function edgeDateLabel(event: AdminEvent): string {
  return new Date(event.startDate).toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
