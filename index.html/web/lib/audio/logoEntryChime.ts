// Short entry chime for the very first frame of the logo page (owner
// instruction 2026-09-06, item 2): guaranteed on every omni-channel surface
// -- PC online, PC App, mobile online, mobile App -- not just the one channel
// that happened to already carry it. Self-contained (its own AudioContext,
// no dependency on SpatialAudioProvider) because CinematicIntroSplash mounts
// above that provider in the tree -- see app/layout.tsx.

import { ensurePlaybackAudioSession, kickAudioContext, makeSilentBuffer } from './audioSession';
import { ACTIVATION_UNLOCK_EVENTS } from './activationUnlock';
import { readAudioPrefMuted } from './audioPreference';

/** Two-note crystal blip -- bright, brief (under 300ms), unmistakable but never intrusive. */
function synthesizeChime(ctx: AudioContext): void {
  const now = ctx.currentTime;
  const bus = ctx.createGain();
  bus.gain.value = 0.22;
  bus.connect(ctx.destination);

  const notes: Array<{ freq: number; start: number; dur: number }> = [
    { freq: 880, start: now, dur: 0.16 },
    { freq: 1318.5, start: now + 0.09, dur: 0.22 },
  ];

  for (const { freq, start, dur } of notes) {
    const core = ctx.createOscillator();
    core.type = 'sine';
    core.frequency.value = freq;
    const coreGain = ctx.createGain();
    coreGain.gain.setValueAtTime(0, start);
    coreGain.gain.linearRampToValueAtTime(1, start + 0.012);
    coreGain.gain.exponentialRampToValueAtTime(0.001, start + dur);
    core.connect(coreGain);
    coreGain.connect(bus);
    core.start(start);
    core.stop(start + dur + 0.02);

    const partial = ctx.createOscillator();
    partial.type = 'sine';
    partial.frequency.value = freq * 2;
    const partialGain = ctx.createGain();
    partialGain.gain.setValueAtTime(0, start);
    partialGain.gain.linearRampToValueAtTime(0.35, start + 0.01);
    partialGain.gain.exponentialRampToValueAtTime(0.001, start + dur * 0.7);
    partial.connect(partialGain);
    partialGain.connect(bus);
    partial.start(start);
    partial.stop(start + dur * 0.7 + 0.02);
  }
}

/**
 * Hardened, omni-channel playback: tries an immediate resume first (works
 * wherever the engine honours an early resume -- installed PWA, an
 * "engaged" origin, Firefox), and whenever autoplay policy blocks that,
 * falls back to firing on the visitor's very first activation-triggering
 * gesture on ANY channel -- the same gesture set AudioGate/ComingSoonCinema
 * already rely on (see activationUnlock.ts) -- so no environment is ever
 * silently skipped. Plays at most once. Returns a disarm function.
 */
export function armLogoEntryChime(): () => void {
  if (typeof window === 'undefined') return () => {};
  if (readAudioPrefMuted()) return () => {};

  const AudioCtxCtor =
    window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtxCtor) return () => {};

  let played = false;
  let ctx: AudioContext;
  try {
    ensurePlaybackAudioSession();
    ctx = new AudioCtxCtor();
  } catch {
    return () => {};
  }
  const silent = makeSilentBuffer(ctx);

  // ROOT CAUSE of the "Sovereign Core Error on entry" (owner instruction
  // 2026-09-07, item 1) -- fixed here. The previous shape of this function
  // declared its gesture listeners AFTER an early `if (ctx.state ===
  // 'running') { fire(); ... }` branch, while `fire()` -> `detach()` read
  // those `const` bindings: on any engine whose autoplay policy lets a
  // fresh AudioContext start at once (an installed PWA, an origin the
  // visitor has engaged with often -- the founder's own browser --
  // Firefox, headless Chromium) the branch ran and `detach()` hit the
  // temporal dead zone: a ReferenceError thrown from CinematicIntroSplash's
  // mount effect, straight into the root error boundary. Everything is now
  // declared before anything can call it, `detach` is idempotent, and every
  // step is fenced -- this function can no longer throw.
  const opts: AddEventListenerOptions = { passive: true, capture: true };
  let listening = false;

  const onState = () => {
    if (ctx.state === 'running') fire();
  };

  const onGesture = () => {
    try {
      ensurePlaybackAudioSession();
      if (silent) kickAudioContext(ctx, silent);
      if (ctx.state === 'running') {
        fire();
        return;
      }
      ctx
        .resume()
        .then(() => {
          if (ctx.state === 'running') fire();
        })
        .catch(() => {});
    } catch {
      /* never throw out of the gesture */
    }
  };

  function detach() {
    if (!listening) return;
    listening = false;
    try {
      for (const type of ACTIVATION_UNLOCK_EVENTS) window.removeEventListener(type, onGesture, opts);
    } catch {
      /* no-op */
    }
    try {
      ctx.removeEventListener('statechange', onState);
    } catch {
      /* no-op */
    }
  }

  function fire() {
    if (played) return;
    played = true;
    try {
      synthesizeChime(ctx);
    } catch {
      /* a synth failure must never surface to the caller */
    }
    detach();
  }

  const disarm = () => {
    detach();
    try {
      ctx.close().catch(() => {});
    } catch {
      /* no-op */
    }
  };

  try {
    ctx.resume().catch(() => {});
    if (silent) kickAudioContext(ctx, silent);
  } catch {
    /* no-op */
  }

  // Immediate playback wherever the engine already allows it.
  if (ctx.state === 'running') {
    fire();
    return disarm;
  }

  // Owner instruction 2026-09-07 (item 2): the chime is scheduled only once
  // the context is actually RUNNING. It used to be synthesized in the same
  // tick as the `resume()` request -- on a still-suspended context the
  // notes were stamped at currentTime 0 and could be lost entirely when the
  // resume settled a beat later (Chromium grants activation on the
  // touchend / click of the tap, not its touchstart). Now: kick + resume
  // inside the gesture, then fire from the resume promise / statechange,
  // whichever lands first.
  try {
    listening = true;
    for (const type of ACTIVATION_UNLOCK_EVENTS) window.addEventListener(type, onGesture, opts);
    ctx.addEventListener('statechange', onState);
  } catch {
    /* no-op */
  }

  return disarm;
}
