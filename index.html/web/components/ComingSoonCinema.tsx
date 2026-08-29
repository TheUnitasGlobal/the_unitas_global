'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Globe, Volume2, VolumeX } from 'lucide-react';
import { usePathname, useRouter } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
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

const LOCALE_NATIVE: Record<string, string> = {
  en: 'English',
  ko: '한국어',
  et: 'Eesti',
  ja: '日本語',
  zh: '中文',
  es: 'Español',
};

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
  const [langOpen, setLangOpen] = useState(false);
  const [autoLocalized, setAutoLocalized] = useState(false);

  const field = useMemo(() => seedCinemaField(), []);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const progressRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);
  const audioRef = useRef<{ ctx: AudioContext; master: GainNode; stop: () => void } | null>(null);

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

  function selectLocale(next: string) {
    setLangOpen(false);
    setAutoLocalized(false);
    try {
      localStorage.setItem(LOCALE_PREF_KEY, next);
    } catch {
      /* no-op */
    }
    if (next !== locale) router.replace(pathname, { locale: next });
  }

  // --- ambient audio (Web Audio API, low gain, user-gesture gated) ---------
  const startAmbient = useCallback(() => {
    if (audioRef.current || typeof window === 'undefined') return;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    filter.Q.value = 4;
    filter.connect(master);

    const drone: OscillatorNode[] = [];
    [55, 82.5, 110].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.detune.value = (i - 1) * 6;
      const g = ctx.createGain();
      g.gain.value = i === 2 ? 0.04 : 0.09;
      osc.connect(g);
      g.connect(filter);
      osc.start();
      drone.push(osc);
    });

    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.05;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 180;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();

    // ZERO-DELAY SYMPHONY: the bed is audible the instant the visitor commits
    // to entering -- a fast 0.35s rise instead of a slow 2.5s fade -- and a
    // one-shot "arrival" impact (sub boom + rising shimmer) fires on the same
    // frame so there is never a beat of silence before the visuals land.
    const now = ctx.currentTime;
    master.gain.setValueAtTime(0, now);
    master.gain.linearRampToValueAtTime(0.5, now + 0.35);

    const boom = ctx.createOscillator();
    boom.type = 'sine';
    boom.frequency.setValueAtTime(140, now);
    boom.frequency.exponentialRampToValueAtTime(34, now + 1.6);
    const boomGain = ctx.createGain();
    boomGain.gain.setValueAtTime(0.0001, now);
    boomGain.gain.linearRampToValueAtTime(0.42, now + 0.02);
    boomGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.8);
    boom.connect(boomGain);
    boomGain.connect(master);
    boom.start(now);
    boom.stop(now + 1.9);

    const riser = ctx.createOscillator();
    riser.type = 'sawtooth';
    riser.frequency.setValueAtTime(180, now);
    riser.frequency.exponentialRampToValueAtTime(1320, now + 1.4);
    const riserFilter = ctx.createBiquadFilter();
    riserFilter.type = 'bandpass';
    riserFilter.frequency.value = 900;
    riserFilter.Q.value = 3;
    const riserGain = ctx.createGain();
    riserGain.gain.setValueAtTime(0.0001, now);
    riserGain.gain.linearRampToValueAtTime(0.12, now + 0.05);
    riserGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.5);
    riser.connect(riserFilter);
    riserFilter.connect(riserGain);
    riserGain.connect(master);
    riser.start(now);
    riser.stop(now + 1.6);

    const bell = window.setInterval(() => {
      if (ctx.state !== 'running') return;
      const b = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = [523.25, 659.25, 783.99, 1046.5][Math.floor(Math.random() * 4)];
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, b);
      g.gain.linearRampToValueAtTime(0.03, b + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, b + 3);
      osc.connect(g);
      g.connect(master);
      osc.start(b);
      osc.stop(b + 3.2);
    }, 7000);

    audioRef.current = {
      ctx,
      master,
      stop: () => {
        window.clearInterval(bell);
        try {
          const end = ctx.currentTime + 0.4;
          master.gain.cancelScheduledValues(ctx.currentTime);
          master.gain.linearRampToValueAtTime(0, end);
          drone.forEach((o) => o.stop(end));
          lfo.stop(end);
          setTimeout(() => ctx.close().catch(() => {}), 600);
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
    a.master.gain.linearRampToValueAtTime(muted ? 0 : 0.5, now + 0.3);
  }, [muted]);

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

          {/* language selector -- available in every phase */}
          <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
            <button
              type="button"
              onClick={() => setLangOpen((v) => !v)}
              aria-expanded={langOpen}
              aria-label={t('langLabel')}
              className="cs-glass flex items-center gap-2 rounded-full px-3 py-2 text-xs font-medium uppercase tracking-[0.15em] text-white/80 transition-colors hover:text-white"
            >
              <Globe size={15} aria-hidden="true" />
              <span>{LOCALE_NATIVE[locale] ?? locale}</span>
            </button>
            {langOpen && (
              <ul className="cs-glass absolute right-0 mt-2 w-40 overflow-hidden rounded-2xl py-1 text-left">
                {routing.locales.map((loc) => (
                  <li key={loc}>
                    <button
                      type="button"
                      onClick={() => selectLocale(loc)}
                      className={`block w-full px-4 py-2 text-xs tracking-wide transition-colors hover:bg-white/10 ${
                        loc === locale ? 'font-bold text-accent' : 'text-white/70'
                      }`}
                    >
                      {LOCALE_NATIVE[loc]}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {autoLocalized && (
              <p className="mt-2 max-w-[10rem] text-[10px] leading-tight text-white/40">
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

                <div className="absolute inset-0 flex items-center justify-center overflow-y-auto overscroll-contain px-6 py-20 sm:px-10">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={segId}
                      initial={{ opacity: 0, y: 18, filter: 'blur(12px)' }}
                      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                      exit={{ opacity: 0, y: -18, filter: 'blur(12px)' }}
                      transition={{ duration: 0.9, ease: [0.16, 0.84, 0.44, 1] }}
                      className="flex max-w-4xl flex-col items-center text-center"
                    >
                      <motion.h2
                        initial={{ letterSpacing: '0.5em' }}
                        animate={{ letterSpacing: '0.16em' }}
                        transition={{ duration: 1.1, ease: [0.16, 0.84, 0.44, 1] }}
                        className="bg-gradient-to-r from-accent via-white to-neon bg-clip-text font-serif text-[1.7rem] font-bold uppercase leading-[1.12] text-transparent [text-wrap:balance] sm:text-5xl lg:text-6xl"
                        style={{
                          filter:
                            'drop-shadow(0 0 26px rgba(212,175,55,0.4)) drop-shadow(0 0 60px rgba(0,243,255,0.18))',
                        }}
                      >
                        {t(captionKeyFor(segId, 'Head'))}
                      </motion.h2>
                      <span
                        aria-hidden="true"
                        className="my-5 block h-px w-16 bg-gradient-to-r from-transparent via-accent/70 to-transparent sm:w-24"
                      />
                      <motion.p
                        initial={{ opacity: 0, letterSpacing: '0.32em' }}
                        animate={{ opacity: 1, letterSpacing: '0.14em' }}
                        transition={{ delay: 0.22, duration: 1, ease: [0.16, 0.84, 0.44, 1] }}
                        className="max-w-2xl font-serif text-sm font-medium leading-relaxed text-white/70 [text-wrap:balance] sm:text-lg lg:text-xl"
                        style={{ textShadow: '0 0 24px rgba(0,243,255,0.14)' }}
                      >
                        {t(captionKeyFor(segId, 'Sub'))}
                      </motion.p>
                    </motion.div>
                  </AnimatePresence>
                </div>

                <button
                  type="button"
                  onClick={skip}
                  className="absolute bottom-6 right-6 z-20 text-[10px] uppercase tracking-[0.3em] text-white/30 transition-colors hover:text-white/80"
                >
                  {t('skip')} →
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
                <p className="mb-4 text-xs uppercase tracking-[0.4em] text-accent/70">
                  {tGate('title')}
                </p>
                <h2 className="cs-awaken font-serif text-4xl font-bold tracking-[0.2em] text-white sm:text-6xl lg:text-7xl">
                  {t('comingSoon')}
                </h2>
                <p className="mt-6 max-w-md text-sm leading-relaxed text-gray-300 [text-wrap:balance] sm:text-base">
                  {t('awakening')}
                </p>
                <p className="mt-3 max-w-xs text-[11px] leading-relaxed text-white/35 [text-wrap:balance]">
                  {t('sealed')}
                </p>
                <div className="mt-10 flex flex-col items-center gap-3">
                  <button
                    type="button"
                    onClick={replay}
                    className="text-[11px] uppercase tracking-[0.25em] text-white/45 transition-colors hover:text-white/85"
                  >
                    ▷ {t('replay')}
                  </button>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-white/25">
                    U-AI · USPTO Patent Pending #64/023,911
                  </p>
                  <p className="text-[10px] tracking-wide text-white/20">{t('rights')}</p>
                </div>

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
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
