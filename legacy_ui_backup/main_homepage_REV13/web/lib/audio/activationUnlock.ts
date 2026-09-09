// Gesture-driven AudioContext unlock (formerly part of lib/splash/splashAudio.ts;
// moved here when the logo-page score was retired -- owner instruction
// 2026-09-05, checklist item 1: the logo page is now SILENT, so the only
// engines that still need a first-gesture resume are the Coming-Soon ambient
// bed and the site-wide spatial SFX provider).
//
// UNIVERSAL AUTO-UNLOCK HUB (owner instruction 2026-09-07, master audit item
// 2): every audio engine on the site -- the logo-page entry chime, the
// site-wide SpatialAudioProvider, the Coming-Soon ambient bed -- now shares
// ONE unlock architecture, on every page, in both channels, for every
// browser (iOS Safari, Android Chrome, Samsung Internet, Firefox, Edge,
// third-party WebViews) and every entry route (a Google result, a typed URL,
// an installed app launch):
//
//   1. KICKSTART AT LOAD. The engine builds its context, declares the
//      playback session, starts a one-sample SILENT buffer and requests
//      `resume()` the instant it exists -- where the policy already allows
//      autoplay (an installed PWA, an "engaged" origin on desktop, Firefox
//      with autoplay permitted) the sound starts before any gesture.
//   2. BOUNDED RETRIES. The same attempt is repeated on a short, fixed
//      schedule (`AUTO_UNLOCK_RETRY_DELAYS_MS`) -- a handful of cheap calls
//      in the first ~1.5 s that catch engines which refuse the very first
//      request while the document is still loading. Nothing long-lived.
//   3. LIFECYCLE RETRIES. `visibilitychange` (-> visible), `pageshow`
//      (bfcache restore / app resume) and window `focus` re-attempt the
//      unlock: an OS-side re-suspend, WebKit's `interrupted`, a tab brought
//      back to the front -- all revived with no gesture.
//   4. GESTURE UNLOCK. The full activation-triggering event set below,
//      captured on `window`, resumes + kicks the context INSIDE the very
//      first touch / click / key, whichever comes first.
//
// The one thing no web page can do is produce sound in a phone BROWSER before
// its first tap (mobile autoplay policy); the hub guarantees the earliest
// lawful instant on every engine, with no gesture ever lost.

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
 * Lifecycle moments (NOT gestures) at which a suspended / interrupted
 * context is re-attempted with no user input: the document becoming visible
 * again, a bfcache / app-switcher restore, the window regaining focus.
 * `visibilitychange` is a `document` event; the other two fire on `window`.
 */
export const AUTO_UNLOCK_RETRY_EVENTS = ['visibilitychange', 'pageshow', 'focus'] as const;

/**
 * Bounded post-load retry schedule (ms after the engine is armed). Five cheap
 * calls inside 1.5 s -- enough to catch an engine that refuses the first
 * request while the document is still parsing, cheap enough for the
 * Low-Memory Armor (no interval, no watcher, all timers self-clearing).
 */
export const AUTO_UNLOCK_RETRY_DELAYS_MS = [0, 120, 350, 800, 1500] as const;

/**
 * Installs the unlock listeners -- the activation gestures on `window`
 * (capture, passive) AND the lifecycle retry events -- and returns the detach
 * function. Idempotent per call; safe to call multiple times. `unlock` must
 * be idempotent itself (every engine checks `state === 'running'` first).
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
  const onVisible = () => {
    try {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
    } catch {
      /* no document -- treat as visible */
    }
    handler();
  };
  for (const type of ACTIVATION_UNLOCK_EVENTS) window.addEventListener(type, handler, opts);
  // Lifecycle retries (no gesture involved). Each add is fenced: a bare host
  // (tests, an exotic WebView) may lack `document.addEventListener`.
  try {
    document.addEventListener('visibilitychange', onVisible);
  } catch {
    /* no-op */
  }
  try {
    window.addEventListener('pageshow', handler);
    window.addEventListener('focus', handler);
  } catch {
    /* no-op */
  }
  let detached = false;
  return () => {
    if (detached) return;
    detached = true;
    for (const type of ACTIVATION_UNLOCK_EVENTS) window.removeEventListener(type, handler, opts);
    try {
      document.removeEventListener('visibilitychange', onVisible);
    } catch {
      /* no-op */
    }
    try {
      window.removeEventListener('pageshow', handler);
      window.removeEventListener('focus', handler);
    } catch {
      /* no-op */
    }
  };
}

/**
 * Runs `attempt` on the bounded post-load schedule (see
 * `AUTO_UNLOCK_RETRY_DELAYS_MS`) and returns a cancel function. Every timer
 * is one-shot; the whole burst is over in 1.5 s. `attempt` must be
 * idempotent (a running context is left alone).
 */
export function scheduleAutoUnlockRetries(attempt: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const timers: number[] = [];
  for (const delay of AUTO_UNLOCK_RETRY_DELAYS_MS) {
    try {
      timers.push(
        window.setTimeout(() => {
          try {
            attempt();
          } catch {
            /* a refused attempt never surfaces */
          }
        }, delay),
      );
    } catch {
      /* no timers on this host */
    }
  }
  return () => {
    for (const id of timers) {
      try {
        window.clearTimeout(id);
      } catch {
        /* no-op */
      }
    }
  };
}
