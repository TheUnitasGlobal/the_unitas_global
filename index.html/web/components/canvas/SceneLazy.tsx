'use client';

import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { routing } from '@/i18n/routing';

/**
 * Code-splits the WebGL background (three.js + @react-three/fiber) into its
 * own chunk loaded after the initial page JS, instead of bundled inline with
 * everything else. Diagnosed via a real headless-browser click test: with
 * `Scene` imported eagerly, the heavy R3F/three.js module graph delayed
 * React's hydration of the whole tree, so the AudioGate's "Enter" button was
 * silently unresponsive to clicks for a few seconds after first paint (the
 * button existed in the server-rendered HTML but hadn't been wired up to its
 * onClick yet). Deferring the canvas via `ssr: false` lets the interactive
 * chrome (gate, nav, audio) hydrate first while the decorative background
 * loads in behind it. `next/dynamic({ ssr: false })` requires a Client
 * Component boundary -- the parent layout is a Server Component, hence this
 * tiny wrapper.
 */
const DynamicScene = dynamic(() => import('./Scene').then((mod) => mod.Scene), {
  ssr: false,
});

/**
 * REV-13 "Quantum White" home (spec §10.1): the home route renders its own
 * white canvas and must never mount this opaque WebGL background at all --
 * `[data-unitas-scene]{display:none}` alone would still pay for a live R3F
 * context behind the curtain.
 *
 * This uses the RAW `next/navigation` `usePathname`, not the next-intl-aware
 * wrapper in `@/i18n/navigation` that the rest of the Quantum White surface
 * uses -- `SceneLazy` is mounted in the TRUE app root layout
 * (`app/layout.tsx`), which sits deliberately OUTSIDE the `[locale]` segment
 * and outside `NextIntlClientProvider` (see that layout's own doc comment:
 * the splash/gate stack must survive locale changes uninterrupted). next-intl's
 * `usePathname` calls `useLocale()` internally and throws when rendered
 * without an intl context above it -- confirmed the hard way: it took down
 * static generation for every route, including `/_not-found`. The raw
 * pathname keeps its locale prefix (`/ko/apex`, `/apex` for the unprefixed
 * default locale per `routing.localePrefix: 'as-needed'`), so the home route
 * is matched manually against every configured locale instead.
 */
const HOME_PATHNAMES = new Set<string>([
  '/',
  ...routing.locales.map((locale) => `/${locale}`),
]);

export function SceneLazy() {
  const pathname = usePathname();
  if (HOME_PATHNAMES.has(pathname)) return null;
  return <DynamicScene />;
}
