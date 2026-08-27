import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Cinzel, JetBrains_Mono } from 'next/font/google';
import { SceneLazy } from '@/components/canvas/SceneLazy';
import { SpatialAudioProvider } from '@/components/audio/SpatialAudioProvider';
import './globals.css';

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
 * longer tears this down and kills the ambient soundscape.
 *
 * The flip side of that same "never re-renders" property is that anything
 * here can't reactively track the current locale. So `<html lang>` is a
 * static fallback, kept in sync imperatively by <HtmlLangSync/> (a client
 * component living down in the locale-reactive tree, see
 * app/[locale]/layout.tsx), and translations/NextIntlClientProvider live
 * there too rather than here -- only state that must survive a locale
 * switch belongs in this file.
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
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/assets/svg/unitas-mark.svg', type: 'image/svg+xml' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/icons/apple-touch-icon.png',
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
      <body className="min-h-screen bg-void font-sans text-gray-200 antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ORGANIZATION_JSON_LD) }}
        />
        <SpatialAudioProvider>
          <SceneLazy />
          {children}
        </SpatialAudioProvider>
      </body>
    </html>
  );
}
