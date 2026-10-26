import { useEffect, useState, useMemo, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CalendarDays,
  Clock,
  MapPin,
  Plus,
  Search,
  Users,
  CheckCircle2,
  Star,
  ExternalLink,
  Trash2,
  Edit3,
  Sparkles,
  Mountain,
  Film,
  Coffee,
  X,
  AlertCircle,
  Radio,
  Trophy,
  Theater,
  Music2,
  PartyPopper,
  Briefcase,
  Plane,
  Snowflake,
  RefreshCw,
} from "lucide-react";
import { useAuth } from "../store/auth";
import { useUI } from "../store/ui";
import { useTranslation } from "../store/i18n";
import { api, apiError, mediaSrc } from "../lib/api";
import { useQuery } from "../hooks/useApi";
import type {
  CinemasResponse,
  CommunityEvent,
  EventsResponse,
  EventTopic,
  Place,
  Category,
  RsvpStatus,
  SportsResponse,
} from "../types";
import { Avatar, Badge, Spinner } from "../components/ui";
import { cn } from "../lib/utils";
import { formatEthiopianDate, toEthiopianDate } from "../lib/ethiopian";

const TOPIC_META: Record<EventTopic, { label: string; icon: typeof Film; className: string }> = {
  CINEMA: { label: "Cinema", icon: Film, className: "bg-rose-600" },
  THEATRE: { label: "Theatre", icon: Theater, className: "bg-purple-600" },
  SPORTS: { label: "Football & sport", icon: Trophy, className: "bg-emerald-600" },
  MUSIC: { label: "Music", icon: Music2, className: "bg-sky-600" },
  FESTIVAL: { label: "Music festival", icon: PartyPopper, className: "bg-amber-600" },
  SOCIAL: { label: "Social", icon: Users, className: "bg-teal-600" },
  TRAVEL: { label: "Travel", icon: Plane, className: "bg-sky-600" },
  HIKING: { label: "Hiking", icon: Mountain, className: "bg-lime-700" },
  BUSINESS: { label: "Business", icon: Briefcase, className: "bg-slate-700" },
  SEASONAL: { label: "Seasonal", icon: Snowflake, className: "bg-indigo-600" },
  COMMUNITY: { label: "Community", icon: Sparkles, className: "bg-brand-600" },
  OTHER: { label: "Other", icon: CalendarDays, className: "bg-neutral-600" },
};

const PRESET_COVERS = [
  {
    name: "Entoto Forest Hike",
    url: "https://images.unsplash.com/photo-1551632811-561732d1e306?auto=format&fit=crop&w=1200&q=75",
  },
  {
    name: "Cinema & Film Night",
    url: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1200&q=75",
  },
  {
    name: "Coffee & Jebena Ceremony",
    url: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1200&q=75",
  },
  {
    name: "Outdoor Watch Party",
    url: "https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?auto=format&fit=crop&w=1200&q=75",
  },
];

function formatEventDate(startStr: string, endStr?: string | null): string {
  try {
    const start = new Date(startStr);
    const dateFormatted = start.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    const ethiopian =
      useUI.getState().calendar === "ETHIOPIAN" ? ` · ${formatEthiopianDate(start)}` : "";
    const timeStart = start.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
    if (endStr) {
      const end = new Date(endStr);
      const timeEnd = end.toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
      });
      if (end.toDateString() === start.toDateString()) {
        return `${dateFormatted}${ethiopian} · ${timeStart} - ${timeEnd}`;
      }
      // Multi-day events (festivals, conferences) must show the closing date,
      // not just a later time on the opening day.
      const endDateFormatted = end.toLocaleDateString(
        undefined,
        end.getFullYear() === start.getFullYear()
          ? { month: "short", day: "numeric" }
          : { year: "numeric", month: "short", day: "numeric" },
      );
      return `${dateFormatted}${ethiopian} · ${timeStart} - ${endDateFormatted} · ${timeEnd}`;
    }
    return `${dateFormatted}${ethiopian} · ${timeStart}`;
  } catch {
    return startStr;
  }
}

function dayLabel(startStr: string): string {
  try {
    return new Date(startStr).toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  } catch {
    return startStr;
  }
}

