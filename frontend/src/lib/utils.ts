import clsx, { type ClassValue } from "clsx";
import {
  BookOpen,
  Clapperboard,
  Coffee,
  Compass,
  Dumbbell,
  Flame,
  Heart,
  MessageCircle,
  Mountain,
  Music,
  Palette,
  Plane,
  Sparkles,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { AppNotification, Category, Difficulty } from "../types";
import { formatEthiopianDate, formatEthiopianMonthYear, type CalendarMode } from "./ethiopian";
import { useUI } from "../store/ui";

/**
 * The calendar preference is read from the UI store so every date on screen
 * follows the member's choice. App re-renders when the preference changes, so
 * plain calls to these helpers update without threading a prop everywhere.
 */
function preferredCalendar(fallback: CalendarMode = "GREGORIAN"): CalendarMode {
  return useUI.getState().calendar ?? fallback;
}

export function cn(...values: ClassValue[]): string {
  return clsx(values);
}

export function timeAgo(value: string | Date, calendar: CalendarMode = preferredCalendar()): string {
  const date = typeof value === "string" ? new Date(value) : value;
  const seconds = Math.max(1, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w`;
  const gregorian = date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  if (calendar === "ETHIOPIAN") return `${formatEthiopianDate(date)} · ${gregorian}`;
  return gregorian;
}

/** Gregorian by default; with the Ethiopian calendar on, both are shown. */
export function formatDate(value: string | Date, calendar: CalendarMode = preferredCalendar()): string {
  const date = typeof value === "string" ? new Date(value) : value;
  const gregorian = date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  if (calendar === "ETHIOPIAN") return `${formatEthiopianDate(date)} · ${gregorian}`;
  return gregorian;
}

export function formatDateTime(value: string | Date, calendar: CalendarMode = preferredCalendar()): string {
  const date = typeof value === "string" ? new Date(value) : value;
  const gregorian = date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  if (calendar === "ETHIOPIAN") return `${formatEthiopianDate(date)} · ${gregorian}`;
  return gregorian;
}

export function monthYear(value: string | Date, calendar: CalendarMode = preferredCalendar()): string {
  const date = typeof value === "string" ? new Date(value) : value;
  const gregorian = date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  if (calendar === "ETHIOPIAN") return `${formatEthiopianMonthYear(date)} · ${gregorian}`;
  return gregorian;
}

export function initials(name?: string | null): string {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function formatCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}m`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(value % 1_000 === 0 ? 0 : 1)}k`;
  return String(value);
}

export function formatDuration(ms?: number | null): string {
  if (!ms || ms <= 0) return "0:00";
  const total = Math.round(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function pluralize(count: number, singular: string, plural?: string): string {
  return count === 1 ? singular : plural ?? `${singular}s`;
}

const iconMap: Record<string, LucideIcon> = {
  Coffee,
  Trophy,
  Sparkles,
  Clapperboard,
  BookOpen,
  Mountain,
  MessageCircle,
  Heart,
  Flame,
  Compass,
  Users,
  Music,
  Dumbbell,
  Palette,
  Plane,
};

export function categoryIcon(name?: string): LucideIcon {
  return (name && iconMap[name]) || MessageCircle;
}

export function categoryAccent(category?: Category | null): string {
  return category?.color || "#0f6b3a";
}

export const difficultyStyles: Record<Difficulty, string> = {
  EASY: "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300",
  MODERATE: "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300",
  HARD: "bg-orange-50 text-orange-700 ring-orange-600/20 dark:bg-orange-500/10 dark:text-orange-300",
  EXPERT: "bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-500/10 dark:text-rose-300",
};

export function notificationLink(notification: AppNotification): string {
  // Leave-by reminders and other newer notifications carry their own target.
  if (notification.url) return notification.url;
  if (notification.type === "FOLLOW" && notification.actor) return `/u/${notification.actor.username}`;
  if (notification.type === "MESSAGE" && notification.conversationId) {
    return `/messages/${notification.conversationId}`;
  }
  if (notification.postId) return `/posts/${notification.postId}`;
  return "/notifications";
}

export function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1).trimEnd()}…`;
}

export function categoryPath(category: Pick<Category, "slug" | "kind">): string {
  if (category.kind === "MOVIE") return "/cinema";
  if (category.kind === "BOOK") return "/books";
  if (category.kind === "HIKE") return "/hiking";
  return `/c/${category.slug}`;
}

export function postPath(post: { id: string; category: Category }): string {
  if (post.category.kind === "MOVIE") return `/cinema/${post.id}`;
  if (post.category.kind === "BOOK") return `/books/${post.id}`;
  if (post.category.kind === "HIKE") return `/hiking/${post.id}`;
  return `/posts/${post.id}`;
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function isVideoUrl(url: string): boolean {
  return /youtube\.com|youtu\.be|vimeo\.com/i.test(url);
}
