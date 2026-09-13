/**
 * REV-21 §4A (F1 / F8) -- the client-navigation lock.
 *
 * A locale switch is a `router.replace(pathname, { locale })`: Next's app
 * router swaps the `[locale]` segment, every client component under it
 * unmounts, and each open deep-modal layer releases in that unmount. Before
 * REV-21 a release always walked history back over its own entry
 * (`history.go(-1)`), and a traversal issued WHILE the router was replacing
 * the entry cancelled the navigation -- the founder-reported "language
 * change collapses the popup / the language never changes" (F1). Likewise
 * the surface-hash `replaceState` (F8) written during a navigation was
 * thrown away with the entry it patched.
 *
 * The lock is a plain module flag with a safety timer: a caller that is
 * about to navigate calls `beginNavigation()`, the layers' unmount cleanup
 * asks `navigationInFlight()` and releases WITHOUT traversing, and the flag
 * clears itself after `NAVIGATION_LOCK_MS` (or on `endNavigation()`) --
 * the same 600 ms budget the modal stack gives a traversal.
 *
 * Pure (no window): a `now` / timer host is injectable for tests.
 */
import { TRAVERSAL_TIMEOUT_MS } from './modalStack';

export const NAVIGATION_LOCK_MS = TRAVERSAL_TIMEOUT_MS;

let until = 0;
let clock: () => number = () => Date.now();

/** Mark a client navigation as in flight for the next `ms` milliseconds. */
export function beginNavigation(ms = NAVIGATION_LOCK_MS): void {
  until = Math.max(until, clock() + ms);
}

/** Clear the lock early (the navigation settled). */
export function endNavigation(): void {
  until = 0;
}

/** True while a navigation begun with `beginNavigation` may still be
 *  committing. */
export function navigationInFlight(): boolean {
  return clock() < until;
}

/** Test seam: inject a clock (or reset it with no argument). */
export function __setNavigationClock(now?: () => number): void {
  clock = now ?? (() => Date.now());
  until = 0;
}
