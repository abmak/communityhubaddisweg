import { useSyncExternalStore } from "react";

/**
 * Locally kept shortlist of places. A saved place is a personal bookmark, not a
 * social object, so it lives in the browser instead of the API.
 */
const STORAGE_KEY = "maed.saved-places";

function read(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((slug): slug is string => typeof slug === "string") : [];
  } catch {
    return [];
  }
}

let slugs = read();
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function persist() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(slugs));
  } catch {
    // A full or blocked storage should never break the page.
  }
}

/** Keep several open tabs in sync. */
if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY) return;
    slugs = read();
    emit();
  });
}

export function toggleSavedPlace(slug: string): boolean {
  const saved = slugs.includes(slug);
  slugs = saved ? slugs.filter((entry) => entry !== slug) : [slug, ...slugs];
  persist();
  emit();
  return !saved;
}

export function isPlaceSaved(slug: string): boolean {
  return slugs.includes(slug);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSavedPlaces() {
  const saved = useSyncExternalStore(subscribe, () => slugs, () => []);
  return {
    saved,
    count: saved.length,
    isSaved: (slug: string) => saved.includes(slug),
    toggle: toggleSavedPlace,
  };
}
