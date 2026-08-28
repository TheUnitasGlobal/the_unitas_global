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

type Phase = 'gate' | 'cinema' | 'sealed';

const PHASE_KEY = 'unitas_cinema_phase';
const LOCALE_PREF_KEY = 'unitas_locale_pref';
const LOCALE_AUTO_KEY = 'unitas_locale_autodetected';

const LOCALE_NATIVE: Record<string, string> = {
  en: 'English',
  ko: '한국어',
  et: 'Eesti',
  ja: '日本語',
  zh: '中文',
  es: 'Español',
};

/**
 * Pre-launch curtain. For the public this is a permanent, non-dismissable
 * overlay: entry gate -> 30s looping cinematic -> sealed "Coming Soon" screen,
 * and the main interface is never reachable. The founder bypasses the whole
 * component (see lib/foundersGate.ts) for build/QA.
 *
 * Mounted in app/[locale]/layout.tsx AFTER <AudioGate/> and outside
 * `.dashboard-zoom`, so it renders at full scale over everything. It is a
 * Client Component but still server-rendered (Next App Router SSRs client
 * components), so the opaque overlay is in the initial HTML -- no flash of the
 * real site before hydration. Fail-closed: initial state always shows the gate;
 * only an effect can later reveal the site (founder) or restore a later phase.
 */
export function ComingSoonCinema() {
  const t = useTranslations('ComingSoonGate');
  const tGate = useTranslations('AudioGate');
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const reduceMotion = useReducedMotion();

  const [bypassed, setBypassed] = useState(false);
  const [phase, setPhase] = useState<Phase>('gate');
  const [muted, setMuted] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [autoLocalized, setAutoLocalized] = useState(false);

  const field = useMemo(() => seedCinemaField(), []);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const captionRef = useRef<HTMLParagraphElement | null>(null);
  const progressRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);
  const audioRef = useRef<{
    ctx: AudioContext;
    master: GainNode;
    stop: () => void;
  } | null>(null);
  const lastCaptionSeg = useRef<number>(-1);

  // --- founder bypass + persisted phase --------------------------------------
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('dev') === 'off') {
      revokeFounderBypass();
    }

    if (readFounderBypass()) {
      persistFounderBypass();
      setBypassed(true);
      return;
    }

    try {
      const saved = sessionStorage.getItem(PHASE_KEY);
      if (saved === 'sealed') setPhase('sealed');
      else if (saved === 'cinema') setPhase('cinema');
    } catch {
      /* storage unavailable -- stay on the gate */
    }
  }, []);

  useEffect(() => {
    if (bypassed) return;
    try {
      sessionStorage.setItem(PHASE_KEY, phase);
    } catch {
      /* no-op */
    }
  }, [phase, bypassed]);

  // --- auto-localization to navigator.language ------------------------------
  useEffect(() => {
    if (bypassed) return;
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
    // locale/pathname intentionally omitted: this must run once on first load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bypassed]);

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

  // --- ambient audio (Web Audio API, low gain, user-gesture gated) ----------
  const startAmbient = useCallback(() => {
    if (audioRef.current || typeof window === 'undefined') return;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
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

    const now = ctx.currentTime;
    master.gain.setValueAtTime(0, now);
    master.gain.linearRampToValueAtTime(0.5, now + 2.5);

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

  useEffect(() => {
    return () => {
      audioRef.current?.stop();
      audioRef.current = null;
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // --- canvas render loop ---------------------------------------------------
  useEffect(() => {
    if (bypassed || phase === 'gate') return;
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
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    if (startRef.current === 0) startRef.current = performance.now();

    const paint = (elapsed: number) => {
      drawCinemaFrame({
        ctx,
        width: cssW,
        height: cssH,
        elapsedMs: elapsed,
        field,
        reducedMotion: !!reduceMotion,
        dim: phase === 'sealed' ? 1 : 0,
      });

      const seg = cinemaSegmentAt(elapsed);
      if (seg.id !== lastCaptionSeg.current && captionRef.current) {
        lastCaptionSeg.current = seg.id;
        captionRef.current.textContent = t(seg.captionKey);
      }
      if (progressRef.current) {
        progressRef.current.style.transform = `scaleX(${cinemaOverallProgress(elapsed)})`;
      }
    };

    if (reduceMotion) {
      // Single representative frame -- no rAF loop on low-power / reduced-motion.
      paint(phase === 'sealed' ? 27_000 : 6_000);
      if (phase === 'cinema') {
        const to = window.setTimeout(() => setPhase('sealed'), 1200);
        return () => {
          window.clearTimeout(to);
          window.removeEventListener('resize', resize);
        };
      }
      return () => window.removeEventListener('resize', resize);
    }

    const frame = (now: number) => {
      const elapsed = now - startRef.current;
      if (phase === 'cinema' && elapsed >= CINEMA_DURATION_MS) {
        setPhase('sealed');
        return;
      }
      paint(elapsed);
      rafRef.current = requestAnimationFrame(frame);
    };
    rafRef.current = requestAnimationFrame(frame);

    return () => {
      window.removeEventListener('resize', resize);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [bypassed, phase, field, reduceMotion, t]);

  // --- scroll lock while the curtain is up ---------------------------------
  useEffect(() => {
    if (bypassed) return;
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = prev;
    };
  }, [bypassed]);

  if (bypassed) return null;

  const enter = () => {
    if (!reduceMotion) startAmbient();
    startRef.current = 0;
    lastCaptionSeg.current = -1;
    setPhase('cinema');
  };

  const replay = () => {
    startRef.current = 0;
    lastCaptionSeg.current = -1;
    setPhase('cinema');
  };

  return (
    <div className="fixed inset-0 z-[400] overflow-hidden bg-void text-center">
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
          <p className="mt-2 max-w-[10rem] text-[10px] leading-tight text-white/40">{t('autoNote')}</p>
        )}
      </div>

      {/* sound toggle -- cinema + sealed only */}
      {phase !== 'gate' && !reduceMotion && (
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

      <AnimatePresence mode="wait">
        {phase === 'gate' && (
          <motion.div
            key="gate"
            className="absolute inset-0 flex flex-col items-center justify-center px-6 backdrop-blur-2xl"
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
                style={{ textShadow: '0 0 24px rgba(212,175,55,0.3), 0 0 60px rgba(0,243,255,0.1)' }}
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
            </motion.div>
          </motion.div>
        )}

        {phase !== 'gate' && (
          <motion.div
            key="stage"
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8 }}
          >
            <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />

            {phase === 'cinema' && (
              <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-4 px-6 pb-14">
                <p
                  ref={captionRef}
                  className="min-h-[1.5em] max-w-xl text-sm tracking-[0.12em] text-white/80 [text-wrap:balance] sm:text-base"
                />
                <div className="h-px w-56 max-w-[70vw] overflow-hidden bg-white/15">
                  <div
                    ref={progressRef}
                    className="h-full origin-left bg-accent"
                    style={{ transform: 'scaleX(0)' }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setPhase('sealed')}
                  className="text-[11px] uppercase tracking-[0.2em] text-white/40 transition-colors hover:text-white/80"
                >
                  {t('skip')} →
                </button>
              </div>
            )}

            {phase === 'sealed' && (
              <motion.div
                className="absolute inset-0 flex flex-col items-center justify-center px-6"
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
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
