import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Cinzel, JetBrains_Mono } from 'next/font/google';
import { SceneLazy } from '@/components/canvas/SceneLazy';
import { SpatialAudioProvider } from '@/components/audio/SpatialAudioProvider';
import { CinematicIntroSplash } from '@/components/splash/CinematicIntroSplash';
import { PWA_CAPTURE_BOOTSTRAP } from '@/lib/pwa/installPrompt';
import { PWA_ICON_VERSION, PWA_MANIFEST_HREF, pwaIconHref } from '@/lib/pwa/iconVersion';
import './globals.css';
import './splash.css';

const cinzel = Cinzel({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-cinzel',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['300', '400', '700'],
  variable: '--font-jetbrains-mono',
});

/**
 * True app root -- deliberately outside `app/[locale]/` and deliberately NOT
 * reading the request locale (no dynamic API calls here at all). Next.js's
 * App Router only re-renders the segment that actually changed plus its
 * descendants on a client-side navigation ("partial rendering") -- layouts
 * ABOVE that point, like this one, are never re-invoked for that
 * navigation. That's exactly the property we want here: `SpatialAudioProvider`
 * (and its live AudioContext/oscillators) sits above the `[locale]` segment,
 * so switching languages -- a navigation from `/en` to `/ko` etc. -- no
 * longer tears this down and kills the ambient soundscape. The same property
 * keeps <CinematicIntroSplash/> running uninterrupted through the locale
 * auto-switch that can fire during its first second.
 *
 * The flip side of that same "never re-renders" property is that anything
 * here can't reactively track the current locale. So `<html lang>` is a
 * static fallback, kept in sync imperatively by <HtmlLangSync/> (a client
 * component living down in the locale-reactive tree, see
 * app/[locale]/layout.tsx), and translations/NextIntlClientProvider live
 * there too rather than here -- only state that must survive a locale
 * switch belongs in this file.
 *
 * PWA icon cache-busting (owner instruction 2026-09-04, item 1): every icon
 * href below and the manifest link carry the content-versioned
 * `?v=v2-final-symmetry.<digest>` query stamped by scripts/pwa-cache-bust.mjs
 * at build time, so OS/browser install records re-download the v2 mark.
 */
const SITE_URL = 'https://www.theunitas.global';

const ORGANIZATION_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'UNITAS',
  legalName: 'THE UNITAS GLOBAL OÜ',
  url: SITE_URL,
  sameAs: [SITE_URL],
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    template: '%s | UNITAS',
    default: 'UNITAS',
  },
  manifest: PWA_MANIFEST_HREF,
  icons: {
    icon: [
      { url: `/favicon.ico?v=${PWA_ICON_VERSION}`, sizes: 'any' },
      { url: `/assets/svg/unitas-mark.svg?v=${PWA_ICON_VERSION}`, type: 'image/svg+xml' },
      { url: pwaIconHref('icon-192.png'), sizes: '192x192', type: 'image/png' },
      { url: pwaIconHref('icon-512.png'), sizes: '512x512', type: 'image/png' },
    ],
    shortcut: `/favicon.ico?v=${PWA_ICON_VERSION}`,
    apple: pwaIconHref('apple-touch-icon.png'),
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'UNITAS',
  },
};

export const viewport: Viewport = {
  themeColor: '#d4af37',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${cinzel.variable} ${jetbrainsMono.variable}`}>
      <head>
        {/* Pre-hydration PWA bootstrap: captures `beforeinstallprompt` before
            React mounts (it fires once, early), registers /sw.js on load, and
            stamps data-splash="off" for ?splash=0. See lib/pwa/installPrompt.ts. */}
        <script id="unitas-pwa-bootstrap" dangerouslySetInnerHTML={{ __html: PWA_CAPTURE_BOOTSTRAP }} />
      </head>
      <body className="min-h-screen bg-void font-sans text-gray-200 antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ORGANIZATION_JSON_LD) }}
        />
        {/* Forced 3s cinematic intro -- SSR'd visible, top of the stack (z-700). */}
        <CinematicIntroSplash />
        <SpatialAudioProvider>
          <SceneLazy />
          {children}
        </SpatialAudioProvider>
      </body>
    </html>
  );
}
