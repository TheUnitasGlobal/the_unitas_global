'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Volume2, VolumeX } from 'lucide-react';
import { usePathname, useRouter } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { GlobalLanguagePicker } from '@/components/i18n/GlobalLanguagePicker';
import { CinemaAppDownload } from '@/components/pwa/CinemaAppDownload';
import {
  persistFounderBypass,
  readFounderBypass,
  revokeFounderBypass,
} from '@/lib/foundersGate';
import {
  CINEMA_DURATION_MS,
  cinemaOverallProgress,
  cinemaSegmentAt,
  drawCinemaFrame,
  seedCinemaField,
} from '@/lib/comingSoonSequence';

/**
 * gate     -> glassmorphism entry screen (public + founder, identical)
 * cinema   -> 30s canvas + CSS cinematic, mysterious keyword typography only
 * sealed   -> TERMINAL for everyone: "COMING SOON" locked screen, dimmed loop
 *             behind. PUBLIC has no path past this -- ever. FOUNDER gets one
 *             extra secret button here that flips to `released`.
 * released -> FOUNDER only: curtain dissolves, the real site is revealed
 */
type Phase = 'gate' | 'cinema' | 'sealed' | 'released';
type Mode = 'public' | 'founder';

const PHASE_KEY = 'unitas_cinema_phase';
const LOCALE_PREF_KEY = 'unitas_locale_pref';
const LOCALE_AUTO_KEY = 'unitas_locale_autodetected';
// components/audio/AudioGate.tsx STORAGE_KEY -- once the founder has crossed
// THIS gate + sat through the cinema, don't make them clear a second entry
// screen on the far side (only matters if the page later hard-reloads).
const AUDIO_GATE_SEEN_KEY = 'unitas_audio_gate_seen';

// AUDIO PURIFY (owner instruction 2026-08-29): the pre-launch cinematic
// soundtrack is now ONLY a calm, focus-inducing, deeply-curious, extremely
// mysterious high-end ambient bed. The old chest-thumping ~37 Hz sub-drone
// and the low "boom" arrival impact -- the grating "웅~~" -- are DELETED
// outright: there is no sub-bass rumble here anymore. Presence comes from
// harmonic weight in the low-MID register, a slow-breathing cathedral pad,
// sparse consonant bells and an airy high shimmer -- never from level or
// sub weight. Master also drops so the 30s ad never feels loud.
const CINEMA_MASTER_GAIN = 0.3;

// Each cinema segment now renders as a two-line high-end keyword lockup:
// an English keyword HEAD + a localized, riddle-like SUB line beneath it.
type CaptionSlot = 'Head' | 'Sub';
type CaptionKey =
  | 'cinemaS1Head' | 'cinemaS1Sub'
  | 'cinemaS2Head' | 'cinemaS2Sub'
  | 'cinemaS3Head' | 'cinemaS3Sub'
  | 'cinemaS4Head' | 'cinemaS4Sub'
  | 'cinemaS5Head' | 'cinemaS5Sub';
const captionKeyFor = (segId: number, slot: CaptionSlot): CaptionKey =>
  `cinemaS${Math.min(Math.max(segId, 1), 5)}${slot}` as CaptionKey;

/**
 * Pre-launch curtain.
 *
 * PUBLIC: a permanent, non-dismissable overlay -- entry gate -> 30s cinematic
 * -> sealed "Coming Soon" screen. The main interface is never reachable and no
 * control that could reach it is ever rendered (fail-closed).
 *
 * FOUNDER (build/QA -- ?dev=true | ?key=<secret> | ?dev=skip | ?dev=replay |
 * persisted grant): walks the EXACT SAME sequential flow -- entry gate ->
 * cinematic -> sealed "Coming Soon" -- so the founder monitors every screen a
 * real visitor sees. The ONLY difference: on that final sealed screen the
 * founder (and only the founder) is shown a secret
 * "[ 창립자 전용 메인 사이트 진입 ]" button that dissolves the curtain into
 * the real homepage. ?dev=skip is a QA shortcut straight to that release.
 *
 * Mounted in app/[locale]/layout.tsx AFTER <AudioGate/> and outside
 * `.dashboard-zoom`. Client Component, but Next App Router SSRs it, so the
 * opaque overlay is in the initial HTML -- no flash of the real site. Fail
 * closed: initial state is always the gate; only an effect can reveal the site.
 *
 * BLACK-SCREEN FIX: the <canvas> is a permanent, top-level child of the curtain
 * (never wrapped in an AnimatePresence that could delay its mount), so its ref
 * is live the instant the cinema phase begins and the rAF loop starts on the
 * next frame. On top of that the CSS backdrop layers (.cs-core / .cs-horizon /
 * .cs-grain) animate on the compositor from frame zero, so there is visible
 * motion even before the first canvas frame paints.
 */
