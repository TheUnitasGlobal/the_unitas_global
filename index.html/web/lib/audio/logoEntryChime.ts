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

  const fire = () => {
    if (played) return;
    played = true;
    try {
      synthesizeChime(ctx);
    } catch {
      /* a synth failure must never surface to the caller */
    }
    detach();
  };

  ctx.resume().catch(() => {});
  if (silent) kickAudioContext(ctx, silent);

  if (ctx.state === 'running') {
    fire();
    return () => {
      try {
        ctx.close().catch(() => {});
      } catch {
        /* no-op */
      }
    };
  }

  const opts: AddEventListenerOptions = { passive: true, capture: true };
  const onGesture = () => {
    ensurePlaybackAudioSession();
    ctx.resume().catch(() => {});
    if (silent) kickAudioContext(ctx, silent);
    fire();
  };
  for (const type of ACTIVATION_UNLOCK_EVENTS) window.addEventListener(type, onGesture, opts);

  function detach() {
    for (const type of ACTIVATION_UNLOCK_EVENTS) window.removeEventListener(type, onGesture, opts);
  }

  return () => {
    detach();
    try {
      ctx.close().catch(() => {});
    } catch {
      /* no-op */
    }
  };
}
