/*
 * Notification-only service worker.
 *
 * It deliberately has no fetch handler: the app keeps its normal network
 * behaviour and this worker exists so notifications can be shown on browsers
 * (notably Android Chrome) that refuse `new Notification(...)`, and so a click
 * can focus the existing tab instead of opening a duplicate one.
 */
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let incoming = {};
  try {
    incoming = event.data ? event.data.json() : {};
  } catch {
    incoming = {};
  }

  const payload = {
    title: typeof incoming.title === "string" ? incoming.title : "Addis Gebeta",
    body:
      typeof incoming.body === "string"
        ? incoming.body
        : "You have a new notification.",
    url: typeof incoming.url === "string" ? incoming.url : "/home",
    tag: typeof incoming.tag === "string" ? incoming.tag : undefined,
    kind: typeof incoming.kind === "string" ? incoming.kind : undefined,
  };

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      // A focused tab already gives the member context; hand it the payload so
      // the app can show its own toast instead of a second OS notification.
      const focused = windows.find(
        (client) => client.focused && client.visibilityState === "visible",
      );
      if (focused) {
        try {
          focused.postMessage({ type: "push:notification", payload });
          return;
        } catch {
          // Fall through to the OS notification below.
        }
      }

      await self.registration.showNotification(payload.title, {
        body: payload.body,
        icon: "/brand-mark.svg",
        badge: "/brand-mark.svg",
        tag: payload.tag,
        data: { url: payload.url },
      });
    })(),
  );
});

// The push service can rotate an endpoint. Open tabs ask the API for the
// current VAPID key and rebuild the subscription; a closed tab recovers on its
// next visit, when the app re-syncs.
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of windows) {
        client.postMessage({ type: "push:resubscribe" });
      }
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const target = (event.notification.data && event.notification.data.url) || "/home";
  let url;
  try {
    url = new URL(target, self.location.origin).href;
  } catch {
    url = new URL("/home", self.location.origin).href;
  }

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const existing = windows.find((client) => {
        try {
          return new URL(client.url).origin === self.location.origin;
        } catch {
          return false;
        }
      });

      if (existing) {
        await existing.focus();
        if ("navigate" in existing) {
          try {
            await existing.navigate(url);
          } catch {
            // Some browsers only allow navigation on a controlled client.
          }
        }
        return;
      }

      await self.clients.openWindow(url);
    })(),
  );
});