export function ComingSoonCinema() {
  const t = useTranslations('ComingSoonGate');
  const tGate = useTranslations('AudioGate');
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const reduceMotion = useReducedMotion();

  const [mode, setMode] = useState<Mode>('public');
  const [phase, setPhase] = useState<Phase>('gate');
  const [segId, setSegId] = useState(1);
  const [muted, setMuted] = useState(false);
  const [autoLocalized, setAutoLocalized] = useState(false);

  const field = useMemo(() => seedCinemaField(), []);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const progressRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);
  const audioRef = useRef<{
    ctx: AudioContext;
    master: GainNode;
    phaseCue: () => void;
    stop: () => void;
  } | null>(null);
  const prevSegRef = useRef(1);

  // Everyone -- public AND founder -- ends the cinematic on the same locked
  // 'sealed' "COMING SOON" screen; the founder just gets an extra button there.
  const isFounder = mode === 'founder';

  // --- founder bypass + persisted phase --------------------------------------
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const dev = params.get('dev');

    if (dev === 'off') {
      revokeFounderBypass();
      try {
        sessionStorage.removeItem(PHASE_KEY);
      } catch {
        /* no-op */
      }
      return; // stay public, stay on the gate
    }

    const qaReplay = dev === 'replay' || dev === 'reset' || params.get('replay') === '1';
    const qaSkip = dev === 'skip' || params.get('skip') === '1';
    const founder = readFounderBypass() || qaReplay || qaSkip;

    if (founder) {
      persistFounderBypass();
      setMode('founder');

      if (qaReplay) {
        try {
          sessionStorage.removeItem(PHASE_KEY);
        } catch {
          /* no-op */
        }
        return; // full flow from the gate
      }
      if (qaSkip) {
        setPhase('released');
        return;
      }
    }

    try {
      const saved = sessionStorage.getItem(PHASE_KEY);
      // 'released' is founder-only; a public browser that somehow has it stored
      // still resolves to the locked screen.
      if (saved === 'released') setPhase(founder ? 'released' : 'sealed');
      else if (saved === 'sealed') setPhase('sealed');
      else if (saved === 'cinema') setPhase('cinema');
    } catch {
      /* storage unavailable -- stay on the gate */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(PHASE_KEY, phase);
    } catch {
      /* no-op */
    }
  }, [phase]);

  // --- auto-localization to navigator.language -----------------------------
  useEffect(() => {
    let manual: string | null = null;
    let already: string | null = null;
    try {
      manual = localStorage.getItem(LOCALE_PREF_KEY);
      already = localStorage.getItem(LOCALE_AUTO_KEY);
    } catch {
      /* no-op */
    }
    if (manual || already) return;

    const detected = (navigator.languages ?? [navigator.language])
      .map((tag) => tag?.split('-')[0]?.toLowerCase())
      .find((code) => code && (routing.locales as readonly string[]).includes(code));

    try {
      localStorage.setItem(LOCALE_AUTO_KEY, '1');
    } catch {
      /* no-op */
    }

    if (detected && detected !== locale) {
      setAutoLocalized(true);
      router.replace(pathname, { locale: detected });
    }
    // run once on first load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- cinematic soundtrack (Web Audio API, fully synthesized, gesture-gated) ---
  //
  // "잔잔하며 집중력·깊은 호기심·극도의 신비감" (owner instruction 2026-08-29).
  // No audio files -- every layer is oscillators + filtered noise, matching the
  // Low-Memory Armor / no-binary-assets rule. Deliberately NO sub-bass:
  //
  //   1. ROOT WARMTH   -- a soft low-MID stack on D (D2/A2/D3/A3, lowest tone
  //      73 Hz -- nothing below it), detuned stereo pairs, under a gently
  //      breathing lowpass. This is a warm floor, not a rumble.
  //   2. CATHEDRAL PAD -- a Dsus2 triad an octave up (D4/E4/A4) on triangle
  //      waves, cross-drifting so it never sits still -- the mysterious body.
  //   3. SHIMMER MOTES -- sparse, consonant D-minor-pentatonic sine bells
  //      panned across the field -- "신비감" / "깊은 호기심".
  //   4. AIR SHIMMER   -- a continuous, near-silent high band-passed noise
  //      veil (~7 kHz) plus a slow airy riser -- the "high-end" top that
  //      replaces the old felt-not-heard low swell.
  //
  // ZERO-DELAY SYMPHONY: master rises in 0.3s, the warmth + pad start at t0
  // with a fast 1.1s "bloom" envelope, and a one-shot SOFT arrival swell
  // (rising airy bloom only -- no boom, no sub) fires on the same frame
  // `enter()` is called, so there is never a beat of silence, and never a thud.
  const startAmbient = useCallback(() => {
    if (audioRef.current || typeof window === 'undefined') return;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const master = ctx.createGain();
    master.gain.setValueAtTime(0, now);
    master.gain.linearRampToValueAtTime(CINEMA_MASTER_GAIN, now + 0.3);
    master.connect(ctx.destination);

    // AUDIO BALANCE (owner instruction 2026-08-30): the sustained ambient BGM
    // drops so the 30s ad stays gentle on the ears, while the discrete
    // phase-transition cues (see `phaseCue` below) fire at full presence
    // through `master` for a clean sense of "타격감". Everything continuous
    // (root warmth, cathedral pad, air veil) routes through `bedGain`;
    // one-shot / sparkle layers stay on `master` so they read louder
    // relative to the quieter bed.
    const bedGain = ctx.createGain();
    bedGain.gain.value = 0.66;
    bedGain.connect(master);

    // A gentle high-pass on the whole bed guarantees nothing sub-70 Hz ever
    // reaches the speakers -- the structural fix for the "웅~~" complaint.
    const subKill = ctx.createBiquadFilter();
    subKill.type = 'highpass';
    subKill.frequency.value = 68;
    subKill.Q.value = 0.5;
    subKill.connect(bedGain);

    const disposables: Array<{ stop: (t: number) => void }> = [];
    const track = (node: AudioScheduledSourceNode) => {
      disposables.push({ stop: (t) => { try { node.stop(t); } catch { /* already stopped */ } } });
      return node;
    };

    // shared noise buffer (2s white noise, looped) for the air layers
    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const nd = noiseBuffer.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

    // ---- 1. root warmth (NO sub -- lowest tone is D2 73.42 Hz) ------------
    const droneFilter = ctx.createBiquadFilter();
    droneFilter.type = 'lowpass';
    droneFilter.frequency.value = 480;
    droneFilter.Q.value = 1.2;
    droneFilter.connect(subKill);

    const breath = ctx.createOscillator();
    breath.type = 'sine';
    breath.frequency.value = 0.035; // ~28s period -- glacial, non-repetitive feel
    const breathDepth = ctx.createGain();
    breathDepth.gain.value = 90;
    breath.connect(breathDepth);
    breathDepth.connect(droneFilter.frequency);
    track(breath).start(now);

    // D2 73.42 · A2 110.00 · D3 146.83 · A3 220.00 (root + fifth + octave + fifth)
    const droneSpecs: Array<{ f: number; type: OscillatorType; g: number; det: number; pan: number }> = [
      { f: 73.42, type: 'sine', g: 0.1, det: -5, pan: -0.22 },
      { f: 73.42, type: 'sine', g: 0.085, det: 6, pan: 0.22 },
      { f: 110.0, type: 'sine', g: 0.075, det: -3, pan: 0.3 },
      { f: 146.83, type: 'triangle', g: 0.05, det: 4, pan: -0.3 },
      { f: 220.0, type: 'sine', g: 0.03, det: -6, pan: 0.15 },
    ];
    droneSpecs.forEach(({ f, type, g, det, pan }) => {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = f;
      osc.detune.value = det;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(g, now + 1.1); // fast bloom (zero-delay)
      const panner = ctx.createStereoPanner();
      panner.pan.value = pan;
      osc.connect(gain);
      gain.connect(panner);
      panner.connect(droneFilter);
      track(osc).start(now);
    });

    // ---- 2. cathedral pad (Dsus2 an octave up: D4 · E4 · A4) ---------------
    const padBus = ctx.createGain();
    padBus.gain.value = 0.9;
    const padFilter = ctx.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.value = 1600;
    padFilter.Q.value = 0.7;
    padBus.connect(padFilter);
    padFilter.connect(subKill);

    const padSwell = ctx.createOscillator();
    padSwell.type = 'sine';
    padSwell.frequency.value = 0.06; // slow cross-drift so the chord "breathes"
    const padSwellDepth = ctx.createGain();
    padSwellDepth.gain.value = 0.18;
    padSwell.connect(padSwellDepth);
    padSwellDepth.connect(padBus.gain);
    track(padSwell).start(now);

    [293.66, 329.63, 440.0].forEach((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = f;
      osc.detune.value = (i - 1) * 4;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.05, now + 1.1); // audible immediately...
      gain.gain.linearRampToValueAtTime(0.07, now + 6); // ...then keeps blooming
      const panner = ctx.createStereoPanner();
      panner.pan.value = (i - 1) * 0.4;
      osc.connect(gain);
      gain.connect(panner);
      panner.connect(padBus);
      track(osc).start(now);
    });

    // ---- 3. shimmer motes (D minor pentatonic: D5 F5 A5 C6 E6) -------------
    const PENT = [587.33, 698.46, 880.0, 1046.5, 1318.51];
    let motesActive = true;
    const scheduleMote = () => {
      if (!motesActive || ctx.state === 'closed') return;
      const b = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = PENT[Math.floor(Math.random() * PENT.length)];
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, b);
      g.gain.linearRampToValueAtTime(0.024, b + 0.5);
      g.gain.exponentialRampToValueAtTime(0.0001, b + 4.5);
      const panner = ctx.createStereoPanner();
      panner.pan.value = Math.random() * 1.6 - 0.8;
      osc.connect(g);
      g.connect(panner);
      panner.connect(master);
      osc.start(b);
      osc.stop(b + 4.7);
      moteTimer = window.setTimeout(scheduleMote, 8000 + Math.random() * 5000);
    };
    let moteTimer = window.setTimeout(scheduleMote, 1800);

    // ---- 4a. continuous air-shimmer veil (near-silent high band) ----------
    const veilSrc = ctx.createBufferSource();
    veilSrc.buffer = noiseBuffer;
    veilSrc.loop = true;
    const veilFilter = ctx.createBiquadFilter();
    veilFilter.type = 'bandpass';
    veilFilter.frequency.value = 7200;
    veilFilter.Q.value = 0.8;
    const veilGain = ctx.createGain();
    veilGain.gain.setValueAtTime(0.0001, now);
    veilGain.gain.linearRampToValueAtTime(0.012, now + 3);
    veilSrc.connect(veilFilter);
    veilFilter.connect(veilGain);
    veilGain.connect(bedGain);
    track(veilSrc).start(now);

    // ---- 4b. slow airy riser (high band-passed noise, never a low rumble) --
    let swellActive = true;
    const scheduleSwell = () => {
      if (!swellActive || ctx.state === 'closed') return;
      const b = ctx.currentTime;
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer;
      src.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(900, b);
      bp.frequency.exponentialRampToValueAtTime(3200, b + 5);
      bp.Q.value = 1.1;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, b);
      g.gain.linearRampToValueAtTime(0.028, b + 4);
      g.gain.exponentialRampToValueAtTime(0.0001, b + 8);
      src.connect(bp);
      bp.connect(g);
      g.connect(master);
      src.start(b);
      src.stop(b + 8.3);
      swellTimer = window.setTimeout(scheduleSwell, 20000 + Math.random() * 6000);
    };
    let swellTimer = window.setTimeout(scheduleSwell, 6000);

    // ---- arrival swell (one-shot, SOFT -- rising airy bloom, no boom/sub) --
    const bloom = ctx.createOscillator();
    bloom.type = 'triangle';
    bloom.frequency.setValueAtTime(330, now);
    bloom.frequency.exponentialRampToValueAtTime(990, now + 1.6);
    const bloomFilter = ctx.createBiquadFilter();
    bloomFilter.type = 'bandpass';
    bloomFilter.frequency.value = 800;
    bloomFilter.Q.value = 2;
    const bloomGain = ctx.createGain();
    bloomGain.gain.setValueAtTime(0.0001, now);
    bloomGain.gain.linearRampToValueAtTime(0.085, now + 0.12);
    bloomGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.9);
    bloom.connect(bloomFilter);
    bloomFilter.connect(bloomGain);
    bloomGain.connect(master);
    track(bloom).start(now);
    bloom.stop(now + 2);

    // a single soft consonant bell (A5) to mark arrival without any impact
    const arriveBell = ctx.createOscillator();
    arriveBell.type = 'sine';
    arriveBell.frequency.value = 880;
    const arriveBellGain = ctx.createGain();
    arriveBellGain.gain.setValueAtTime(0.0001, now);
    arriveBellGain.gain.linearRampToValueAtTime(0.038, now + 0.15);
    arriveBellGain.gain.exponentialRampToValueAtTime(0.0001, now + 3);
    arriveBell.connect(arriveBellGain);
    arriveBellGain.connect(master);
    track(arriveBell).start(now);
    arriveBell.stop(now + 3.1);

    // ---- phase-transition cue (fires on every S1->S2->...->S5 hand-off) ----
    // A short, consonant rising two-note ping (A5 -> D6) plus an airy
    // high-passed tick -- clean attack, no boom, no sub. Routed through
    // `master` (NOT `bedGain`), so it sits clearly on top of the lowered
    // ambient bed and gives each segment change a crisp, high-end punctuation
    // (owner instruction 2026-08-30: "타격감·청각적 몰입감").
    const phaseCue = () => {
      if (ctx.state === 'closed') return;
      const b = ctx.currentTime;
      [880, 1174.66].forEach((f, i) => {
        const at = b + i * 0.07;
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = f;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, at);
        g.gain.linearRampToValueAtTime(0.12, at + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, at + 0.55);
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 2400;
        bp.Q.value = 0.9;
        const panner = ctx.createStereoPanner();
        panner.pan.value = i === 0 ? -0.12 : 0.12;
        osc.connect(g);
        g.connect(bp);
        bp.connect(panner);
        panner.connect(master);
        osc.start(at);
        osc.stop(at + 0.7);
      });
      const tick = ctx.createBufferSource();
      tick.buffer = noiseBuffer;
      const tg = ctx.createGain();
      tg.gain.setValueAtTime(0.05, b);
      tg.gain.exponentialRampToValueAtTime(0.0001, b + 0.14);
      const tf = ctx.createBiquadFilter();
      tf.type = 'highpass';
      tf.frequency.value = 1800;
      tick.connect(tf);
      tf.connect(tg);
      tg.connect(master);
      tick.start(b);
      tick.stop(b + 0.2);
    };

    audioRef.current = {
      ctx,
      master,
      phaseCue,
      stop: () => {
        motesActive = false;
        swellActive = false;
        window.clearTimeout(moteTimer);
        window.clearTimeout(swellTimer);
        try {
          const end = ctx.currentTime + 0.5;
          master.gain.cancelScheduledValues(ctx.currentTime);
          master.gain.setValueAtTime(Math.max(master.gain.value, 0.0001), ctx.currentTime);
          master.gain.linearRampToValueAtTime(0, end);
          disposables.forEach((d) => d.stop(end));
          setTimeout(() => ctx.close().catch(() => {}), 700);
        } catch {
          ctx.close().catch(() => {});
        }
      },
    };
    ctx.resume().catch(() => {});
  }, []);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const now = a.ctx.currentTime;
    a.master.gain.cancelScheduledValues(now);
    a.master.gain.linearRampToValueAtTime(muted ? 0 : CINEMA_MASTER_GAIN, now + 0.3);
  }, [muted]);

  // Fire the crisp phase-transition cue on each cinema segment hand-off
  // (S1->S2->...->S5). Segment 1's entrance already has the arrival swell,
  // so it's skipped here to avoid doubling.
  useEffect(() => {
    if (phase !== 'cinema') {
      prevSegRef.current = segId;
      return;
    }
    if (segId === prevSegRef.current) return;
    prevSegRef.current = segId;
    if (segId > 1 && !muted) audioRef.current?.phaseCue();
  }, [segId, phase, muted]);

  // stop the ambient bed once the founder leaves the curtain for the real site
  useEffect(() => {
    if (phase === 'released') {
      audioRef.current?.stop();
      audioRef.current = null;
    }
  }, [phase]);

  useEffect(() => {
    return () => {
      audioRef.current?.stop();
      audioRef.current = null;
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // --- canvas render loop --------------------------------------------------
  useEffect(() => {
    if (phase !== 'cinema' && phase !== 'sealed') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    let cssW = 0;
    let cssH = 0;

    const resize = () => {
      cssW = canvas.clientWidth || window.innerWidth;
      cssH = canvas.clientHeight || window.innerHeight;
      canvas.width = Math.max(1, Math.round(cssW * dpr));
      canvas.height = Math.max(1, Math.round(cssH * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    // Start the clock once per cinema run. enter()/replay() reset it to the
    // sentinel 0; we only stamp it here so a mid-cinema effect re-run (e.g.
    // useReducedMotion resolving null -> false after hydration, or a locale
    // switch) can NOT rewind the timeline. On the sealed loop we keep
    // whatever clock we had so the dimmed background keeps flowing unbroken.
    if (phase === 'cinema' && startRef.current === 0) {
      startRef.current = performance.now();
    }

    const sealed = phase === 'sealed';
    let stopped = false;

    const draw = (elapsed: number) => {
      drawCinemaFrame({
        ctx,
        width: cssW,
        height: cssH,
        elapsedMs: elapsed,
        field,
        reducedMotion: !!reduceMotion,
        dim: sealed ? 1 : 0,
      });
      if (!sealed) {
        const seg = cinemaSegmentAt(elapsed);
        setSegId((prev) => (prev === seg.id ? prev : seg.id));
        if (progressRef.current) {
          progressRef.current.style.transform = `scaleX(${cinemaOverallProgress(elapsed).toFixed(4)})`;
        }
      }
    };

    if (reduceMotion) {
      // One representative frame, no rAF loop on reduced-motion / low-power.
      draw(sealed ? 26_000 : 8_000);
      if (phase === 'cinema') {
        setSegId(3);
        const to = window.setTimeout(() => setPhase('sealed'), 2200);
        return () => {
          stopped = true;
          window.clearTimeout(to);
          window.removeEventListener('resize', resize);
        };
      }
      return () => {
        stopped = true;
        window.removeEventListener('resize', resize);
      };
    }

    const tick = (now: number) => {
      if (stopped) return;
      const elapsed = now - startRef.current;
      if (phase === 'cinema' && elapsed >= CINEMA_DURATION_MS) {
        setPhase('sealed');
        return;
      }
      draw(elapsed);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      stopped = true;
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      window.removeEventListener('resize', resize);
    };
  }, [phase, field, reduceMotion]);

  // --- NO scroll lock -----------------------------------------------------
  // Owner instruction 2026-08-29: the curtain must never freeze up/down
  // scrolling on ANY device. We do NOT touch `document.documentElement.style
  // .overflow` anymore. The curtain is a full-viewport fixed layer and each
  // phase panel scrolls its own overflow (`overflow-y-auto overscroll-contain`)
  // so tall content on short/landscape viewports stays reachable with a
  // natural, organic scroll instead of a dead, locked page. As a one-time
  // defensive cleanup, clear any stale inline overflow lock a previous build
  // (or a hot-reload of the old code) may have left on the root element.
  useEffect(() => {
    const el = document.documentElement;
    if (el.style.overflow === 'hidden') el.style.overflow = '';
  }, []);

  // --- actions -----------------------------------------------------------
  const enter = () => {
    if (!reduceMotion) startAmbient();
    startRef.current = 0;
    setSegId(1);
    setPhase('cinema');
  };

  const replay = () => {
    startRef.current = 0;
    setSegId(1);
    setPhase('cinema');
  };

  const skip = () => setPhase('sealed');

  // FOUNDER-ONLY: leave the curtain for the real homepage. Guarded by
  // `isFounder` at the call site AND here -- a public build can never call it.
  const enterMainSite = () => {
    if (!isFounder) return;
    try {
      // don't make the founder clear the site's own <AudioGate/> as well
      sessionStorage.setItem(AUDIO_GATE_SEEN_KEY, '1');
    } catch {
      /* no-op */
    }
    audioRef.current?.stop();
    audioRef.current = null;
    // Land the real homepage at the very top (the page behind the curtain was
    // free to scroll while the curtain was up -- we no longer lock it).
    window.scrollTo(0, 0);
    setPhase('released');
  };

  const showChrome = phase === 'cinema' || phase === 'sealed';

  return (
    <AnimatePresence>
      {phase !== 'released' && (
        <motion.div
          key="curtain"
          className="fixed inset-0 z-[400] overflow-hidden bg-void text-center"
          initial={false}
          exit={{ opacity: 0, filter: 'blur(8px)' }}
          transition={{ duration: 1, ease: 'easeInOut' }}
        >
          {/* permanent canvas -- never gated behind an AnimatePresence */}
          <canvas
            ref={canvasRef}
            aria-hidden="true"
            className={`absolute inset-0 h-full w-full transition-opacity duration-700 ${
              phase === 'gate' ? 'opacity-0' : 'opacity-100'
            }`}
          />

          {/* pure-CSS cinematic backdrop -- guaranteed motion from frame zero */}
          {showChrome && !reduceMotion && (
            <div className="cs-stage-in pointer-events-none absolute inset-0" aria-hidden="true">
              <div
                className="cs-horizon absolute left-1/2 top-1/2 h-[120vmin] w-[120vmin]"
                style={{
                  background:
                    'conic-gradient(from 0deg, rgba(124,58,237,0.16), rgba(0,243,255,0.14), rgba(212,175,55,0.16), rgba(236,72,153,0.12), rgba(124,58,237,0.16))',
                  maskImage: 'radial-gradient(circle, transparent 34%, #000 42%, #000 62%, transparent 72%)',
                  WebkitMaskImage:
                    'radial-gradient(circle, transparent 34%, #000 42%, #000 62%, transparent 72%)',
                  filter: 'blur(12px)',
                }}
              />
              <div
                className="cs-core absolute left-1/2 top-1/2 h-[46vmin] w-[46vmin] rounded-full"
                style={{
                  background:
                    'radial-gradient(circle, rgba(255,255,255,0.9) 0%, rgba(212,175,55,0.4) 22%, rgba(124,58,237,0.14) 48%, transparent 70%)',
                }}
              />
              <div
                className="cs-grain absolute inset-[-4%] opacity-[0.07] mix-blend-screen"
                style={{
                  backgroundImage:
                    'repeating-linear-gradient(0deg, #fff 0, #fff 1px, transparent 1px, transparent 3px)',
                }}
              />
              <div
                className="absolute inset-0"
                style={{
                  background:
                    'radial-gradient(ellipse at center, transparent 42%, rgba(3,3,5,0.55) 100%)',
                }}
              />
            </div>
          )}

          {/* flag + native-language selector -- available in every phase
              (gate, cinematic, sealed) so the visitor is never stuck on an
              unreadable screen. Shared component -- same one the audio gate
              and the main-site nav use. */}
          <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
            <GlobalLanguagePicker onSelect={() => setAutoLocalized(false)} />
            {autoLocalized && (
              <p className="mt-2 max-w-[11rem] text-[10px] leading-tight text-white/40">
                {t('autoNote')}
              </p>
            )}
          </div>

          {/* sound toggle -- cinema + sealed only */}
          {showChrome && !reduceMotion && (
            <button
              type="button"
              onClick={() => setMuted((v) => !v)}
              aria-label={muted ? t('soundOff') : t('soundOn')}
              className="cs-glass absolute left-4 top-4 z-20 flex items-center gap-2 rounded-full px-3 py-2 text-xs uppercase tracking-[0.15em] text-white/70 transition-colors hover:text-white sm:left-6 sm:top-6"
            >
              {muted ? <VolumeX size={15} aria-hidden="true" /> : <Volume2 size={15} aria-hidden="true" />}
              <span>{muted ? t('soundOff') : t('soundOn')}</span>
            </button>
          )}

          {/* GATE */}
          <AnimatePresence>
            {phase === 'gate' && (
              <motion.div
                key="gate"
                className="absolute inset-0 flex flex-col items-center justify-center overflow-y-auto overscroll-contain px-6 py-16 backdrop-blur-2xl"
                initial={false}
                exit={{ opacity: 0, scale: 1.04 }}
                transition={{ duration: 0.9, ease: 'easeInOut' }}
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
                    className="mb-6 font-serif text-5xl font-bold tracking-[0.14em] text-white md:text-7xl lg:text-8xl"
                    style={{
                      textShadow: '0 0 24px rgba(212,175,55,0.3), 0 0 60px rgba(0,243,255,0.1)',
                    }}
                  >
                    {tGate('title')}
                  </h1>
                  <p className="mx-auto mb-12 max-w-lg text-base leading-relaxed text-gray-300 [text-wrap:balance] md:max-w-3xl md:text-xl">
                    {tGate('subtitle')}
                  </p>
                  <button
                    type="button"
                    onClick={enter}
                    className="event-horizon-btn inline-block whitespace-nowrap px-7 py-3.5 text-xs font-medium uppercase tracking-[0.15em] text-white backdrop-blur-md transition-transform duration-300 hover:scale-[1.03] active:scale-[0.98] sm:text-sm"
                  >
                    {tGate('button')}
                  </button>
                  {isFounder && (
                    <p className="mt-6 text-[10px] uppercase tracking-[0.3em] text-accent/50">
                      founder · full sequential QA
                    </p>
                  )}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* CINEMA -- mysterious keyword typography only, centered */}
          <AnimatePresence>
            {phase === 'cinema' && (
              <motion.div
                key="cinema"
                className="absolute inset-0"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.6 }}
              >
                {/* ultra-thin loop progress line (QA aid; not a caption) */}
                <div className="absolute inset-x-0 top-0 h-px bg-white/5">
                  <div
                    ref={progressRef}
                    className="h-full origin-left bg-accent/40"
                    style={{ transform: 'scaleX(0)' }}
                  />
                </div>

                {/* GLITCH-FREE CROSS-FADE (owner instruction 2026-08-29): the
                    old + new phase lockups occupy the SAME centered grid cell
                    (col/row-start-1) and only opacity + a small compositor-only
                    y-shift tween between them -- a clean simultaneous cross-fade,
                    no hard cut. The previous build animated `letterSpacing` and
                    `filter: blur()` on the gradient-clipped headline every frame;
                    that forced `[text-wrap:balance]` to re-wrap mid-animation
                    (the headline visibly collapsing 2 lines -> 1) and repainted
                    the `bg-clip-text` fill (the flicker / ghost double-image).
                    Both tweens are removed: letter-spacing is now static, the
                    drop-shadow is static, so the text swap is seamless.
                    `line-clamp-2` hard-guarantees the large typography never
                    exceeds two lines on any mobile viewport. */}
                <div className="absolute inset-0 grid place-items-center overflow-y-auto overscroll-contain px-6 py-20 sm:px-10">
                  <AnimatePresence>
                    <motion.div
                      key={segId}
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -14 }}
                      transition={{
                        opacity: { duration: 1.15, ease: 'easeInOut' },
                        y: { duration: 1.3, ease: [0.16, 0.84, 0.44, 1] },
                      }}
                      className="col-start-1 row-start-1 flex max-w-4xl flex-col items-center text-center [will-change:opacity,transform]"
                    >
                      <h2
                        className="line-clamp-2 break-keep bg-gradient-to-r from-accent via-white to-neon bg-clip-text font-serif text-[clamp(1.05rem,5.4vw,1.9rem)] font-bold uppercase leading-[1.12] tracking-[0.16em] text-transparent [text-wrap:balance] sm:text-5xl sm:tracking-[0.14em] lg:text-7xl"
                        style={{
                          filter:
                            'drop-shadow(0 0 26px rgba(212,175,55,0.4)) drop-shadow(0 0 60px rgba(0,243,255,0.18))',
                        }}
                      >
                        {t(captionKeyFor(segId, 'Head'))}
                      </h2>
                      <span
                        aria-hidden="true"
                        className="my-6 block h-px w-16 bg-gradient-to-r from-transparent via-accent/70 to-transparent sm:w-28"
                      />
                      <p
                        className="line-clamp-2 max-w-2xl break-keep font-serif text-[clamp(0.72rem,3.2vw,0.95rem)] font-medium leading-snug tracking-[0.14em] text-white/70 [text-wrap:balance] sm:text-lg lg:text-2xl"
                        style={{ textShadow: '0 0 24px rgba(0,243,255,0.14)' }}
                      >
                        {t(captionKeyFor(segId, 'Sub'))}
                      </p>
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* Skip -- "건너뛰기" label + a skip-forward glyph (⏭: double
                    triangle + trailing bar) haloed in the exact same rotating
                    rainbow-neon pulse as the sealed-screen 'replay' control, so
                    the two affordances feel like one system. */}
                <button
                  type="button"
                  onClick={skip}
                  aria-label={t('skip')}
                  className="absolute bottom-6 right-6 z-20 flex items-center gap-2.5 whitespace-nowrap text-[11px] uppercase tracking-[0.22em] text-white/45 transition-colors hover:text-white/90"
                >
                  <span>{t('skip')}</span>
                  <span className="cs-skip-aurora" aria-hidden="true">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M4 5l8.5 7L4 19z" />
                      <path d="M12 5l8.5 7L12 19z" />
                      <rect x="19.6" y="5" width="2.4" height="14" rx="1" />
                    </svg>
                  </span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* SEALED -- the terminal screen for EVERYONE. Public sees no path
              out. Founder alone gets the secret entry button at the bottom. */}
          <AnimatePresence>
            {phase === 'sealed' && (
              <motion.div
                key="sealed"
                className="absolute inset-0 flex flex-col items-center justify-center overflow-y-auto overscroll-contain px-6 py-16"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 1.1, ease: 'easeOut' }}
              >
                <h2 className="cs-awaken font-serif text-[2.75rem] font-bold tracking-[0.22em] text-white sm:text-7xl lg:text-[5.25rem]">
                  {t('comingSoon')}
                </h2>
                <p className="mt-7 max-w-lg text-base leading-relaxed text-gray-300 [text-wrap:balance] sm:text-lg">
                  {t('awakening')}
                </p>
                <p className="mt-3 max-w-sm text-xs leading-relaxed text-white/35 [text-wrap:balance] sm:text-sm">
                  {t('sealed')}
                </p>

                {/* One clear blank line of separation, then the relocated
                    'UNITAS' wordmark sitting directly above the corporate name.
                    Scale steps down from COMING SOON by ~golden ratio; a
                    champagne-gold gradient sets it apart from the white legal
                    line beneath it.

                    OPTICAL-CENTER FIX (owner instruction 2026-08-30): CSS
                    letter-spacing appends the full tracking value as trailing
                    space after the LAST glyph but adds none before the first,
                    so a `text-align:center` box centres the glyph-run + that
                    trailing gap -- pushing the visible letters left of true
                    centre and making the (less-tracked) corporate line beneath
                    read as shifted right. Re-adding an equal `text-indent`
                    before the first glyph restores a symmetric gap on both
                    sides, so 'UNITAS' and '© THE UNITAS GLOBAL OÜ' now share
                    one exact vertical centre line (±0). Both lines are
                    `w-full text-center` for the same box reference. */}
                <p
                  className="mt-16 w-full bg-gradient-to-r from-[#d4af37] via-[#f5e6b8] to-[#d4af37] bg-clip-text text-center font-serif text-[1.62rem] font-bold uppercase tracking-[0.45em] text-transparent [text-indent:0.45em] sm:text-[2.62rem]"
                  style={{ filter: 'drop-shadow(0 0 22px rgba(212,175,55,0.35))' }}
                >
                  {tGate('title')}
                </p>
                {/* 법인명: 모든 디바이스에서 좌우 여백 기준 완벽 중앙 정렬
                    (w-full text-center) + tracking 상쇄 text-indent 로 위
                    UNITAS 워드마크 정중앙과 1~2px 오차 없이 대칭
                    (owner instruction 2026-08-30). */}
                <p className="mt-3 w-full text-center text-[0.8rem] font-medium uppercase tracking-[0.2em] text-white/45 [text-indent:0.2em] sm:text-[1.05rem]">
                  © THE UNITAS GLOBAL OÜ
                </p>

                {/* FOUNDER-ONLY secret door. Never rendered for the public,
                    so there is no path past the curtain in a normal session. */}
                {isFounder && (
                  <motion.div
                    className="mt-12 flex flex-col items-center gap-3 border-t border-white/10 pt-8"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6, duration: 0.8 }}
                  >
                    <p className="text-[10px] uppercase tracking-[0.4em] text-accent/60">
                      {t('founderAccessLabel')}
                    </p>
                    <button
                      type="button"
                      onClick={enterMainSite}
                      className="event-horizon-btn inline-block whitespace-nowrap px-7 py-3.5 text-xs font-medium uppercase tracking-[0.15em] text-white backdrop-blur-md transition-transform duration-300 hover:scale-[1.03] active:scale-[0.98] sm:text-sm"
                    >
                      {t('enterMain')}
                    </button>
                    <p className="max-w-xs text-[10px] leading-relaxed text-white/30 [text-wrap:balance]">
                      {t('founderAccessNote')}
                    </p>
                  </motion.div>
                )}

                {/* Post-ad growth path: the exact nav-bar "shimmering logo +
                    UNITAS App Download" lockup, pinned bottom-left, mirroring
                    the replay control on the right. One tap -> in-curtain PWA
                    install sheet (owner instruction 2026-08-30). */}
                <CinemaAppDownload />

                {/* Replay -- minimal "다시 재생" label + a reverse-play glyph
                    haloed in a soft, slow rainbow aurora. Pinned bottom-right,
                    mirrors the cinema 'skip' affordance. */}
                <button
                  type="button"
                  onClick={replay}
                  aria-label={t('replay')}
                  className="absolute bottom-6 right-6 z-20 flex items-center gap-2.5 whitespace-nowrap text-[11px] uppercase tracking-[0.22em] text-white/45 transition-colors hover:text-white/90"
                >
                  <span className="cs-replay-aurora" aria-hidden="true">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                      {/* reverse-play: triangle to the left + a leading stop bar */}
                      <path d="M20 5v14L9 12z" />
                      <rect x="4" y="5" width="2.6" height="14" rx="1" />
                    </svg>
                  </span>
                  <span>{t('replay')}</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
