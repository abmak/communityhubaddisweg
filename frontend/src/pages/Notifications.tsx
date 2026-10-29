import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlarmClock,
  AtSign,
  Bell,
  BellOff,
  BookOpen,
  CheckCheck,
  Clapperboard,
  Heart,
  MessageCircle,
  MessageSquare,
  Megaphone,
  UserPlus,
} from "lucide-react";
import type { AppNotification } from "../types";
import { useQuery } from "../hooks/useApi";
import { useAuth } from "../store/auth";
import { useUI } from "../store/ui";
import { api, apiError } from "../lib/api";
import { notificationLink, timeAgo } from "../lib/utils";
import { tt } from "../lib/i18n";
import { Avatar, EmptyState, PageLoader } from "../components/ui";
import { getSocket } from "../lib/socket";

interface NotificationsResponse {
  notifications: AppNotification[];
  unreadCount: number;
  nextCursor: string | null;
}

const ICONS: Record<AppNotification["type"], typeof Heart> = {
  POST_LIKE: Heart,
  COMMENT: MessageCircle,
  REPLY: MessageSquare,
  COMMENT_LIKE: Heart,
  FOLLOW: UserPlus,
  MESSAGE: AtSign,
  ANNOUNCEMENT: Megaphone,
  MOVIE_REVIEW: Clapperboard,
  BOOK_REVIEW: BookOpen,
  EVENT_REMINDER: AlarmClock,
};

export function NotificationsPage() {
  const navigate = useNavigate();
  const setUnread = useAuth((state) => state.setUnread);
  const pushToast = useUI((state) => state.pushToast);
  const { data, loading, error, setData } = useQuery<NotificationsResponse>(
    "/api/notifications?limit=30",
  );
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [marking, setMarking] = useState(false);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const onNew = (notification: AppNotification) => {
      setData((current) =>
        current
          ? {
              ...current,
              notifications: [notification, ...current.notifications.filter((item) => item.id !== notification.id)],
              unreadCount: current.unreadCount + (notification.readAt ? 0 : 1),
            }
          : current,
      );
    };
    socket.on("notification:new", onNew);
    return () => {
      socket.off("notification:new", onNew);
    };
  }, [setData]);

  const unreadCount = data?.unreadCount ?? 0;
  const notifications = data?.notifications ?? [];

  const visible = useMemo(
    () => (filter === "unread" ? notifications.filter((item) => !item.readAt) : notifications),
    [notifications, filter],
  );

  const markAll = async () => {
    setMarking(true);
    try {
      await api.post("/api/notifications/read-all");
      const now = new Date().toISOString();
      setData((current) =>
        current
          ? {
              ...current,
              notifications: current.notifications.map((item) => ({ ...item, readAt: item.readAt ?? now })),
              unreadCount: 0,
            }
          : current,
      );
      setUnread({ notifications: 0 });
    } catch (err) {
      pushToast(apiError(err), { tone: "error" });
    } finally {
      setMarking(false);
    }
  };

  const open = async (notification: AppNotification) => {
    if (!notification.readAt) {
      try {
        const response = await api.post<{ unreadCount: number }>(`/api/notifications/${notification.id}/read`);
        setData((current) =>
          current
            ? {
                ...current,
                notifications: current.notifications.map((item) =>
                  item.id === notification.id ? { ...item, readAt: new Date().toISOString() } : item,
                ),
                unreadCount: response.data.unreadCount,
              }
            : current,
        );
        setUnread({ notifications: response.data.unreadCount });
      } catch {
        // Navigation matters more than the read receipt.
      }
    }
    navigate(notificationLink(notification));
  };

  if (loading) return <PageLoader label="Loading notifications…" />;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-700 dark:text-brand-300">
            <Bell className="h-3.5 w-3.5" /> Notifications
            <span lang="am" className="font-ethiopic normal-case tracking-normal text-muted">
              ማሳወቂያ
            </span>
          </p>
          <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight text-ink">
            Everything that happened while you were away.
          </h1>
          <p className="mt-1 text-sm text-muted">
            {unreadCount > 0 ? `${unreadCount} ${tt("unread")}` : tt("You're all caught up.")}
          </p>
        </div>
        {unreadCount > 0 && (
          <button type="button" onClick={markAll} className="btn-secondary btn-sm" disabled={marking}>
            <CheckCheck className="h-3.5 w-3.5" /> Mark all read
          </button>
        )}
      </header>

      <div className="flex gap-1 border-b border-line">
        {(["all", "unread"] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setFilter(option)}
            className={
              filter === option
                ? "relative px-3 py-2.5 text-sm font-semibold capitalize text-ink after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-brand-700"
                : "px-3 py-2.5 text-sm font-medium capitalize text-muted transition hover:text-ink"
            }
          >
            {tt(option === "all" ? "All" : "Unread")}
            {option === "unread" && unreadCount > 0 && (
              <span className="ml-1.5 rounded-full bg-brand-700 px-1.5 py-0.5 text-[9px] font-bold text-white">
                {unreadCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {error ? (
        <div className="card p-6 text-center text-sm text-rose-600">{error}</div>
      ) : visible.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={filter === "unread" ? BellOff : Bell}
            title={filter === "unread" ? "No unread notifications" : "Nothing here yet"}
            description={
              filter === "unread"
                ? "When someone likes, replies or follows, you'll see it here."
                : "Join a conversation and the community will start finding you."
            }
            action={
              <Link to="/home" className="btn-primary btn-sm">
                Back to the feed
              </Link>
            }
          />
        </div>
      ) : (
        <div className="card divide-y divide-line overflow-hidden">
          {visible.map((notification) => {
            const Icon = ICONS[notification.type] ?? Bell;
            return (
              <button
                key={notification.id}
                type="button"
                onClick={() => open(notification)}
                className={`flex w-full items-start gap-3 px-4 py-3.5 text-left transition hover:bg-raised/60 ${
                  notification.readAt ? "" : "bg-brand-50/40 dark:bg-brand-500/5"
                }`}
              >
                <span className="relative mt-0.5">
                  {notification.actor ? (
                    <Avatar
                      name={notification.actor.displayName}
                      username={notification.actor.username}
                      src={notification.actor.avatarUrl}
                      size="md"
                    />
                  ) : (
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                      <Icon className="h-5 w-5" />
                    </span>
                  )}
                  <span className="absolute -bottom-0.5 -right-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full border-2 border-surface bg-surface text-brand-700 shadow-sm dark:text-brand-300">
                    <Icon className="h-3 w-3" />
                  </span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="text-sm leading-6 text-ink">
                      {notification.actor && (
                        <strong className="font-semibold">{notification.actor.displayName} </strong>
                      )}
                      {notification.body}
                    </span>
                    {!notification.readAt && (
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-600" aria-label="Unread" />
                    )}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-muted">
                    {notification.type.replaceAll("_", " ").toLowerCase()} · {timeAgo(notification.createdAt)}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
