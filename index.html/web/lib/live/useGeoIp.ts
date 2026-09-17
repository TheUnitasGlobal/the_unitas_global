'use client';

/**
 * REV-41 D-4 -- the Geo-IP fix as a hook: the cached value on the first
 * render (null on the server and on a cold device), then at most ONE
 * network resolution per page load, shared by every subscriber.
 *
 * `useSlotContext` (the discovery carousel AND the U-AI hyper stream) is the
 * consumer; both mount in the same popup, so the refresh promise lives at
 * module level rather than per hook instance -- the providers see exactly
 * one request per session however many components read the context.
 */
import { useEffect, useState } from 'react';
import { readGeoIpFix, refreshGeoIpFix, type GeoIpFix } from '@/lib/live/geoIp';

/** The session's one refresh, settled or in flight. A fresh cache settles it
 *  without touching the network; only a missing / expired fix spends the
 *  request (Codex ch.1 micro-burn: a returning visitor costs 0 calls). */
let sessionRefresh: Promise<GeoIpFix | null> | null = null;

export function useGeoIpFix(): GeoIpFix | null {
  // State initialiser, never a render-time clock: the cache read happens
  // once, on the client, and the server frame is honestly `null`.
  const [fix, setFix] = useState<GeoIpFix | null>(() => readGeoIpFix());
  useEffect(() => {
    let alive = true;
    if (!sessionRefresh) {
      const cached = readGeoIpFix();
      sessionRefresh = cached ? Promise.resolve(cached) : refreshGeoIpFix();
    }
    void sessionRefresh.then((next) => {
      if (!alive || !next) return;
      setFix((prev) => (prev && prev.at === next.at ? prev : next));
    });
    return () => {
      alive = false;
    };
  }, []);
  return fix;
}
