'use client';

import { useEffect, useLayoutEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AnimatePresence, motion } from 'framer-motion';
import { useSpatialAudio } from './SpatialAudioProvider';
import { GlobalLanguagePicker } from '@/components/i18n/GlobalLanguagePicker';
import { CINEMA_PHASE_EVENT } from '@/lib/foundersGate';
import { CINEMA_PHASE_STORAGE_KEY } from '@/lib/splash/splashTimeline';

const STORAGE_KEY = 'unitas_audio_gate_seen';
/** The Coming-Soon curtain phase on which the real site is revealed
 *  (components/ComingSoonCinema.tsx `released`, founder-only, server-verified). */
const RELEASED_PHASE = 'released';

/**
 * Has the pre-launch curtain ALREADY released the site for this tab? Read
 * synchronously (before paint) from the live `<html data-cinema-phase>` stamp
 * the curtain keeps current, falling back to the phase it persisted -- so a
 * refresh parked on the main home never flashes this gate for a frame.
 */
function curtainAlreadyReleased(): boolean {
  try {
    if (document.documentElement.dataset.cinemaPhase === RELEASED_PHASE) return true;
    return sessionStorage.getItem(CINEMA_PHASE_STORAGE_KEY) === RELEASED_PHASE;
  } catch {
    return false;
  }
}

// useLayoutEffect has no server-side equivalent and React warns if it's
// called during SSR; swap to the plain (async) useEffect there instead.
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/**
 * Browsers block AudioContext output until a real user gesture, so nothing
 * plays until the visitor clicks through here. The gate itself stays silent
 * (no icon, no preview audio) -- unlockAndUnmute() resumes the context
 * immediately, unmuting interaction SFX (hover/focus/quest/vault cues) for
 * the rest of the session. There is no background music/ambient drone to
 * defer here -- see SpatialAudioProvider.unlockAndUnmute.
 *
 * `dismissed` defaults to false (gate visible) so the very first paint --
 * server-rendered and the first client render -- already shows the gate
 * covering the page, and `initial={false}` on the motion wrapper means it
 * never fades in from opacity 0 either. sessionStorage can only be read on
 * the client, so for a returning-this-session visitor the check that flips
 * `dismissed` back to true runs in a *layout* effect (before the browser
 * paints) rather than a regular effect (after) -- otherwise the gate would
 * flash fully onscreen and then fade out over the exit transition on every
 * reload instead of just staying hidden.
 *
 * NO INTERMEDIATE ENTRY PAGE (owner instruction 2026-09-05, round 15, item
 * 0): this gate sits BENEATH the pre-launch curtain (z-300 under z-400), so
 * the only moment it could ever be seen is the instant the curtain releases
 * the real site to the verified founder -- and then it used to appear as a
 * second, redundant "entry page" between the Coming-Soon screen and the main
 * home. The founder's click on the curtain's entry button IS the audio
 * unlock gesture now (ComingSoonCinema `enterMainSite()` calls
 * `unlockAndUnmute()` itself), and this gate additionally retires itself the
 * moment the curtain reports `released` -- by any route, including the
 * `?dev=skip` QA jump and a refresh parked on the main home -- rendering
 * NOTHING at once (no exit fade that could ghost through the dissolving
 * curtain). The public never reaches `released`, so nothing changes for them.
 */
export function AudioGate() {
  const t = useTranslations('AudioGate');
  const { unlocked, unlockAndUnmute } = useSpatialAudio();
  const [dismissed, setDismissed] = useState(false);
  const [released, setReleased] = useState(false);

  useIsomorphicLayoutEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (sessionStorage.getItem(STORAGE_KEY)) setDismissed(true);
    } catch {
      /* storage blocked -- the gate simply shows */
    }
    if (curtainAlreadyReleased()) setReleased(true);
  }, []);

  // The curtain releasing the site (founder door / QA skip / verified
  // restore after a refresh) retires this gate for good.
  useEffect(() => {
    const onPhase = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== RELEASED_PHASE) return;
      try {
        sessionStorage.setItem(STORAGE_KEY, 'true');
      } catch {
        /* no-op */
      }
      setDismissed(true);
      setReleased(true);
    };
    window.addEventListener(CINEMA_PHASE_EVENT, onPhase);
    return () => window.removeEventListener(CINEMA_PHASE_EVENT, onPhase);
  }, []);

  const open = !released && !dismissed && !unlocked;

  // NO document scroll lock (owner instruction 2026-08-29: never freeze up/down
  // scrolling on any device). The overlay is a full-viewport fixed layer that
  // scrolls its own overflow instead; clear any stale inline lock a previous
  // build may have left on the root element.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const el = document.documentElement;
    if (el.style.overflow === 'hidden') el.style.overflow = '';
  }, [open]);

  function markSeen() {
    try {
      sessionStorage.setItem(STORAGE_KEY, 'true');
    } catch {
      /* private-mode quota / blocked storage -- dismiss for this render anyway */
    }
    setDismissed(true);
  }

  function handleInitiate() {
    // Owner instruction 2026-09-07 (item 2): the entry tap IS the site-wide
    // audio unlock; every step here is fenced so the gate always dismisses
    // even if the engine refuses to build or resume a context.
    try {
      unlockAndUnmute();
    } catch {
      /* never block the entry on a refused unlock */
    }
    markSeen();
    // Land on the dashboard scrolled to the very top -- even if the page
    // was scrolled before the gate appeared (e.g. back-navigation).
    try {
      window.scrollTo(0, 0);
    } catch {
      /* no-op */
    }
  }

  // Released: nothing, instantly -- not even an exit transition.
  if (released) return null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="u-viewport-fit gate-panel fixed inset-0 z-[300] flex flex-col items-center justify-center overflow-y-auto overscroll-contain bg-void text-center backdrop-blur-2xl"
          initial={false}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: 'easeInOut' }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="audio-gate-title"
        >
          {/* Flag + native-language selector -- present on the very first
              screen so a visitor can read the gate before committing. */}
          <div
            className="absolute right-4 z-20 sm:right-6"
            style={{ top: 'max(1rem, var(--u-safe-top))' }}
          >
            <GlobalLanguagePicker />
          </div>

          <div
            className="pointer-events-none absolute inset-0 opacity-40"
            style={{
              background:
                'radial-gradient(ellipse at center, rgba(212,175,55,0.08) 0%, transparent 70%)',
            }}
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.05]"
            style={{
              backgroundImage:
                'repeating-linear-gradient(0deg, #fff 0px, #fff 1px, transparent 1px, transparent 3px)',
            }}
            aria-hidden="true"
          />

          <motion.div
            className="relative flex flex-col items-center"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 1, ease: 'easeOut' }}
          >
            <h1
              id="audio-gate-title"
              className="font-serif font-bold tracking-[0.14em] text-white"
              style={{ textShadow: '0 0 24px rgba(212,175,55,0.3), 0 0 60px rgba(0,243,255,0.1)' }}
            >
              {t('title')}
            </h1>
            <p className="mx-auto max-w-lg text-gray-300 [text-wrap:balance] md:max-w-3xl">
              {t('subtitle')}
            </p>

            <button
              type="button"
              onClick={handleInitiate}
              className="event-horizon-btn inline-block whitespace-nowrap px-7 py-3.5 text-xs font-medium uppercase tracking-[0.15em] text-white backdrop-blur-md transition-transform duration-300 hover:scale-[1.03] active:scale-[0.98] sm:text-sm"
            >
              {t('button')}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
