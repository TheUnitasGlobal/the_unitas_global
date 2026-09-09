// REV-13 "Quantum White" haptic micro-sounds (spec section 5 + item 18).
//
// The new home eradicates the ambient BGM and every hover cue; the only
// sounds left are two sub-40 ms "haptic" clicks -- a tic when a cluster or
// module tile opens, a click when an investment succeeds / a module is
// entered. They are deliberately STANDALONE: their own lazily created
// AudioContext, no dependency on SpatialAudioProvider, so a page that never
// mounts the provider (or mounts it muted) still gets tactile feedback, and
// the provider's ambient-bed suppression logic stays untouched.
//
// Rules this file guarantees:
//  - The context is created INSIDE the gesture that asks for a cue (a click
//    handler), never at import or mount time, so the autoplay policy grants
//    it at once; a suspended / interrupted context is resumed in the same
//    gesture (owner instruction 2026-09-07, item 2 -- cover every
//    non-running state).
//  - The persisted sound preference (`unitas_audio_pref` === 'off',
//    lib/audio/audioPreference.ts) is honoured on EVERY call: muted means
//    silent, and no context is built for a muted visitor.
//  - Nothing here ever throws out of the click that requested it -- a
//    WebView without Web Audio, a hardware context cap, a closed context,
//    all simply skip the cue.
//  - The context is closed on `APP_EXIT_EVENT` / `APP_TERMINATE_EVENT`
//    (lib/exit/appExit.ts) so a terminated app holds no audio graph, and on
//    the next gesture after an exit a fresh one is built.

import { readAudioPrefMuted } from '@/lib/audio/audioPreference';
import { ensurePlaybackAudioSession } from '@/lib/audio/audioSession';
import { APP_EXIT_EVENT, APP_TERMINATE_EVENT } from '@/lib/exit/appExit';

/** Tic: total length (ms) -- a cluster / tile opening. */
export const HAPTIC_TIC_MS = 12;
/** Tic: carrier frequency (Hz). */
export const HAPTIC_TIC_HZ = 2400;
/** Tic: peak gain. */
export const HAPTIC_TIC_GAIN = 0.05;
/** Click: total length (ms) -- a successful investment / module entry. */
export const HAPTIC_CLICK_MS = 38;
/** Click: first-stage carrier (Hz), 0..18 ms. */
export const HAPTIC_CLICK_LOW_HZ = 1200;
/** Click: second-stage carrier (Hz), 18..38 ms. */
export const HAPTIC_CLICK_HIGH_HZ = 2800;
/** Click: stage boundary (ms). */
export const HAPTIC_CLICK_STAGE_MS = 18;
/** Click: peak gain. */
export const HAPTIC_CLICK_GAIN = 0.07;

/** Attack length shared by both cues (ms) -- 1 ms keeps the edge click-free. */
const ATTACK_MS = 1;
/** Floor an exponential ramp can reach (0 is illegal for exponential ramps). */
const SILENT_FLOOR = 0.0001;

type HapticWindow = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

let hapticCtx: AudioContext | null = null;
let exitListenersArmed = false;

/**
 * Close whatever context exists and forget it. Idempotent; a refusal from
 * the engine (already closed) is swallowed.
 */
function releaseContext(): void {
  const ctx = hapticCtx;
  hapticCtx = null;
  if (!ctx) return;
  try {
    if (ctx.state !== 'closed') ctx.close().catch(() => {});
  } catch {
    /* already closed / engine refused -- nothing to hold */
  }
}

/** Fired on exit / termination: fall silent and release the audio graph. */
function onAppExit(): void {
  releaseContext();
}

/**
 * Arm the exit listeners exactly once per document. Armed lazily (with the
 * first context) so a page that never plays a haptic holds no listener.
 */
function armExitListeners(): void {
  if (exitListenersArmed || typeof window === 'undefined') return;
  exitListenersArmed = true;
  try {
    window.addEventListener(APP_EXIT_EVENT, onAppExit);
    window.addEventListener(APP_TERMINATE_EVENT, onAppExit);
  } catch {
    /* an environment without addEventListener simply never exits this way */
  }
}

