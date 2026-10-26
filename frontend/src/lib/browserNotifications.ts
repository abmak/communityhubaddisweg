import { useSyncExternalStore } from "react";
import { api } from "./api";

/**
 * Browser notifications for the things a member does not want to miss: a new
 * chat message, a freshly published event and service announcements.
 *
 * Permission is requested only from a user gesture (the shell prompt or the
 * Settings toggle). Once granted, the browser is subscribed to Web Push, so a
 * notification still arrives when Addis Gebeta is fully closed. The service
 * worker decides whether to show an OS notification or hand the payload to a
 * focused tab for an in-app toast.
 */

const ENABLED_KEY = "ch_browser_notifications";
const PROMPT_KEY = "ch_browser_notifications_prompt_at";
const PROMPT_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
const WORKER_READY_TIMEOUT_MS = 8000;

export type BrowserPushKind = "message" | "event" | "announcement";

export interface BrowserPushPayload {
  title: string;
  body: string;
  url: string;
  tag?: string;
  kind?: BrowserPushKind;
}

export interface BrowserNotificationSnapshot {
  supported: boolean;
  pushSupported: boolean;
  permission: NotificationPermission;
  enabled: boolean;
  pushActive: boolean;
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

let pushActive = false;

function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

function readSnapshot(): BrowserNotificationSnapshot {
  const supported = typeof window !== "undefined" && "Notification" in window;
  const permission: NotificationPermission = supported
    ? window.Notification.permission
    : "denied";
  const stored = typeof window !== "undefined" ? localStorage.getItem(ENABLED_KEY) : null;

  return {
    supported,
    pushSupported: pushSupported(),
    permission,
    // Granting permission is the opt-in. A stored "off" is an explicit pause.
    enabled: permission === "granted" && stored !== "off",
    pushActive: pushActive && permission === "granted",
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

/** React view of the current permission, preference and push state. */
export function useBrowserNotifications(): BrowserNotificationSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

if (typeof window !== "undefined") {
  // A member may block or unblock notifications in the browser's site
  // settings without reloading the tab.
  window.addEventListener("focus", refresh);
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let index = 0; index < raw.length; index += 1) {
    output[index] = raw.charCodeAt(index);
  }
  return output;
}

function base64UrlFromBuffer(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return window
    .btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function sameApplicationServerKey(
  subscription: PushSubscription,
  publicKey: string,
): boolean {
  const current = subscription.options.applicationServerKey;
  return current ? base64UrlFromBuffer(current) === publicKey : false;
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

async function pushRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!pushSupported()) return null;
  registerNotificationWorker();

  const timeout = new Promise<null>((resolve) =>
    window.setTimeout(() => resolve(null), WORKER_READY_TIMEOUT_MS),
  );
  return Promise.race([
    navigator.serviceWorker.ready.catch(() => null),
    timeout,
  ]);
}

export async function requestBrowserNotifications(): Promise<NotificationPermission> {
  if (!snapshot.supported) return "denied";

  try {
    // Must be called directly from a click handler; awaiting first would lose
    // the user gesture on Safari and Firefox.
    const permission = await window.Notification.requestPermission();
    if (permission === "granted") {
      localStorage.setItem(ENABLED_KEY, "on");
      refresh();
      await subscribeToPush();
    } else {
      refresh();
    }
    return permission;
  } catch {
    refresh();
    return snapshot.permission;
  }
}

export function pauseBrowserNotifications(): void {
  localStorage.setItem(ENABLED_KEY, "off");
  pushActive = false;
  refresh();
  // Removing the server subscription is what stops a closed tab from waking.
  void unsubscribeFromPush({ removeServer: true });
}

export function resumeBrowserNotifications(): NotificationPermission {
  if (snapshot.permission !== "granted") return snapshot.permission;
  localStorage.setItem(ENABLED_KEY, "on");
  refresh();
  void subscribeToPush();
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

export function isPushActive(): boolean {
  return readSnapshot().pushActive;
}

/**
 * Creates or refreshes the browser's push subscription and stores it on the
 * server. Safe to call on every signed-in app load: an existing subscription
 * is reused and upserted, so a lost server row is repaired automatically.
 */
export async function subscribeToPush(): Promise<boolean> {
  if (!pushSupported()) return false;
  if (snapshot.permission !== "granted" || localStorage.getItem(ENABLED_KEY) === "off") {
    return false;
  }

  try {
    const registration = await pushRegistration();
    if (!registration) return false;

    const response = await api.get<{ publicKey: string }>("/api/push/public-key");
    const publicKey = response.data.publicKey;
    if (!publicKey) return false;

    let subscription = await registration.pushManager.getSubscription();
    if (subscription && !sameApplicationServerKey(subscription, publicKey)) {
      // The server's VAPID pair changed (for example after a database reset).
      // A subscription made with the old key can never be delivered.
      await subscription.unsubscribe();
      subscription = null;
    }

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    }

    // The member may have paused while the permission dialog was open.
    if (localStorage.getItem(ENABLED_KEY) === "off") {
      await subscription.unsubscribe();
      return false;
    }

    const json = subscription.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) {
      throw new Error("The browser returned an incomplete push subscription");
    }

    await api.post("/api/push/subscribe", {
      endpoint: json.endpoint,
      keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
    });
    pushActive = true;
    refresh();
    return true;
  } catch (error) {
    console.warn("Could not enable Web Push notifications", error);
    pushActive = false;
    refresh();
    return false;
  }
}

/**
 * Removes this browser's push subscription. `removeServer` is false only when
 * the API is already unreachable, such as after a session has been cleared.
 */
export async function unsubscribeFromPush(
  options: { removeServer?: boolean } = {},
): Promise<void> {
  const { removeServer = true } = options;
  pushActive = false;
  refresh();

  if (!pushSupported()) return;

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return;

    const endpoint = subscription.endpoint;
    // Drop the local subscription first. If the member resumes while the
    // server DELETE is in flight, the browser creates a different endpoint,
    // so the older DELETE cannot remove the new row.
    try {
      await subscription.unsubscribe();
    } catch (error) {
      console.warn("Could not unsubscribe this browser locally", error);
    }
    if (removeServer) {
      try {
        await api.delete("/api/push/subscribe", { data: { endpoint } });
      } catch {
        // The browser is already unsubscribed; the server will prune the dead
        // endpoint when the next send returns 404/410.
      }
    }
  } catch (error) {
    console.warn("Could not remove the Web Push subscription", error);
  }
}

