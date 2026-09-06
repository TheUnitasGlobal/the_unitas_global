// Gesture-driven AudioContext unlock (formerly part of lib/splash/splashAudio.ts;
// moved here when the logo-page score was retired -- owner instruction
// 2026-09-05, checklist item 1: the logo page is now SILENT, so the only
// engines that still need a first-gesture resume are the Coming-Soon ambient
// bed and the site-wide spatial SFX provider).

import { ensurePlaybackAudioSession } from '@/lib/audio/audioSession';

/**
 * The events browsers treat as "activation triggering input events" (HTML
 * spec): `keydown`, `mousedown`, a MOUSE `pointerdown`, a non-mouse
 * `pointerup`, `touchend`, plus `click` as the universal fallback -- AND a
 * forced resume on `pointerdown` / `touchstart`, the first physical contact
 * with the screen. Those two carry no activation on their own, so an engine
 * may defer the resume they request; the activating `touchend` / `pointerup`
 * of the same finger settles it a few dozen ms later. Where the engine does
 * honour an early resume (installed PWA, engaged origin, Firefox) the sound
 * starts on contact.
 */
export const ACTIVATION_UNLOCK_EVENTS = [
  'pointerdown',
  'touchstart',
  'pointerup',
  'touchend',
  'mousedown',
  'click',
  'keydown',
] as const;

/**
 * Installs the unlock listeners on `window` (capture, passive) and returns
 * the detach function. Idempotent per call; safe to call multiple times.
 */
export function attachActivationUnlock(unlock: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const opts: AddEventListenerOptions = { passive: true, capture: true };
  const handler = () => {
    try {
      // The playback session is (re)declared inside the gesture itself, for
      // every engine that shares this unlock (iOS ring/silent switch).
      ensurePlaybackAudioSession();
      unlock();
    } catch {
      /* never let an unlock attempt throw out of a gesture */
    }
  };
  for (const type of ACTIVATION_UNLOCK_EVENTS) window.addEventListener(type, handler, opts);
  let detached = false;
  return () => {
    if (detached) return;
    detached = true;
    for (const type of ACTIVATION_UNLOCK_EVENTS) window.removeEventListener(type, handler, opts);
  };
}
