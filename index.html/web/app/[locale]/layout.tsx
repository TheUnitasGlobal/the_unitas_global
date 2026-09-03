import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { HtmlLangSync } from '@/components/i18n/HtmlLangSync';
import { LocaleAutoSwitch } from '@/components/i18n/LocaleAutoSwitch';
import { WalletProvider } from '@/components/wallet/WalletProvider';
import { NavBar } from '@/components/nav/NavBar';
import { AudioGate } from '@/components/audio/AudioGate';
import { ComingSoonCinema } from '@/components/ComingSoonCinema';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

const SITE_URL = 'https://www.theunitas.global';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'LocaleLayout' });
  const title = t('title');
  const description = `${t('description')} · THE UNITAS GLOBAL OÜ`;
  const url = `${SITE_URL}/${locale}`;

  return {
    description,
    alternates: {
      canonical: url,
      languages: {
        ...Object.fromEntries(routing.locales.map((loc) => [loc, `${SITE_URL}/${loc}`])),
        'x-default': `${SITE_URL}/${routing.defaultLocale}`,
      },
    },
    openGraph: {
      title,
      description,
      url,
      siteName: 'UNITAS',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

/**
 * Locale-scoped layout -- re-renders on every language switch (that's the
 * whole reason translations, NavBar and AudioGate live here rather than in
 * the stable root: they need fresh `messages` each time). NavBar/AudioGate
 * DO remount when this happens, but that's harmless for audio: the actual
 * AudioContext/`muted` state lives in SpatialAudioProvider one level up in
 * app/layout.tsx (which never remounts), so a fresh NavBar instance just
 * re-subscribes to that same still-running context and shows the correct
 * on/off state immediately -- the soundscape itself never stops.
 */
export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  return (
    <NextIntlClientProvider>
      <HtmlLangSync />
      <WalletProvider>
        <LocaleAutoSwitch />
        {/* Everything but the entry gate renders at a 75%-zoom-equivalent
            scale, so the whole ecosystem reads as one wide, majestic
            composition on entry instead of a taller, more cramped 100%
            layout. The gate itself stays outside this wrapper so its
            typography renders at full, undiminished scale. */}
        <div className="dashboard-zoom">
          <NavBar />
          <div className="relative z-0">{children}</div>
        </div>
        <AudioGate />
        {/* Pre-launch curtain: opaque, non-dismissable for the public; the
            founder bypasses it via ?dev=true / secret key / persisted grant
            (see lib/foundersGate.ts). Sits above everything, at full scale. */}
        <ComingSoonCinema />
        <noscript>
          {/* Fail-closed when JS is disabled: the client curtain can't mount,
              so seal the interface with a static panel instead. */}
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 500,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#030305',
              color: '#e2e8f0',
              textAlign: 'center',
              padding: '1.5rem',
              fontFamily: 'var(--font-cinzel), serif',
            }}
          >
            <p style={{ letterSpacing: '0.4em', color: 'rgba(212,175,55,0.7)', fontSize: '0.75rem' }}>
              UNITAS
            </p>
            <h2 style={{ letterSpacing: '0.2em', fontSize: '2rem', margin: '1rem 0 0.5rem' }}>
              COMING SOON
            </h2>
            <p style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
              The Sovereign Intelligence is Awakening
            </p>
          </div>
        </noscript>
      </WalletProvider>
    </NextIntlClientProvider>
  );
}
