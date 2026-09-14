// Minimal installability-only service worker.
//
// Deliberately does NOT cache anything: this project deploys on every
// revision, so an offline cache would risk serving stale bundles to returning
// users. `activate` purges Cache Storage outright, and nothing here ever
// writes to it. `web/__tests__/pwa/serviceWorkerContract.test.ts` holds that
// promise against the file itself, so "never caches" cannot quietly stop being
// true, and REV-26's E2E measures it again at runtime (Cache Storage empty
// after a real load).
//
// WHY A FETCH HANDLER EXISTS AT ALL. Chrome dropped the fetch-handler
// requirement for installing from the menu (mobile 108 / desktop 112), but the
// algorithm that fires `beforeinstallprompt` -- the one-click install this
// project is built around -- still requires a fetch handler to be present.
// See developer.chrome.com/blog/update-install-criteria.
//
// WHY IT NO LONGER ANSWERS EVERYTHING (REV-26, measured 2026-09-14).
// `event.respondWith(fetch(event.request))` re-issues every request from the
// worker. That costs a worker hop on each one, and it also takes the request
// out of the page's own scope -- which is why Playwright's `page.route` saw
// ZERO `_next/static` requests and the F-2 pre-hydration test skipped on every
// engine for two revisions. Measured on the built app, median of five loads:
//
//                        SW active      SW blocked     delta
//   TTFB                   16.7ms          9.9ms      +6.8ms
//   DOMContentLoaded       65.2ms         50.0ms     +15.2ms
//   load                  316.0ms        269.7ms     +46.3ms
//   worker hop / asset      5.2ms            0        +5.2ms
//   worker hop, 32 assets 139.2ms            0      +139.2ms
//   Cache Storage keys         []             []     (it really caches nothing)
//
// So the worker was charging every visitor a hop per request and returning no
// cache in exchange. Chrome names this exact anti-pattern in the post above:
// "sites added service workers with empty fetch handlers to satisfy the
// criteria. This hurt web performance."
//
// The handler therefore stays, and still answers navigations and anything else
// -- it is a real handler, not an empty one -- but Next's CONTENT-HASHED build
// output under `/_next/static/` falls straight through to the network. Those
// URLs are immutable by construction: a changed chunk is a different filename,
// so there is nothing a worker could add except latency.
//
// UNITAS_PWA_ICON_VERSION doubles as a byte-level change marker: bumping it
// makes every installed client download this new worker generation, whose
// `activate` step purges any Cache Storage a previous generation may have left
// behind (owner instruction 2026-09-04, item 1: PWA icon cache-busting).
const UNITAS_PWA_ICON_VERSION = 'v3-rev26-passthrough';

/** Immutable, content-hashed build output: a worker can only add latency. */
function isImmutableBuildOutput(request) {
  try {
    const url = new URL(request.url);
    return url.origin === self.location.origin && url.pathname.startsWith('/_next/static/');
  } catch (_) {
    return false;
  }
}

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
  // Falling through (no respondWith) leaves the request exactly where the page
  // made it: same network path, no worker hop, still interceptable by the
  // page's own tooling.
  if (isImmutableBuildOutput(event.request)) return;
  event.respondWith(fetch(event.request));
});

self.addEventListener('message', (event) => {
  if (event.data === 'unitas:pwa-version' && event.source) {
    event.source.postMessage({ type: 'unitas:pwa-version', version: UNITAS_PWA_ICON_VERSION });
  }
});
