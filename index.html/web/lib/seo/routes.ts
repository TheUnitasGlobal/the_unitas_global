/**
 * REV-22 M_SEO -- the single source of truth for "which URLs exist for a
 * search engine, and what each one's canonical / hreflang set is".
 *
 * Codex v23.0 ch.12 (extreme SEO saturation) was the last unfulfilled chapter
 * of REV-21: `/sitemap.xml` and `/robots.txt` both returned a live 404 because
 * neither file existed anywhere in the source tree. This module is the shared
 * core that `app/sitemap.ts`, `app/robots.ts` and every page's
 * `generateMetadata` now read from, so the sitemap, the robots directives and
 * the on-page `<link rel="canonical">` can never disagree.
 *
 * Deliberately pure: no `next/*` runtime import, no `window`, no I/O -- it is
 * unit-tested directly in __tests__/seo/routes.test.ts. The only inputs are
 * three catalogs that already existed:
 *   * `routing` (i18n/routing.ts) -- the 20 locales + the `as-needed` prefix rule
 *   * `sitePages.ts` slug lists   -- company / legal / support pages
 *   * `MODULE_REGISTRY`           -- which module routes are coin-gated (and
 *                                    therefore NOT indexable)
 *
 * Nothing here is hand-maintained alongside those catalogs; adding a locale, a
 * legal page or a module automatically flows through.
 */

import { routing } from '@/i18n/routing';
import { COMPANY_SLUGS, LEGAL_SLUGS, SUPPORT_SLUGS } from '@/lib/sitePages';
import { MODULE_REGISTRY } from '@/lib/module-registry';

/** Canonical origin. No trailing slash -- `absoluteUrl` adds the path. */
export const SITE_URL = 'https://www.theunitas.global';

/** Bare canonical host, for the robots.txt `Host:` directive. */
export const SITE_HOST = 'www.theunitas.global';

export type ChangeFrequency =
  | 'always'
  | 'hourly'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'yearly'
  | 'never';

export interface PublicRoute {
  /** Locale-INDEPENDENT path, always leading-slash. '/' is the home page. */
  path: string;
  priority: number;
  changeFrequency: ChangeFrequency;
}

/**
 * Every route a search engine is allowed to index, locale-independent.
 *
 * Deliberately EXCLUDED, each for a reason a crawler can verify:
 *   * `/sovereign*`     -- middleware.ts answers a bodiless 404 to anyone
 *                          without the signed founder cookie. Listing a hard
 *                          404 in a sitemap is a pure crawl-budget leak.
 *   * the 16 coin-gated -- app/[locale]/(gated)/layout.tsx `redirect()`s an
 *     module routes        ungranted visitor to `/locked` (307). A sitemap
 *                          full of redirects earns "Page with redirect"
 *                          exclusions in Search Console, not rankings.
 *   * `/locked`         -- the redirect target itself: a state screen with no
 *                          standalone content.
 *   * `/api/*`          -- JSON endpoints, never a search result.
 */
export const PUBLIC_ROUTES: readonly PublicRoute[] = [
  { path: '/', priority: 1.0, changeFrequency: 'daily' },
  { path: '/u-ai', priority: 0.9, changeFrequency: 'daily' },
  { path: '/u-signature', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/u-key', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/u-pay', priority: 0.8, changeFrequency: 'monthly' },
  ...COMPANY_SLUGS.map((slug): PublicRoute => ({
    path: `/company/${slug}`,
    priority: slug === 'about' ? 0.7 : 0.6,
    changeFrequency: 'monthly',
  })),
  ...SUPPORT_SLUGS.map((slug): PublicRoute => ({
    path: `/support/${slug}`,
    priority: slug === 'system-status' ? 0.5 : 0.6,
    changeFrequency: slug === 'system-status' ? 'weekly' : 'monthly',
  })),
  ...LEGAL_SLUGS.map((slug): PublicRoute => ({
    path: `/legal/${slug}`,
    priority: 0.4,
    changeFrequency: 'yearly',
  })),
];

