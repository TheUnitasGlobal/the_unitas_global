'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { isSoundMutedByChoice, storeSoundMuted } from '@/lib/preferences';

interface SpatialAudioContextValue {
  muted: boolean;
  /** True once the AudioContext has actually been resumed by a user gesture. */
  unlocked: boolean;
  toggleMuted: () => void;
  /** Explicitly unlocks the AudioContext AND unmutes in one action -- see AudioGate. */
  unlockAndUnmute: () => void;
  /** Plays a short synthesized blip panned in stereo space (-1 left .. 1 right). */
  playSpatialPing: (pan?: number) => void;
  /** Soft high-tech blip for card/button hover. */
  playHoverSfx: (pan?: number) => void;
  /** Futuristic activation click when the OMNI-SYNAPSE search input gains focus. */
  playSearchFocusSfx: () => void;
  /** Rising three-note confirm swell for entering a quest/module. */
  playQuestEnterSfx: () => void;
  /** Single percussive tick for each OMNI-SYNAPSE search keystroke. */
  playTypingTick: () => void;
  /** Themed hover cue for one of the 11 ecosystems (see lib/ecosystems.ts `sfx` keys). */
  playEcosystemHover: (theme: string, pan?: number) => void;
  /** Heavy mechanical vault-closing thud for B2B protocol cards. */
  playVaultSfx: () => void;
}

const SpatialAudioContext = createContext<SpatialAudioContextValue | null>(null);

const BASE_MASTER_GAIN = 0.4;

/** Ambient bed level (routed under BASE_MASTER_GAIN). Deliberately low -- a presence, not a soundtrack. */
const AMBIENT_GAIN = 0.05;

/**
 * Loudness standard across every access environment (PC, tablet, mobile):
 * `playHoverSfx` -- the cue for the 5 B2C "Live Consumer Service" cards -- is
 * the reference level that every other interaction and scroll cue is matched
 * to. Its peak envelope gain (0.12) is `REFERENCE_CUE_PEAK`.
 *
 * The two heavier cue families are each routed through a single fixed trim
 * gain calibrated so their *perceived* level matches that reference:
 *   - `playVaultSfx`   -> the 3 B2B protocol cards
 *   - `playEcosystemHover` -> the 11 cognitive-ecosystem cards
 * so all three card tiers sound equally loud. `playVaultSfx`'s trim is
 * anchored on its mid-frequency clank layer rather than the raw numeric sum,
 * because its sub-bass thud is perceptually much quieter than the same gain at
 * hover-cue frequencies (an earlier numeric-sum trim left it too quiet). Both
 * the pointer-hover path and the scroll-into-focus path call these exact
 * functions, so the page-scroll SFX are normalized in lockstep with the hover
 * SFX -- no separate scroll-volume knob to keep in sync.
 */
const REFERENCE_CUE_PEAK = 0.12;
// playVaultSfx: the earlier trim (0.24) treated the raw numeric sum (~0.5 of a
// ~0.35 sub-bass thud + ~0.15 clank) as if it mapped linearly to loudness. It
// does not -- almost all of that energy sits at 45-120 Hz, which the ear hears
// far more quietly than playHoverSfx's 1200 Hz triangle at the same gain, so the
// 3-protocol-card cue came out audibly weaker than the 5- and 11-module cues on
// every viewport. Re-anchor on the mid-frequency clank layer (900 Hz bandpassed
// noise, 0.2 gain) -- the part perceptually comparable to the hover triangle --
// so it lands on REFERENCE_CUE_PEAK; the sub-bass thud then rides underneath at a
// perceptually matched level.
const VAULT_SFX_TRIM = REFERENCE_CUE_PEAK / 0.2; // 0.6
// playEcosystemHover's loudest theme stacks to ~0.375 of concurrent gain.
const ECOSYSTEM_SFX_TRIM = REFERENCE_CUE_PEAK / 0.375; // 0.32

