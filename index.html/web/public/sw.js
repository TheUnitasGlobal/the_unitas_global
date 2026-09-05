// Minimal installability-only service worker.
// Deliberately does NOT cache anything: this project auto-deploys on every
// commit (see CLAUDE.md Stop hook), so an offline cache would risk serving
// stale bundles to returning users. This worker exists solely so Chromium
// browsers see an active fetch handler, which is required for the
// `beforeinstallprompt` PWA-install signal to fire.
//
// UNITAS_PWA_ICON_VERSION doubles as a byte-level change marker: bumping it
// makes every installed client download this new worker generation, whose
// `activate` step purges any Cache Storage a previous generation may have
// left behind -- so a stale v1 icon can never be served from SW cache again
// (owner instruction 2026-09-04, item 1: PWA icon cache-busting).
const UNITAS_PWA_ICON_VERSION = 'v2-final-symmetry';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      } catch (_) {
        // Cache Storage unavailable -- nothing to purge.
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});

self.addEventListener('message', (event) => {
  if (event.data === 'unitas:pwa-version' && event.source) {
    event.source.postMessage({ type: 'unitas:pwa-version', version: UNITAS_PWA_ICON_VERSION });
  }
});