const PUBLIC_ROUTE_PATHS = new Set(PUBLIC_ROUTES.map((r) => r.path));

export function isPublicRoute(path: string): boolean {
  return PUBLIC_ROUTE_PATHS.has(path);
}

/**
 * The module route SEGMENTS that must never be indexed -- read straight off
 * the registry rather than re-listed, so a new coin-gated module is fenced the
 * moment it is registered.
 */
export const GATED_MODULE_ROUTES: readonly string[] = MODULE_REGISTRY.filter(
  (m) => m.coinGated,
).map((m) => m.route);

/** Non-module paths that are equally off-limits to a crawler. */
export const PRIVATE_PATHS: readonly string[] = ['/sovereign', '/locked'];

/**
 * Locale-prefixed path for `path` under `locale`.
 *
 * Root single-URL English-first architecture (owner instruction 2026-09-06):
 * `i18n/routing.ts` sets `localePrefix: 'as-needed'`, so the default locale has
 * NO prefix -- English lives at `/legal/terms`, never `/en/legal/terms` (which
 * 308-redirects). Getting this wrong would put 17 phantom `/en/*` URLs into the
 * sitemap, every one of them a redirect.
 */
export function localePath(locale: string, path: string): string {
  const prefix = locale === routing.defaultLocale ? '' : `/${locale}`;
  if (path === '/') return prefix === '' ? '/' : prefix;
  return `${prefix}${path}`;
}

/**
 * Absolute URL. The bare home page is `SITE_URL` with no trailing slash,
 * matching the canonical the locale layout has always emitted.
 */
export function absoluteUrl(locale: string, path: string): string {
  const p = localePath(locale, path);
  return p === '/' ? SITE_URL : `${SITE_URL}${p}`;
}

/**
 * The full hreflang map for one path: all 20 locales plus `x-default` pointing
 * at the unprefixed English URL (Google's documented "no locale matched"
 * fallback).
 */
export function languageAlternates(path: string): Record<string, string> {
  const languages: Record<string, string> = {};
  for (const locale of routing.locales) {
    languages[locale] = absoluteUrl(locale, path);
  }
  languages['x-default'] = absoluteUrl(routing.defaultLocale, path);
  return languages;
}

/**
 * `alternates` for a page's `generateMetadata`.
 *
 * This exists because Next.js metadata is merged SHALLOWLY down the segment
 * tree: a page that does not declare `alternates` inherits its layout's
 * verbatim. app/[locale]/layout.tsx declares the LOCALE-ROOT canonical, so
 * before REV-22 every sub-page shipped
 * `<link rel="canonical" href="https://www.theunitas.global/ko"/>` -- measured
 * in the REV-21 build output -- telling Google that all 240 company / legal /
 * support pages were duplicates of 20 home pages. Every indexable page now
 * calls this with its OWN path.
 */
export function seoAlternates(locale: string, path: string) {
  return {
    canonical: absoluteUrl(locale, path),
    languages: languageAlternates(path),
  };
}

export interface SitemapEntry {
  url: string;
  lastModified: Date;
  changeFrequency: ChangeFrequency;
  priority: number;
  alternates: { languages: Record<string, string> };
}

/**
 * Every indexable URL: `PUBLIC_ROUTES` x `routing.locales`, each carrying the
 * complete hreflang cluster. Emitted route-major so a crawler reads all 20
 * translations of one page consecutively.
 */
export function sitemapEntries(lastModified: Date): SitemapEntry[] {
  const entries: SitemapEntry[] = [];
  for (const route of PUBLIC_ROUTES) {
    const languages = languageAlternates(route.path);
    for (const locale of routing.locales) {
      entries.push({
        url: absoluteUrl(locale, route.path),
        lastModified,
        changeFrequency: route.changeFrequency,
        priority: route.priority,
        alternates: { languages },
      });
    }
  }
  return entries;
}

