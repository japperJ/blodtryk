/*
 * Minimal service worker (#16) — KUN til daglige påmindelsesnotifikationer.
 * Bevidst INGEN caching (ingen fetch-handler): eksisterende HTTP-caching og
 * dev-mode skal ikke påvirkes. Install/activate er trivielle.
 */
const TARGET_URL = "/scan";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Tryk på påmindelsen → fokusér allerede åben fane hvis muligt, ellers åbn /scan.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(TARGET_URL, self.location.origin).href;
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ("focus" in client) return client.focus();
        }
        return self.clients.openWindow(url);
      })
  );
});
