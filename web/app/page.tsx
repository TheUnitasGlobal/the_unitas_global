'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { readStoredLocale } from '@/lib/preferences';

/**
 * Bare "/" entry point. Per owner mandate (2026-08-27):
 *   - A first-ever visit ALWAYS lands in English. The old server redirect
 *     sniffed `Accept-Language` and could send e.g. a Korean browser straight
 *     to `/ko`; that is gone.
 *   - Once the visitor picks a language from the nav dropdown it is stored in
 *     `localStorage` ('unitas_locale'); every later visit to "/" restores
 *     that choice automatically.
 *
 * Deep links to "/ko", "/ja", … still work directly and are unaffected. The
 * redirect must run on the client (that is where `localStorage` lives), so
 * this renders a full-bleed void screen for the split second before it fires
 * -- visually identical to the app's own background, plus a <noscript>
 * fallback to English.
 */
export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    const target = readStoredLocale(routing.locales) ?? routing.defaultLocale;
    router.replace(`/${target}`);
  }, [router]);

  return (
    <div
      aria-hidden="true"
      style={{ position: 'fixed', inset: 0, background: '#030305' }}
    >
      <noscript>
        <meta httpEquiv="refresh" content={`0; url=/${routing.defaultLocale}`} />
      </noscript>
    </div>
  );
}
