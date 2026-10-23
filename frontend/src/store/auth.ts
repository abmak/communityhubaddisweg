import { create } from "zustand";
import { api } from "../lib/api";
import type { UnreadCounts, User } from "../types";

interface AuthResponse {
  user: User;
  unread: UnreadCounts;
}

interface SessionResponse {
  user: User | null;
  unread: UnreadCounts;
}

interface RegisterPayload {
  email: string;
  username: string;
  displayName: string;
  password: string;
  phone?: string;
}

interface AuthState {
  user: User | null;
  unread: UnreadCounts;
  status: "idle" | "loading" | "ready";
  bootstrap: () => Promise<void>;
  login: (identifier: string, password: string) => Promise<User>;
  register: (payload: RegisterPayload) => Promise<User>;
  logout: () => Promise<void>;
  setUser: (user: User | null) => void;
  setUnread: (partial: Partial<UnreadCounts>) => void;
  refreshUnread: () => Promise<void>;
  refreshMe: () => Promise<void>;
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  unread: { notifications: 0, messages: 0 },
  status: "idle",

  bootstrap: async () => {
    if (get().status === "loading" || get().status === "ready") return;
    set({ status: "loading" });
    try {
      const response = await api.get<SessionResponse>("/api/auth/me");
      set({
        user: response.data.user,
        unread: response.data.unread,
        status: "ready",
      });
    } catch {
      set({ user: null, status: "ready" });
    }
  },

  login: async (identifier, password) => {
    const response = await api.post<AuthResponse>("/api/auth/login", { identifier, password });
    set({ user: response.data.user, unread: response.data.unread, status: "ready" });
    return response.data.user;
  },

  register: async (payload) => {
    const response = await api.post<AuthResponse>("/api/auth/register", payload);
    set({ user: response.data.user, unread: response.data.unread, status: "ready" });
    return response.data.user;
  },

  logout: async () => {
    try {
      await api.post("/api/auth/logout");
    } finally {
      set({ user: null, unread: { notifications: 0, messages: 0 }, status: "ready" });
    }
  },

  setUser: (user) => set({ user }),

  setUnread: (partial) =>
    set((state) => ({ unread: { ...state.unread, ...partial } })),

  refreshUnread: async () => {
    if (!get().user) return;
    try {
      const [notifications, messages] = await Promise.all([
        api.get<{ count: number }>("/api/notifications/unread-count"),
        api.get<{ count: number }>("/api/conversations/unread-count"),
      ]);
      set({
        unread: {
          notifications: notifications.data.count,
          messages: messages.data.count,
        },
      });
    } catch {
      // Counts refresh on the next navigation.
    }
  },

  refreshMe: async () => {
    if (!get().user) return;
    try {
      const response = await api.get<SessionResponse>("/api/auth/me");
      if (response.data.user) {
        set({ user: response.data.user, unread: response.data.unread });
      }
    } catch {
      // ignore
    }
  },
}));