/** Keeps the server subscription aligned with the member's preference. */
export async function syncPushSubscription(): Promise<void> {
  const current = readSnapshot();
  if (!current.supported) return;
  if (current.permission !== "granted") {
    // Revoking permission in the browser leaves the server row undeliverable.
    if (current.permission === "denied") {
      await unsubscribeFromPush({ removeServer: true });
    }
    return;
  }

  if (!current.enabled) {
    await unsubscribeFromPush({ removeServer: true });
    return;
  }
  await subscribeToPush();
}

/**
 * Receives payloads the service worker hands to a focused tab, plus the
 * resubscribe request it sends after the push service rotates an endpoint.
 */
export function listenForPushMessages(
  handler: (payload: BrowserPushPayload) => void,
): () => void {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return () => undefined;
  }

  const listener = (event: MessageEvent) => {
    const data = event.data as
      | { type?: unknown; payload?: Partial<BrowserPushPayload> }
      | undefined;
    if (!data || typeof data.type !== "string") return;

    if (
      data.type === "push:notification" &&
      data.payload &&
      typeof data.payload.title === "string" &&
      typeof data.payload.body === "string" &&
      typeof data.payload.url === "string"
    ) {
      handler(data.payload as BrowserPushPayload);
      return;
    }

    if (data.type === "push:resubscribe") {
      void subscribeToPush();
    }
  };

  navigator.serviceWorker.addEventListener("message", listener);
  return () => navigator.serviceWorker.removeEventListener("message", listener);
}

/**
 * Shows a notification if the member has allowed and not paused them. Returns
 * false when nothing was displayed, so Settings can report a blocked test.
 *
 * When Web Push is active the service worker owns delivery, including the
 * focused-tab toast, so this page-side fallback stays out of the way.
 */
export async function showBrowserNotification(
  input: BrowserNotificationInput,
): Promise<boolean> {
  const current = readSnapshot();
  if (!current.supported || current.permission !== "granted" || !current.enabled) {
    return false;
  }
  if (!input.force && current.pushActive) return false;

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
