export type LocationBlock =
  /** Phones only expose GPS on HTTPS; a plain-HTTP origin can never ask. */
  | "insecure"
  | "unsupported";

export type LocationFailure = "denied" | "timeout" | "unavailable";

export interface Coords {
  lat: number;
  lng: number;
}

/** Why the device cannot answer at all, or null when it can be asked. */
export function locationBlock(): LocationBlock | null {
  if (typeof window === "undefined") return null;
  if (!window.isSecureContext) return "insecure";
  if (!("geolocation" in navigator)) return "unsupported";
  return null;
}

export function locationFailure(error: GeolocationPositionError): LocationFailure {
  if (error.code === error.PERMISSION_DENIED) return "denied";
  if (error.code === error.TIMEOUT) return "timeout";
  return "unavailable";
}

/**
 * getCurrentPosition has no callback at all while the permission prompt is
 * still open on some browsers, and its own timeout only starts once permission
 * is answered. The local timer is what actually bounds the wait.
 */
function ask(options: PositionOptions, budgetMs: number): Promise<Coords> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (outcome: () => void) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      outcome();
    };
    const timer = window.setTimeout(() => finish(() => reject("timeout")), budgetMs);

    navigator.geolocation.getCurrentPosition(
      (position) =>
        finish(() => resolve({ lat: position.coords.latitude, lng: position.coords.longitude })),
      (error) => finish(() => reject(locationFailure(error))),
      options,
    );
  });
}

/**
 * A first fix on a phone can take much longer than the browser's default eight
 * seconds, especially indoors. Ask once for a fresh position, then accept a
 * cached one before giving up for good.
 */
export function requestPosition(): Promise<Coords> {
  return ask({ enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 }, 13000).catch(
    (failure) => {
      if (failure !== "timeout") throw failure;
      return ask({ enableHighAccuracy: false, timeout: 6000, maximumAge: 10 * 60 * 1000 }, 7000);
    },
  );
}

/** The sentence shown when the device never got as far as a fix. */
export function locationMessage(
  failure: LocationFailure | LocationBlock,
  fallback = "We couldn't reach your location.",
): string {
  switch (failure) {
    case "insecure":
      return "Phones only share GPS over HTTPS. Pick your area and we'll sort by distance from there.";
    case "unsupported":
      return "This browser can't share a location. Pick your area instead.";
    case "denied":
      return "Location is blocked for this site. Allow it in your browser settings, or pick your area.";
    case "timeout":
      return "Your phone took too long to find a fix. Try again outdoors, or pick your area.";
    default:
      return `${fallback} Pick your area and we'll sort from there.`;
  }
}
