'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Volume2, VolumeX, X } from 'lucide-react';
import { usePathname, useRouter } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { GlobalLanguagePicker } from '@/components/i18n/GlobalLanguagePicker';
import { CinemaAppDownload } from '@/components/pwa/CinemaAppDownload';
import { useSpatialAudio } from '@/components/audio/SpatialAudioProvider';
import { APP_EXIT_EVENT, isExitInProgress } from '@/lib/exit/appExit';
import { requestAppExit } from '@/lib/exit/exitConfirmFlow';
import { attenuateMaster } from '@/lib/audio/masterLevel';
import { ensurePlaybackAudioSession, kickAudioContext, makeSilentBuffer } from '@/lib/audio/audioSession';
import { attachActivationUnlock, scheduleAutoUnlockRetries } from '@/lib/audio/activationUnlock';
import { isAppLocale } from '@/lib/countryLocale';
import { readLocalePreference } from '@/lib/i18n/localePreference';
import { CINEMA_PHASE_STORAGE_KEY, SPLASH_REPLAY_EVENT } from '@/lib/splash/splashTimeline';
import {
  CINEMA_PHASE_EVENT,
  hasSovereignHint,
  revokeSovereignFounder,
  verifySovereignFounder,
} from '@/lib/foundersGate';
import {
  CINEMA_DURATION_MS,
  CINEMA_SEGMENTS,
  cinemaOverallProgress,
  cinemaSegmentAt,
  cinemaSegmentStartMs,
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

// Shared with the pre-hydration splash gate (lib/pwa/installPrompt.ts) and
// ExitGuard -- one key, no drift (owner instruction 2026-09-05, round 10).
const PHASE_KEY = CINEMA_PHASE_STORAGE_KEY;
// Which of the 5 cinema segments is on screen -- persisted so an in-place
// refresh (F5) during the ad resumes at THAT stage instead of rewinding to
// stage 1 (owner instruction 2026-09-05, 7-point hardening, item 6).
const SEGMENT_KEY = 'unitas_cinema_segment';
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
// Owner instruction 2026-09-05 (round 10, item 2): the 0.3 baseline is then
// halved by the global omni-channel 50% master attenuation, identically on
// every device and in both the online and App channels.
const CINEMA_MASTER_GAIN = attenuateMaster(0.3);

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
 * FOUNDER (build/QA): identity is decided by the SERVER only -- a
 * `?sovereign_auth=<token>` visit makes middleware.ts mint an HMAC-signed
 * HttpOnly session, and this component asks GET /api/sovereign/verify
 * (lib/foundersGate.ts) before flipping to founder mode. The retired
 * `?dev=true` / `?key=` / localStorage grants no longer exist anywhere in the
 * bundle (owner instruction 2026-09-04, item 4). A verified founder walks the
 * EXACT SAME sequential flow -- entry gate -> cinematic -> sealed "Coming
 * Soon" -- so the founder monitors every screen a real visitor sees. The
 * ONLY difference: on that final sealed screen the founder (and only the
 * founder) is shown a secret "[ 창립자 전용 메인 사이트 진입 ]" button that
 * dissolves the curtain into the real homepage. QA shortcuts `?dev=skip`
 * (straight to release) and `?dev=replay` (restart from the gate) are honoured
 * only AFTER the server verification succeeds; `?dev=off` signs the founder
 * session out.
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
  const tExit = useTranslations('ExitGuard');
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  // Site-wide UI SFX (owner instruction 2026-09-05, 7-point hardening, item
  // 5): the curtain's buttons play the SAME hover / confirm cues the main
  // site's buttons do, through the one provider that already applies the
  // global 50% level -- so every device and both channels sound identical.
  const { playHoverSfx, playQuestEnterSfx, playSpatialPing, unlockAndUnmute } = useSpatialAudio();

  const [mode, setMode] = useState<Mode>('public');
  const [phase, setPhase] = useState<Phase>('gate');
  const [segId, setSegId] = useState(1);
  const [muted, setMuted] = useState(false);
  const [autoLocalized, setAutoLocalized] = useState(false);
  /**
   * Owner instruction 2026-09-05 (round 15, item 1 -- refresh persistence):
   * true while a persisted `released` MAIN HOME is being re-verified against
   * the server after an in-place refresh, for a browser that carries the
   * founder hint cookie. During that window the curtain paints as a plain
   * opaque void -- NOT the sealed "COMING SOON" screen -- so an F5 on the
   * main home reads as a normal reload (black -> the very page you were on)
   * and never as a reset to the entry page. Still fail-closed: the void is
   * opaque, nothing underneath is visible, and a forged hint / lapsed session
   * resolves straight back to the sealed screen. A browser without the hint
   * (the public) never enters this state -- it gets `sealed` synchronously.
   */
  const [restoringReleased, setRestoringReleased] = useState(false);

  const field = useMemo(() => seedCinemaField(), []);
  /** Segment to resume at after an in-place refresh (item 6); consumed by
   *  the canvas effect the first time it starts the cinema clock. */
  const resumeSegRef = useRef<number | null>(null);
  /**
   * Owner instruction 2026-09-05 (round 9): true while a persisted
   * `released` phase is being re-verified against the server on mount (see
   * the effect below). The mount effect sets the in-memory `phase` to the
   * fail-closed `sealed` placeholder *before* the async verify resolves --
   * without this guard, the sibling persist-effect immediately writes that
   * placeholder over the durable `released` record in sessionStorage, so
   * any second read of it (a React Strict Mode dev double-invoke, a locale
   * remount, or simply losing the race) permanently downgrades the founder
   * to `sealed` on every refresh instead of recovering `released`.
   */
  const verifyingReleasedRef = useRef(false);
  /**
   * Round 15 (refresh persistence): the persist effect below runs on mount
   * with the INITIAL `gate` state -- one render before the phase restored
   * from sessionStorage is applied -- and used to overwrite the persisted
   * `cinema` / `sealed` / `released` record with `gate` for that one render
   * (and for good if the founder verify then failed offline). While this ref
   * is set the initial `gate` is never written: the first persisted value
   * after a restore is the restored phase itself.
   */
  const skipInitialPersistRef = useRef(false);
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
  /** Live mute flag for the rAF closure (its effect does not re-run on
   *  `muted`), so the stage-5 closing cue honours the toggle. */
  const mutedRef = useRef(muted);
  mutedRef.current = muted;

  // Everyone -- public AND founder -- ends the cinematic on the same locked
  // 'sealed' "COMING SOON" screen; the founder just gets an extra button there.
  const isFounder = mode === 'founder';

  // --- sovereign founder verification + persisted phase ----------------------
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const dev = params.get('dev');
    const qaReplay = dev === 'replay' || dev === 'reset' || params.get('replay') === '1';
    const qaSkip = dev === 'skip' || params.get('skip') === '1';

    if (dev === 'off') {
      void revokeSovereignFounder();
      try {
        sessionStorage.removeItem(PHASE_KEY);
      } catch {
        /* no-op */
      }
      return; // stay public, stay on the gate
    }

    // Read the persisted phase SYNCHRONOUSLY, before the persist effect
    // below (which runs right after this one on mount) can overwrite it with
    // the initial 'gate'. Restoring 'cinema' / 'sealed' needs no identity, so
    // it happens now -- a remount mid-sequence (locale auto-switch, language
    // change, F5) never loses the visitor's place. Only the founder-exclusive
    // 'released' waits for the server: it resolves fail-closed to 'sealed'
    // immediately and upgrades once verification succeeds.
    let saved: string | null = null;
    try {
      saved = sessionStorage.getItem(PHASE_KEY);
    } catch {
      /* storage unavailable -- stay on the gate */
    }
    if (saved === 'released' || saved === 'sealed' || saved === 'cinema') {
      // Round 15: never let the mount-time persist write `gate` over this.
      skipInitialPersistRef.current = true;
    }
    // Sovereign console isolation (owner instruction 2026-09-07, master
    // audit item 2): the console's "메인사이트 진입" (`?dev=skip`) is a
    // TRANSITION straight onto the main home -- no logo page (the head
    // bootstrap stamped it off), no entry chime, and no flash of the entry
    // gate / sealed screen while the server verifies: a founder browser
    // (hint cookie) paints the opaque void until the verified `released`
    // lands. Fail-closed as ever -- a lapsed session resolves to the sealed
    // screen below.
    if (qaSkip && hasSovereignHint()) setRestoringReleased(true);
    if (saved === 'released') {
      verifyingReleasedRef.current = true;
      // A founder browser (hint cookie present) re-verifying its main home
      // paints an opaque void instead of the sealed screen (round 15).
      if (hasSovereignHint()) setRestoringReleased(true);
      setPhase('sealed');
    } else if (saved === 'sealed') {
      setPhase('sealed');
    } else if (saved === 'cinema') {
      // Item 6: resume the ad at the stage that was on screen, not stage 1.
      let savedSeg: string | null = null;
      try {
        savedSeg = sessionStorage.getItem(SEGMENT_KEY);
      } catch {
        /* no-op */
      }
      const seg = cinemaSegmentAt(cinemaSegmentStartMs(savedSeg)).id;
      resumeSegRef.current = seg;
      setSegId(seg);
      setPhase('cinema');
    }

    // Public visitors resolve synchronously to `founder: false` (no hint
    // cookie -> no network); a founder pays one no-store GET.
    let cancelled = false;
    void verifySovereignFounder().then(({ founder }) => {
      if (cancelled) return;
      if (!founder) {
        // Genuinely not a founder (session lapsed/revoked) -- the sealed
        // placeholder above was correct all along; persist it for real now
        // (the persist effect skipped it while the verify was pending).
        const wasVerifying = verifyingReleasedRef.current;
        verifyingReleasedRef.current = false;
        setRestoringReleased(false);
        if (wasVerifying) {
          try {
            sessionStorage.setItem(PHASE_KEY, 'sealed');
          } catch {
            /* no-op */
          }
        }
        return;
      }
      setMode('founder');
      if (qaReplay) {
        verifyingReleasedRef.current = false;
        setRestoringReleased(false);
        try {
          sessionStorage.removeItem(PHASE_KEY);
        } catch {
          /* no-op */
        }
        startRef.current = 0;
        setSegId(1);
        setPhase('gate'); // full flow from the gate
        return;
      }
      verifyingReleasedRef.current = false;
      if (qaSkip || saved === 'released') {
        setPhase('released');
      } else {
        setRestoringReleased(false);
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // See `verifyingReleasedRef` above: skip persisting the transient
    // fail-closed `sealed` default while a durable `released` record is
    // still being re-verified, so it survives a remount instead of being
    // permanently clobbered before the verify call resolves.
    // Round 15: the mount-time run sees the initial `gate` one render before
    // a restored phase lands -- never write that `gate` over the restored
    // record (see `skipInitialPersistRef`).
    const skipInitialGate = skipInitialPersistRef.current && phase === 'gate';
    if (phase !== 'gate') skipInitialPersistRef.current = false;
    if (!skipInitialGate && !(verifyingReleasedRef.current && phase === 'sealed')) {
      try {
        sessionStorage.setItem(PHASE_KEY, phase);
      } catch {
        /* no-op */
      }
    }
    // Live phase stamp on <html> -- lets a sibling mounted AFTER this
    // component (ExitGuard) read the current phase synchronously instead of
    // depending on having caught the event below. The curtain is a fixed
    // overlay, so the attribute is purely informational (no CSS hooks).
    document.documentElement.dataset.cinemaPhase = phase;
    // Founder debug panel + ExitGuard mirror the live curtain phase.
    window.dispatchEvent(new CustomEvent(CINEMA_PHASE_EVENT, { detail: phase }));
  }, [phase]);

  // Item 6: remember the ad stage on screen so an F5 resumes right there.
  useEffect(() => {
    try {
      if (phase === 'cinema') sessionStorage.setItem(SEGMENT_KEY, String(segId));
      else sessionStorage.removeItem(SEGMENT_KEY);
    } catch {
      /* no-op */
    }
  }, [phase, segId]);

  // --- global locale restore + auto-localization to navigator.language ----
  // Owner instruction 2026-09-06 (item 5): a previously chosen language must
  // win on every fresh visit -- re-APPLY it, not just skip auto-detect (the
  // bug this used to have: `manual` blocked the navigator.language guess
  // below but was never itself redirected to, so a guest's manual pick never
  // survived a real return visit to the canonical "/" root).
  useEffect(() => {
    let manual: string | null = null;
    let already: string | null = null;
    try {
      manual = readLocalePreference();
      already = localStorage.getItem(LOCALE_AUTO_KEY);
    } catch {
      /* no-op */
    }
    if (manual) {
      if (isAppLocale(manual) && manual !== locale) {
        setAutoLocalized(true);
        router.replace(pathname, { locale: manual });
      }
      return;
    }
    if (already) return;

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
    // Owner instruction 2026-09-07 (item 1): the whole engine build is
    // fenced. This runs from a mount / phase effect as well as from the gate
    // button, and a refused AudioContext (hardware context cap on some
    // Android WebViews, a node the engine lacks) used to throw out of that
    // effect straight into the route error screen. A bed that cannot be
    // built is skipped -- the ad plays silent, never crashes.
    let created: AudioContext | null = null;
    try {
    // iPhone ring/silent switch (round 13, item 4): declare a playback
    // session before the context exists -- lib/audio/audioSession.ts.
    ensurePlaybackAudioSession();
    const ctx = new AudioCtx();
    created = ctx;
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
    // A short, consonant rising three-note ping (A5 -> D6 -> A6) plus an airy
    // high-passed tick -- clean attack, no boom, no sub. Routed through
    // `master` (NOT `bedGain`), so it sits clearly on top of the lowered
    // ambient bed and gives each segment change a crisp, high-end punctuation
    // (owner instruction 2026-08-30: "타격감·청각적 몰입감").
    //
    // OMNI-CHANNEL SYNC (owner instruction 2026-09-05, 7-point hardening,
    // item 5): the cue was routinely inaudible in the ONLINE channel -- its
    // 0.12 peak under the halved master sat below the bed on phone speakers,
    // and after an in-place refresh into the cinema no context existed at
    // all (the bed only ever started from the gate button; see the resume
    // effect below). It now plays at a level that clears the bed on every
    // device, skips cleanly (rather than queueing a stray late ping) while
    // the context is not yet running, and the context itself is guaranteed
    // to exist for every cinema/sealed render.
    const phaseCue = () => {
      if (ctx.state !== 'running') return;
      const b = ctx.currentTime;
      [880, 1174.66, 1760].forEach((f, i) => {
        const at = b + i * 0.065;
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = f;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, at);
        g.gain.linearRampToValueAtTime(i === 2 ? 0.18 : 0.26, at + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, at + 0.6);
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 2400;
        bp.Q.value = 0.8;
        const panner = ctx.createStereoPanner();
        panner.pan.value = i === 0 ? -0.14 : i === 1 ? 0.14 : 0;
        osc.connect(g);
        g.connect(bp);
        bp.connect(panner);
        panner.connect(master);
        osc.start(at);
        osc.stop(at + 0.75);
      });
      const tick = ctx.createBufferSource();
      tick.buffer = noiseBuffer;
      const tg = ctx.createGain();
      tg.gain.setValueAtTime(0.09, b);
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
    } catch {
      audioRef.current = null;
      try {
        created?.close().catch(() => {});
      } catch {
        /* no-op */
      }
    }
  }, []);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    try {
      const now = a.ctx.currentTime;
      a.master.gain.cancelScheduledValues(now);
      a.master.gain.linearRampToValueAtTime(muted ? 0 : CINEMA_MASTER_GAIN, now + 0.3);
    } catch {
      /* a closed engine -- nothing to fade */
    }
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
    if (segId > 1 && !muted) {
      try {
        audioRef.current?.phaseCue();
      } catch {
        /* a refused cue never breaks the segment hand-off */
      }
    }
  }, [segId, phase, muted]);

  // OMNI-CHANNEL AUDIO GUARANTEE (owner instruction 2026-09-05, 7-point
  // hardening, item 5): the ambient bed + cue engine used to be created ONLY
  // by the gate button's click. Every other way into the cinema / sealed
  // screens -- an in-place refresh (item 6), a persisted phase restored on a
  // remount, a locale switch mid-ad -- rendered the ad SILENT, with no
  // segment cues at all. Now any cinema/sealed render without a live engine
  // builds one; if the autoplay policy keeps it suspended (no gesture yet),
  // the same activation-event unlock the intro splash uses resumes it on the
  // first touch / click / key, on every device, online and App alike.
  useEffect(() => {
    if (phase !== 'cinema' && phase !== 'sealed') return;
    if (reduceMotion) return;
    if (!audioRef.current) startAmbient();
    const engine = audioRef.current;
    if (!engine || engine.ctx.state === 'running') return;
    let detached = false;
    const silent = makeSilentBuffer(engine.ctx);
    const wake = () => {
      if (detached) return;
      // Round 13 (hardening patch, item 4): a WebKit-proof gesture unlock --
      // silent kick + resume, inside the gesture -- so the ad stages sing on
      // the first touch of a phone. (The logo page itself is silent now.)
      // Owner instruction 2026-09-07 (item 2): `interrupted` (WebKit) is
      // treated like `suspended` -- anything not running is woken.
      try {
        if (engine.ctx.state === 'running') return;
        ensurePlaybackAudioSession();
        if (silent) kickAudioContext(engine.ctx, silent);
        engine.ctx.resume().catch(() => {});
      } catch {
        /* never throw out of the gesture */
      }
    };
    // Universal auto-unlock hub (owner instruction 2026-09-07, master audit
    // item 2): gestures + lifecycle retries (visibilitychange / pageshow /
    // focus) + a bounded post-load kickstart burst -- the ad stages 1-5 and
    // the sealed screen wake at the earliest instant every engine allows.
    const detach = attachActivationUnlock(wake);
    const cancelRetries = scheduleAutoUnlockRetries(wake);
    const onState = () => {
      if (engine.ctx.state === 'running') {
        detached = true;
        detach();
        cancelRetries();
        engine.ctx.removeEventListener('statechange', onState);
      }
    };
    try {
      engine.ctx.addEventListener('statechange', onState);
    } catch {
      /* no-op */
    }
    return () => {
      detached = true;
      detach();
      cancelRetries();
      try {
        engine.ctx.removeEventListener('statechange', onState);
      } catch {
        /* no-op */
      }
    };
  }, [phase, reduceMotion, startAmbient]);

  // stop the ambient bed once the founder leaves the curtain for the real site
  useEffect(() => {
    if (phase === 'released') {
      audioRef.current?.stop();
      audioRef.current = null;
    }
  }, [phase]);

  // A confirmed exit / in-place termination (the sealed screen's 'X', the
  // main home's 종료): the bed falls silent at once -- a terminated app must
  // never keep its ambient loop playing under the black shroud
  // (lib/exit/appExit.ts APP_EXIT_EVENT).
  useEffect(() => {
    const onExit = () => {
      audioRef.current?.stop();
      audioRef.current = null;
    };
    window.addEventListener(APP_EXIT_EVENT, onExit);
    return () => window.removeEventListener(APP_EXIT_EVENT, onExit);
  }, []);

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
      // Item 6: after an in-place refresh, back-date the clock so the loop
      // resumes at the start of the segment that was on screen.
      const resumeSeg = resumeSegRef.current;
      resumeSegRef.current = null;
      startRef.current = performance.now() - (resumeSeg ? cinemaSegmentStartMs(resumeSeg) : 0);
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
        // AD STAGE 5 AUDIO SYNC (owner instruction 2026-09-07, master audit
        // item 1): stages 2-5 each open with the phase cue; the sealed
        // "COMING SOON" screen is stage 5's hand-off, so its arrival gets
        // the same crisp cue -- the last stage is punctuated exactly like
        // the four before it. Natural completion only: the skip control
        // plays its own ping.
        if (!mutedRef.current) {
          try {
            audioRef.current?.phaseCue();
          } catch {
            /* a refused cue never breaks the hand-off */
          }
        }
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
    playQuestEnterSfx();
    if (!reduceMotion) startAmbient();
    startRef.current = 0;
    resumeSegRef.current = null;
    setRestoringReleased(false);
    setSegId(1);
    setPhase('cinema');
  };

  /**
   * "다시보기" (owner instruction 2026-09-05, 7-point hardening, item 4): a
   * replay is a COMPLETE restart of the visitor's journey -- the very first
   * "logo page" (the silent 3s cinematic intro splash), then the entry gate,
   * then the ad from stage 1 -- never a jump into the middle of the
   * sequence. The ambient engine is torn down (the gate button rebuilds it,
   * exactly as on a cold visit) and the intro splash is replayed through the
   * same window event the founder console uses; it mounts above this curtain
   * at z-700 and dissolves onto the gate 3s later.
   */
  const replay = () => {
    playSpatialPing();
    audioRef.current?.stop();
    audioRef.current = null;
    startRef.current = 0;
    resumeSegRef.current = null;
    setRestoringReleased(false);
    setSegId(1);
    setPhase('gate');
    window.scrollTo(0, 0);
    window.dispatchEvent(new CustomEvent(SPLASH_REPLAY_EVENT));
  };

  const skip = () => {
    playSpatialPing();
    setPhase('sealed');
  };

  /**
   * The sealed screen's "[X] 종료" (bottom-right, next to 다시 재생).
   *
   * ROUND 23 (owner instruction 2026-09-06, exit UX hardening items 2 + 4):
   * EVERY channel now opens ExitGuard's confirm dialog first -- the tap no
   * longer tunnels straight into the exit engine on the ONLINE channel. Round
   * 10's "극단적 터널링" (item 6) is superseded: a visitor exiting from the
   * sealed Coming-Soon screen on a PC or mobile BROWSER TAB used to leave
   * with zero confirmation, while the same tap on the MAIN HOME (back
   * gesture / Escape) already showed "종료하시겠습니까?" -- an inconsistency
   * the owner named directly ("커밍순 페이지: 기존에 즉시 종료되던 방식을
   * 개편하여 메인과 동일하게... 팝업창이... 정상 작동"). `requestAppExit()`
   * opens the same dialog ExitGuard renders everywhere else; only an explicit
   * 종료 there runs the shared exit engine (lib/exit/exitConfirmFlow.ts),
   * which still decides the ONLINE/APP branch (back to the referring page vs.
   * terminate) exactly as before. ExitGuard mounts right after this curtain
   * in app/[locale]/layout.tsx and its modal renders on the top layer (z-680,
   * above the curtain).
   */
  const exitFromSealed = () => {
    if (isExitInProgress()) return;
    requestAppExit();
  };

  // FOUNDER-ONLY: leave the curtain for the real homepage. Guarded by
  // `isFounder` at the call site AND here -- a public build can never call it.
  //
  // DIRECT ENTRY (owner instruction 2026-09-05, round 15, item 0): this one
  // tap lands on the MAIN HOME itself -- no intermediate entry page. The
  // site's own <AudioGate/> (z-300, beneath this curtain) used to surface as
  // a second "[ 진입 ]" screen the moment the curtain dissolved, because its
  // sessionStorage flag is only read on mount and nothing here unlocked the
  // site's audio. Now the tap IS the site-wide audio unlock (the same
  // `unlockAndUnmute()` the audio gate's own button runs, synchronously
  // inside this gesture), the seen-flag covers a later refresh, and the
  // audio gate additionally retires itself on the `released` phase event.
  const enterMainSite = () => {
    if (!isFounder) return;
    playQuestEnterSfx();
    try {
      // don't make the founder clear the site's own <AudioGate/> as well
      sessionStorage.setItem(AUDIO_GATE_SEEN_KEY, '1');
    } catch {
      /* no-op */
    }
    audioRef.current?.stop();
    audioRef.current = null;
    // The site's SFX / ambient engine unlocks on THIS gesture (round 15).
    unlockAndUnmute();
    // Land the real homepage at the very top (the page behind the curtain was
    // free to scroll while the curtain was up -- we no longer lock it).
    window.scrollTo(0, 0);
    setPhase('released');
  };

  const showChrome = phase === 'cinema' || phase === 'sealed';
  /** Round 15: opaque void while a persisted main home re-verifies (F5);
   *  2026-09-07 (console isolation): also while the console's `?dev=skip`
   *  entry verifies -- whichever phase the curtain is parked on. */
  const voidPlaceholder = restoringReleased && phase !== 'released';

  return (
    <AnimatePresence>
      {phase !== 'released' && (
        <motion.div
          key="curtain"
          className="cs-root fixed inset-0 z-[400] overflow-hidden bg-void text-center"
          initial={false}
          // A verified restore after a refresh dissolves fast and flat (the
          // visitor never left the page); the founder's live entry keeps the
          // cinematic 1s blur-out.
          exit={restoringReleased ? { opacity: 0 } : { opacity: 0, filter: 'blur(8px)' }}
          transition={{ duration: restoringReleased ? 0.35 : 1, ease: 'easeInOut' }}
        >
          {/* permanent canvas -- never gated behind an AnimatePresence */}
          <canvas
            ref={canvasRef}
            aria-hidden="true"
            className={`absolute inset-0 h-full w-full transition-opacity duration-700 ${
              phase === 'gate' || voidPlaceholder ? 'opacity-0' : 'opacity-100'
            }`}
          />

          {/* pure-CSS cinematic backdrop -- guaranteed motion from frame zero */}
          {showChrome && !voidPlaceholder && !reduceMotion && (
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
          {!voidPlaceholder && (
            <div
              className="absolute right-4 z-20 sm:right-6"
              style={{ top: 'max(1rem, var(--u-safe-top))' }}
            >
              <GlobalLanguagePicker onSelect={() => setAutoLocalized(false)} />
              {autoLocalized && (
                <p className="mt-2 max-w-[11rem] text-[10px] leading-tight text-white/40">
                  {t('autoNote')}
                </p>
              )}
            </div>
          )}

          {/* sound toggle -- cinema + sealed only */}
          {showChrome && !voidPlaceholder && !reduceMotion && (
            <button
              type="button"
              onClick={() => setMuted((v) => !v)}
              aria-label={muted ? t('soundOff') : t('soundOn')}
              className="cs-glass absolute left-4 z-20 flex items-center gap-2 rounded-full px-3 py-2 text-xs uppercase tracking-[0.15em] text-white/70 transition-colors hover:text-white sm:left-6"
              style={{ top: 'max(1rem, var(--u-safe-top))' }}
            >
              {muted ? <VolumeX size={15} aria-hidden="true" /> : <Volume2 size={15} aria-hidden="true" />}
              <span>{muted ? t('soundOff') : t('soundOn')}</span>
            </button>
          )}

          {/* GATE */}
          <AnimatePresence>
            {phase === 'gate' && !voidPlaceholder && (
              <motion.div
                key="gate"
                className="cs-gate gate-panel absolute inset-0 flex flex-col items-center justify-center overflow-y-auto overscroll-contain backdrop-blur-2xl"
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
                    className="font-serif font-bold tracking-[0.14em] text-white"
                    style={{
                      textShadow: '0 0 24px rgba(212,175,55,0.3), 0 0 60px rgba(0,243,255,0.1)',
                    }}
                  >
                    {tGate('title')}
                  </h1>
                  <p className="mx-auto max-w-lg text-gray-300 [text-wrap:balance] md:max-w-3xl">
                    {tGate('subtitle')}
                  </p>
                  <button
                    type="button"
                    onMouseEnter={() => playHoverSfx()}
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

          {/* CINEMA -- mysterious keyword typography only, centered.
              Ad stages 1-5 all render through this ONE panel: identical
              lockup, dots, progress line, skip control, phase cue, segment
              persistence and exit guard -- stage 5 is never a special case
              (owner instruction 2026-09-07, master audit item 1). */}
          <AnimatePresence>
            {phase === 'cinema' && !voidPlaceholder && (
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

                {/* 5-segment scroll indicator dots -- permanently fixed (lives
                    inside the curtain's `fixed inset-0` ancestor, so it never
                    moves with page scroll or resize) and tracks `segId`,
                    giving a persistent "where am I in the 30s loop" cue that
                    the old ultra-thin progress line alone didn't provide. */}
                <div
                  className="pointer-events-none absolute inset-x-0 top-5 z-20 flex items-center justify-center gap-2"
                  aria-hidden="true"
                >
                  {CINEMA_SEGMENTS.map((seg) => (
                    <span
                      key={seg.id}
                      className="h-1.5 rounded-full transition-all duration-500 ease-out"
                      style={{
                        width: seg.id === segId ? '22px' : '6px',
                        backgroundColor: seg.id === segId ? 'rgba(212,175,55,0.85)' : 'rgba(255,255,255,0.22)',
                        boxShadow: seg.id === segId ? '0 0 10px rgba(212,175,55,0.55)' : 'none',
                      }}
                    />
                  ))}
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
                <div className="cs-cinema-body absolute inset-0 grid place-items-center overflow-y-auto overscroll-contain">
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
                        className="line-clamp-2 break-keep bg-gradient-to-r from-accent via-white to-neon bg-clip-text font-serif font-bold uppercase tracking-[0.16em] text-transparent [text-wrap:balance] sm:tracking-[0.14em]"
                        style={{
                          filter:
                            'drop-shadow(0 0 26px rgba(212,175,55,0.4)) drop-shadow(0 0 60px rgba(0,243,255,0.18))',
                        }}
                      >
                        {t(captionKeyFor(segId, 'Head'))}
                      </h2>
                      <span
                        aria-hidden="true"
                        className="cs-cinema-divider block h-px w-16 bg-gradient-to-r from-transparent via-accent/70 to-transparent sm:w-28"
                      />
                      <p
                        className="line-clamp-2 max-w-2xl break-keep font-serif font-medium tracking-[0.14em] text-white/70 [text-wrap:balance]"
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
                  onMouseEnter={() => playHoverSfx()}
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
            {phase === 'sealed' && !voidPlaceholder && (
              <motion.div
                key="sealed"
                data-founder={isFounder ? '1' : undefined}
                className="cs-sealed absolute inset-0 flex flex-col items-center justify-center overflow-y-auto overscroll-contain"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 1.1, ease: 'easeOut' }}
              >
                <h2 className="cs-awaken font-serif font-bold tracking-[0.22em] text-white">
                  {t('comingSoon')}
                </h2>
                <p
                  className="max-w-lg text-base leading-relaxed text-gray-300 [text-wrap:balance] sm:text-lg"
                  style={{ marginTop: 'clamp(.75rem,2.5svh,1.75rem)' }}
                >
                  {t('awakening')}
                </p>
                <p
                  className="max-w-sm text-xs leading-relaxed text-white/35 [text-wrap:balance] sm:text-sm"
                  style={{ marginTop: 'clamp(.5rem,1.2svh,.75rem)' }}
                >
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
                    sides, so 'UNITAS' and 'THE UNITAS GLOBAL OÜ' now share
                    one exact vertical centre line (±0). Both lines are
                    `w-full text-center` for the same box reference. */}
                <p
                  className="cs-seal-mark w-full bg-gradient-to-r from-[#d4af37] via-[#f5e6b8] to-[#d4af37] bg-clip-text text-center font-serif font-bold uppercase tracking-[0.45em] text-transparent [text-indent:0.45em]"
                  style={{ filter: 'drop-shadow(0 0 22px rgba(212,175,55,0.35))' }}
                >
                  {tGate('title')}
                </p>
                {/* 법인명: 모든 디바이스에서 좌우 여백 기준 완벽 중앙 정렬
                    (w-full text-center) + tracking 상쇄 text-indent 로 위
                    UNITAS 워드마크 정중앙과 1~2px 오차 없이 대칭
                    (owner instruction 2026-08-30).
                    Owner instruction 2026-09-07 (master audit, item 1): the
                    `©` glyph is REMOVED -- the line is the bare corporate
                    name only. With no leading symbol the glyph run is
                    symmetric under the same `text-indent` == `tracking`
                    compensation, so the string sits on the exact horizontal
                    centre of every viewport (PC / tablet / mobile, online
                    and App) with nothing to drift: `w-full` pins the box to
                    the panel width, `whitespace-nowrap` + `break-keep` keep
                    it one unbroken line, `[text-wrap:nowrap]` guards the
                    balance heuristics some engines apply to short lines. */}
                <p
                  className="mt-3 w-full whitespace-nowrap break-keep text-center font-medium uppercase tracking-[0.2em] text-white/45 [text-indent:0.2em] [text-wrap:nowrap]"
                  style={{ fontSize: 'clamp(.72rem, .5rem + 1vw, 1.05rem)' }}
                  translate="no"
                >
                  THE UNITAS GLOBAL OÜ
                </p>

                {/* FOUNDER-ONLY secret door. Never rendered for the public,
                    so there is no path past the curtain in a normal session.

                    MOBILE VISIBILITY FIX (owner instruction 2026-09-01): this
                    used to sit in-flow (`mt-12` after the corporate name
                    block), so on short mobile viewports it could be pushed
                    below the fold and require a scroll to discover. Pinned
                    `absolute` + `inset-x-0 bottom-24` instead, matching the
                    same pinned-corner pattern already used by
                    `CinemaAppDownload` (bottom-left) and the replay control
                    (bottom-right) below -- now it renders at fixed
                    screen-bottom-center on every viewport, identically on
                    PC and mobile, with no scroll required. `bottom-24`
                    (not `bottom-6`) keeps it clear of that same bottom-6
                    corner-control row so nothing overlaps on narrow phones. */}
                {isFounder && (
                  <motion.div
                    className="cs-founder-door absolute inset-x-0 z-20 flex flex-col items-center gap-3 px-6"
                    style={{ bottom: 'calc(6rem + var(--u-safe-bottom))' }}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6, duration: 0.8 }}
                  >
                    <p className="text-[10px] uppercase tracking-[0.4em] text-accent/60">
                      {t('founderAccessLabel')}
                    </p>
                    <button
                      type="button"
                      onMouseEnter={() => playHoverSfx()}
                      onClick={enterMainSite}
                      className="event-horizon-btn inline-block whitespace-nowrap px-7 py-3.5 text-xs font-medium uppercase tracking-[0.15em] text-white backdrop-blur-md transition-transform duration-300 hover:scale-[1.03] active:scale-[0.98] sm:text-sm"
                    >
                      {t('enterMain')}
                    </button>
                    <p className="cs-founder-note max-w-[85vw] text-[10px] leading-relaxed text-white/30 [text-wrap:balance] sm:max-w-xs">
                      {t('founderAccessNote')}
                    </p>
                  </motion.div>
                )}

                {/* BOTTOM BAR -- ONE flex row (owner instruction 2026-09-05,
                    round 15, item 1). The app-download lockup (left) and the
                    replay / exit controls (right) used to be two independent
                    `absolute` corners that collided on narrow phones -- the
                    three labels overlapped. They now share a single
                    bottom-pinned flex row with `justify-between`, so the two
                    ends can never occupy the same pixels on ANY viewport: the
                    row is the layout contract. On mobile the lockup stacks
                    "UNITAS" over "App Download" (two lines), the right-hand
                    labels shrink one step, gutters tighten, and the whole bar
                    respects the iOS home-indicator safe area in the App
                    channel; from `sm` up it is the exact round-14 layout. */}
                <div
                  className="absolute inset-x-0 bottom-0 z-20 flex items-end justify-between gap-3 px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] sm:gap-6 sm:px-6 sm:pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]"
                >
                  {/* Post-ad growth path: the exact nav-bar "shimmering logo +
                      UNITAS App Download" lockup, bottom-left, mirroring the
                      replay control on the right. One tap -> PWA install
                      (owner instruction 2026-08-30). */}
                  <CinemaAppDownload />

                  {/* Bottom-right control row (owner instruction 2026-09-05,
                      checklist item 4): "[glyph] 다시 재생" and, to its RIGHT,
                      "[X] 종료" -- two controls of identical size, typography,
                      aurora halo and hover treatment, baseline-aligned on one
                      row. The 'X' that used to sit top-right (under the
                      language picker) is GONE from there; it lives here as the
                      glyph of the exit control, in the same haloed slot the
                      replay glyph occupies. */}
                  <div className="flex shrink-0 items-center gap-4 sm:gap-8">
                    {/* Replay -- minimal "다시 재생" label + a reverse-play
                        glyph haloed in a soft, slow rainbow aurora. Mirrors
                        the cinema 'skip' affordance. */}
                    <button
                      type="button"
                      onMouseEnter={() => playHoverSfx()}
                      onClick={replay}
                      aria-label={t('replay')}
                      className="flex items-center gap-2 whitespace-nowrap text-[10px] uppercase tracking-[0.16em] text-white/45 transition-colors hover:text-white/90 sm:gap-2.5 sm:text-[11px] sm:tracking-[0.22em]"
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

                    {/* Exit -- "[X] 종료", the exact same control as replay.
                        Round 17: App channel -> ExitGuard's two-step double
                        confirm; online -> the exit engine directly. See
                        `exitFromSealed` above for the full round history. */}
                    <button
                      type="button"
                      onMouseEnter={() => playHoverSfx()}
                      onClick={(e) => {
                        e.preventDefault();
                        exitFromSealed();
                      }}
                      onTouchEnd={(e) => {
                        // Owner instruction 2026-09-05 (round 3): a bare
                        // onClick was intermittently unresponsive to a mobile
                        // tap on this control -- some devices swallow the
                        // synthetic click that normally follows touchend.
                        // Handling touchend directly (and preventing that
                        // follow-up click so the tap never double-fires)
                        // makes the exit control react to the very first tap
                        // on every touch device.
                        e.preventDefault();
                        exitFromSealed();
                      }}
                      aria-label={tExit('exitTitle')}
                      style={{ pointerEvents: 'auto', touchAction: 'manipulation' }}
                      className="flex items-center gap-2 whitespace-nowrap text-[10px] uppercase tracking-[0.16em] text-white/45 transition-colors hover:text-white/90 sm:gap-2.5 sm:text-[11px] sm:tracking-[0.22em]"
                    >
                      <span className="cs-replay-aurora" aria-hidden="true">
                        <X size={15} strokeWidth={2.4} aria-hidden="true" />
                      </span>
                      <span>{tExit('exitConfirm')}</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
