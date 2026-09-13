import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Cinzel, JetBrains_Mono } from 'next/font/google';
import { SceneLazy } from '@/components/canvas/SceneLazy';
import { SpatialAudioProvider } from '@/components/audio/SpatialAudioProvider';
import { TerminationBoundary } from '@/components/exit/TerminationBoundary';
import { CinematicIntroSplash } from '@/components/splash/CinematicIntroSplash';
import { RuntimeShield } from '@/components/system/RuntimeShield';
import { SovereignShield } from '@/components/system/SovereignShield';
import { ShortsOrphanCleanup } from '@/components/system/ShortsOrphanCleanup';
import { WalletProvider } from '@/components/wallet/WalletProvider';
import { ENTRY_CHIME_BOOTSTRAP } from '@/lib/audio/logoEntryChime';
import { EXIT_GUARD_BOOTSTRAP } from '@/lib/exit/appExit';
import { SITE_LINK_BOOTSTRAP } from '@/lib/sitePages';
import { PWA_CAPTURE_BOOTSTRAP } from '@/lib/pwa/installPrompt';
import { IN_APP_ESCAPE_BOOTSTRAP } from '@/lib/pwa/inAppBrowser';
import { STANDALONE_LAUNCH_BOOTSTRAP } from '@/lib/pwa/standaloneLaunch';
import { PWA_ICON_VERSION, PWA_MANIFEST_HREF, pwaIconHref } from '@/lib/pwa/iconVersion';
import {
  GOOGLE_SITE_VERIFICATION,
  NAVER_SITE_VERIFICATION,
  SEZNAM_SITE_VERIFICATION,
  YANDEX_SITE_VERIFICATION,
} from '@/lib/seo/routes';
import './globals.css';
import './splash.css';
import './waitlist.css';

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
  // Google Search Console ownership proof (founder directive 2026-09-13),
  // declared FIRST so it reads as the head's highest-priority imprint. Next
  // emits it as <meta name="google-site-verification" content="..." /> -- via
  // the Metadata API rather than a hand-written <meta> in the <head> JSX
  // below, because Next owns head de-duplication and streaming for metadata
  // tags and documents the manual form as unsupported in a root layout. No
  // route redeclares `verification`, so the shallow metadata merge carries
  // this to every one of the 340 indexable URLs. The token itself lives in
  // lib/seo/routes.ts, beside SITE_URL / SITEMAP_URL.
  verification: {
    google: GOOGLE_SITE_VERIFICATION,
    // Yandex Webmaster (founder directive 2026-09-13). Yandex, unlike Naver,
    // IS a first-class field on Next's `Verification` type, so it needs no
    // `other` escape hatch.
    yandex: YANDEX_SITE_VERIFICATION,
    // Naver Search Advisor (founder directive 2026-09-13). Next's
    // `Verification` type is exactly { google, yahoo, yandex, me, other } --
    // there is no `naver` field, and writing one is a compile error rather
    // than a no-op -- so the token is declared under `other` by its literal
    // meta name, which Next emits verbatim. This sits INSIDE the existing
    // `verification` object on purpose: a second `verification:` key in this
    // literal would be a duplicate-property error, and if it ever compiled,
    // the later one would silently erase the Google token.
    other: {
      'naver-site-verification': NAVER_SITE_VERIFICATION,
      // Seznam.cz (Czech market) -- another console with no first-class field.
      'seznam-wmt': SEZNAM_SITE_VERIFICATION,
    },
  },
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
  applicationName: 'UNITAS',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'UNITAS',
  },
  // Standalone-mode imprint (owner instruction 2026-09-07, comparative
  // hardening item 4): `appleWebApp.capable` covers iOS; Chromium on Android
  // (and the older Samsung / Huawei shells) read the legacy
  // `mobile-web-app-capable` meta for the same "launch without browser
  // chrome" contract, alongside manifest `display: standalone`.
  other: {
    'mobile-web-app-capable': 'yes',
  },
};

