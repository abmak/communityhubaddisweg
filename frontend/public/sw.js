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
