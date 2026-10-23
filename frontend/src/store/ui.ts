import { create } from "zustand";
import type { CalendarMode } from "../lib/ethiopian";

export type Theme = "light" | "dark" | "system";

export interface Toast {
  id: string;
  message: string;
  tone: "default" | "success" | "error";
  href?: string;
}

interface UIState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  calendar: CalendarMode;
  setCalendar: (calendar: CalendarMode) => void;
  toasts: Toast[];
  pushToast: (message: string, options?: { tone?: Toast["tone"]; href?: string }) => void;
  dismissToast: (id: string) => void;
  presence: Record<string, boolean>;
  setPresence: (userId: string, online: boolean) => void;
  mergePresence: (entries: Array<{ userId: string; online: boolean }>) => void;
}

const storedTheme = (localStorage.getItem("ch_theme") as Theme | null) ?? "light";
const storedCalendar =
  (localStorage.getItem("ch_calendar") as CalendarMode | null) ?? "GREGORIAN";

export const useUI = create<UIState>((set, get) => ({
  theme: storedTheme,

  setTheme: (theme) => {
    localStorage.setItem("ch_theme", theme);
    set({ theme });
  },

  calendar: storedCalendar,

  setCalendar: (calendar) => {
    localStorage.setItem("ch_calendar", calendar);
    set({ calendar });
  },

  toasts: [],

  pushToast: (message, options) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const toast: Toast = { id, message, tone: options?.tone ?? "default", href: options?.href };
    set((state) => ({ toasts: [...state.toasts.slice(-3), toast] }));
    window.setTimeout(() => get().dismissToast(id), 4200);
  },

  dismissToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),

  presence: {},

  setPresence: (userId, online) =>
    set((state) => ({ presence: { ...state.presence, [userId]: online } })),

  mergePresence: (entries) =>
    set((state) => {
      const next = { ...state.presence };
      for (const entry of entries) next[entry.userId] = entry.online;
      return { presence: next };
    }),
}));
