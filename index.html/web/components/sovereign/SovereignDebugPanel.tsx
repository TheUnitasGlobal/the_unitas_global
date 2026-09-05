'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronUp, LogOut, Play, RotateCcw, ShieldCheck, Sparkles } from 'lucide-react';
import {
  CINEMA_PHASE_EVENT,
  revokeSovereignFounder,
  verifySovereignFounder,
  type SovereignVerification,
} from '@/lib/foundersGate';
import { CINEMA_PHASE_STORAGE_KEY, SPLASH_REPLAY_EVENT } from '@/lib/splash/splashTimeline';

const COLLAPSED_KEY = 'unitas_sovereign_panel_collapsed';
// The curtain's persisted phase key (shared constant) -- read once for the
// initial value, then kept live through CINEMA_PHASE_EVENT.
const PHASE_KEY = CINEMA_PHASE_STORAGE_KEY;

/**
 * Founder debug panel (owner instruction 2026-09-04, item 4-2). Renders
 * NOTHING until GET /api/sovereign/verify confirms the HMAC-signed founder
 * session -- there is no client-side flag that can summon it. Once verified
 * it pins a compact glass console (z-450: above the pre-launch curtain, below
 * the PWA sheet and the intro splash) with the session expiry, the live
 * curtain phase and the QA controls that used to hide behind URL params:
 * enter main site (`?dev=skip`), replay the sequence (`?dev=replay`), replay
 * the intro splash, and revoke the session. Collapsed state persists for
 * the tab.
 *
 * Collapsing (owner instruction 2026-09-05, item 3) swaps the whole panel
 * for a mini circular toggle button at the same anchor point, rather than
 * just hiding the body under a full-width header bar -- so a collapsed
 * console is genuinely out of the way of whatever is underneath it.
 */
export function SovereignDebugPanel() {
  const t = useTranslations('Sovereign');
  const [session, setSession] = useState<SovereignVerification | null>(null);
  const [phase, setPhase] = useState('gate');
  const [collapsed, setCollapsed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    void verifySovereignFounder().then((result) => {
      if (alive && result.founder) setSession(result);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    try {
      setCollapsed(sessionStorage.getItem(COLLAPSED_KEY) === '1');
      setPhase(sessionStorage.getItem(PHASE_KEY) ?? 'gate');
    } catch {
      /* no-op */
    }
    const onPhase = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      if (typeof detail === 'string') setPhase(detail);
    };
    window.addEventListener(CINEMA_PHASE_EVENT, onPhase);
    return () => window.removeEventListener(CINEMA_PHASE_EVENT, onPhase);
  }, []);

  if (!session) return null;

  const expires = session.expiresAt ? new Date(session.expiresAt * 1000) : null;

  const navigateWith = (query: string) => {
    const url = new URL(window.location.href);
    url.search = query;
    window.location.assign(url.toString());
  };

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        sessionStorage.setItem(COLLAPSED_KEY, next ? '1' : '0');
      } catch {
        /* no-op */
      }
      return next;
    });
  };

  const revoke = async () => {
    setBusy(true);
    await revokeSovereignFounder();
    try {
      sessionStorage.removeItem(PHASE_KEY);
    } catch {
      /* no-op */
    }
    window.location.reload();
  };

  const actionClass =
    'flex w-full items-center gap-2 border border-accent/30 bg-void/60 px-3 py-2 text-left text-[11px] uppercase tracking-[0.14em] text-gray-100 transition-colors hover:border-accent hover:text-accent disabled:opacity-50';

  // Collapsed state (owner instruction 2026-09-05, item 3): a true mini
  // toggle button -- not the full-width panel with its body merely hidden --
  // so the console stays out of the way of the page underneath it until the
  // founder deliberately reopens it.
  if (collapsed) {
    return (
      <button
        type="button"
        onClick={toggleCollapsed}
        aria-label={t('expand')}
        data-testid="sovereign-debug-panel"
        className="cs-glass fixed left-4 top-24 z-[450] flex h-10 w-10 items-center justify-center rounded-full text-accent shadow-[0_0_30px_rgba(212,175,55,0.15)] transition-transform hover:scale-105"
      >
        <ShieldCheck size={18} aria-hidden="true" />
      </button>
    );
  }

  return (
    <aside
      className="cs-glass fixed left-4 top-24 z-[450] w-[min(17rem,calc(100vw-2rem))] rounded-xl p-3 text-left text-white shadow-[0_0_30px_rgba(212,175,55,0.15)]"
      aria-label={t('title')}
      data-testid="sovereign-debug-panel"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-serif text-[11px] font-bold uppercase tracking-[0.24em] text-accent">
          <ShieldCheck size={14} aria-hidden="true" />
          {t('title')}
        </p>
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={t('collapse')}
          className="flex h-6 w-6 items-center justify-center text-white/60 transition-colors hover:text-white"
        >
          <ChevronUp size={14} />
        </button>
      </div>

      <div className="mt-3 space-y-3">
        <dl className="space-y-1 text-[11px] leading-relaxed text-white/70">
          <div className="flex items-center gap-2 text-emerald-300/90">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
            <dd>{t('verified')}</dd>
          </div>
          {expires && (
            <div className="flex justify-between gap-3">
              <dt className="text-white/45">{t('expires')}</dt>
              <dd className="font-mono text-[10px] text-white/80">{expires.toLocaleDateString()}</dd>
            </div>
          )}
          <div className="flex justify-between gap-3">
            <dt className="text-white/45">{t('phase')}</dt>
            <dd className="font-mono text-[10px] uppercase text-cyan-300/90">{phase}</dd>
          </div>
        </dl>

        <div className="space-y-1.5">
          <button type="button" className={actionClass} onClick={() => navigateWith('?dev=skip')}>
            <Play size={12} aria-hidden="true" />
            {t('enterMain')}
          </button>
          <button type="button" className={actionClass} onClick={() => navigateWith('?dev=replay')}>
            <RotateCcw size={12} aria-hidden="true" />
            {t('replaySequence')}
          </button>
          <button
            type="button"
            className={actionClass}
            onClick={() => window.dispatchEvent(new CustomEvent(SPLASH_REPLAY_EVENT))}
          >
            <Sparkles size={12} aria-hidden="true" />
            {t('replaySplash')}
          </button>
          <button type="button" className={actionClass} onClick={() => void revoke()} disabled={busy}>
            <LogOut size={12} aria-hidden="true" />
            {t('revoke')}
          </button>
        </div>
      </div>
    </aside>
  );
}