/**
 * robots.txt `Disallow:` list. Robots matching is a PREFIX match with `*`
 * wildcards, so each protected segment needs two forms: the unprefixed English
 * URL (`/apex`) and the locale-prefixed one (`/[star]/apex`, matching `/ko/apex`
 * through `/tl/apex`). `/sovereign` also covers `/sovereign/brand-kit` and
 * friends by prefix.
 */
export function robotsDisallow(): string[] {
  const out = ['/api/'];
  for (const p of PRIVATE_PATHS) {
    out.push(p, `/*${p}`);
  }
  for (const route of GATED_MODULE_ROUTES) {
    out.push(`/${route}`, `/*/${route}`);
  }
  // Never let the founder bypass token be crawled, logged or indexed from a
  // shared link (lib/sovereignAuth.ts). The middleware strips it with a 303
  // anyway; this keeps it out of crawl logs entirely.
  out.push('/*?sovereign_auth=', '/*&sovereign_auth=');
  return out;
}

/**
 * Search engines that get their OWN rule block. A named block REPLACES the `*`
 * block for that agent -- it does not layer on top of it -- so each one is
 * emitted with the identical allow/disallow payload. Naver (`Yeti`) and Daum
 * (`Daumoa`) are named explicitly per ch.12's Google / Naver / Bing mandate.
 */
export const NAMED_CRAWLERS: readonly string[] = [
  'Googlebot',
  'Googlebot-Image',
  'Bingbot',
  'Yeti',
  'Daumoa',
];

/** Absolute URL of the sitemap, for the robots.txt `Sitemap:` directive. */
export const SITEMAP_URL = `${SITE_URL}/sitemap.xml`;

/**
 * Google Search Console HTML-tag ownership proof (founder directive
 * 2026-09-13), issued against the canonical property `SITE_URL`.
 *
 * It belongs in THIS module rather than beside the layout's JSX because
 * ownership and the sitemap are one fact, not two: verifying the property is
 * the precondition for submitting `/sitemap.xml` at all, and a token that
 * drifts away from the canonical host silently un-verifies the property --
 * after which Search Console stops reporting on the 340 URLs `sitemapEntries`
 * emits, with no error anywhere in the build.
 *
 * Consumed by `app/layout.tsx` as `metadata.verification.google`, which Next
 * renders as `<meta name="google-site-verification" content="..." />` in
 * `<head>`. Because Next's metadata merge is SHALLOW -- a child only replaces
 * the fields it actually declares -- and no route under `app/` declares
 * `verification`, the tag is inherited by every page rather than living on the
 * home page alone. (That same shallow merge is what broke 320 pages' canonical
 * tags in REV-21; here it works in our favour, and
 * __tests__/seo/routes.test.ts pins the wiring so it stays that way.)
 */
export const GOOGLE_SITE_VERIFICATION = 'VJzwePjEl-VFppwMQJXBCJ4tl5tGCJQQx3obko8Lw44';

/**
 * Naver Search Advisor (`사이트 소유확인`) HTML-tag ownership proof
 * (founder directive 2026-09-13), the second of the three consoles ch.12
 * names. Naver is the search engine `NAMED_CRAWLERS` already fences a
 * dedicated `Yeti` robots block for, so ownership here is what turns that
 * block into actual indexing.
 *
 * Unlike Google, Naver has NO first-class field in Next's `Verification` type
 * -- it is exactly `{ google, yahoo, yandex, me, other }` (next/dist/lib/
 * metadata/types/metadata-types.d.ts). A `naver:` key there is a compile
 * error, not a silently-ignored one, so this goes through `verification.other`
 * under its literal meta name, which Next emits verbatim as
 * `<meta name="naver-site-verification" content="..." />`.
 */
export const NAVER_SITE_VERIFICATION = '4ecc1c574f7004b05f19488c8d2f5a783fb3b5b1';