/**
 * Web Audio API spatial-cue provider. No binary audio assets are bundled --
 * every SFX, including all 11 ecosystem themes, is synthesized (oscillators,
 * filtered noise, envelopes/LFOs), matching the root static site's
 * assets/js/soundscape.js approach. Autoplay-gated behind the first user
 * gesture. Muting is implemented purely via the master gain node.
 *
 * "Whisper" layers (Echo, Aura) are a breathy band-passed noise texture, not
 * synthesized speech -- there's no real voice synthesis here, just a sound
 * design approximation.
 *
 * Ambient bed (owner instruction 2026-08-29, supersedes the 2026-08-26
 * "no persistent audio bed" decision and the 15a93b5 removal): a fully
 * synthesized, very low-level drone (two detuned low oscillators + a slow
 * filter LFO + a faint filtered-noise "air" layer) plays continuously
 * whenever sound is ON, on every device and every page. It routes through
 * the same master gain as the SFX, so muting silences it too -- still
 * exactly one mute path.
 *
 * CRITICAL: browsers block AudioContext output until a user gesture, AND
 * this provider previously defaulted `muted` to true with no explicit path
 * to false -- so even after a gesture resumed the context, playback stayed
 * silenced by the master gain. `unlockAndUnmute()` (called by the AudioGate
 * overlay, and internally by `toggleMuted` when turning sound on) is now
 * the single path that both resumes the context AND sets muted=false in
 * the same user-initiated action.
 *
 * SOUND-ON MANDATE (owner, 2026-08-27): `muted` now defaults to FALSE on
 * every load, on every device. The only thing that flips it to true is the
 * visitor pressing the SoundToggle -- and that single choice is the only
 * value persisted (`unitas_sound_muted` in localStorage). A plain reload
 * with no stored "off" therefore always comes back with sound enabled; it
 * can never be silently muted by a refresh again. Browser autoplay policy
 * still requires one user gesture before any audio is audible -- the
 * AudioGate provides it, and the visibilitychange/pointerdown/keydown
 * hardening below resumes a context that a later reload left suspended.
 */
