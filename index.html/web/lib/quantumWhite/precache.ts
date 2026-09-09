import type { ClusterModule, SingularityCluster } from './clusters';

/**
 * REV-13 Quantum White precache: warms a module's route (Next router
 * prefetch) and pins its detail record in a Map the instant a visitor hovers
 * a cluster core or a sub-module tile, so the click that follows opens a
 * fully-resolved pop-up synchronously and the eventual "Enter" navigation
 * hits an already-fetched route.
 *
 * Design constraints (spec §3):
 * - dedup via a Set -- a module is prefetched at most once per precache
 *   instance no matter how many hover events fire;
 * - the network-touching prefetch is deferred to `requestIdleCallback`
 *   (fallback `setTimeout(..., 1)`) so it never competes with the hover
 *   animation frame; the Set / Map bookkeeping is synchronous so a click
 *   that lands before the idle slot still resolves instantly;
 * - it NEVER throws: router.prefetch rejects/throws for unknown routes and
 *   during hydration races, and a decorative warm-up must not surface as an
 *   error boundary trip on the home.
 */

export interface PrecacheRouter {
  prefetch(href: string): void;
}

export interface Precache {
  warmModule(m: ClusterModule): void;
  warmCluster(c: SingularityCluster): void;
  isWarm(id: string): boolean;
  /** Synchronous detail lookup for an already-warmed module. */
  resolve(id: string): ClusterModule | undefined;
  /** Cancels pending idle work (app exit / unmount). Safe to call repeatedly. */
  dispose(): void;
}

type IdleHandle = { kind: 'idle'; id: number } | { kind: 'timeout'; id: ReturnType<typeof setTimeout> };

type IdleCapableWindow = {
  requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  cancelIdleCallback?: (id: number) => void;
};

function idleWindow(): IdleCapableWindow | null {
  return typeof window === 'undefined' ? null : (window as unknown as IdleCapableWindow);
}

function scheduleIdle(cb: () => void): IdleHandle {
  const w = idleWindow();
  if (w && typeof w.requestIdleCallback === 'function') {
    // 1.5 s timeout: on a busy first paint the callback must still run
    // before the visitor is realistically done reading the cluster card.
    return { kind: 'idle', id: w.requestIdleCallback(cb, { timeout: 1500 }) };
  }
  return { kind: 'timeout', id: setTimeout(cb, 1) };
}

function cancelIdle(handle: IdleHandle): void {
  if (handle.kind === 'idle') {
    const w = idleWindow();
    if (w && typeof w.cancelIdleCallback === 'function') w.cancelIdleCallback(handle.id);
    return;
  }
  clearTimeout(handle.id);
}

export function createPrecache(router: PrecacheRouter): Precache {
  const warmed = new Set<string>();
  const details = new Map<string, ClusterModule>();
  const pending = new Set<IdleHandle>();
  let disposed = false;

  function prefetchNow(m: ClusterModule): void {
    try {
      // router.prefetch may return a promise in some Next versions -- swallow
      // a rejection too so an unhandled-rejection never escapes the warm-up.
      const result: unknown = router.prefetch(m.href);
      if (result && typeof (result as Promise<unknown>).catch === 'function') {
        (result as Promise<unknown>).catch(() => undefined);
      }
    } catch {
      // Unknown route / hydration race -- purely decorative, ignore.
    }
  }

  function warmModule(m: ClusterModule): void {
    if (disposed) return;
    if (warmed.has(m.id)) return;
    warmed.add(m.id);
    details.set(m.id, m);
    if (!m.hasRoute || !m.href) return;
    try {
      let handle: IdleHandle | null = null;
      handle = scheduleIdle(() => {
        if (handle) pending.delete(handle);
        if (disposed) return;
        prefetchNow(m);
      });
      pending.add(handle);
    } catch {
      // Scheduler unavailable (exotic WebView) -- fall back to prefetching inline.
      prefetchNow(m);
    }
  }

  function warmCluster(c: SingularityCluster): void {
    for (const m of c.modules) warmModule(m);
  }

  function isWarm(id: string): boolean {
    return warmed.has(id);
  }

  function resolve(id: string): ClusterModule | undefined {
    return details.get(id);
  }

  function dispose(): void {
    disposed = true;
    for (const handle of pending) {
      try {
        cancelIdle(handle);
      } catch {
        // nothing to do -- the callback itself checks `disposed`.
      }
    }
    pending.clear();
  }

  return { warmModule, warmCluster, isWarm, resolve, dispose };
}
