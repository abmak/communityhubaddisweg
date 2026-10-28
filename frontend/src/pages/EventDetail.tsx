import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import {
  AlarmClock,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Car,
  Clock,
  Footprints,
  LocateFixed,
  MapPin,
  Users,
  CheckCircle2,
  Star,
  ExternalLink,
  RefreshCw,
  Trash2,
  Edit3,
  X,
  Share2,
  Navigation,
  Radio,
} from "lucide-react";
import { useAuth } from "../store/auth";
import { useUI } from "../store/ui";
import { useTranslation } from "../store/i18n";
import { api, apiError, mediaSrc } from "../lib/api";
import type {
  EventDetail,
  EventDetailResponse,
  Category,
  LeaveByPlan,
  Place,
  RsvpStatus,
} from "../types";
import { Avatar, Spinner } from "../components/ui";
import { cn } from "../lib/utils";
import { formatEthiopianDate, toEthiopianDate } from "../lib/ethiopian";
import { eventNavigationPath, formatRouteDistance, formatRouteDuration } from "../lib/navigation";
import {
  locationBlock,
  requestPosition,
  type LocationBlock,
  type LocationFailure,
} from "../lib/geo";

const TOPIC_LABEL: Record<string, string> = {
  CINEMA: "Cinema",
  THEATRE: "Theatre",
  SPORTS: "Football & sport",
  MUSIC: "Music",
  FESTIVAL: "Music festival",
  SOCIAL: "Social",
  TRAVEL: "Travel",
  HIKING: "Hiking",
  BUSINESS: "Business conference",
  SEASONAL: "Seasonal event",
  COMMUNITY: "Community",
  OTHER: "Event",
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
      weekday: "long",
      year: "numeric",
      month: "long",
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
        return `${dateFormatted}${ethiopian} at ${timeStart} – ${timeEnd}`;
      }
      // Multi-day events (festivals, conferences) must show the closing date.
      const endDateFormatted = end.toLocaleDateString(undefined, {
        weekday: "short",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      return `${dateFormatted}${ethiopian} at ${timeStart} – ${endDateFormatted} at ${timeEnd}`;
    }
    return `${dateFormatted}${ethiopian} at ${timeStart}`;
  } catch {
    return startStr;
  }
}

/** Leave-by needs a precise pin, so its copy cannot offer the area picker. */
function leaveByLocationMessage(problem: LocationBlock | LocationFailure): string {
  switch (problem) {
    case "insecure":
      return "Location sharing needs HTTPS. Open this site over a secure connection to work out a leave time.";
    case "unsupported":
      return "This browser cannot share a location. Try another browser to use leave-by reminders.";
    case "denied":
      return "Location is blocked for this site. Allow it in your browser settings and try again.";
    case "timeout":
      return "Your device took too long to find a fix. Try again outdoors or near a window.";
    default:
      return "We couldn't get a location fix. Try again in a moment.";
  }
}