export const viewport: Viewport = {
  themeColor: '#d4af37',
  // REV-21 §4.3 row 8: paint into the notch / home-indicator safe areas so
  // fixed surfaces (towers, sheets, the curtain) never leave a letterbox.
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${cinzel.variable} ${jetbrainsMono.variable}`}>
      <head>
        {/* Pre-hydration PWA bootstrap: captures `beforeinstallprompt` before
            React mounts (it fires once, early), registers /sw.js on load, and
            stamps data-splash="off" for ?splash=0. See lib/pwa/installPrompt.ts. */}
        <script id="unitas-pwa-bootstrap" dangerouslySetInnerHTML={{ __html: PWA_CAPTURE_BOOTSTRAP }} />
        {/* Installed-app launch fast-path (owner instruction 2026-09-07,
            item 4): inside the standalone app, a `/` launch is redirected to
            the visitor's persisted language BEFORE first paint, so the app
            opens in the right locale in one document. No-op online.
            See lib/pwa/standaloneLaunch.ts. */}
        <script id="unitas-standalone-launch" dangerouslySetInnerHTML={{ __html: STANDALONE_LAUNCH_BOOTSTRAP }} />
        {/* In-app browser hand-off (owner instruction 2026-09-07, item 2): a
            Facebook / Instagram / KakaoTalk / LINE / ... embedded WebView can
            never install the app, so the page is handed to the system
            browser automatically, pre-paint, throttled to once per 90s.
            See lib/pwa/inAppBrowser.ts. */}
        <script id="unitas-inapp-escape" dangerouslySetInnerHTML={{ __html: IN_APP_ESCAPE_BOOTSTRAP }} />
        {/* Pre-hydration back-guard bootstrap (round 16, item 1): parks the
            hardware-back sentinel buffer on the visitor's FIRST gesture --
            on the 3s logo page, before ExitGuard has hydrated on a phone --
            so a back press there never finishes the installed app. Stands
            down once ExitGuard mounts. See lib/exit/appExit.ts. */}
        <script id="unitas-exit-guard-bootstrap" dangerouslySetInnerHTML={{ __html: EXIT_GUARD_BOOTSTRAP }} />
        {/* REV-21 §6.1 (F-2): a footer / legal link clicked BEFORE React has
            hydrated is captured here and its page request parked for
            SiteLinkModalHost to open on mount, instead of falling through to
            the anchor and routing into the dark document. Stands down on the
            first click after the host mounts. See lib/sitePages.ts. */}
        <script id="unitas-site-link-bootstrap" dangerouslySetInnerHTML={{ __html: SITE_LINK_BOOTSTRAP }} />
        {/* Pre-hydration logo-page entry chime (owner instruction 2026-09-07,
            mobile online browser fix): from the document's first byte, arms
            the chime's own AudioContext and sounds it immediately where
            autoplay is allowed, else inside the visitor's very FIRST tap --
            before React has hydrated on a phone, and never torn down when the
            3s logo page ends. Must come AFTER the PWA bootstrap, which stamps
            data-splash="off" for in-place refreshes. See lib/audio/logoEntryChime.ts. */}
        <script id="unitas-entry-chime-bootstrap" dangerouslySetInnerHTML={{ __html: ENTRY_CHIME_BOOTSTRAP }} />
      </head>
      <body className="min-h-screen bg-void font-sans text-gray-200 antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ORGANIZATION_JSON_LD) }}
        />
        {/* Round 19 (owner instruction 2026-09-06, task-switcher hygiene):
            the app's `root.unmount()`. Everything rendered under <body> --
            the splash, the audio graph, the 3D scene, every route -- sits
            inside this boundary, so a terminated app releases the WHOLE
            tree (WebGL, AudioContexts, timers, channels) through React's own
            cleanups. See components/exit/TerminationBoundary.tsx. */}
        <TerminationBoundary>
          {/* Sovereign Shield doctrine (owner instruction 2026-09-07, item 1):
              the route-level error screens never cover THIS layout's own
              modules -- a fault in the 3D scene, the intro splash or the audio
              graph used to fall straight through to global-error.tsx as a
              "SOVEREIGN CORE ERROR". Each module now sits in its own
              self-healing SovereignShield (fallback: nothing), and
              RuntimeShield catches the window-level faults no boundary sees.
              See components/system/*. */}
          <RuntimeShield />
          <ShortsOrphanCleanup />
          {/* Forced 3s SILENT cinematic intro ("logo page") -- SSR'd visible,
              top of the stack (z-700); runs only on a cold entry, never on a
              refresh of any page. */}
          <SovereignShield zone="intro-splash">
            <CinematicIntroSplash />
          </SovereignShield>
          <SpatialAudioProvider>
            <SovereignShield zone="scene">
              <SceneLazy />
            </SovereignShield>
            {/* REV-21 §4A (F2): the wallet / session provider has no next-intl
                dependency, so it lives ABOVE the `[locale]` segment -- a
                language switch no longer remounts it (no session re-query,
                no coin-badge blank, no locale auto-switch re-bounce). */}
            <WalletProvider>{children}</WalletProvider>
          </SpatialAudioProvider>
        </TerminationBoundary>
      </body>
    </html>
  );
}
