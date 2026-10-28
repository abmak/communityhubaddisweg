import { useEffect, useState, type FormEvent } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Award,
  Bell,
  BellRing,
  Bookmark,
  CalendarDays,
  Compass,
  Home,
  Laugh,
  LayoutGrid,
  LogIn,
  LogOut,
  MessageCircle,
  MapPin,
  Menu as MenuIcon,
  Monitor,
  Moon,
  Navigation,
  PenSquare,
  Plus,
  Search,
  Settings,
  Shield,
  Star,
  Sun,
  User as UserIcon,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "../store/auth";
import { useUI } from "../store/ui";
import { connectSocket, disconnectSocket } from "../lib/socket";
import {
  isPushActive,
  requestBrowserNotifications,
  shouldOfferBrowserNotifications,
  showBrowserNotification,
  snoozeBrowserNotificationPrompt,
  useBrowserNotifications,
} from "../lib/browserNotifications";
import type { AppNotification, ExploreData, Message, PlacesResponse, User } from "../types";
import { useQuery } from "../hooks/useApi";
import { cn, formatCount, notificationLink, postPath, timeAgo } from "../lib/utils";
import { Avatar, Badge, Dropdown, IconButton, Spinner, UserRowLink } from "./ui";
import { FollowButton } from "./UserCard";
import { categoryIcon, categoryPath } from "../lib/utils";
import { BrandMark, Wordmark } from "./Brand";
import { BRAND, categoryAmharic } from "../lib/brand";
import { KIND_META, placePath } from "../lib/places";
import type { Category } from "../types";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { useTranslation } from "../store/i18n";

interface RealtimeEvent {
  id: string;
  slug: string;
  title: string;
  startDate: string;
  location: string | null;
  kind: "EVENT" | "MEETUP";
  creatorId: string;
}

function messagePreview(message: Message): string {
  const body = message.body?.trim();
  if (body) return body.length > 160 ? `${body.slice(0, 157)}…` : body;
  if (message.media.some((item) => item.kind === "AUDIO")) return "Sent you a voice message.";
  if (message.media.length > 0) return "Sent you a photo.";
  return "Sent you a message.";
}

function useRealtime() {
  const user = useAuth((state) => state.user);
  const setUnread = useAuth((state) => state.setUnread);
  const refreshUnread = useAuth((state) => state.refreshUnread);
  const pushToast = useUI((state) => state.pushToast);
  const setPresence = useUI((state) => state.setPresence);

  useEffect(() => {
    if (!user) {
      disconnectSocket();
      return;
    }

    const socket = connectSocket();

    const onNotification = (notification: AppNotification) => {
      const message = notification.actor
        ? `${notification.actor.displayName} ${notification.body}`
        : notification.body;
      pushToast(message, { href: notificationLink(notification) });
    };
    const onNotificationCount = (payload: { count: number }) => {
      setUnread({ notifications: payload.count });
    };
    const onMessageCount = (payload: { count: number }) => {
      setUnread({ messages: payload.count });
    };
    const onMessage = (message: Message) => {
      if (message.senderId === user.id) return;
      const state = useAuth.getState();
      setUnread({ messages: state.unread.messages + 1 });

      void showBrowserNotification({
        title: message.sender.displayName,
        body: messagePreview(message),
        url: `/messages/${message.conversationId}`,
        tag: `message:${message.conversationId}`,
      });
    };
    const onPresence = (payload: { userId: string; online: boolean }) => {
      setPresence(payload.userId, payload.online);
    };
    const onAnnouncement = (payload: { postId: string; title: string }) => {
      // With Web Push active the service worker hands a focused tab the same
      // payload; showing both would duplicate the toast.
      if (!isPushActive()) {
        pushToast(`New announcement: ${payload.title}`, { href: `/posts/${payload.postId}` });
      }
      void showBrowserNotification({
        title: "Addis Gebeta · Service update",
        body: payload.title,
        url: `/posts/${payload.postId}`,
        tag: `announcement:${payload.postId}`,
      });
    };
    const onEvent = (event: RealtimeEvent) => {
      if (event.creatorId === user.id) return;
      const when = new Date(event.startDate).toLocaleString(undefined, {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
      const place = event.location?.trim();
      void showBrowserNotification({
        title: "New event on Addis Gebeta",
        body: `${event.title} · ${when}${place ? ` · ${place}` : ""}`,
        url: `/events/${event.slug}`,
        tag: `event:${event.id}`,
      });
    };
    const onReconnect = () => {
      void refreshUnread();
    };

    socket.on("notification:new", onNotification);
    socket.on("notifications:unread", onNotificationCount);
    socket.on("messages:unread", onMessageCount);
    socket.on("message:new", onMessage);
    socket.on("presence:update", onPresence);
    socket.on("announcement:new", onAnnouncement);
    socket.on("event:new", onEvent);
    socket.on("connect", onReconnect);

    if (socket.connected) void refreshUnread();

    return () => {
      socket.off("notification:new", onNotification);
      socket.off("notifications:unread", onNotificationCount);
      socket.off("messages:unread", onMessageCount);
      socket.off("message:new", onMessage);
      socket.off("presence:update", onPresence);
      socket.off("announcement:new", onAnnouncement);
      socket.off("event:new", onEvent);
      socket.off("connect", onReconnect);
    };
  }, [user?.id, pushToast, refreshUnread, setPresence, setUnread]);
}

function ThemeManager() {
  const theme = useUI((state) => state.theme);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && media.matches);
      document.documentElement.classList.toggle("dark", dark);
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);

  return null;
}

function NavBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="ml-auto inline-flex min-w-[20px] items-center justify-center rounded-full bg-brand-700 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
      {count > 99 ? "99+" : count}
    </span>
  );
}

const navItemClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition",
    isActive
      ? "bg-brand-50/80 text-brand-900 shadow-[inset_0_0_0_1px_rgba(15,107,58,0.08)] dark:bg-brand-500/10 dark:text-brand-100"
      : "text-muted hover:bg-raised/70 hover:text-ink",
  );

function Sidebar() {
  const user = useAuth((state) => state.user);
  const unread = useAuth((state) => state.unread);
  const logout = useAuth((state) => state.logout);
  const theme = useUI((state) => state.theme);
  const setTheme = useUI((state) => state.setTheme);
  const { t, lang } = useTranslation();
  const navigate = useNavigate();

  const isModerator = user?.role === "ADMIN" || user?.role === "MODERATOR";

  const cycleTheme = () => {
    setTheme(theme === "light" ? "dark" : theme === "dark" ? "system" : "light");
  };
  const ThemeIcon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[272px] flex-col border-r border-line/80 bg-surface/80 px-3.5 py-5 backdrop-blur-xl lg:flex">
      <Link to="/home" className="mb-6 flex items-center gap-3 rounded-xl px-2 py-1">
        <BrandMark className="h-9 w-9" />
        <Wordmark subtitle="Addis Gebeta · since 2026" />
      </Link>

      {user ? (
        <button
          type="button"
          onClick={() => navigate("/create")}
          className="btn-primary mb-5 w-full justify-start px-3.5"
        >
          <PenSquare className="h-4 w-4" /> {t("nav.post", "Share something")}
        </button>
      ) : (
        <Link to="/register" className="btn-primary mb-5 w-full justify-start px-3.5">
          <Plus className="h-4 w-4" /> {t("nav.join", "Join Addis Gebeta")}
        </Link>
      )}

      <div className="no-scrollbar -mr-1 min-h-0 flex-1 overflow-y-auto pr-1">
        <nav className="space-y-1" aria-label="Main navigation">
          <p lang="am" className="mb-1 px-3 font-ethiopic text-[10px] uppercase tracking-[0.14em] text-muted/50">
          {lang === "am" ? "ዋና ገጾች" : lang === "om" ? "Kutaalee Ijoo" : "Navigation"}
        </p>
        <NavLink to="/home" className={navItemClass}>
          <Home className="h-[18px] w-[18px]" /> {t("nav.home", "Home")}
          {lang === "en" && (
            <span lang="am" className="ml-auto font-ethiopic text-[9px] text-muted/60">
              መነሻ
            </span>
          )}
        </NavLink>
        <NavLink to="/explore" className={navItemClass}>
          <Compass className="h-[18px] w-[18px]" /> {t("nav.explore", "Explore")}
          {lang === "en" && (
            <span lang="am" className="ml-auto font-ethiopic text-[9px] text-muted/60">
              ዳሰሳ
            </span>
          )}
        </NavLink>
        <NavLink to="/places" className={navItemClass}>
          <MapPin className="h-[18px] w-[18px]" /> {t("nav.places", "Nearby")}
          {lang === "en" && (
            <span lang="am" className="ml-auto font-ethiopic text-[9px] text-muted/60">
              አቅራቢያ
            </span>
          )}
        </NavLink>
        <NavLink to="/events" className={navItemClass}>
          <CalendarDays className="h-[18px] w-[18px]" /> {t("nav.events", "Events")}
          {lang === "en" && (
            <span lang="am" className="ml-auto font-ethiopic text-[9px] text-muted/60">
              ዝግጅቶች
            </span>
          )}
        </NavLink>
        <NavLink to="/meetups" className={navItemClass}>
          <Users className="h-[18px] w-[18px]" /> {t("nav.meetups", "Meetups")}
          {lang === "en" && (
            <span lang="am" className="ml-auto font-ethiopic text-[9px] text-muted/60">
              ስብሰባዎች
            </span>
          )}
        </NavLink>
        <NavLink to="/travel" className={navItemClass}>
          <Navigation className="h-[18px] w-[18px]" /> {t("nav.travel", "Let's Travel")}
          {lang === "en" && (
            <span lang="am" className="ml-auto font-ethiopic text-[9px] text-muted/60">
              ጉዞ
            </span>
          )}
        </NavLink>
        <NavLink to="/jokes" className={navItemClass}>
          <Laugh className="h-[18px] w-[18px] text-amber-500" /> {t("nav.jokes", "Joke Time")}
          {lang === "en" && (
            <span lang="am" className="ml-auto font-ethiopic text-[9px] text-muted/60">
              የቀልድ ሰዓት
            </span>
          )}
        </NavLink>
        <NavLink to="/quiz" className={navItemClass}>
          <Award className="h-[18px] w-[18px] text-amber-500" /> {t("nav.quiz", "Lets Know Ethiopia")}
          {lang === "en" && (
            <span lang="am" className="ml-auto font-ethiopic text-[9px] text-muted/60">
              ኢትዮጵያን እናውቃት
            </span>
          )}
        </NavLink>
        <NavLink to="/categories" className={navItemClass}>
          <LayoutGrid className="h-[18px] w-[18px]" /> {t("nav.categories", "Categories")}
          {lang === "en" && (
            <span lang="am" className="ml-auto font-ethiopic text-[9px] text-muted/60">
              ምድቦች
            </span>
          )}
        </NavLink>
        {user && (
          <>
            <NavLink to="/messages" className={navItemClass}>
              <MessageCircle className="h-[18px] w-[18px]" /> {t("nav.messages", "Messages")}
              {lang === "en" && (
                <span lang="am" className="font-ethiopic text-[9px] text-muted/60">
                  መልዕክቶች
                </span>
              )}
              <NavBadge count={unread.messages} />
            </NavLink>
            <NavLink to="/notifications" className={navItemClass}>
              <Bell className="h-[18px] w-[18px]" /> {t("nav.notifications", "Notifications")}
              {lang === "en" && (
                <span lang="am" className="font-ethiopic text-[9px] text-muted/60">
                  ማሳወቂያ
                </span>
              )}
              <NavBadge count={unread.notifications} />
            </NavLink>
            <NavLink to="/bookmarks" className={navItemClass}>
              <Bookmark className="h-[18px] w-[18px]" /> {t("nav.bookmarks", "Bookmarks")}
              {lang === "en" && (
                <span lang="am" className="ml-auto font-ethiopic text-[9px] text-muted/60">
                  የተቀመጡ
                </span>
              )}
            </NavLink>
          </>
        )}
        </nav>

        {user && (
          <>
            <div className="my-4 border-t border-line" />
            <div className="space-y-1">
              <NavLink to={`/u/${user.username}`} className={navItemClass}>
                <UserIcon className="h-[18px] w-[18px]" /> {t("nav.profile", "Your profile")}
              </NavLink>
              <NavLink to="/settings" className={navItemClass}>
                <Settings className="h-[18px] w-[18px]" /> {t("nav.settings", "Settings")}
              </NavLink>
              {isModerator && (
                <NavLink to="/admin/overview" className={navItemClass}>
                  <Shield className="h-[18px] w-[18px]" /> {t("nav.admin", "Admin dashboard")}
                </NavLink>
              )}
            </div>
          </>
        )}
      </div>

      <div className="mt-4 space-y-2.5">
        <div className="relative overflow-hidden rounded-xl border border-white/10 bg-brand-900 p-3.5 text-white shadow-soft">
          <span aria-hidden="true" className="tilet-strip absolute inset-x-0 top-0 h-1 opacity-60" />
          <p lang="am" className="font-ethiopic text-sm font-semibold text-accent-200">
            {t("common.bunaTetu", "ቡና ተጠጡ")}
          </p>
          <p className="mt-1 text-[11px] leading-5 text-white/55">
            {t("common.coffeeToast", "Every good table starts with a cup and a story. Pull up a chair.")}
          </p>
        </div>

        <LanguageSwitcher dropUp className="w-full" />

        <button
          type="button"
          onClick={cycleTheme}
          className="flex w-full items-center gap-2.5 rounded-lg border border-line bg-surface px-3 py-2 text-xs font-medium text-muted shadow-[0_1px_2px_rgba(16,24,20,0.04)] transition hover:bg-raised hover:text-ink"
        >
          <ThemeIcon className="h-4 w-4" />
          {theme === "light" ? t("common.light", "Light") : theme === "dark" ? t("common.dark", "Dark") : t("common.system", "System")} {t("common.switchTheme", "theme")}
          <span className="ml-auto text-[10px] uppercase tracking-wide text-muted/60">Switch</span>
        </button>

        {user ? (
          <div className="rounded-xl border border-line bg-surface p-2.5 shadow-[0_1px_2px_rgba(16,24,20,0.04)]">
            <div className="flex items-center gap-2.5">
              <Link to={`/u/${user.username}`} className="min-w-0 flex-1">
                <span className="flex items-center gap-2.5">
                  <Avatar
                    name={user.displayName}
                    username={user.username}
                    src={user.avatarUrl}
                    size="sm"
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-ink">
                      {user.displayName}
                    </span>
                    <span className="block truncate text-[11px] text-muted">@{user.username}</span>
                  </span>
                </span>
              </Link>
              <IconButton
                label="Sign out"
                onClick={async () => {
                  await logout();
                  navigate("/");
                }}
              >
                <LogOut className="h-4 w-4" />
              </IconButton>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-line bg-surface p-3 shadow-[0_1px_2px_rgba(16,24,20,0.04)]">
            <p className="text-xs leading-5 text-muted">
              Join a community that talks about films, books, trails and everyday life.
            </p>
            <div className="mt-3 flex gap-2">
              <Link to="/register" className="btn-primary btn-sm flex-1">
                Create account
              </Link>
              <Link to="/login" className="btn-secondary btn-sm">
                <LogIn className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

function TopBar() {
  const user = useAuth((state) => state.user);
  const unread = useAuth((state) => state.unread);
  const { t } = useTranslation();
  const [term, setTerm] = useState("");
  const navigate = useNavigate();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const query = term.trim();
    if (query.length >= 2) navigate(`/search?q=${encodeURIComponent(query)}`);
  };

  return (
    <header className="sticky top-0 z-30 border-b border-line/80 bg-surface/75 backdrop-blur-xl supports-[backdrop-filter]:bg-surface/65">
      <div className="mx-auto flex h-[60px] max-w-[1320px] items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Link to="/home" className="flex items-center gap-2.5 lg:hidden">
          <BrandMark className="h-8 w-8" />
          <Wordmark compact />
        </Link>

        <form onSubmit={submit} className="ml-auto hidden w-full max-w-[420px] sm:block">
          <label className="relative block">
            <span className="sr-only">{t("nav.search", "Search")}</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted/80" />
            <input
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder={t("nav.searchPlaceholder", "Search films, books, trails, people…")}
              className="input h-9 rounded-lg border-line/80 bg-raised/50 pl-9 pr-3 text-[13px] shadow-none transition focus:bg-surface"
            />
          </label>
        </form>

        <div className="ml-auto flex items-center gap-2 sm:ml-2">
          <Link
            to="/search"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted transition hover:bg-raised hover:text-ink sm:hidden"
            aria-label={t("nav.search", "Search")}
          >
            <Search className="h-5 w-5" />
          </Link>

          <LanguageSwitcher compact className="hidden shrink-0 sm:inline-flex" />

          {user ? (
            <>
              <Link
                to="/create"
                className="btn-primary btn-sm hidden sm:inline-flex lg:hidden"
              >
                <PenSquare className="h-3.5 w-3.5" /> {t("nav.post", "Post")}
              </Link>
              {(user.role === "ADMIN" || user.role === "MODERATOR") && (
                <Link
                  to="/admin/overview"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted transition hover:bg-raised hover:text-ink lg:hidden"
                  aria-label={t("nav.admin", "Admin dashboard")}
                >
                  <Shield className="h-5 w-5" />
                </Link>
              )}
              <Link
                to="/notifications"
                className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted transition hover:bg-raised hover:text-ink"
                aria-label={`Notifications${unread.notifications ? `, ${unread.notifications} unread` : ""}`}
              >
                <Bell className="h-5 w-5" />
                {unread.notifications > 0 && (
                  <span className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-600 px-1 text-[9px] font-bold leading-none text-white">
                    {unread.notifications > 9 ? "9+" : unread.notifications}
                  </span>
                )}
              </Link>
              <Link to={`/u/${user.username}`} className="ml-1">
                <Avatar name={user.displayName} username={user.username} src={user.avatarUrl} size="sm" />
              </Link>
            </>
          ) : (
            <>
              <Link to="/login" className="btn-ghost btn-sm">
                {t("nav.signIn", "Sign in")}
              </Link>
              <Link to="/register" className="btn-primary btn-sm">
                {t("nav.join", "Join")}
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function RightRail() {
  const { data, loading } = useQuery<ExploreData>("/api/explore");
  const { data: placesData } = useQuery<PlacesResponse>("/api/places?limit=4");
  const categories = data?.categories ?? [];
  const trending = data?.trending ?? [];
  const suggested = data?.suggestedUsers ?? [];
  const places = placesData?.places ?? [];

  return (
    <aside className="sticky top-[84px] hidden h-fit w-[312px] shrink-0 space-y-4 xl:block">
      <section className="card p-4">
        <div className="mb-3 flex items-center gap-2">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
            <TrendingUp className="h-3.5 w-3.5" />
          </span>
          <h2 className="text-[13px] font-semibold text-ink">Hot in the hub</h2>
          <span lang="am" className="ml-auto font-ethiopic text-[10px] text-muted/60">
            የዕለቱ ሞቃት
          </span>
        </div>
        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((row) => (
              <div key={row} className="skeleton h-12 w-full" />
            ))}
          </div>
        ) : (
          <ol className="space-y-1">
            {trending.slice(0, 4).map((post, index) => (
              <li key={post.id}>
                <Link
                  to={postPath(post)}
                  className="flex gap-3 rounded-lg px-1.5 py-2 transition hover:bg-raised"
                >
                  <span className="mt-0.5 font-display text-lg font-semibold text-muted/40">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="min-w-0">
                    <span className="line-clamp-2 text-sm font-medium leading-5 text-ink">
                      {post.title || post.body}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-muted">
                      {post.category.name} · {timeAgo(post.createdAt)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
            {trending.length === 0 && <p className="text-sm text-muted">Nothing trending yet.</p>}
          </ol>
        )}
      </section>

      <section className="card p-4">
        <div className="mb-2 flex items-center gap-2">
          <MapPin className="h-4 w-4 text-brand-700 dark:text-brand-300" />
          <h2 className="text-sm font-semibold text-ink">Around town</h2>
          <Link
            to="/places"
            className="ml-auto text-[11px] font-semibold text-brand-700 hover:underline dark:text-brand-300"
          >
            Nearby
          </Link>
        </div>
        <div className="space-y-0.5">
          {places.map((place) => {
            const meta = KIND_META[place.kind];
            const Icon = meta.icon;
            return (
              <Link
                key={place.id}
                to={placePath(place)}
                className="flex items-center gap-2.5 rounded-xl px-1.5 py-2 transition hover:bg-raised"
              >
                <span
                  className={cn(
                    "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line bg-raised",
                    meta.iconTone,
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-ink">
                    {place.name}
                  </span>
                  <span className="block truncate text-[11px] text-muted">
                    {meta.label} · {place.city}
                  </span>
                </span>
                <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-ink">
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                  {place.rating.toFixed(1)}
                </span>
              </Link>
            );
          })}
          {places.length === 0 && (
            <p className="px-1.5 py-2 text-sm text-muted">Places are loading…</p>
          )}
        </div>
        <Link
          to="/places"
          className="mt-2 flex items-center justify-center gap-1.5 rounded-xl border border-line px-3 py-2 text-[11px] font-semibold text-ink transition hover:border-brand-500/40 hover:bg-raised"
        >
          Find what&apos;s close to you <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </section>

      <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-brand-900 p-4 text-white shadow-soft">
        <span aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(90%_90%_at_100%_0%,rgba(233,185,73,0.18),transparent_60%),radial-gradient(80%_80%_at_0%_100%,rgba(31,163,87,0.24),transparent_60%)]" />
        <span aria-hidden="true" className="tilet-strip absolute inset-y-0 right-0 w-12 opacity-20" />
        <p lang="am" className="font-ethiopic text-[11px] font-semibold text-accent-300">
          የዕለቱ ቡና
        </p>
        <h2 className="mt-1 font-display text-base font-semibold leading-snug">
          What is one small thing that made you smile today?
        </h2>
        <p className="mt-1.5 text-[11px] leading-5 text-white/60">
          A daily prompt for the community table.
        </p>
        <Link
          to="/create"
          className="relative mt-3 inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1.5 text-[11px] font-semibold text-white ring-1 ring-inset ring-white/15 transition hover:bg-white/20"
        >
          Add your answer
        </Link>
      </section>

      <section className="card p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">People to follow</h2>
          <Link to="/explore" className="text-[11px] font-semibold text-brand-700 hover:underline dark:text-brand-300">
            See all
          </Link>
        </div>
        {suggested.length === 0 && <p className="text-sm text-muted">You're following everyone already.</p>}
        {suggested.slice(0, 3).map((user) => (
          <UserRowLink
            key={user.id}
            user={user}
            subtitle={`${formatCount(user.followerCount ?? 0)} followers`}
          />
        ))}
      </section>

      <section className="card p-4">
        <h2 className="mb-3 text-sm font-semibold text-ink">Browse interests</h2>
        <div className="flex flex-wrap gap-1.5">
          {categories.map((category) => {
            const Icon = categoryIcon(category.icon);
            return (
              <Link
                key={category.id}
                to={categoryPath(category)}
                className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1.5 text-[11px] font-medium text-muted transition hover:border-brand-300 hover:text-ink"
              >
                <Icon className="h-3 w-3" style={{ color: category.color }} />
                {category.name}
              </Link>
            );
          })}
        </div>
      </section>

      <p className="px-2 text-[11px] leading-5 text-muted/70">
        <span lang="am" className="font-ethiopic text-ink/80">አዲስ ገበታ</span> · {BRAND.latin}
        <br />
        A new table, shared stories — made in Addis.
      </p>
    </aside>
  );
}

/**
 * Mobile navigation: the sidebar becomes a bottom bar with the everyday
 * destinations and a full menu sheet for everything else, so nothing that is
 * reachable on desktop is hidden on a phone.
 */
function MobileNav() {
  const user = useAuth((state) => state.user);
  const unread = useAuth((state) => state.unread);
  const logout = useAuth((state) => state.logout);
  const theme = useUI((state) => state.theme);
  const setTheme = useUI((state) => state.setTheme);
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const isModerator = user?.role === "ADMIN" || user?.role === "MODERATOR";
  const unreadTotal = unread.messages + unread.notifications;

  useEffect(() => setMenuOpen(false), [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [menuOpen]);

  const itemClass = (active: boolean) =>
    cn(
      "flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition",
      active ? "text-brand-700 dark:text-brand-300" : "text-muted",
    );

  const sheetItem = ({ isActive }: { isActive: boolean }) =>
    cn(
      "flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-[13px] font-medium transition",
      isActive
        ? "border-brand-600/30 bg-brand-50 text-brand-800 dark:bg-brand-500/10 dark:text-brand-200"
        : "border-line bg-surface text-ink hover:border-brand-300",
    );

  const sheetLinks: Array<{
    to: string;
    label: string;
    hint?: string;
    icon: typeof Home;
    badge?: number;
    tone?: string;
  }> = [
    { to: "/explore", label: t("nav.explore", "Explore"), hint: "ዳሰሳ", icon: Compass },
    { to: "/places", label: t("nav.places", "Nearby Places"), hint: "አቅራቢያ", icon: MapPin },
    { to: "/events", label: t("nav.events", "Events"), hint: "ዝግጅቶች", icon: CalendarDays },
    { to: "/meetups", label: t("nav.meetups", "Meetups"), hint: "ስብሰባዎች", icon: Users },
    { to: "/travel", label: t("nav.travel", "Let's Travel"), hint: "ጉዞ", icon: Navigation },
    { to: "/jokes", label: "Joke Time", hint: "የቀልድ ሰዓት", icon: Laugh, tone: "text-amber-500" },
    { to: "/quiz", label: t("nav.quiz", "Lets Know Ethiopia"), hint: "ኢትዮጵያን እናውቃት", icon: Award },
    { to: "/categories", label: t("nav.categories", "Categories"), hint: "ምድቦች", icon: LayoutGrid },
  ];

  if (user) {
    sheetLinks.push(
      { to: "/messages", label: t("nav.messages", "Messages"), hint: "መልዕክቶች", icon: MessageCircle, badge: unread.messages },
      { to: "/notifications", label: t("nav.notifications", "Notifications"), hint: "ማሳወቂያ", icon: Bell, badge: unread.notifications },
      { to: "/bookmarks", label: t("nav.bookmarks", "Bookmarks"), hint: "የተቀመጡ", icon: Bookmark },
      { to: `/u/${user.username}`, label: t("nav.profile", "Your profile"), icon: UserIcon },
      { to: "/settings", label: t("nav.settings", "Settings"), icon: Settings },
    );
    if (isModerator) {
      sheetLinks.push({ to: "/admin/overview", label: t("nav.admin", "Admin dashboard"), icon: Shield });
    }
  }

  const signOut = async () => {
    setMenuOpen(false);
    await logout();
    navigate("/", { replace: true });
  };

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line/80 bg-surface/90 backdrop-blur-xl lg:hidden">
        <div className="flex items-stretch px-2 pb-[env(safe-area-inset-bottom)]">
          <NavLink to="/home" className={({ isActive }) => itemClass(isActive)}>
            <Home className="h-5 w-5" />
            {t("nav.home", "Home")}
          </NavLink>
          <NavLink to="/jokes" className={({ isActive }) => itemClass(isActive)}>
            <Laugh className="h-5 w-5" />
            Jokes
          </NavLink>
          <Link
            to={user ? "/create" : "/login"}
            className="relative -mt-4 flex w-16 flex-col items-center justify-center"
            aria-label={t("nav.post", "Create a post")}
          >
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-b from-brand-600 to-brand-800 text-white shadow-[0_8px_20px_-8px_rgba(15,107,58,0.65)] ring-4 ring-canvas">
              <Plus className="h-5 w-5" />
            </span>
          </Link>
          <NavLink to={user ? "/messages" : "/login"} className={({ isActive }) => itemClass(isActive)}>
            <span className="relative">
              <MessageCircle className="h-5 w-5" />
              {unread.messages > 0 && (
                <span className="absolute -right-2 -top-1 h-3.5 min-w-[14px] rounded-full bg-rose-600 px-1 text-[8px] font-bold leading-[14px] text-white">
                  {unread.messages > 9 ? "9" : unread.messages}
                </span>
              )}
            </span>
            {t("nav.messages", "Messages")}
          </NavLink>
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className={cn(itemClass(false), "relative")}
            aria-label="Open menu"
            aria-expanded={menuOpen}
          >
            <span className="relative">
              <MenuIcon className="h-5 w-5" />
              {unreadTotal > 0 && (
                <span className="absolute -right-1.5 -top-1 h-2 w-2 rounded-full bg-rose-600" />
              )}
            </span>
            Menu
          </button>
        </div>
      </nav>

      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="presentation">
          <button
            type="button"
            className="absolute inset-0 bg-black/45 backdrop-blur-sm"
            onClick={() => setMenuOpen(false)}
            aria-label="Close menu"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
            className="absolute inset-x-0 bottom-0 max-h-[88dvh] overflow-y-auto rounded-t-2xl border-t border-line bg-surface px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 shadow-lift"
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" aria-hidden="true" />
            <div className="flex items-center justify-between px-1">
              <p className="font-display text-base font-semibold text-ink">Menu</p>
              <button
                type="button"
                className="btn-ghost btn-sm px-2"
                onClick={() => setMenuOpen(false)}
                aria-label="Close menu"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              {sheetLinks.map((item) => (
                <NavLink key={item.to} to={item.to} className={sheetItem}>
                  <item.icon className={cn("h-4 w-4 shrink-0", item.tone)} />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {item.badge ? (
                    <span className="rounded-full bg-rose-600 px-1.5 py-0.5 text-[9px] font-bold leading-none text-white">
                      {item.badge > 9 ? "9+" : item.badge}
                    </span>
                  ) : item.hint ? (
                    <span lang="am" className="font-ethiopic text-[9px] text-muted/60">
                      {item.hint}
                    </span>
                  ) : null}
                </NavLink>
              ))}
            </div>

            <div className="mt-4">
              <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
                Language
              </p>
              <LanguageSwitcher className="w-full [&>button]:w-full" />
            </div>

            <div className="mt-3 rounded-xl border border-line bg-raised/50 p-2.5">
              <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
                Appearance
              </p>
              <div className="grid grid-cols-3 gap-1.5">
                {(["light", "dark", "system"] as const).map((option) => {
                  const Icon = option === "light" ? Sun : option === "dark" ? Moon : Monitor;
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setTheme(option)}
                      className={cn(
                        "flex flex-col items-center gap-1 rounded-lg border px-2 py-2 text-[11px] font-medium capitalize transition",
                        theme === option
                          ? "border-brand-600 bg-brand-50 text-brand-800 dark:bg-brand-500/10 dark:text-brand-200"
                          : "border-line text-muted",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {option}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-3 grid gap-2">
              {user ? (
                <button type="button" className="btn-secondary" onClick={() => void signOut()}>
                  <LogOut className="h-4 w-4" /> Sign out
                </button>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Link to="/login" className="btn-secondary">
                    <LogIn className="h-4 w-4" /> Sign in
                  </Link>
                  <Link to="/register" className="btn-primary">
                    <Plus className="h-4 w-4" /> Join
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function NotificationPrompt() {
  const user = useAuth((state) => state.user);
  const pushToast = useUI((state) => state.pushToast);
  const { supported, permission } = useBrowserNotifications();
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!user || !supported || permission !== "default" || dismissed) return null;
  if (!shouldOfferBrowserNotifications()) return null;

  const enable = async () => {
    setBusy(true);
    try {
      const result = await requestBrowserNotifications();
      if (result === "granted") {
        pushToast("Browser notifications enabled.", { tone: "success" });
      } else if (result === "denied") {
        pushToast("Notifications are blocked. Allow them in your browser's site settings.", {
          tone: "error",
        });
      }
    } finally {
      setBusy(false);
    }
  };

  const dismiss = () => {
    snoozeBrowserNotificationPrompt();
    setDismissed(true);
  };

  return (
    <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-brand-200/80 bg-brand-50/70 p-3.5 shadow-sm sm:flex-row sm:items-center sm:p-4 dark:border-brand-500/20 dark:bg-brand-500/5">
      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-brand-700 shadow-sm dark:bg-brand-500/15 dark:text-brand-300">
        <BellRing className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink">Never miss a message or a new event</p>
        <p className="mt-0.5 text-xs leading-5 text-muted">
          Allow browser notifications for chat replies, newly published events and service
          announcements — even when the tab is closed. You can pause them any time in Settings.
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button type="button" onClick={() => void enable()} className="btn-primary btn-sm" disabled={busy}>
          {busy ? <Spinner className="h-3.5 w-3.5" /> : <BellRing className="h-3.5 w-3.5" />} Allow
          notifications
        </button>
        <button type="button" onClick={dismiss} className="btn-ghost btn-sm">
          Not now
        </button>
      </div>
    </div>
  );
}

export function AppLayout() {
  const location = useLocation();
  const user = useAuth((state) => state.user);
  useRealtime();
  const isMessages = location.pathname.startsWith("/messages");

  return (
    <div className="min-h-screen">
      <Sidebar />
      <div className="lg:pl-[272px]">
        <TopBar />        <div
          className={cn(
            "mx-auto flex w-full gap-8 px-4 pb-24 pt-6 sm:px-6 lg:px-8 xl:gap-10",
            isMessages ? "max-w-[1440px]" : "max-w-[1260px]",
          )}
        >
          <main className={cn("min-w-0 flex-1", isMessages && "h-[calc(100dvh-7.5rem)]")}>
            <NotificationPrompt />
            <Outlet />
          </main>
          {!isMessages && <RightRail />}
        </div>
      </div>
      <MobileNav />
      {!user && (
        <div className="fixed bottom-16 left-1/2 z-30 -translate-x-1/2 lg:hidden">
          <Link
            to="/register"
            className="rounded-full bg-brand-800 px-4 py-2 text-xs font-semibold text-white shadow-lift"
          >
            Join the table · እንኳን ደህና መጡ
          </Link>
        </div>
      )}
    </div>
  );
}

export { ThemeManager };