export function SpatialAudioProvider({ children }: { children: ReactNode }) {
  const [muted, setMuted] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const noiseBufferRef = useRef<AudioBuffer | null>(null);
  const ambientRef = useRef<{ stop: () => void } | null>(null);

  const ensureContext = useCallback(() => {
    if (typeof window === 'undefined') return null;
    if (!ctxRef.current) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return null;
      const ctx: AudioContext = new AudioCtx();
      const masterGain = ctx.createGain();
      masterGain.gain.value = muted ? 0 : BASE_MASTER_GAIN;
      masterGain.connect(ctx.destination);
      ctxRef.current = ctx;
      masterGainRef.current = masterGain;
    }
    return ctxRef.current;
  }, [muted]);

  useEffect(() => {
    if (masterGainRef.current) {
      masterGainRef.current.gain.value = muted ? 0 : BASE_MASTER_GAIN;
    }
  }, [muted]);

  // Sound is ON by default (above). Re-mute ONLY for a visitor who turned it
  // off by hand on a previous visit -- that is the sole persisted state.
  // Runs once after mount so SSR and the first client render agree (both
  // start unmuted), avoiding a hydration mismatch on the SoundToggle icon.
  useEffect(() => {
    if (isSoundMutedByChoice()) {
      setMuted(true);
    }
  }, []);

  const getNoiseBuffer = useCallback((ctx: AudioContext) => {
    if (!noiseBufferRef.current) {
      const length = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
      noiseBufferRef.current = buffer;
    }
    return noiseBufferRef.current;
  }, []);

  /**
   * Builds the continuous ambient bed and returns a stop() that fades it out.
   * StrictMode's double-invoke is handled by the effect below stopping any
   * prior instance before starting a new one.
   */
  const startAmbient = useCallback(
    (ctx: AudioContext): { stop: () => void } => {
      const master = masterGainRef.current;
      const now = ctx.currentTime;

      const bed = ctx.createGain();
      bed.gain.setValueAtTime(0.0001, now);
      bed.gain.exponentialRampToValueAtTime(AMBIENT_GAIN, now + 2.4);

      // Gentle movement: a slow LFO sweeps a lowpass cutoff so the drone
      // breathes instead of sitting as a dead tone.
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 320;
      lp.Q.value = 0.6;
      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.05;
      const lfoDepth = ctx.createGain();
      lfoDepth.gain.value = 120;
      lfo.connect(lfoDepth);
      lfoDepth.connect(lp.frequency);

      lp.connect(bed);
      if (master) bed.connect(master);

      // Two detuned low oscillators -- A1 (55 Hz) + E2 (~82.4 Hz), a hollow fifth.
      const oscSpecs: Array<{ freq: number; type: OscillatorType; detune: number; gain: number }> = [
        { freq: 55, type: 'sine', detune: -4, gain: 0.6 },
        { freq: 82.41, type: 'triangle', detune: 5, gain: 0.32 },
        { freq: 110, type: 'sine', detune: 0, gain: 0.14 },
      ];
      const oscs = oscSpecs.map(({ freq, type, detune, gain }) => {
        const osc = ctx.createOscillator();
        osc.type = type;
        osc.frequency.value = freq;
        osc.detune.value = detune;
        const g = ctx.createGain();
        g.gain.value = gain;
        osc.connect(g);
        g.connect(lp);
        osc.start(now);
        return osc;
      });

      // Faint filtered-noise "air" layer for texture.
      const airSrc = ctx.createBufferSource();
      airSrc.buffer = getNoiseBuffer(ctx);
      airSrc.loop = true;
      const airFilter = ctx.createBiquadFilter();
      airFilter.type = 'bandpass';
      airFilter.frequency.value = 1600;
      airFilter.Q.value = 0.4;
      const airGain = ctx.createGain();
      airGain.gain.value = 0.05;
      airSrc.connect(airFilter);
      airFilter.connect(airGain);
      airGain.connect(bed);
      airSrc.start(now);
      lfo.start(now);

      return {
        stop: () => {
          const t = ctx.currentTime;
          try {
            bed.gain.cancelScheduledValues(t);
            bed.gain.setValueAtTime(Math.max(bed.gain.value, 0.0001), t);
            bed.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
          } catch {
            /* no-op */
          }
          const stopAt = t + 0.7;
          [...oscs, lfo, airSrc].forEach((node) => {
            try {
              node.stop(stopAt);
            } catch {
              /* already stopped */
            }
          });
          window.setTimeout(() => {
            try {
              bed.disconnect();
            } catch {
              /* no-op */
            }
          }, 900);
        },
      };
    },
    [getNoiseBuffer],
  );

  // Drive the ambient bed off `muted`: present whenever sound is on, on every
  // page and device. Pre-gesture the context is suspended so this schedules
  // silently and becomes audible the moment the context resumes.
  useEffect(() => {
    if (muted) return;
    const ctx = ensureContext();
    if (!ctx) return;
    ctx.resume().catch(() => {});
    ambientRef.current?.stop();
    ambientRef.current = startAmbient(ctx);
    return () => {
      ambientRef.current?.stop();
      ambientRef.current = null;
    };
  }, [muted, ensureContext, startAmbient]);

  /**
   * Must be called directly from a user gesture handler (click/keydown) --
   * resumes the AudioContext and unmutes in the same synchronous gesture.
   */
  const unlockAndUnmute = useCallback(() => {
    const ctx = ensureContext();
    if (!ctx) return;
    ctx.resume().catch(() => {});
    setUnlocked(true);
    // Honour a visitor who has deliberately turned sound off before: entering
    // through the gate resumes the context but leaves them muted. Everyone
    // else (the default) gets sound.
    if (!isSoundMutedByChoice()) {
      setMuted(false);
    }
  }, [ensureContext]);

  /**
   * Side effects live here in the handler, not inside a setMuted() updater
   * -- updater functions must stay pure, and React 18 StrictMode
   * double-invokes them in dev, which would otherwise fire ctx.resume()
   * twice per click.
   */
  const toggleMuted = useCallback(() => {
    const next = !muted;
    setMuted(next);
    // The toggle is the ONLY writer of the persisted sound preference.
    storeSoundMuted(next);
    if (!next) {
      // Turning sound ON: make sure the context is actually resumed too,
      // in case the AudioGate was skipped.
      const ctx = ensureContext();
      if (ctx) {
        ctx.resume().catch(() => {});
        setUnlocked(true);
      }
    }
  }, [muted, ensureContext]);

  // Hardening: some browsers (mobile Safari especially) silently suspend a
  // running AudioContext on tab-backgrounding or power-saving. If the user
  // has sound on, resume on the next real interaction or when the tab comes
  // back into view, so playback never gets stuck silent without the user
  // ever explicitly muting it.
  useEffect(() => {
    if (muted) return;

    function resumeIfSuspended() {
      const ctx = ctxRef.current;
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
    }

    const opts: AddEventListenerOptions = { passive: true };
    document.addEventListener('visibilitychange', resumeIfSuspended);
    window.addEventListener('pointerdown', resumeIfSuspended, opts);
    window.addEventListener('touchstart', resumeIfSuspended, opts);
    window.addEventListener('wheel', resumeIfSuspended, opts);
    window.addEventListener('keydown', resumeIfSuspended);
    return () => {
      document.removeEventListener('visibilitychange', resumeIfSuspended);
      window.removeEventListener('pointerdown', resumeIfSuspended);
      window.removeEventListener('touchstart', resumeIfSuspended);
      window.removeEventListener('wheel', resumeIfSuspended);
      window.removeEventListener('keydown', resumeIfSuspended);
    };
  }, [muted]);

  const playSpatialPing = useCallback(
    (pan = 0) => {
      const ctx = ensureContext();
      const master = masterGainRef.current;
      if (!ctx || !master) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const panner = ctx.createStereoPanner();

      osc.type = 'sine';
      osc.frequency.value = 660;
      panner.pan.value = Math.max(-1, Math.min(1, pan));

      const now = ctx.currentTime;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.3, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(panner);
      panner.connect(master);

      osc.start(now);
      osc.stop(now + 0.4);
    },
    [ensureContext],
  );

  const playHoverSfx = useCallback(
    (pan = 0) => {
      const ctx = ensureContext();
      const master = masterGainRef.current;
      if (!ctx || !master) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const panner = ctx.createStereoPanner();

      osc.type = 'triangle';
      osc.frequency.value = 1200;
      panner.pan.value = Math.max(-1, Math.min(1, pan));

      const now = ctx.currentTime;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.12, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc.connect(gain);
      gain.connect(panner);
      panner.connect(master);

      osc.start(now);
      osc.stop(now + 0.15);
    },
    [ensureContext],
  );

  const playSearchFocusSfx = useCallback(() => {
    const ctx = ensureContext();
    const master = masterGainRef.current;
    if (!ctx || !master) return;

    const now = ctx.currentTime;

    // Rising pitched sweep -- the "activation" feel.
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(1800, now + 0.09);
    oscGain.gain.setValueAtTime(0, now);
    oscGain.gain.linearRampToValueAtTime(0.16, now + 0.015);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    const oscFilter = ctx.createBiquadFilter();
    oscFilter.type = 'bandpass';
    oscFilter.frequency.value = 1600;
    oscFilter.Q.value = 6;

    osc.connect(oscFilter);
    oscFilter.connect(oscGain);
    oscGain.connect(master);
    osc.start(now);
    osc.stop(now + 0.16);

    // Crisp digital noise transient layered on top for a "click" texture.
    const buffer = getNoiseBuffer(ctx);
    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = buffer;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.value = 6000;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.09, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);

    noiseSrc.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(master);
    noiseSrc.start(now);
    noiseSrc.stop(now + 0.03);
  }, [ensureContext, getNoiseBuffer]);

  const playQuestEnterSfx = useCallback(() => {
    const ctx = ensureContext();
    const master = masterGainRef.current;
    if (!ctx || !master) return;

    const now = ctx.currentTime;
    const notes = [440, 660, 880]; // rising arpeggio -- an "access granted" cue
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;

      const start = now + i * 0.07;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.25, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.3);

      osc.connect(gain);
      gain.connect(master);
      osc.start(start);
      osc.stop(start + 0.32);
    });
  }, [ensureContext]);

  const playTypingTick = useCallback(() => {
    const ctx = ensureContext();
    const master = masterGainRef.current;
    if (!ctx || !master) return;

    const buffer = getNoiseBuffer(ctx);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 4000;
    const gain = ctx.createGain();

    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(now);
    src.stop(now + 0.04);
  }, [ensureContext, getNoiseBuffer]);

  const playVaultSfx = useCallback(() => {
    const ctx = ensureContext();
    const master = masterGainRef.current;
    if (!ctx || !master) return;

    const now = ctx.currentTime;

    // Normalization trim: brings the whole vault cue down to the shared
    // REFERENCE_CUE_PEAK (playHoverSfx) level on every viewport.
    const trim = ctx.createGain();
    trim.gain.value = VAULT_SFX_TRIM;
    trim.connect(master);

    // Low mechanical thud.
    const thud = ctx.createOscillator();
    thud.type = 'sine';
    thud.frequency.setValueAtTime(120, now);
    thud.frequency.exponentialRampToValueAtTime(45, now + 0.25);
    const thudGain = ctx.createGain();
    thudGain.gain.setValueAtTime(0.35, now);
    thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    thud.connect(thudGain);
    thudGain.connect(trim);
    thud.start(now);
    thud.stop(now + 0.42);

    // Metallic clank layer (filtered noise burst).
    const buffer = getNoiseBuffer(ctx);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 900;
    filter.Q.value = 6;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(trim);
    src.start(now);
    src.stop(now + 0.22);
  }, [ensureContext, getNoiseBuffer]);

  const playEcosystemHover = useCallback(
    (theme: string, pan = 0) => {
      const ctx = ensureContext();
      const master = masterGainRef.current;
      if (!ctx || !master) return;

      const now = ctx.currentTime;

      // Normalization trim: every ecosystem theme cue (hover AND scroll-into-
      // focus) is pulled down through this to the shared REFERENCE_CUE_PEAK
      // (playHoverSfx) level, identically on PC, tablet and mobile.
      const trim = ctx.createGain();
      trim.gain.value = ECOSYSTEM_SFX_TRIM;
      trim.connect(master);

      const panner = ctx.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, pan));
      panner.connect(trim);

      const tone = (
        freq: number,
        start: number,
        duration: number,
        opts: { type?: OscillatorType; gain?: number; detune?: number; freqTo?: number } = {},
      ) => {
        const osc = ctx.createOscillator();
        osc.type = opts.type ?? 'sine';
        osc.frequency.setValueAtTime(freq, start);
        if (opts.freqTo) osc.frequency.exponentialRampToValueAtTime(opts.freqTo, start + duration);
        if (opts.detune) osc.detune.value = opts.detune;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, start);
        g.gain.linearRampToValueAtTime(opts.gain ?? 0.2, start + Math.min(0.02, duration / 4));
        g.gain.exponentialRampToValueAtTime(0.001, start + duration);
        osc.connect(g);
        g.connect(panner);
        osc.start(start);
        osc.stop(start + duration + 0.02);
      };

      const noise = (
        start: number,
        duration: number,
        opts: { filterType?: BiquadFilterType; freq?: number; q?: number; gain?: number } = {},
      ) => {
        const buffer = getNoiseBuffer(ctx);
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        const filter = ctx.createBiquadFilter();
        filter.type = opts.filterType ?? 'bandpass';
        filter.frequency.value = opts.freq ?? 2000;
        filter.Q.value = opts.q ?? 3;
        const g = ctx.createGain();
        g.gain.setValueAtTime(opts.gain ?? 0.15, start);
        g.gain.exponentialRampToValueAtTime(0.001, start + duration);
        src.connect(filter);
        filter.connect(g);
        g.connect(panner);
        src.start(start);
        src.stop(start + duration + 0.02);
      };

      switch (theme) {
        case 'echo': // water drop + repeating echo + breathy whisper tail
          tone(1400, now, 0.15, { type: 'sine', gain: 0.22 });
          tone(1400, now + 0.14, 0.12, { type: 'sine', gain: 0.12 });
          tone(1400, now + 0.26, 0.1, { type: 'sine', gain: 0.06 });
          noise(now + 0.05, 0.5, { filterType: 'bandpass', freq: 3200, q: 1.2, gain: 0.03 });
          break;
        case 'void': // vacuum tear -- fast descending sweep into silence
          tone(600, now, 0.5, { type: 'sawtooth', freqTo: 30, gain: 0.18 });
          noise(now, 0.3, { filterType: 'lowpass', freq: 400, q: 0.5, gain: 0.08 });
          break;
        case 'mirror': // mech scan blip
          noise(now, 0.18, { filterType: 'highpass', freq: 3500, q: 2, gain: 0.14 });
          tone(2200, now, 0.15, { type: 'square', freqTo: 3400, gain: 0.06 });
          break;
        case 'oracle': // choir-like triad + music-box shimmer
          tone(523.25, now, 0.6, { type: 'triangle', gain: 0.14 });
          tone(659.25, now + 0.05, 0.55, { type: 'triangle', gain: 0.12 });
          tone(783.99, now + 0.1, 0.5, { type: 'triangle', gain: 0.1 });
          tone(1567.98, now + 0.15, 0.3, { type: 'sine', gain: 0.05 });
          break;
        case 'pulse': // double heartbeat thump
          tone(90, now, 0.14, { type: 'sine', gain: 0.32 });
          tone(90, now + 0.18, 0.14, { type: 'sine', gain: 0.24 });
          break;
        case 'apex': // ticking countdown
          [0, 0.1, 0.2].forEach((offset) => tone(1800, now + offset, 0.04, { type: 'square', gain: 0.1 }));
          break;
        case 'genesis': // crystal chime cluster
          [1046.5, 1318.5, 1568, 2093].forEach((freq, i) =>
            tone(freq, now + i * 0.04, 0.5 - i * 0.05, { type: 'sine', gain: 0.1 }),
          );
          break;
        case 'syndicate': // radio static + pitch-swept tuning
          noise(now, 0.35, { filterType: 'bandpass', freq: 1500, q: 0.8, gain: 0.18 });
          tone(400, now, 0.3, { type: 'sawtooth', freqTo: 900, gain: 0.05 });
          break;
        case 'aura': // slow synth pad swell + breathy whisper
          tone(220, now, 1.1, { type: 'sine', gain: 0.1, detune: -8 });
          tone(277.18, now, 1.1, { type: 'sine', gain: 0.08, detune: 6 });
          noise(now + 0.1, 0.9, { filterType: 'bandpass', freq: 2600, q: 1, gain: 0.025 });
          break;
        case 'paradox': // reversed metallic pluck -- swells up then cuts (inverse envelope)
          tone(1800, now, 0.4, { type: 'sawtooth', freqTo: 500, gain: 0.16 });
          noise(now, 0.4, { filterType: 'highpass', freq: 2000, q: 4, gain: 0.06 });
          break;
        case 'chronos': // heavy clockwork tick-tock with metallic resonance
          tone(180, now, 0.08, { type: 'square', gain: 0.2 });
          tone(180, now + 0.35, 0.08, { type: 'square', gain: 0.18 });
          noise(now, 0.05, { filterType: 'bandpass', freq: 2500, q: 8, gain: 0.05 });
          noise(now + 0.35, 0.05, { filterType: 'bandpass', freq: 2500, q: 8, gain: 0.045 });
          break;
        default:
          tone(900, now, 0.15, { gain: 0.15 });
      }
    },
    [ensureContext, getNoiseBuffer],
  );

  useEffect(() => {
    return () => {
      ctxRef.current?.close().catch(() => {});
    };
  }, []);

  const value = useMemo(
    () => ({
      muted,
      unlocked,
      toggleMuted,
      unlockAndUnmute,
      playSpatialPing,
      playHoverSfx,
      playSearchFocusSfx,
      playQuestEnterSfx,
      playTypingTick,
      playEcosystemHover,
      playVaultSfx,
    }),
    [
      muted,
      unlocked,
      toggleMuted,
      unlockAndUnmute,
      playSpatialPing,
      playHoverSfx,
      playSearchFocusSfx,
      playQuestEnterSfx,
      playTypingTick,
      playEcosystemHover,
      playVaultSfx,
    ],
  );

  return (
    <SpatialAudioContext.Provider value={value}>{children}</SpatialAudioContext.Provider>
  );
}

export function useSpatialAudio() {
  const ctx = useContext(SpatialAudioContext);
  if (!ctx) {
    throw new Error('useSpatialAudio must be used within a SpatialAudioProvider');
  }
  return ctx;
}
