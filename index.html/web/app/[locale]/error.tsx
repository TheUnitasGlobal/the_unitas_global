'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { ShieldAlert } from 'lucide-react';
import { PWA_ICON_VERSION } from '@/lib/pwa/iconVersion';
import { SELF_HEAL_DELAY_MS, claimSelfHealAttempt, clearSelfHealRecord } from '@/lib/system/selfHeal';

const SELF_HEAL_SCOPE = 'locale-route';

/**
 * Route-segment error boundary. Deliberately renders NOTHING from the
 * caught `error` object except `error.digest` -- Next.js's own
 * purpose-built opaque reference hash for server-side log lookup, which
 * carries no file paths, stack traces, or internal identifiers. Never
 * render `error.message` / `error.stack` / `error.name` here: those can
 * (and in this app's case, given Supabase/Stripe error messages, likely
 * will) leak internal details to the client.
 *
 * SELF-HEALING (owner instruction 2026-09-07, item 1): this screen is the
 * last resort behind the per-module SovereignShields, and even here the
 * first move is to heal, not to show: on mount it calls Next's `reset()`
 * itself after a short beat (lib/system/selfHeal.ts budget: two automatic
 * attempts per 30s window), rendering only a quiet void with the dimmed
 * mark in the meantime. A transient fault therefore never surfaces the
 * "Sovereign Core Error" copy at all; only a persistent one, past the
 * budget, shows the full screen with its manual Retry / Home controls.
 */
export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('ErrorBoundary');
  const [healing, setHealing] = useState(true);

  useEffect(() => {
    // Browser-console-only, never rendered to the page -- fine for local
    // debugging without violating the "hide internals from the UI" rule.
    console.error('[Sovereign Core Error]', error);
  }, [error]);

  useEffect(() => {
    if (!claimSelfHealAttempt(SELF_HEAL_SCOPE)) {
      setHealing(false);
      return;
    }
    const timer = window.setTimeout(() => {
      try {
        reset();
      } catch {
        setHealing(false);
      }
    }, SELF_HEAL_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [reset]);

  if (healing) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-void" role="status" aria-busy="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/assets/svg/unitas-mark.svg?v=${PWA_ICON_VERSION}`}
          alt=""
          aria-hidden="true"
          draggable={false}
          className="h-14 w-14 animate-pulse opacity-40"
          style={{ filter: 'saturate(.4)' }}
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <ShieldAlert size={40} className="mb-6 text-accent" aria-hidden="true" />
      <h1 className="glow-text mb-3 font-serif text-2xl font-bold text-white md:text-3xl">
        {t('title')}
      </h1>
      <p className="mb-8 max-w-md text-sm text-gray-400">{t('body')}</p>

      {error.digest && (
        <p className="mb-8 text-[10px] uppercase tracking-widest text-gray-600">
          {t('digestLabel')} {error.digest}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => {
            clearSelfHealRecord(SELF_HEAL_SCOPE);
            reset();
          }}
          className="border border-accent bg-accent/10 px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-accent transition-all hover:bg-accent hover:text-void"
        >
          {t('retry')}
        </button>
        <Link
          href="/"
          className="border border-white/20 px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-gray-300 transition-all hover:border-white/40"
        >
          {t('home')}
        </Link>
      </div>
    </div>
  );
}
