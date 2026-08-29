'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

// useLayoutEffect warns during SSR; fall back to useEffect on the server.
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

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

/**
 * Persistent audio preference. Absent OR 'on' => sound is ON by default on
 * every device and every page load (home + each module). Only an explicit
 * user mute writes 'off', and that survives F5 / full reloads. This is the
 * fix for "sound silently OFF after refresh": `muted` no longer resets to a
 * hardcoded true on mount -- it is rehydrated from here.
 */
const AUDIO_PREF_KEY = 'unitas_audio_pref';

/** Ambient bed level (under BASE_MASTER_GAIN). Deliberately low -- a presence, not a soundtrack. */
const AMBIENT_GAIN = 0.05;

function readAudioPrefMuted(): boolean {
  if (typeof window === 'undefined') return true; // SSR / first paint parity
  try {
    return window.localStorage.getItem(AUDIO_PREF_KEY) === 'off';
  } catch {
    return false; // storage blocked -> default ON
  }
}

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
 * "no persistent audio bed" decision): a fully synthesized, very low-level
 * drone (two detuned low oscillators + a slow filter LFO + a faint filtered-
 * noise "air" layer) plays continuously whenever sound is ON, on every
 * device and every page. It routes through the same master gain as the SFX,
 * so muting silences it too -- there is still exactly one mute path.
 *
 * CRITICAL: browsers block AudioContext output until a user gesture. `muted`
 * now rehydrates from localStorage (`unitas_audio_pref`) and defaults to
 * false (sound ON) when no explicit 'off' was ever stored, so a refresh
 * never silently flips sound off. The context still needs a gesture to
 * actually produce sound: the AudioGate is that gesture on first visit, and
 * after an in-session reload the existing pointerdown/keydown/visibilitychange
 * resume handler below revives a suspended context on the very next
 * interaction while `muted` stays false the whole time.
 */
