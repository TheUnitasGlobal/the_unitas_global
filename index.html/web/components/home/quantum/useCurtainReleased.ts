'use client';

import { useEffect, useLayoutEffect, useState } from 'react';
import { CINEMA_PHASE_EVENT } from '@/lib/foundersGate';
import { CINEMA_PHASE_STORAGE_KEY } from '@/lib/splash/splashTimeline';

// useLayoutEffect has no server-side equivalent and React warns if it's
// called during SSR; swap to the plain (async) useEffect there instead
// (mirrors components/audio/AudioGate.tsx's identical guard).
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/** The Coming-Soon curtain phase on which the real site is revealed
 *  (components/ComingSoonCinema.tsx `released`, founder-only, server-verified). */
const RELEASED_PHASE = 'released';

/**
 * Is the pre-launch curtain already `released` for this tab? Read
 * synchronously (before paint) from the live `<html data-cinema-phase>` stamp
 * the curtain keeps current, falling back to the phase it persisted --
 * mirrors `components/audio/AudioGate.tsx`'s `curtainAlreadyReleased()` so
 * every surface that needs to know agrees on the same two sources.
 */
function curtainAlreadyReleased(): boolean {
  try {
    if (document.documentElement.dataset.cinemaPhase === RELEASED_PHASE) return true;
    return sessionStorage.getItem(CINEMA_PHASE_STORAGE_KEY) === RELEASED_PHASE;
  } catch {
    return false;
  }
}

/**
 * REV-13 Quantum White curtain-awareness hook (spec §0.9): the main home is
 * only meaningfully "visible" once the pre-launch curtain has released it --
 * anything that must not run behind the curtain (ambient suppression, the
 * chrono clock, the watermark) waits for this to flip `true`.
 *
 * Initial value is read synchronously in a layout effect (before paint) so a
 * reload that lands directly on the released home never renders a frame of
 * "not released" state; live changes arrive via the `unitas:cinema-phase`
 * window event the curtain dispatches on every phase transition.
 */
export function useCurtainReleased(): boolean {
  const [released, setReleased] = useState(false);

  useIsomorphicLayoutEffect(() => {
    if (curtainAlreadyReleased()) setReleased(true);
  }, []);

  useEffect(() => {
    const onPhase = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      if (detail === RELEASED_PHASE) setReleased(true);
    };
    window.addEventListener(CINEMA_PHASE_EVENT, onPhase);
    return () => window.removeEventListener(CINEMA_PHASE_EVENT, onPhase);
  }, []);

  return released;
}
