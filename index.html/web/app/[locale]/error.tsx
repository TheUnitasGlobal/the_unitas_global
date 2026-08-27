'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { ShieldAlert } from 'lucide-react';

/**
 * Route-segment error boundary. Deliberately renders NOTHING from the
 * caught `error` object except `error.digest` -- Next.js's own
 * purpose-built opaque reference hash for server-side log lookup, which
 * carries no file paths, stack traces, or internal identifiers. Never
 * render `error.message` / `error.stack` / `error.name` here: those can
 * (and in this app's case, given Supabase/Stripe error messages, likely
 * will) leak internal details to the client.
 */
export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('ErrorBoundary');

  useEffect(() => {
    // Browser-console-only, never rendered to the page -- fine for local
    // debugging without violating the "hide internals from the UI" rule.
    console.error('[Sovereign Core Error]', error);
  }, [error]);

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
          onClick={reset}
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