export function SpatialAudioProvider({ children }: { children: ReactNode }) {
  // Start from the SSR-safe default (true) so server and first client render
  // match, then rehydrate synchronously from localStorage in a layout effect
  // before paint -- see the effect below.
  const [muted, setMuted] = useState(true);
  const [unlocked, setUnlocked] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const noiseBufferRef = useRef<AudioBuffer | null>(null);
  const hydratedRef = useRef(false);
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

  // Rehydrate the persisted preference before the first paint so the sound
  // toggle never flashes the wrong state, and sound is ON unless the user
  // explicitly turned it off in a previous session.
  useIsomorphicLayoutEffect(() => {
    const prefMuted = readAudioPrefMuted();
    if (prefMuted !== muted) setMuted(prefMuted);
    hydratedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist every change (but not the initial hydration write-back).
  useEffect(() => {
    if (!hydratedRef.current) return;
    try {
      window.localStorage.setItem(AUDIO_PREF_KEY, muted ? 'off' : 'on');
    } catch {
      /* storage blocked -- in-memory state still holds for this session */
    }
  }, [muted]);

  useEffect(() => {
    if (masterGainRef.current) {
      masterGainRef.current.gain.value = muted ? 0 : BASE_MASTER_GAIN;
    }
  }, [muted]);

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
   * Idempotent-safe: callers null out ambientRef, and StrictMode's
   * double-invoke is handled by the effect below stopping any prior instance
   * before starting a new one.
   */
  const startAmbient = useCallback(
    (ctx: AudioContext): { stop: () => void } => {
      const master = masterGainRef.current;
      const now = ctx.currentTime;

      const bed = ctx.createGain();
      bed.gain.setValueAtTime(0.0001, now);
      // ZERO-DELAY SYMPHONY (owner instruction 2026-08-29): the bed reaches
      // full level in ~0.7s instead of 2.4s so the soundscape is present the
      // instant a page/render appears -- no silent lead-in.
      bed.gain.exponentialRampToValueAtTime(AMBIENT_GAIN, now + 0.7);

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
    setMuted(false);

    // Immediate "arrival" impact so crossing the gate is never silent while
    // the ambient bed ramps up behind it (zero-delay symphony).
    const master = masterGainRef.current;
    if (master) {
      const now = ctx.currentTime;
      const boom = ctx.createOscillator();
      boom.type = 'sine';
      boom.frequency.setValueAtTime(150, now);
      boom.frequency.exponentialRampToValueAtTime(40, now + 1.4);
      const boomGain = ctx.createGain();
      boomGain.gain.setValueAtTime(0.0001, now);
      boomGain.gain.linearRampToValueAtTime(0.5, now + 0.02);
      boomGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.6);
      boom.connect(boomGain);
      boomGain.connect(master);
      boom.start(now);
      boom.stop(now + 1.7);

      const shimmer = ctx.createOscillator();
      shimmer.type = 'triangle';
      shimmer.frequency.setValueAtTime(320, now);
      shimmer.frequency.exponentialRampToValueAtTime(1280, now + 0.9);
      const shimmerGain = ctx.createGain();
      shimmerGain.gain.setValueAtTime(0.0001, now);
      shimmerGain.gain.linearRampToValueAtTime(0.14, now + 0.04);
      shimmerGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.1);
      shimmer.connect(shimmerGain);
      shimmerGain.connect(master);
      shimmer.start(now);
      shimmer.stop(now + 1.2);
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

  // Hardening: browsers create every AudioContext suspended and require a
  // gesture to start it, AND some (mobile Safari especially) silently
  // re-suspend a running context on tab-backgrounding or power-saving. This
  // is also what revives sound after an in-session F5: `muted` has already
  // rehydrated to false, and the very first interaction of any kind resumes
  // the fresh (suspended) context so the ambient bed + SFX come back without
  // the visitor ever seeing the entry gate again or touching the toggle.
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
    const buffer = getNoiseBuffer(ctx);

    // Owner instruction 2026-08-29: 3대 모듈 박스 타격감 대폭 상향 + 음색 튜닝.
    // Four stacked layers -- deep sub-impact, a body thud, a metallic clank and
    // a resonant ring tail -- so the B2B card cue lands like a real vault door
    // instead of a soft click.

    // 1. Deep sub-impact (chest-hit weight).
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(96, now);
    sub.frequency.exponentialRampToValueAtTime(28, now + 0.3);
    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(0.55, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    sub.connect(subGain);
    subGain.connect(master);
    sub.start(now);
    sub.stop(now + 0.52);

    // 2. Body thud -- triangle gives a woodier "door slab" tone than a pure sine.
    const body = ctx.createOscillator();
    body.type = 'triangle';
    body.frequency.setValueAtTime(190, now);
    body.frequency.exponentialRampToValueAtTime(58, now + 0.22);
    const bodyGain = ctx.createGain();
    bodyGain.gain.setValueAtTime(0.34, now);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.34);
    body.connect(bodyGain);
    bodyGain.connect(master);
    body.start(now);
    body.stop(now + 0.36);

    // 3. Metallic clank (bolt slam) -- filtered noise burst.
    const clank = ctx.createBufferSource();
    clank.buffer = buffer;
    const clankFilter = ctx.createBiquadFilter();
    clankFilter.type = 'bandpass';
    clankFilter.frequency.value = 760;
    clankFilter.Q.value = 7;
    const clankGain = ctx.createGain();
    clankGain.gain.setValueAtTime(0.3, now);
    clankGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    clank.connect(clankFilter);
    clankFilter.connect(clankGain);
    clankGain.connect(master);
    clank.start(now);
    clank.stop(now + 0.24);

    // 4. Resonant ring tail -- a high, narrow band that keeps humming for ~0.5s
    // so the hit has a lingering steel-vault character ("타격감").
    const ring = ctx.createBufferSource();
    ring.buffer = buffer;
    const ringFilter = ctx.createBiquadFilter();
    ringFilter.type = 'bandpass';
    ringFilter.frequency.value = 2600;
    ringFilter.Q.value = 14;
    const ringGain = ctx.createGain();
    ringGain.gain.setValueAtTime(0.14, now + 0.02);
    ringGain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    ring.connect(ringFilter);
    ringFilter.connect(ringGain);
    ringGain.connect(master);
    ring.start(now);
    ring.stop(now + 0.57);
  }, [ensureContext, getNoiseBuffer]);

  const playEcosystemHover = useCallback(
    (theme: string, pan = 0) => {
      const ctx = ensureContext();
      const master = masterGainRef.current;
      if (!ctx || !master) return;

      const now = ctx.currentTime;
      const panner = ctx.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, pan));
      panner.connect(master);

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