/**
 * Returns a live AudioContext for the cue, building it INSIDE the calling
 * gesture when none exists (or the previous one was closed on exit) and
 * resuming it when the engine left it suspended / interrupted. `null` when
 * Web Audio is unavailable or the engine refuses to build one.
 */
function acquireContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (hapticCtx && hapticCtx.state === 'closed') hapticCtx = null;
  if (!hapticCtx) {
    try {
      const win = window as HapticWindow;
      const AudioCtx = win.AudioContext || win.webkitAudioContext;
      if (!AudioCtx) return null;
      // iOS ring/silent switch: declare a playback session before the
      // context exists (lib/audio/audioSession.ts).
      ensurePlaybackAudioSession();
      hapticCtx = new AudioCtx();
      armExitListeners();
    } catch {
      hapticCtx = null;
      return null;
    }
  }
  const ctx = hapticCtx;
  try {
    // Covers `suspended` AND WebKit's non-standard `interrupted`.
    if (ctx.state !== 'running') ctx.resume().catch(() => {});
  } catch {
    /* a refused resume must never throw out of the gesture */
  }
  return ctx;
}

/**
 * One enveloped oscillator: `attack` ms linear rise to `peak`, exponential
 * decay to silence by `start + duration`, stopped at the very same instant.
 * Every automation point is absolute in context time so two stages can be
 * chained back to back without a click between them.
 */
function voice(
  ctx: AudioContext,
  opts: { type: OscillatorType; hz: number; start: number; durationMs: number; peak: number },
): void {
  const { type, hz, start, durationMs, peak } = opts;
  const end = start + durationMs / 1000;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(hz, start);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(SILENT_FLOOR, start);
  gain.gain.linearRampToValueAtTime(peak, start + ATTACK_MS / 1000);
  gain.gain.exponentialRampToValueAtTime(SILENT_FLOOR, end);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(start);
  osc.stop(end);
}

/**
 * Tic -- 12 ms, 2.4 kHz sine, 1 ms attack / ~10 ms exponential decay at
 * gain .05. Cluster open / module tile open. Silent when the persisted
 * preference is 'off'; never throws.
 */
export function playHapticTic(): void {
  try {
    if (readAudioPrefMuted()) return;
    const ctx = acquireContext();
    if (!ctx) return;
    voice(ctx, {
      type: 'sine',
      hz: HAPTIC_TIC_HZ,
      start: ctx.currentTime,
      durationMs: HAPTIC_TIC_MS,
      peak: HAPTIC_TIC_GAIN,
    });
  } catch {
    /* a refused cue must never break the interaction that asked for it */
  }
}

/**
 * Click -- two-stage 38 ms (1.2 kHz -> 2.8 kHz, square-ish via triangle) at
 * gain .07. Successful investment / module entry. Silent when the persisted
 * preference is 'off'; never throws.
 */
export function playHapticClick(): void {
  try {
    if (readAudioPrefMuted()) return;
    const ctx = acquireContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    voice(ctx, {
      type: 'triangle',
      hz: HAPTIC_CLICK_LOW_HZ,
      start: now,
      durationMs: HAPTIC_CLICK_STAGE_MS,
      peak: HAPTIC_CLICK_GAIN,
    });
    voice(ctx, {
      type: 'triangle',
      hz: HAPTIC_CLICK_HIGH_HZ,
      start: now + HAPTIC_CLICK_STAGE_MS / 1000,
      durationMs: HAPTIC_CLICK_MS - HAPTIC_CLICK_STAGE_MS,
      peak: HAPTIC_CLICK_GAIN,
    });
  } catch {
    /* a refused cue must never break the interaction that asked for it */
  }
}

/**
 * Test hook: close any context, drop the exit listeners and forget every
 * module-level flag so each test starts from a cold engine. Not for app code.
 */
export function __resetHapticsForTests(): void {
  releaseContext();
  if (exitListenersArmed && typeof window !== 'undefined') {
    try {
      window.removeEventListener(APP_EXIT_EVENT, onAppExit);
      window.removeEventListener(APP_TERMINATE_EVENT, onAppExit);
    } catch {
      /* no-op */
    }
  }
  exitListenersArmed = false;
}