function getEventBadgeDate(startStr: string) {
  try {
    const d = new Date(startStr);
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

export function EventDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { t } = useTranslation();
  const user = useAuth((state) => state.user);
  const pushToast = useUI((state) => state.pushToast);
  const navigate = useNavigate();

  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [leaveBy, setLeaveBy] = useState<LeaveByPlan | null>(null);
  const [leaveByBusy, setLeaveByBusy] = useState(false);

  const [activeTab, setActiveTab] = useState<"GOING" | "INTERESTED">("GOING");

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [saving, setSaving] = useState(false);

  // Form State
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [location, setLocation] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedPlace, setSelectedPlace] = useState("");
  const [maxAttendees, setMaxAttendees] = useState("");

  const loadEvent = async () => {
    if (!slug) return;
    try {
      setLoading(true);
      setError(null);
      const res = await api.get<EventDetailResponse>(`/api/events/${slug}`);
      setEvent(res.data.event);
      setLeaveBy(res.data.event.leaveBy ?? null);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadEvent();
  }, [slug]);

  const handleOpenEditModal = async () => {
    if (!event) return;
    setTitle(event.title);
    setDescription(event.description);
    // Convert ISO to datetime-local string
    setStartDate(event.startDate ? new Date(event.startDate).toISOString().slice(0, 16) : "");
    setEndDate(event.endDate ? new Date(event.endDate).toISOString().slice(0, 16) : "");
    setLocation(event.location);
    setCoverUrl(event.coverUrl || "");
    setSelectedCategory(event.category?.id || "");
    setSelectedPlace(event.place?.id || "");
    setMaxAttendees(event.maxAttendees ? String(event.maxAttendees) : "");

    setIsEditModalOpen(true);
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

  const handleSaveEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!event) return;
    if (!title.trim() || !startDate || !location.trim()) {
      pushToast("Please provide a title, date, and location.");
      return;
    }

    try {
      setSaving(true);
      const res = await api.patch<{ event: Partial<EventDetail> }>(`/api/events/${event.id}`, {
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

      setEvent((prev) => (prev ? { ...prev, ...res.data.event } : null));
      // The API clears departure plans when an event is edited, because a
      // moved start or venue would make the old one wrong.
      setLeaveBy(null);
      setIsEditModalOpen(false);
      pushToast(event.kind === "EVENT" ? "Event details updated!" : "Meetup details updated!");
    } catch (err) {
      pushToast(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!event) return;
    const noun = event.kind === "EVENT" ? "event" : "meetup";
    if (!window.confirm(`Are you sure you want to remove this ${noun}?`)) return;

    try {
      await api.delete(`/api/events/${event.id}`);
      pushToast(event.kind === "EVENT" ? "Event removed." : "Meetup cancelled.");
      navigate("/events");
    } catch (err) {
      pushToast(apiError(err));
    }
  };

  const handleRsvp = async (targetStatus: RsvpStatus) => {
    if (!user) {
      pushToast("Please sign in to RSVP for gatherings.");
      navigate("/login");
      return;
    }
    if (!event) return;

    const newStatus = event.myRsvp === targetStatus ? "NONE" : targetStatus;

    try {
      const res = await api.post<{
        myRsvp: RsvpStatus | null;
        counts: { going: number; interested: number; total: number };
      }>(`/api/events/${event.id}/rsvp`, { status: newStatus });

      setEvent((prev) => {
        if (!prev) return null;
        let updatedGoing = [...prev.attendees.going];
        let updatedInterested = [...prev.attendees.interested];

        // Remove current user from lists
        updatedGoing = updatedGoing.filter((u) => u.id !== user.id);
        updatedInterested = updatedInterested.filter((u) => u.id !== user.id);

        if (newStatus === "GOING") {
          updatedGoing.push({
            id: user.id,
            username: user.username,
            displayName: user.displayName,
            avatarUrl: user.avatarUrl ?? null,
          });
        } else if (newStatus === "INTERESTED") {
          updatedInterested.push({
            id: user.id,
            username: user.username,
            displayName: user.displayName,
            avatarUrl: user.avatarUrl ?? null,
          });
        }

        return {
          ...prev,
          myRsvp: res.data.myRsvp,
          counts: res.data.counts,
          attendees: {
            going: updatedGoing,
            interested: updatedInterested,
          },
        };
      });

      pushToast(
        newStatus === "GOING"
          ? "You're going! 🎉"
          : newStatus === "INTERESTED"
            ? "Saved to your interested meetups."
            : "RSVP removed.",
      );
    } catch (err) {
      pushToast(apiError(err));
    }
  };

  const handleLeaveBy = async () => {
    if (!user) {
      pushToast("Please sign in to set a leave-by reminder.");
      navigate("/login");
      return;
    }
    if (!event) return;

    const blocked = locationBlock();
    if (blocked) {
      pushToast(leaveByLocationMessage(blocked), { tone: "error" });
      return;
    }

    setLeaveByBusy(true);
    try {
      const origin = await requestPosition();
      const res = await api.post<{ leaveBy: LeaveByPlan }>(
        `/api/events/${event.id}/leave-by`,
        {
          origin,
          originLabel: "Your location",
          mode: "driving",
        },
      );
      setLeaveBy(res.data.leaveBy);
      pushToast("Leave time saved. We'll send a reminder 5 minutes before you need to go.", {
        tone: "success",
      });
    } catch (err) {
      const failure = typeof err === "string" ? (err as LocationFailure) : null;
      pushToast(
        failure
          ? leaveByLocationMessage(failure)
          : apiError(err, "We couldn't work out a leave time for this gathering."),
        { tone: "error" },
      );
    } finally {
      setLeaveByBusy(false);
    }
  };

  const handleRemoveLeaveBy = async () => {
    if (!event) return;
    setLeaveByBusy(true);
    try {
      await api.delete(`/api/events/${event.id}/leave-by`);
      setLeaveBy(null);
      pushToast("Leave-by reminder removed.");
    } catch (err) {
      pushToast(apiError(err), { tone: "error" });
    } finally {
      setLeaveByBusy(false);
    }
  };

  const handleShare = () => {
    if (navigator.share) {
      void navigator.share({
        title: event?.title,
        text: event?.description,
        url: window.location.href,
      });
    } else {
      void navigator.clipboard.writeText(window.location.href);
      pushToast("Link copied to clipboard!");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
        <Spinner className="h-8 w-8 text-brand-600" />
        <p className="text-xs text-muted">Loading gathering details…</p>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="mx-auto max-w-xl space-y-4 py-12 text-center">
        <CalendarDays className="mx-auto h-12 w-12 text-muted/60" />
        <h2 className="text-xl font-bold text-ink">Meetup not found</h2>
        <p className="text-xs text-muted">{error || "This gathering may have been cancelled or moved."}</p>
        <Link
          to="/events"
          className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-xs font-semibold text-white shadow-sm"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to All Events</span>
        </Link>
      </div>
    );
  }

  const badgeDate = getEventBadgeDate(event.startDate);
  const isCreator = user?.id === event.creator.id;
  const canManage = isCreator || user?.role === "ADMIN" || user?.role === "MODERATOR";
  // Linked venues and stored pins go straight to in-app navigation; a venue we
  // only know by name is pinned by the address geocoder on the navigate page.
  const navigateHref = eventNavigationPath(event);
  // A saved departure plan knows the member's starting pin, so its navigation
  // link can start from there instead of asking the device again.
  const venueLat = event.lat ?? event.place?.lat ?? null;
  const venueLng = event.lng ?? event.place?.lng ?? null;
  const leaveNavigationHref =
    leaveBy && venueLat !== null && venueLng !== null
      ? `/navigate?from=${leaveBy.origin.lat},${leaveBy.origin.lng}&to=${venueLat},${venueLng}&name=${encodeURIComponent(
          event.place?.name ?? event.location,
        )}`
      : navigateHref;
  const eventUpcoming = new Date(event.startDate).getTime() > Date.now();
  const blockedLocation = locationBlock();
  const leaveAt = leaveBy ? new Date(leaveBy.leaveAt) : null;
  const leaveNow = leaveAt ? leaveAt.getTime() <= Date.now() : false;

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-20">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <Link
          to={event.kind === "MEETUP" ? "/meetups" : "/events"}
          className="inline-flex items-center gap-2 text-xs font-semibold text-muted transition hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>
            {event.kind === "MEETUP"
              ? "Back to Meetups"
              : t("events.upcoming", "Back to Gatherings")}
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleShare}
            className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-1.5 text-xs font-medium text-muted hover:text-ink"
          >
            <Share2 className="h-3.5 w-3.5" />
            <span>Share</span>
          </button>

          {canManage && (
            <>
              <button
                type="button"
                onClick={handleOpenEditModal}
                className="inline-flex items-center gap-1.5 rounded-xl border border-brand-500/30 bg-brand-500/10 px-3 py-1.5 text-xs font-bold text-brand-600 hover:bg-brand-500/20 dark:text-brand-300"
              >
                <Edit3 className="h-3.5 w-3.5" />
                <span>Edit</span>
              </button>
              <button
                type="button"
                onClick={() => void handleDelete()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-500/20"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Hero Cover Card */}
      <div className="group relative overflow-hidden rounded-3xl border border-line bg-neutral-900 shadow-lift">
        <div className="aspect-[21/9] w-full min-h-[220px]">
          <img
            src={mediaSrc(event.coverUrl) || PRESET_COVERS[0].url}
            alt={event.title}
            className="h-full w-full object-cover"
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />

        {/* Date Badge */}
        <div className="absolute left-6 top-6 flex flex-col items-center rounded-2xl border border-white/20 bg-surface/90 px-3.5 py-2 text-center shadow-lift backdrop-blur-md dark:bg-neutral-900/90">
          <span className="text-[10px] font-black tracking-widest text-rose-500">{badgeDate.month}</span>
          <span className="text-xl font-black text-ink">{badgeDate.day}</span>
        </div>

        {/* Categories & Place Links */}
        <div className="absolute bottom-6 left-6 right-6 flex flex-wrap items-center gap-2">
          {event.category && (
            <Link
              to={`/c/${event.category.slug}`}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold text-white shadow-sm backdrop-blur-md"
              style={{ backgroundColor: `${event.category.color}dd` }}
            >
              <span>{event.category.name}</span>
            </Link>
          )}
          {event.place && (
            <Link
              to={`/places/${event.place.slug}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-black/60 px-3 py-1 text-xs font-semibold text-zinc-100 backdrop-blur-md hover:text-white"
            >
              <MapPin className="h-3.5 w-3.5 text-amber-400" />
              <span>{event.place.name}</span>
              <ExternalLink className="h-3 w-3 opacity-60" />
            </Link>
          )}
        </div>
      </div>

      {/* Event Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column: Details & Attendees */}
        <div className="space-y-6 lg:col-span-2">
          {/* Header Info */}
          <div className="space-y-4 rounded-3xl border border-line bg-surface p-6 sm:p-8">
            <h1 className="font-serif text-2xl font-bold tracking-tight text-ink sm:text-3xl">
              {event.title}
            </h1>

            {event.kind === "EVENT" && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] font-medium text-muted">
                <span className="inline-flex items-center gap-1 rounded-full bg-brand-500/10 px-2.5 py-0.5 font-bold uppercase tracking-wide text-brand-700 dark:text-brand-300">
                  <Radio className="h-3 w-3" /> {TOPIC_LABEL[event.topic] ?? "Event"}
                  {event.source ? " · auto-imported" : " · official listing"}
                </span>
                {event.source && <span>Listed by {event.source.name}</span>}
                {event.sourceUrl && (
                  <a
                    href={event.sourceUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-1 font-semibold text-brand-600 hover:underline dark:text-brand-400"
                  >
                    Open original listing <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-4 border-y border-line/60 py-3 text-xs text-muted">
              <div className="flex items-center gap-2 font-medium text-ink">
                <Clock className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                <span>{formatEventDate(event.startDate, event.endDate)}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <span className="line-clamp-1">{event.location}</span>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted">About this Gathering</h3>
              <p className="whitespace-pre-line text-sm leading-relaxed text-ink/90 sm:text-base">
                {event.description}
              </p>
            </div>

            {/* Directions Action */}
            <div className="flex flex-wrap items-center gap-2 pt-2">
              {navigateHref ? (
                <Link
                  to={navigateHref}
                  className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-brand-600"
                >
                  <Navigation className="h-3.5 w-3.5" />
                  <span>Navigate to the venue</span>
                  <ArrowRight className="h-3 w-3 opacity-80" />
                </Link>
              ) : (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                    event.place ? `${event.place.name}, ${event.location}` : event.location,
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface-raised/50 px-4 py-2.5 text-xs font-semibold text-ink transition hover:border-brand-500 hover:text-brand-600"
                >
                  <Navigation className="h-3.5 w-3.5 text-brand-600 dark:text-brand-400" />
                  <span>Find the venue on Google Maps</span>
                  <ExternalLink className="h-3 w-3 opacity-60" />
                </a>
              )}
              <span className="text-[11px] text-muted">
                Turn-by-turn directions inside Addis Gebeta, no app switch.
              </span>
            </div>
          </div>

          {/* Attendees Section */}
          <div className="rounded-3xl border border-line bg-surface p-6 sm:p-8">
            <div className="flex items-center justify-between border-b border-line pb-4">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-brand-600" />
                <h3 className="text-base font-bold text-ink">Community Attendees</h3>
              </div>
              <div className="flex items-center gap-1.5 rounded-xl border border-line p-1">
                <button
                  type="button"
                  onClick={() => setActiveTab("GOING")}
                  className={cn(
                    "rounded-lg px-3 py-1 text-xs font-bold transition",
                    activeTab === "GOING"
                      ? "bg-brand-700 text-white"
                      : "text-muted hover:text-ink",
                  )}
                >
                  Going ({event.counts.going})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("INTERESTED")}
                  className={cn(
                    "rounded-lg px-3 py-1 text-xs font-bold transition",
                    activeTab === "INTERESTED"
                      ? "bg-amber-600 text-white"
                      : "text-muted hover:text-ink",
                  )}
                >
                  Interested ({event.counts.interested})
                </button>
              </div>
            </div>

            {/* Attendees Grid */}
            <div className="mt-5">
              {(activeTab === "GOING" ? event.attendees.going : event.attendees.interested).length ===
              0 ? (
                <p className="py-6 text-center text-xs text-muted">
                  {activeTab === "GOING"
                    ? "No members marked as going yet. Be the first!"
                    : "No members marked as interested yet."}
                </p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {(activeTab === "GOING" ? event.attendees.going : event.attendees.interested).map(
                    (att) => (
                      <Link
                        key={att.id}
                        to={`/u/${att.username}`}
                        className="flex items-center gap-3 rounded-2xl border border-line/60 bg-surface-raised/30 p-2.5 transition hover:border-brand-500/40 hover:bg-surface-raised"
                      >
                        <Avatar src={att.avatarUrl} name={att.displayName} username={att.username} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-bold text-ink">{att.displayName}</p>
                          <p className="truncate text-[11px] text-muted">@{att.username}</p>
                        </div>
                      </Link>
                    ),
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: RSVP Box & Host Profile */}
        <div className="space-y-6">
          {/* RSVP Control Card */}
          <div className="rounded-3xl border border-line bg-surface p-6 shadow-lift">
            <h3 className="text-sm font-bold text-ink">Are you attending?</h3>
            <p className="mt-1 text-xs text-muted">
              {event.kind === "EVENT"
                ? "Mark yourself going so the community knows who to look for, or save it as interested."
                : "Let the host and community know so space and reservations can be confirmed."}
            </p>

            {event.maxAttendees && (
              <div className="mt-4 rounded-xl border border-line/70 bg-surface-raised/40 p-3">
                <div className="flex justify-between text-xs">
                  <span className="text-muted">Attendance Limit</span>
                  <span className="font-bold text-ink">
                    {event.counts.going} / {event.maxAttendees} spots
                  </span>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-line">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                    style={{
                      width: `${Math.min(100, (event.counts.going / event.maxAttendees) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            )}

            <div className="mt-5 grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => void handleRsvp("GOING")}
                className={cn(
                  "flex flex-col items-center justify-center gap-1.5 rounded-2xl p-3 text-xs font-bold transition active:scale-95",
                  event.myRsvp === "GOING"
                    ? "bg-emerald-600 text-white shadow-glow"
                    : "border border-line bg-surface hover:bg-emerald-500/10 hover:text-emerald-600",
                )}
              >
                <CheckCircle2 className="h-5 w-5" />
                <span>{event.myRsvp === "GOING" ? "Going ✓" : "Going"}</span>
              </button>

              <button
                type="button"
                onClick={() => void handleRsvp("INTERESTED")}
                className={cn(
                  "flex flex-col items-center justify-center gap-1.5 rounded-2xl p-3 text-xs font-bold transition active:scale-95",
                  event.myRsvp === "INTERESTED"
                    ? "bg-amber-600 text-white shadow-glow"
                    : "border border-line bg-surface hover:bg-amber-500/10 hover:text-amber-600",
                )}
              >
                <Star className="h-5 w-5" />
                <span>{event.myRsvp === "INTERESTED" ? "Interested ★" : "Interested"}</span>
              </button>
            </div>
          </div>

          {eventUpcoming && user && venueLat !== null && venueLng !== null && (
            <div className="rounded-3xl border border-line bg-surface p-6 shadow-lift">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-700 dark:text-brand-300">
                  <AlarmClock className="h-4 w-4" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-ink">Leave-by reminder</h3>
                  <p className="mt-0.5 text-[11px] leading-5 text-muted">
                    A nudge when it is time to go, based on the drive and this hour's traffic.
                  </p>
                </div>
              </div>

              {leaveBy && leaveAt ? (
                <div className="mt-4">
                  <div className="rounded-2xl border border-brand-500/20 bg-brand-500/5 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
                      {leaveNow ? "Time to go" : "Leave by"}
                    </p>
                    <p className="mt-0.5 font-display text-2xl font-semibold text-ink">
                      {leaveNow
                        ? "Now"
                        : leaveAt.toLocaleTimeString(undefined, {
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                    </p>
                    <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted">
                      <span className="inline-flex items-center gap-1">
                        {leaveBy.mode === "walking" ? (
                          <Footprints className="h-3 w-3" />
                        ) : (
                          <Car className="h-3 w-3" />
                        )}
                        {formatRouteDuration(leaveBy.travelSeconds)}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{formatRouteDistance(leaveBy.distanceMeters)}</span>
                      <span aria-hidden="true">·</span>
                      <span>arrive 10 min early</span>
                    </p>
                  </div>

                  <p className="mt-2.5 text-[11px] leading-5 text-muted">
                    {leaveBy.notifiedAt
                      ? "Reminder sent — check your notifications. Open navigation to head out."
                      : `We'll notify you at ${new Date(leaveBy.notifyAt).toLocaleTimeString(
                          undefined,
                          { hour: "numeric", minute: "2-digit" },
                        )}, five minutes before you need to leave.`}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {leaveNavigationHref && (
                      <Link
                        to={leaveNavigationHref}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-brand-700 px-3 py-2 text-[11px] font-semibold text-white transition hover:bg-brand-600"
                      >
                        <Navigation className="h-3.5 w-3.5" /> Start route
                      </Link>
                    )}
                    <button
                      type="button"
                      onClick={() => void handleLeaveBy()}
                      disabled={leaveByBusy}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-[11px] font-semibold text-ink transition hover:bg-raised disabled:opacity-50"
                    >
                      <RefreshCw className={cn("h-3.5 w-3.5", leaveByBusy && "animate-spin")} />
                      Recalculate
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleRemoveLeaveBy()}
                      disabled={leaveByBusy}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-[11px] font-semibold text-muted transition hover:border-rose-300 hover:text-rose-600 disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="mt-3 text-[11px] leading-5 text-muted">
                    Share your current location and we'll work out the drive using the road
                    route and the traffic expected at that hour. We'll save an alert five
                    minutes before you need to go; enable browser notifications in Settings
                    for a push when the tab is closed.
                  </p>
                  <button
                    type="button"
                    onClick={() => void handleLeaveBy()}
                    disabled={leaveByBusy || Boolean(blockedLocation)}
                    className="btn-primary btn-sm mt-3 w-full disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {leaveByBusy ? (
                      <Spinner className="h-3.5 w-3.5" />
                    ) : (
                      <LocateFixed className="h-3.5 w-3.5" />
                    )}
                    {leaveByBusy ? "Working out your leave time…" : "Use my location"}
                  </button>
                  {blockedLocation && (
                    <p className="mt-2 text-[10px] leading-4 text-amber-700 dark:text-amber-300">
                      {leaveByLocationMessage(blockedLocation)}
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {/* Source card for imported listings, organiser card for curated ones. */}
          {event.source ? (
            <div className="rounded-3xl border border-line bg-surface p-6 shadow-lift">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted">Source</h3>
              <div className="mt-4 flex items-center gap-3">
                <span className="rounded-xl bg-brand-500/10 p-2.5 text-brand-600 dark:text-brand-300">
                  <Radio className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-ink">{event.source?.name ?? "Online listing"}</p>
                  <p className="text-xs text-muted">
                    {event.importedAt
                      ? `Imported ${new Date(event.importedAt).toLocaleDateString()}`
                      : "Imported automatically"}
                  </p>
                </div>
              </div>
              {event.sourceUrl && (
                <a
                  href={event.sourceUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl border border-line bg-surface py-2 text-center text-xs font-semibold text-ink transition hover:bg-raised"
                >
                  View original <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
              <p className="mt-3 text-[11px] leading-relaxed text-muted">
                Times and tickets come from the organiser. Always confirm before travelling.
              </p>
            </div>
          ) : (
          <div className="rounded-3xl border border-line bg-surface p-6 shadow-lift">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted">
              {event.kind === "EVENT" ? "Published by" : "Organized by"}
            </h3>
            <div className="mt-4 flex items-center gap-3">
              <Avatar
                src={event.creator.avatarUrl}
                name={event.creator.displayName}
                username={event.creator.username}
                size="md"
              />
              <div className="min-w-0 flex-1">
                <Link
                  to={`/u/${event.creator.username}`}
                  className="font-bold text-ink hover:underline"
                >
                  {event.creator.displayName}
                </Link>
                <p className="text-xs text-muted">@{event.creator.username}</p>
              </div>
            </div>

            <Link
              to={`/u/${event.creator.username}`}
              className="mt-4 block w-full rounded-xl border border-line bg-surface py-2 text-center text-xs font-semibold text-ink transition hover:bg-raised"
            >
              {event.kind === "EVENT" ? "View organiser profile" : "View host profile"}
            </Link>

            {event.kind === "EVENT" && (
              <p className="mt-3 text-[11px] leading-relaxed text-muted">
                An official listing from the Addis Gebeta community team.
              </p>
            )}
          </div>
          )}

          {/* Venue Card if attached */}
          {event.place && (
            <div className="rounded-3xl border border-line bg-surface p-6 shadow-lift">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted">Venue Details</h3>
              <div className="mt-3 space-y-2">
                <p className="font-bold text-ink">{event.place.name}</p>
                <p className="text-xs text-muted">
                  {event.place.kind} · {event.place.area || event.place.city}
                </p>
                <Link
                  to={`/places/${event.place.slug}`}
                  className="inline-flex items-center gap-1.5 pt-1 text-xs font-bold text-brand-600 hover:underline dark:text-brand-400"
                >
                  <span>Explore this venue</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit Meetup Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-line bg-surface p-6 shadow-lift sm:p-8">
            <button
              type="button"
              onClick={() => setIsEditModalOpen(false)}
              className="absolute right-5 top-5 rounded-full p-2 text-muted hover:bg-raised hover:text-ink"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2.5">
              <div className="rounded-xl bg-brand-500/10 p-2 text-brand-600 dark:text-brand-300">
                <Edit3 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-ink">
                  {event.kind === "EVENT" ? "Edit event details" : "Edit Community Meetup"}
                </h2>
                <p className="text-xs text-muted">Update event information, time, or location.</p>
              </div>
            </div>

            <form onSubmit={handleSaveEdit} className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-ink">Event Title *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-xs text-ink outline-none transition focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink">Description *</label>
                <textarea
                  required
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-line bg-surface px-3.5 py-2 text-xs text-ink outline-none transition focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-ink">Start Date & Time *</label>
                  <input
                    type="datetime-local"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs text-ink outline-none transition focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink">End Date & Time (optional)</label>
                  <input
                    type="datetime-local"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs text-ink outline-none transition focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink">Meeting Point / Address *</label>
                <input
                  type="text"
                  required
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-xs text-ink outline-none transition focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-ink">Associated Room</label>
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
                  <label className="block text-xs font-semibold text-ink">Link to a Place</label>
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

              <div>
                <label className="block text-xs font-semibold text-ink">Attendee Limit</label>
                <input
                  type="number"
                  min="2"
                  max="500"
                  value={maxAttendees}
                  onChange={(e) => setMaxAttendees(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs text-ink outline-none transition focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink">Cover Image URL</label>
                <input
                  type="url"
                  value={coverUrl}
                  onChange={(e) => setCoverUrl(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs text-ink outline-none transition focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="rounded-xl border border-line bg-surface px-4 py-2.5 text-xs font-semibold text-muted hover:text-ink"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-brand-700 px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-brand-600 disabled:opacity-50"
                >
                  {saving && <Spinner className="h-3.5 w-3.5" />}
                  <span>{saving ? "Saving…" : "Save Changes"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
