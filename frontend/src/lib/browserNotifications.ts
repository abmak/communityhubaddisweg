import { useSyncExternalStore } from "react";

/**
 * Browser notifications for the things a member does not want to miss: a new
 * chat message, a freshly published event and service announcements.
 *
 * Permission is requested only from a user gesture (the shell prompt or the
 * Settings toggle). Delivery works while Addis Gebeta is open in a tab; a
 * closed tab would need Web Push with VAPID keys, which this app does not have
 * yet.
 */

const ENABLED_KEY = "ch_browser_notifications";
const PROMPT_KEY = "ch_browser_notifications_prompt_at";
const PROMPT_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

export interface BrowserNotificationSnapshot {
  supported: boolean;
  permission: NotificationPermission;
  enabled: boolean;
}

export interface BrowserNotificationInput {
  title: string;
  body: string;
  /** Same-origin path to open when the notification is clicked. */
  url?: string;
  /** Collapses repeated notifications for the same conversation or event. */
  tag?: string;
  /** Show even while the tab is focused, used by the Settings test button. */
  force?: boolean;
}

function readSnapshot(): BrowserNotificationSnapshot {
  const supported = typeof window !== "undefined" && "Notification" in window;
  const permission: NotificationPermission = supported ? window.Notification.permission : "denied";
  const stored = typeof window !== "undefined" ? localStorage.getItem(ENABLED_KEY) : null;

  return {
    supported,
    permission,
    // Granting permission is the opt-in. A stored "off" is an explicit pause.
    enabled: permission === "granted" && stored !== "off",
  };
}

let snapshot = readSnapshot();
const listeners = new Set<() => void>();

function refresh(): void {
  snapshot = readSnapshot();
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): BrowserNotificationSnapshot {
  return snapshot;
}

/** React view of the current permission and preference. */
export function useBrowserNotifications(): BrowserNotificationSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

if (typeof window !== "undefined") {
  // A member may block or unblock notifications in the browser's site
  // settings without reloading the tab.
  window.addEventListener("focus", refresh);
}

export async function requestBrowserNotifications(): Promise<NotificationPermission> {
  if (!snapshot.supported) return "denied";

  try {
    // Must be called directly from a click handler; awaiting first would lose
    // the user gesture on Safari and Firefox.
    const permission = await window.Notification.requestPermission();
    if (permission === "granted") localStorage.setItem(ENABLED_KEY, "on");
    refresh();
    return permission;
  } catch {
    refresh();
    return snapshot.permission;
  }
}

export function pauseBrowserNotifications(): void {
  localStorage.setItem(ENABLED_KEY, "off");
  refresh();
}

export function resumeBrowserNotifications(): NotificationPermission {
  if (snapshot.permission !== "granted") return snapshot.permission;
  localStorage.setItem(ENABLED_KEY, "on");
  refresh();
  return "granted";
}

/** True while the shell prompt has not been dismissed in the last week. */
export function shouldOfferBrowserNotifications(): boolean {
  if (!snapshot.supported || snapshot.permission !== "default") return false;
  const last = Number(localStorage.getItem(PROMPT_KEY) ?? 0);
  return !Number.isFinite(last) || Date.now() - last > PROMPT_COOLDOWN_MS;
}

export function snoozeBrowserNotificationPrompt(): void {
  localStorage.setItem(PROMPT_KEY, String(Date.now()));
}

let registrationPromise: Promise<ServiceWorkerRegistration | null> | null = null;

/** Registers the notification worker once, after the app has loaded. */
export function registerNotificationWorker(): void {
  if (registrationPromise) return;
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    registrationPromise = Promise.resolve(null);
    return;
  }

  registrationPromise = navigator.serviceWorker.register("/sw.js").catch(() => null);
}

async function activeRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;

  registerNotificationWorker();
  if (!registrationPromise) return null;

  const registered = await registrationPromise;
  if (!registered) return null;

  // `register()` can resolve while the worker is still installing. Waiting on
  // `ready` would fix that, but a failed worker would then block every
  // notification forever; the constructor fallback covers the first moments.
  return registered.active ? registered : null;
}

/**
 * Shows a notification if the member has allowed and not paused them. Returns
 * false when nothing was displayed, so Settings can report a blocked test.
 */
export async function showBrowserNotification(input: BrowserNotificationInput): Promise<boolean> {
  const current = readSnapshot();
  if (!current.supported || current.permission !== "granted" || !current.enabled) {
    return false;
  }

  // In-app toasts already cover the focused case; only interrupt when the tab
  // is in the background or another window has focus.
  if (!input.force && document.visibilityState === "visible" && document.hasFocus()) {
    return false;
  }

  const options: NotificationOptions = {
    body: input.body,
    icon: "/brand-mark.svg",
    badge: "/brand-mark.svg",
    tag: input.tag,
    data: { url: input.url ?? "/home" },
  };

  const registration = await activeRegistration();
  if (registration) {
    try {
      await registration.showNotification(input.title, options);
      return true;
    } catch {
      // Fall through to the constructor below.
    }
  }

  try {
    const notification = new window.Notification(input.title, options);
    notification.onclick = () => {
      window.focus();
      if (input.url) window.location.assign(input.url);
      notification.close();
    };
    return true;
  } catch {
    return false;
  }
}
