import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: [
    'en', 'ko', 'et', 'ja', 'zh', 'es', 'km', 'fr', 'de', 'pt', 'vi', 'id',
    'ru', 'hi', 'it', 'tr', 'th', 'pl', 'nl', 'tl',
  ],
  defaultLocale: 'en',
  // Owner instruction 2026-09-06 (root single-URL English-first SEO
  // architecture): the default locale gets NO prefix (`/` serves English,
  // not `/en`) while every other locale keeps its prefix (`/ko`, `/ja`, ...).
  // `localeDetection: false` means this is enforced purely from the URL --
  // `/` always resolves to English regardless of Accept-Language or a
  // previous locale cookie, matching the "priority-1 automatic English
  // rendering" requirement (no Accept-Language-based redirect away from
  // root). Visiting the now-superfluous `/en` still 308-redirects to `/`
  // for canonical consolidation -- see middleware.ts.
  localePrefix: 'as-needed',
  localeDetection: false,
});
