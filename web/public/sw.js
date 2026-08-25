// Minimal installability-only service worker.
// Deliberately does NOT cache anything: this project auto-deploys on every
// commit (see CLAUDE.md Stop hook), so an offline cache would risk serving
// stale bundles to returning users. This worker exists solely so Chromium
// browsers see an active fetch handler, which is required for the
// `beforeinstallprompt` PWA-install signal to fire.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
