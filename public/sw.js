/* Only the public offline document is cached. Account pages, API data and PDFs remain network-only. */
const OFFLINE_CACHE = "railwatch-offline-v1";
self.addEventListener("install", event => {
  event.waitUntil(caches.open(OFFLINE_CACHE).then(cache => cache.add("/offline.html")).then(() => self.skipWaiting()));
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("railwatch-offline-") && key !== OFFLINE_CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", event => {
  if (event.request.mode !== "navigate" || event.request.method !== "GET" || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(event.request).catch(() => caches.match("/offline.html")));
});

// Display one notification per journey; URLs are constrained to the current origin.
self.addEventListener("push", event => {
  let payload;
  try { payload = event.data.json(); } catch { return; }
  event.waitUntil(self.registration.showNotification(payload.title || "RailWatch", {
    body: payload.body, tag: payload.tag || "railwatch", icon: "/icons/app-192.png",
    data: { url: "/journeys" }, renotify: false,
  }));
});
self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async windows => {
    const target = new URL("/journeys", self.location.origin).href;
    const client = windows.find(window => new URL(window.url).origin === self.location.origin);
    if (client) { await client.navigate(target); return client.focus(); }
    return self.clients.openWindow(target);
  }));
});
