'use client';

import { useEffect, useLayoutEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AnimatePresence, motion } from 'framer-motion';
import { useSpatialAudio } from './SpatialAudioProvider';

const STORAGE_KEY = 'unitas_audio_gate_seen';

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
 */
export function AudioGate() {
  const t = useTranslations('AudioGate');
  const { unlocked, unlockAndUnmute } = useSpatialAudio();
  const [dismissed, setDismissed] = useState(false);

  useIsomorphicLayoutEffect(() => {
    if (typeof window === 'undefined') return;
    if (sessionStorage.getItem(STORAGE_KEY)) {
      setDismissed(true);
    }
  }, []);

  const open = !dismissed && !unlocked;

  // The gate's content fits the viewport by design -- lock document scroll
  // while it's open so no vertical scrollbar can appear behind/through the
  // fixed overlay (a `position: fixed` panel doesn't stop the page under it
  // from scrolling on its own).
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (open) {
      const previous = document.documentElement.style.overflow;
      document.documentElement.style.overflow = 'hidden';
      return () => {
        document.documentElement.style.overflow = previous;
      };
    }
  }, [open]);

  function markSeen() {
    sessionStorage.setItem(STORAGE_KEY, 'true');
    setDismissed(true);
  }

  function handleInitiate() {
    unlockAndUnmute();
    markSeen();
    // Land on the dashboard scrolled to the very top -- even if the page
    // was scrolled before the gate appeared (e.g. back-navigation).
    window.scrollTo(0, 0);
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[300] flex flex-col items-center justify-center bg-void px-6 text-center backdrop-blur-2xl"
          initial={false}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: 'easeInOut' }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="audio-gate-title"
        >
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
              className="mb-6 font-serif text-5xl font-bold tracking-[0.14em] text-white md:text-7xl lg:text-8xl"
              style={{ textShadow: '0 0 24px rgba(212,175,55,0.3), 0 0 60px rgba(0,243,255,0.1)' }}
            >
              {t('title')}
            </h1>
            <p className="mx-auto mb-12 max-w-lg text-base leading-relaxed text-gray-300 [text-wrap:balance] md:max-w-3xl md:text-xl">
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
