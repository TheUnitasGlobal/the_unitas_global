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
import { PwaInstallHost } from '@/components/pwa/PwaInstallHost';
import { InAppBrowserEscape } from '@/components/pwa/InAppBrowserEscape';
import { SovereignDebugPanel } from '@/components/sovereign/SovereignDebugPanel';
import { ExitGuard } from '@/components/interaction/ExitGuard';
import { SovereignShield } from '@/components/system/SovereignShield';
import { SealedFallback } from '@/components/system/SealedFallback';
import { PageShield } from '@/components/system/PageShield';

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
  // Root single-URL SEO architecture (owner instruction 2026-09-06):
  // localePrefix is 'as-needed', so the default locale (English) lives at
  // the bare root, not `/en` -- canonical/hreflang must point there too, or
  // Google indexes a phantom `/en` alongside the real, unprefixed page.
  const localizedUrl = (loc: string) =>
    loc === routing.defaultLocale ? SITE_URL : `${SITE_URL}/${loc}`;
  const url = localizedUrl(locale);

  return {
    description,
    alternates: {
      canonical: url,
      languages: {
        ...Object.fromEntries(routing.locales.map((loc) => [loc, localizedUrl(loc)])),
        'x-default': SITE_URL,
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
      {/* Sovereign Shield doctrine (owner instruction 2026-09-07, item 1):
          every independent module below sits in its own self-healing
          SovereignShield so a module-local fault never escalates into the
          route-level "Sovereign Core Error" screen. Fallbacks are FAIL-SAFE
          per module: nothing for chrome / guards (the site keeps working
          without them for a beat while they remount), the quiet
          ModuleFallback for the page slot, and -- the one FAIL-CLOSED case --
          a static sealed panel for the pre-launch curtain, so a curtain fault
          can never expose the site to the public. */}
      <SovereignShield zone="html-lang">
        <HtmlLangSync />
      </SovereignShield>
      <WalletProvider>
        <SovereignShield zone="locale-auto-switch">
          <LocaleAutoSwitch />
        </SovereignShield>
        {/* Everything but the entry gate renders at a 75%-zoom-equivalent
            scale, so the whole ecosystem reads as one wide, majestic
            composition on entry instead of a taller, more cramped 100%
            layout. The gate itself stays outside this wrapper so its
            typography renders at full, undiminished scale. */}
        <div className="dashboard-zoom">
          <SovereignShield zone="nav">
            <NavBar />
          </SovereignShield>
          <div className="relative z-0">
            <PageShield>{children}</PageShield>
          </div>
        </div>
        <SovereignShield zone="audio-gate">
          <AudioGate />
        </SovereignShield>
        {/* Pre-launch curtain: opaque, non-dismissable for the public; only a
            server-verified sovereign founder session (?sovereign_auth=<token>
            -> middleware.ts -> /api/sovereign/verify, see lib/sovereignAuth.ts)
            unlocks the founder door. Sits above everything, at full scale.
            FAIL-CLOSED: its shield falls back to the static sealed panel. */}
        <SovereignShield zone="curtain" fallback={<SealedFallback />}>
          <ComingSoonCinema />
        </SovereignShield>
        {/* Sovereign exit confirm (owner instruction 2026-09-05, checklist
            items 2 + 3): a history-traversal sentinel buffer on EVERY device
            and EVERY funnel page in both channels -- back / forward is
            swallowed silently on the logo / gate / ad / Coming-Soon pages and
            opens the exit confirm on the main home; PC ESC toggles it.
            Mounted here in the layout (not the home page) so one guard
            serves every route; its modal renders on the top layer (z-680),
            above the curtain. */}
        <SovereignShield zone="exit-guard">
          <ExitGuard />
        </SovereignShield>
        {/* Global one-click PWA install handler (z-650) -- serves every route,
            including the sealed cinema screen. Any `data-pwa-install` element
            or requestPwaInstall() call anywhere resolves here. */}
        <SovereignShield zone="pwa-install">
          <PwaInstallHost />
        </SovereignShield>
        {/* In-app browser (Facebook / Instagram / KakaoTalk / LINE / ...
            WebView) hand-off fallback card (z-660). The automatic hand-off
            itself fires pre-hydration from app/layout.tsx's head bootstrap;
            this only appears if the container refused it. Renders nothing
            in a real browser or the installed app. */}
        <SovereignShield zone="inapp-escape">
          <InAppBrowserEscape />
        </SovereignShield>
        {/* Founder-only console (renders nothing unless the server verifies). */}
        <SovereignShield zone="sovereign-debug">
          <SovereignDebugPanel />
        </SovereignShield>
        <noscript>
          {/* Fail-closed when JS is disabled: the client curtain can't mount,
              so seal the interface with a static panel instead. */}
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 500,
              height: '100svh',
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