function timeLabel(startStr: string): string {
  try {
    return new Date(startStr).toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function getEventBadgeDate(startStr: string) {
  try {
    const d = new Date(startStr);
    // With the Ethiopian calendar on, the tile counts in Ge'ez days.
    if (useUI.getState().calendar === "ETHIOPIAN") {
      const eth = toEthiopianDate(d);
      return { month: eth.monthAmharic, day: eth.day };
    }
    const month = d.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
    const day = d.getDate();
    return { month, day };
  } catch {
    return { month: "EVENT", day: "" };
  }
}

type HubItem = { key: string; day: string; time: string; title: string; meta: string | null };

const HUB_TONES = {
  emerald: {
    tile: "bg-emerald-600",
    wash: "from-emerald-500/12",
    text: "text-emerald-700 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  rose: {
    tile: "bg-rose-600",
    wash: "from-rose-500/12",
    text: "text-rose-700 dark:text-rose-300",
    dot: "bg-rose-500",
  },
  violet: {
    tile: "bg-violet-600",
    wash: "from-violet-500/12",
    text: "text-violet-700 dark:text-violet-300",
    dot: "bg-violet-500",
  },
} as const;

/** One of the three schedule cards at the top of Events. */
function HubCard({
  icon: Icon,
  tone,
  kicker,
  amharic,
  count,
  unit,
  items,
  href,
  emptyLabel,
}: {
  icon: typeof Film;
  tone: keyof typeof HUB_TONES;
  kicker: string;
  amharic: string;
  count: number;
  unit: string;
  items: HubItem[];
  href: string;
  emptyLabel: string;
}) {
  const palette = HUB_TONES[tone];

  return (
    <Link
      to={href}
      className="group relative flex flex-col overflow-hidden rounded-3xl border border-line bg-surface shadow-card transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-lift"
    >
      <div className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br to-transparent", palette.wash)} />

      <div className="relative flex items-start gap-3 p-4">
        <span className={cn("rounded-2xl p-2.5 text-white shadow-sm transition group-hover:scale-105", palette.tile)}>
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className={cn("text-[10px] font-bold uppercase tracking-[0.16em]", palette.text)}>
            {kicker} <span lang="am" className="font-ethiopic tracking-normal">· {amharic}</span>
          </span>
          <span className="mt-1 block text-sm font-bold text-ink">
            {count} {unit}
          </span>
        </span>
        <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-ink" />
      </div>

      <ul className="relative divide-y divide-line/60 border-t border-line/60">
        {items.length === 0 ? (
          <li className="px-4 py-5 text-[11px] text-muted">{emptyLabel}</li>
        ) : (
          items.map((item) => (
            <li key={item.key} className="flex items-start gap-3 px-4 py-2.5">
              <span className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", palette.dot)} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold text-ink">{item.title}</span>
                <span className="mt-0.5 block truncate text-[10px] text-muted">
                  {item.day}
                  {item.time ? ` · ${item.time}` : ""}
                  {item.meta ? ` · ${item.meta}` : ""}
                </span>
              </span>
            </li>
          ))
        )}
      </ul>

      <span className="relative mt-auto flex items-center justify-between gap-2 border-t border-line/60 px-4 py-2.5 text-[11px] font-bold text-ink transition group-hover:bg-raised/60">
        <span>Open the full schedule</span>
        <ArrowRight className="h-3.5 w-3.5" />
      </span>
    </Link>
  );
}

export function EventsPage({
  defaultTopic,
  view = "events",
}: {
  defaultTopic?: EventTopic;
  view?: "events" | "meetups";
} = {}) {
  const { t, lang } = useTranslation();
  const user = useAuth((state) => state.user);
  const pushToast = useUI((state) => state.pushToast);
  const navigate = useNavigate();

  const [events, setEvents] = useState<CommunityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Events and Meetups live on separate routes now; the shared card renderer
  // below still keys off this single value.
  const tab = view === "meetups" ? "MEETUP" : "EVENT";
  const showHub = view === "events" && !defaultTopic;
  const [searchQuery, setSearchQuery] = useState("");
  const [meetupFilter, setMeetupFilter] = useState<"ALL" | "HIKE" | "CINEMA" | "COFFEE">("ALL");
  const [topicFilter, setTopicFilter] = useState<"ALL" | EventTopic>(defaultTopic ?? "ALL");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CommunityEvent | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [location, setLocation] = useState("");
  const [coverUrl, setCoverUrl] = useState(PRESET_COVERS[0].url);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedPlace, setSelectedPlace] = useState("");
  const [maxAttendees, setMaxAttendees] = useState("");

  const loadEvents = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ limit: "50" });
      if (view === "meetups") params.set("kind", "MEETUP");
      if (defaultTopic) params.set("topic", defaultTopic);
      const res = await api.get<EventsResponse>(`/api/events?${params.toString()}`);
      setEvents(res.data.events);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadEvents();
  }, []);

  // The Events landing page previews the three categories the sidebar exposes.
  const { data: sportsHub } = useQuery<SportsResponse>("/api/events/sports?days=21", { enabled: showHub });
  const { data: cinemaHub } = useQuery<CinemasResponse>("/api/events/cinemas", { enabled: showHub });
  const { data: theatreHub } = useQuery<EventsResponse>("/api/events?topic=THEATRE&limit=50", {
    enabled: showHub,
  });

  const hubFixtures = useMemo(
    () =>
      (sportsHub?.leagues ?? [])
        .flatMap((league) => league.fixtures)
        .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()),
    [sportsHub],
  );
  const hubScreenings = useMemo(
    () =>
      (cinemaHub?.schedules ?? [])
        .flatMap((group) => group.screenings.map((screening) => ({ ...screening, venue: group.venue })))
        .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()),
    [cinemaHub],
  );
  const theatreListings = theatreHub?.events ?? [];

  const loadModalDeps = async () => {
    try {
      const [catsRes, placesRes] = await Promise.all([
        api.get<{ categories: Category[] }>("/api/categories"),
        api.get<{ places: Place[] }>("/api/places?limit=40"),
      ]);
      setCategories(catsRes.data.categories || []);
      setPlaces(placesRes.data.places || []);
    } catch (e) {
      console.warn("Could not load categories or places", e);
    }
  };

  const handleOpenCreateModal = async () => {
    if (!user) {
      navigate("/login");
      return;
    }
    setEditingEvent(null);
    setTitle("");
    setDescription("");
    setStartDate("");
    setEndDate("");
    setLocation("");
    setCoverUrl(PRESET_COVERS[0].url);
    setSelectedCategory("");
    setSelectedPlace("");
    setMaxAttendees("");
    setIsModalOpen(true);
    await loadModalDeps();
  };

  const handleOpenEditModal = async (ev: CommunityEvent) => {
    if (!user) {
      navigate("/login");
      return;
    }
    setEditingEvent(ev);
    setTitle(ev.title);
    setDescription(ev.description);
    setStartDate(ev.startDate ? new Date(ev.startDate).toISOString().slice(0, 16) : "");
    setEndDate(ev.endDate ? new Date(ev.endDate).toISOString().slice(0, 16) : "");
    setLocation(ev.location);
    setCoverUrl(ev.coverUrl || PRESET_COVERS[0].url);
    setSelectedCategory(ev.category?.id || "");
    setSelectedPlace(ev.place?.id || "");
    setMaxAttendees(ev.maxAttendees ? String(ev.maxAttendees) : "");
    setIsModalOpen(true);
    await loadModalDeps();
  };

  const handleRsvp = async (eventId: string, targetStatus: RsvpStatus) => {
    if (!user) {
      pushToast("Please sign in to RSVP for gatherings.");
      navigate("/login");
      return;
    }

    const currentEvent = events.find((e) => e.id === eventId);
    if (!currentEvent) return;

    // Toggle off if already has target status
    const newStatus = currentEvent.myRsvp === targetStatus ? "NONE" : targetStatus;

    try {
      // Optimistic update
      setEvents((prev) =>
        prev.map((e) => {
          if (e.id !== eventId) return e;
          const oldStatus = e.myRsvp;
          let goingDelta = 0;
          let interestedDelta = 0;

          if (oldStatus === "GOING") goingDelta -= 1;
          if (oldStatus === "INTERESTED") interestedDelta -= 1;
          if (newStatus === "GOING") goingDelta += 1;
          if (newStatus === "INTERESTED") interestedDelta += 1;

          return {
            ...e,
            myRsvp: newStatus === "NONE" ? null : newStatus,
            counts: {
              ...e.counts,
              going: Math.max(0, e.counts.going + goingDelta),
              interested: Math.max(0, e.counts.interested + interestedDelta),
              total: Math.max(0, e.counts.going + goingDelta),
            },
          };
        }),
      );

      const res = await api.post<{ myRsvp: RsvpStatus | null; counts: { going: number; interested: number; total: number } }>(
        `/api/events/${eventId}/rsvp`,
        { status: newStatus },
      );

      setEvents((prev) =>
        prev.map((e) => (e.id === eventId ? { ...e, myRsvp: res.data.myRsvp, counts: res.data.counts } : e)),
      );

      pushToast(
        newStatus === "GOING"
          ? "You're going! See you there. 🎉"
          : newStatus === "INTERESTED"
            ? "Saved as interested! We'll keep you updated."
            : "RSVP removed.",
      );
    } catch (err) {
      pushToast(apiError(err));
      void loadEvents(); // Revert on error
    }
  };

  const handleDelete = async (eventId: string) => {
    if (!window.confirm(t("events.deleteConfirm", "Are you sure you want to cancel this event?"))) return;

    try {
      await api.delete(`/api/events/${eventId}`);
      setEvents((prev) => prev.filter((e) => e.id !== eventId));
      pushToast("Event cancelled.");
    } catch (err) {
      pushToast(apiError(err));
    }
  };

  const handleSubmitModal = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !startDate || !location.trim()) {
      pushToast("Please fill in title, date, and meeting location.");
      return;
    }

    try {
      setSubmitting(true);
      if (editingEvent) {
        const res = await api.patch<{ event: Partial<CommunityEvent> }>(`/api/events/${editingEvent.id}`, {
          title: title.trim(),
          description: description.trim(),
          startDate: new Date(startDate).toISOString(),
          endDate: endDate ? new Date(endDate).toISOString() : null,
          location: location.trim(),
          coverUrl: coverUrl.trim() || null,
          categoryId: selectedCategory || null,
          placeId: selectedPlace || null,
          maxAttendees: maxAttendees ? parseInt(maxAttendees, 10) : null,
        });

        setEvents((prev) =>
          prev.map((item) => (item.id === editingEvent.id ? { ...item, ...res.data.event } : item)),
        );
        setIsModalOpen(false);
        pushToast("Meetup details updated!");
      } else {
        const res = await api.post<{ event: CommunityEvent }>("/api/events", {
          title: title.trim(),
          description: description.trim(),
          startDate: new Date(startDate).toISOString(),
          endDate: endDate ? new Date(endDate).toISOString() : undefined,
          location: location.trim(),
          coverUrl: coverUrl.trim() || undefined,
          categoryId: selectedCategory || undefined,
          placeId: selectedPlace || undefined,
          maxAttendees: maxAttendees ? parseInt(maxAttendees, 10) : undefined,
        });

        setEvents((prev) => [res.data.event, ...prev]);
        setIsModalOpen(false);
        pushToast("Meetup scheduled! Your community can now RSVP.");
      }
      // Reset form
      setTitle("");
      setDescription("");
      setStartDate("");
      setEndDate("");
      setLocation("");
      setMaxAttendees("");
      setEditingEvent(null);
    } catch (err) {
      pushToast(apiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const eventCount = useMemo(() => events.filter((item) => item.kind === "EVENT").length, [events]);
  const meetupCount = useMemo(() => events.filter((item) => item.kind === "MEETUP").length, [events]);
  const sourceCount = useMemo(
    () => new Set(events.filter((item) => item.kind === "EVENT" && item.source).map((item) => item.source!.id)).size,
    [events],
  );
  const presentTopics = useMemo(() => {
    const found = new Set<EventTopic>();
    for (const item of events) if (item.kind === "EVENT") found.add(item.topic);
    // A category route (/theatre) must still show which filter is active even
    // when the feed has nothing in that category yet.
    if (topicFilter !== "ALL") found.add(topicFilter);
    return (Object.keys(TOPIC_META) as EventTopic[]).filter((topic) => found.has(topic));
  }, [events, topicFilter]);

  const filteredEvents = useMemo(() => {
    return events.filter((item) => {
      if (item.kind !== tab) return false;

      if (tab === "EVENT") {
        if (topicFilter !== "ALL" && item.topic !== topicFilter) return false;
      } else if (meetupFilter === "HIKE") {
        const isHike =
          item.category?.slug.includes("hike") ||
          item.title.toLowerCase().includes("hike") ||
          item.description.toLowerCase().includes("hike");
        if (!isHike) return false;
      } else if (meetupFilter === "CINEMA") {
        const isCinema =
          item.category?.slug.includes("cinema") ||
          item.place?.kind === "CINEMA" ||
          item.title.toLowerCase().includes("cinema") ||
          item.title.toLowerCase().includes("film");
        if (!isCinema) return false;
      } else if (meetupFilter === "COFFEE") {
        const isCoffee =
          item.category?.slug.includes("coffee") ||
          item.place?.kind === "CAFE" ||
          item.title.toLowerCase().includes("coffee") ||
          item.title.toLowerCase().includes("buna");
        if (!isCoffee) return false;
      }

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        item.title.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.location.toLowerCase().includes(q) ||
        item.creator.displayName.toLowerCase().includes(q) ||
        (item.source?.name.toLowerCase().includes(q) ?? false) ||
        (item.place?.name.toLowerCase().includes(q) ?? false)
      );
    });
  }, [events, tab, topicFilter, meetupFilter, searchQuery]);

  return (
    <div className="space-y-8 pb-16">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-line bg-gradient-to-br from-brand-900 via-brand-950 to-canvas p-6 text-white shadow-lift sm:p-8">
        <div className="absolute right-0 top-0 -mr-16 -mt-16 h-64 w-64 rounded-full bg-accent-500/15 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 -mb-16 h-48 w-48 rounded-full bg-brand-500/10 blur-2xl" />

        <div className="relative z-10 flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div className="max-w-2xl space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-1 text-xs font-semibold backdrop-blur-md">
              {tab === "EVENT" ? (
                <Radio className="h-3.5 w-3.5 text-accent-400" />
              ) : (
                <CalendarDays className="h-3.5 w-3.5 text-accent-400" />
              )}
              <span>{tab === "EVENT" ? "Events · city calendar" : "Meetups · hosted by members"}</span>
              <span className="font-ethiopic text-[11px] text-accent-300">
                {tab === "EVENT" ? "· ዝግጅቶች" : "· ስብሰባዎች"}
              </span>
            </div>

            <h1 className="font-serif text-2xl font-bold tracking-tight text-white sm:text-3xl md:text-4xl">
              {tab === "EVENT"
                ? defaultTopic
                  ? `${TOPIC_META[defaultTopic].label} — every listing in one place.`
                  : "Sport, cinema and theatre — all in one place."
                : t("events.title", "Real-world meetups, cinema nights & trail hikes.")}
            </h1>

            <p className="text-sm leading-relaxed text-zinc-300 sm:text-base">
              {tab === "EVENT"
                ? `Updated automatically from ${sourceCount || 1} online ${
                    sourceCount === 1 ? "source" : "sources"
                  }, plus official listings from the community team. Jump straight into a league schedule, find a screening at a hall you like, or see what is on stage.`
                : t(
                    "events.subtitle",
                    "Pick a time and a place, post it, and everyone can see the schedule and who is coming. Hikes, watch parties and coffee ceremonies across Addis Ababa.",
                  )}
            </p>
          </div>

          {tab === "MEETUP" ? (
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-accent-500 to-amber-500 px-6 py-3.5 text-sm font-bold text-zinc-950 shadow-glow transition hover:opacity-95 active:scale-95 sm:self-start lg:self-auto"
            >
              <Plus className="h-4 w-4" />
              <span>{t("events.create", "Schedule a Meetup")}</span>
            </button>
          ) : (
            <div className="flex items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-[11px] font-medium text-zinc-300 backdrop-blur-md sm:self-start lg:self-auto">
              <RefreshCw className="h-3.5 w-3.5 text-accent-400" />
              <span>Refreshed from live sources throughout the day</span>
            </div>
          )}
        </div>
      </div>

      {/* Three ways into the week: sport fixtures, cinema screenings and what is
          on stage. Tapping a card filters the listing grid below it. */}
      {showHub && (
        <div className="grid gap-4 lg:grid-cols-3">
          <HubCard
            icon={Trophy}
            tone="emerald"
            kicker="Sport"
            amharic="ስፖርት"
            count={hubFixtures.length}
            unit={`${hubFixtures.length === 1 ? "fixture" : "fixtures"} coming up`}
            href="/sports"
            emptyLabel="No fixtures in the next three weeks — check back after the next sync."
            items={hubFixtures.slice(0, 3).map((fixture) => ({
              key: fixture.id,
              day: dayLabel(fixture.startDate),
              time: timeLabel(fixture.startDate),
              title: fixture.awayTeam
                ? `${fixture.homeTeam} vs ${fixture.awayTeam}`
                : fixture.title,
              meta: fixture.venue ?? fixture.competition,
            }))}
          />

          <HubCard
            icon={Film}
            tone="rose"
            kicker="Cinema"
            amharic="ሲኒማ"
            count={hubScreenings.length}
            unit={`${hubScreenings.length === 1 ? "screening" : "screenings"} scheduled`}
            href="/cinema"
            emptyLabel="No screenings listed right now — new showtimes arrive with each sync."
            items={hubScreenings.slice(0, 3).map((screening) => ({
              key: screening.id,
              day: dayLabel(screening.startDate),
              time: timeLabel(screening.startDate),
              title: screening.title,
              meta: screening.venue,
            }))}
          />

          <HubCard
            icon={Theater}
            tone="violet"
            kicker="Theatre"
            amharic="ቲያትር"
            count={theatreListings.length}
            unit={`${theatreListings.length === 1 ? "show" : "shows"} on stage`}
            href="/theatre"
            emptyLabel="Nothing on stage yet — theatre listings appear as venues publish."
            items={theatreListings.slice(0, 3).map((show) => ({
              key: show.id,
              day: dayLabel(show.startDate),
              time: timeLabel(show.startDate),
              title: show.title,
              meta: show.location,
            }))}
          />
        </div>
      )}

      {view === "meetups" && (
        <div className="flex flex-wrap items-end justify-between gap-3 border-t border-line pt-6">
          <div>
            <h2 className="font-serif text-xl font-bold text-ink">Posted meetup schedule</h2>
            <p className="text-xs leading-relaxed text-muted">
              Hikes, watch parties and coffee tables members have posted — RSVP and it lands on
              your calendar.
            </p>
          </div>
          <span className="rounded-full border border-line bg-surface px-3 py-1 text-[11px] font-semibold text-muted">
            {meetupCount} posted
          </span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {tab === "EVENT" ? (
            <>
              <button
                type="button"
                onClick={() => setTopicFilter("ALL")}
                className={cn(
                  "rounded-xl px-3.5 py-2 text-xs font-semibold transition",
                  topicFilter === "ALL"
                    ? "bg-brand-700 text-white shadow-sm"
                    : "border border-line bg-surface text-muted hover:bg-raised hover:text-ink",
                )}
              >
                All events ({eventCount})
              </button>
              {presentTopics.map((topic) => {
                const meta = TOPIC_META[topic];
                const Icon = meta.icon;
                return (
                  <button
                    key={topic}
                    type="button"
                    onClick={() => setTopicFilter(topic)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition",
                      topicFilter === topic
                        ? `${meta.className} text-white shadow-sm`
                        : "border border-line bg-surface text-muted hover:bg-raised hover:text-ink",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{meta.label}</span>
                  </button>
                );
              })}
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setMeetupFilter("ALL")}
                className={cn(
                  "rounded-xl px-3.5 py-2 text-xs font-semibold transition",
                  meetupFilter === "ALL"
                    ? "bg-brand-700 text-white shadow-sm"
                    : "border border-line bg-surface text-muted hover:bg-raised hover:text-ink",
                )}
              >
                All meetups ({meetupCount})
              </button>
              <button
                type="button"
                onClick={() => setMeetupFilter("HIKE")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition",
                  meetupFilter === "HIKE"
                    ? "bg-emerald-700 text-white shadow-sm"
                    : "border border-line bg-surface text-muted hover:bg-raised hover:text-ink",
                )}
              >
                <Mountain className="h-3.5 w-3.5" />
                <span>Hikes</span>
              </button>
              <button
                type="button"
                onClick={() => setMeetupFilter("CINEMA")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition",
                  meetupFilter === "CINEMA"
                    ? "bg-rose-700 text-white shadow-sm"
                    : "border border-line bg-surface text-muted hover:bg-raised hover:text-ink",
                )}
              >
                <Film className="h-3.5 w-3.5" />
                <span>Watch parties</span>
              </button>
              <button
                type="button"
                onClick={() => setMeetupFilter("COFFEE")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition",
                  meetupFilter === "COFFEE"
                    ? "bg-amber-700 text-white shadow-sm"
                    : "border border-line bg-surface text-muted hover:bg-raised hover:text-ink",
                )}
              >
                <Coffee className="h-3.5 w-3.5" />
                <span>Coffee & talks</span>
              </button>
            </>
          )}
        </div>

        {/* Search Input */}
        <div className="relative min-w-[260px] sm:w-72">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("events.searchPlaceholder", "Search events by title or location…")}
            className="w-full rounded-xl border border-line bg-surface py-2 pl-10 pr-4 text-xs font-medium text-ink outline-none transition focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          />
        </div>
      </div>

      {/* Content Area */}
      {loading ? (
        <div className="flex min-h-[300px] flex-col items-center justify-center gap-3">
          <Spinner className="h-8 w-8 text-brand-600" />
          <p className="text-xs text-muted">Loading community gatherings…</p>
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-6 text-center text-sm text-rose-500">
          <AlertCircle className="mx-auto mb-2 h-6 w-6" />
          <p>{error}</p>
          <button
            onClick={() => void loadEvents()}
            className="mt-3 rounded-xl bg-surface px-4 py-2 text-xs font-semibold text-ink shadow-sm"
          >
            Retry
          </button>
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-line bg-surface/50 p-12 text-center">
          <CalendarDays className="mx-auto mb-3 h-10 w-10 text-muted/60" />
          <h3 className="text-base font-bold text-ink">
            {tab === "EVENT" ? "No imported listings match that filter" : t("events.emptyTitle", "No upcoming meetups found")}
          </h3>
          <p className="mx-auto mt-1 max-w-sm text-xs text-muted">
            {tab === "EVENT"
              ? "New cinema, theatre and football listings appear here automatically as soon as a source publishes them."
              : t("events.emptyDesc", "Be the first to schedule a coffee chat, film screening, or weekend hike!")}
          </p>
          {tab === "MEETUP" ? (
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-600"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{t("events.create", "Schedule a Meetup")}</span>
            </button>
          ) : (
            <Link
              to="/meetups"
              className="mt-5 inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-4 py-2.5 text-xs font-semibold text-ink shadow-sm transition hover:border-brand-500"
            >
              <Users className="h-3.5 w-3.5" />
              <span>Browse meetups instead</span>
            </Link>
          )}
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredEvents.map((item) => {
            const badgeDate = getEventBadgeDate(item.startDate);
            const isCreator = user?.id === item.creator.id;
            const canManage = isCreator || user?.role === "ADMIN" || user?.role === "MODERATOR";
            const topicMeta = TOPIC_META[item.topic];
            const TopicIcon = topicMeta.icon;

            return (
              <div
                key={item.id}
                className="group flex flex-col overflow-hidden rounded-3xl border border-line bg-surface shadow-lift transition hover:border-brand-500/40 hover:shadow-glow"
              >
                {/* Event Cover Image */}
                <div className="relative aspect-[16/9] w-full overflow-hidden bg-neutral-900">
                  <Link to={`/events/${item.slug}`} className="block h-full w-full">
                    <img
                      src={mediaSrc(item.coverUrl) || PRESET_COVERS[0].url}
                      alt={item.title}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
                  </Link>

                  {/* Date Badge */}
                  <div className="pointer-events-none absolute left-4 top-4 flex flex-col items-center rounded-2xl border border-white/20 bg-surface/90 px-3 py-1.5 text-center shadow-lift backdrop-blur-md dark:bg-neutral-900/90">
                    <span className="text-[10px] font-bold tracking-wider text-rose-500">
                      {badgeDate.month}
                    </span>
                    <span className="text-lg font-black leading-tight text-ink">
                      {badgeDate.day}
                    </span>
                  </div>

                  {/* Actions / Edit & Delete */}
                  {canManage && (
                    <div className="absolute right-4 top-4 z-10 flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          void handleOpenEditModal(item);
                        }}
                        title={item.kind === "EVENT" ? "Edit event" : "Edit meetup"}
                        className="rounded-xl border border-white/20 bg-black/60 p-2 text-zinc-200 backdrop-blur-md transition hover:bg-brand-600 hover:text-white"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          void handleDelete(item.id);
                        }}
                        title={item.kind === "EVENT" ? "Remove event" : "Cancel meetup"}
                        className="rounded-xl border border-white/20 bg-black/60 p-2 text-zinc-200 backdrop-blur-md transition hover:bg-rose-600 hover:text-white"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}

                  {/* Category & Place Badges */}
                  <div className="absolute bottom-3 left-4 right-4 flex flex-wrap items-center gap-1.5">
                    {item.kind === "EVENT" && (
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-white shadow-sm",
                          topicMeta.className,
                        )}
                      >
                        <TopicIcon className="h-3 w-3" />
                        <span>{topicMeta.label}</span>
                      </span>
                    )}
                    {item.category && (
                      <Link
                        to={`/c/${item.category.slug}`}
                        className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium text-white shadow-sm backdrop-blur-md"
                        style={{ backgroundColor: `${item.category.color}dd` }}
                      >
                        <span>{item.category.name}</span>
                      </Link>
                    )}
                    {item.place && (
                      <Link
                        to={`/places/${item.place.slug}`}
                        className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-black/60 px-2.5 py-0.5 text-[11px] font-medium text-zinc-200 backdrop-blur-md hover:text-white"
                      >
                        <MapPin className="h-3 w-3 text-amber-400" />
                        <span>{item.place.name}</span>
                      </Link>
                    )}
                  </div>
                </div>

                {/* Event Body */}
                <div className="flex flex-1 flex-col p-5">
                  <Link to={`/events/${item.slug}`} className="group/title block">
                    <h3 className="line-clamp-2 text-base font-bold text-ink transition group-hover/title:text-brand-600 dark:group-hover/title:text-brand-300">
                      {item.title}
                    </h3>
                  </Link>

                  <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-muted">
                    {item.description}
                  </p>

                  <div className="mt-2">
                    <Link
                      to={`/events/${item.slug}`}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-600 hover:underline dark:text-brand-400"
                    >
                      <span>View details & attendees</span>
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>

                  <div className="mt-4 space-y-2 border-t border-line/60 pt-3 text-xs text-muted">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 shrink-0 text-brand-600 dark:text-brand-400" />
                      <span className="font-medium text-ink">
                        {formatEventDate(item.startDate, item.endDate)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                      <span className="line-clamp-1">{item.location}</span>
                    </div>
                  </div>

                  {/* Imported listings credit the feed; curated events and meetups credit their host. */}
                  {item.source ? (
                    <div className="mt-4 flex items-center gap-2.5 border-t border-line/60 pt-3">
                      <span className="rounded-lg bg-brand-500/10 p-1.5 text-brand-600 dark:text-brand-300">
                        <Radio className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[11px] text-muted">
                          Imported from{" "}
                          <span className="font-semibold text-ink">{item.source.name}</span>
                        </p>
                      </div>
                      {item.sourceUrl && (
                        <a
                          href={item.sourceUrl}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-600 hover:underline dark:text-brand-400"
                        >
                          Source <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  ) : (
                    <div className="mt-4 flex items-center gap-2.5 border-t border-line/60 pt-3">
                      <Avatar
                        src={item.creator.avatarUrl}
                        name={item.creator.displayName}
                        username={item.creator.username}
                        size="xs"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[11px] text-muted">
                          {item.kind === "EVENT" ? "Published by" : t("events.host", "Hosted by")}{" "}
                          <Link
                            to={`/u/${item.creator.username}`}
                            className="font-semibold text-ink hover:underline"
                          >
                            {item.creator.displayName}
                          </Link>
                        </p>
                      </div>

                      {item.kind === "EVENT" ? (
                        <Badge tone="brand">Official</Badge>
                      ) : (
                        item.maxAttendees && (
                          <span className="text-[11px] font-medium text-muted">
                            Max: {item.maxAttendees}
                          </span>
                        )
                      )}
                    </div>
                  )}

                  {/* Attendees RSVP Stack & Buttons */}
                  <div className="mt-4 rounded-2xl bg-surface-raised/40 p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5 text-muted" />
                        <span className="text-xs font-bold text-ink">
                          {item.counts.going}{" "}
                          <span className="font-normal text-muted">{t("events.going", "Going")}</span>
                        </span>
                        {item.counts.interested > 0 && (
                          <span className="text-[11px] text-muted">
                            · {item.counts.interested} {t("events.interested", "Interested")}
                          </span>
                        )}
                      </div>

                      {/* Attendee Avatars */}
                      {item.attendeesPreview.length > 0 && (
                        <div className="flex -space-x-1.5 overflow-hidden">
                          {item.attendeesPreview.slice(0, 4).map((att) => (
                            <Avatar
                              key={att.id}
                              src={att.avatarUrl}
                              name={att.displayName}
                              size="xs"
                              className="ring-2 ring-surface"
                            />
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Action RSVP buttons */}
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => void handleRsvp(item.id, "GOING")}
                        className={cn(
                          "inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition",
                          item.myRsvp === "GOING"
                            ? "bg-emerald-600 text-white shadow-sm"
                            : "bg-surface border border-line text-ink hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400",
                        )}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>{item.myRsvp === "GOING" ? "Going ✓" : t("events.going", "Going")}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => void handleRsvp(item.id, "INTERESTED")}
                        className={cn(
                          "inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition",
                          item.myRsvp === "INTERESTED"
                            ? "bg-amber-600 text-white shadow-sm"
                            : "bg-surface border border-line text-ink hover:bg-amber-500/10 hover:text-amber-600 dark:hover:text-amber-400",
                        )}
                      >
                        <Star className="h-3.5 w-3.5" />
                        <span>
                          {item.myRsvp === "INTERESTED"
                            ? "Interested ★"
                            : t("events.interested", "Interested")}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Schedule Meetup Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-line bg-surface p-6 shadow-lift sm:p-8">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="absolute right-5 top-5 rounded-full p-2 text-muted hover:bg-raised hover:text-ink"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2.5">
              <div className="rounded-xl bg-brand-500/10 p-2 text-brand-600 dark:text-brand-300">
                {editingEvent ? <Edit3 className="h-5 w-5" /> : <CalendarDays className="h-5 w-5" />}
              </div>
              <div>
                <h2 className="text-lg font-bold text-ink">
                  {editingEvent ? "Edit Community Meetup" : t("events.modalTitle", "Schedule a Community Meetup")}
                </h2>
                <p className="text-xs text-muted">
                  {editingEvent
                    ? "Update gathering details, meeting spot, or date."
                    : "Gather fellow members for a hike, movie watch party, or coffee tasting."}
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmitModal} className="mt-6 space-y-4">
              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-ink">
                  {t("events.titleLabel", "Event Title")} *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t("events.titlePlaceholder", "e.g. Sunday Morning Entoto Peak Hike")}
                  className="mt-1 w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-xs text-ink outline-none transition focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-ink">
                  {t("events.descLabel", "Description")} *
                </label>
                <textarea
                  required
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t(
                    "events.descPlaceholder",
                    "Where to meet, what to bring, and what to expect…",
                  )}
                  className="mt-1 w-full rounded-xl border border-line bg-surface px-3.5 py-2 text-xs text-ink outline-none transition focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                />
              </div>

              {/* Date & Time Grid */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-ink">
                    {t("events.dateTime", "Start Date & Time")} *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs text-ink outline-none transition focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink">
                    End Date & Time (optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs text-ink outline-none transition focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                  />
                </div>
              </div>

              {/* Location */}
              <div>
                <label className="block text-xs font-semibold text-ink">
                  {t("events.locationLabel", "Meeting Point / Address")} *
                </label>
                <input
                  type="text"
                  required
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder={t("events.locationPlaceholder", "e.g. Entoto Park Main Gate, Addis Ababa")}
                  className="mt-1 w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-xs text-ink outline-none transition focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                />
              </div>

              {/* Linked Category & Place */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-ink">
                    {t("events.linkRoom", "Associated Room (optional)")}
                  </label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs text-ink outline-none transition focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                  >
                    <option value="">None / General</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink">
                    {t("events.linkPlace", "Link to a Place (optional)")}
                  </label>
                  <select
                    value={selectedPlace}
                    onChange={(e) => setSelectedPlace(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs text-ink outline-none transition focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                  >
                    <option value="">No venue attached</option>
                    {places.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.kind} - {p.city})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Max attendees */}
              <div>
                <label className="block text-xs font-semibold text-ink">
                  Attendee Limit (optional)
                </label>
                <input
                  type="number"
                  min="2"
                  max="500"
                  value={maxAttendees}
                  onChange={(e) => setMaxAttendees(e.target.value)}
                  placeholder="e.g. 25 people"
                  className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs text-ink outline-none transition focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                />
              </div>

              {/* Cover Image Presets */}
              <div>
                <label className="block text-xs font-semibold text-ink">
                  {t("events.coverUrlLabel", "Cover Image")}
                </label>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {PRESET_COVERS.map((preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => setCoverUrl(preset.url)}
                      className={cn(
                        "rounded-lg border px-2.5 py-1 text-[11px] font-medium transition",
                        coverUrl === preset.url
                          ? "border-brand-500 bg-brand-500/10 text-brand-600 dark:text-brand-300"
                          : "border-line text-muted hover:border-ink hover:text-ink",
                      )}
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
                <input
                  type="url"
                  value={coverUrl}
                  onChange={(e) => setCoverUrl(e.target.value)}
                  placeholder="Or paste any custom image URL…"
                  className="mt-2 w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs text-ink outline-none transition focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl border border-line bg-surface px-4 py-2.5 text-xs font-semibold text-muted hover:text-ink"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-brand-700 px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-brand-600 disabled:opacity-50"
                >
                  {submitting && <Spinner className="h-3.5 w-3.5" />}
                  <span>
                    {submitting
                      ? "Saving…"
                      : editingEvent
                        ? "Save Changes"
                        : t("events.submit", "Publish Meetup")}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
