import { describe, expect, it } from 'vitest';
import { routing } from '@/i18n/routing';
import { COMPANY_SLUGS, LEGAL_SLUGS, SUPPORT_SLUGS } from '@/lib/sitePages';
import { MODULE_REGISTRY } from '@/lib/module-registry';
import {
  GATED_MODULE_ROUTES,
  NAMED_CRAWLERS,
  PRIVATE_PATHS,
  PUBLIC_ROUTES,
  SITEMAP_URL,
  SITE_HOST,
  SITE_URL,
  absoluteUrl,
  isPublicRoute,
  languageAlternates,
  localePath,
  robotsDisallow,
  seoAlternates,
  sitemapEntries,
} from '@/lib/seo/routes';
import sitemap from '@/app/sitemap';
import robots from '@/app/robots';

// REV-22 M_SEO -- Codex v23.0 ch.12. REV-21 shipped with /sitemap.xml and
// /robots.txt both returning a live 404 and zero source instances. These tests
// pin the three properties that make the replacement correct rather than
// merely present:
//   1. the URL set matches the routes that actually serve 200 to the public,
//   2. English is unprefixed ('as-needed'), so no phantom /en/* redirect URLs,
//   3. robots.txt fences exactly the non-public routes and nothing more.

const LOCALES = routing.locales;
const FIXED_DATE = new Date('2026-09-13T00:00:00.000Z');

/**
 * Minimal robots.txt path matcher: a rule is a PREFIX match, `*` matches any
 * run of characters, a trailing `$` anchors the end. Enough to prove the
 * disallow list covers what it must and nothing it must not.
 */
function robotsMatches(pattern: string, path: string): boolean {
  const anchored = pattern.endsWith('$');
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const source = body
    .split('*')
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp(`^${source}${anchored ? '$' : ''}`).test(path);
}

function isDisallowed(path: string): boolean {
  return robotsDisallow().some((rule) => robotsMatches(rule, path));
}

describe('robotsMatches (the test helper itself)', () => {
  it('prefix-matches, expands `*`, and honours a trailing `$`', () => {
    expect(robotsMatches('/api/', '/api/u-ai/insight')).toBe(true);
    expect(robotsMatches('/api/', '/company/about')).toBe(false);
    expect(robotsMatches('/*/apex', '/ko/apex')).toBe(true);
    expect(robotsMatches('/*/apex', '/apex')).toBe(false);
    expect(robotsMatches('/locked$', '/locked')).toBe(true);
    expect(robotsMatches('/locked$', '/locked/deep')).toBe(false);
  });
});

describe('public route inventory', () => {
  it('is exactly home + u-ai + the 3 B2B protocols + every company/legal/support slug', () => {
    const expected = [
      '/',
      '/u-ai',
      '/u-signature',
      '/u-key',
      '/u-pay',
      ...COMPANY_SLUGS.map((s) => `/company/${s}`),
      ...SUPPORT_SLUGS.map((s) => `/support/${s}`),
      ...LEGAL_SLUGS.map((s) => `/legal/${s}`),
    ];
    expect(PUBLIC_ROUTES.map((r) => r.path)).toEqual(expected);
    expect(PUBLIC_ROUTES).toHaveLength(17);
  });

  it('has no duplicate paths and every path is a leading-slash, trailing-slash-free path', () => {
    const paths = PUBLIC_ROUTES.map((r) => r.path);
    expect(new Set(paths).size).toBe(paths.length);
    for (const p of paths) {
      expect(p.startsWith('/')).toBe(true);
      if (p !== '/') expect(p.endsWith('/')).toBe(false);
    }
  });

  it('gives every route a sitemap-legal priority, with the home page highest', () => {
    for (const r of PUBLIC_ROUTES) {
      expect(r.priority).toBeGreaterThan(0);
      expect(r.priority).toBeLessThanOrEqual(1);
    }
    const home = PUBLIC_ROUTES.find((r) => r.path === '/');
    expect(home?.priority).toBe(1);
    expect(Math.max(...PUBLIC_ROUTES.map((r) => r.priority))).toBe(1);
  });

  it('excludes every coin-gated module, /locked and /sovereign', () => {
    const paths = new Set(PUBLIC_ROUTES.map((r) => r.path));
    for (const route of GATED_MODULE_ROUTES) expect(paths.has(`/${route}`)).toBe(false);
    for (const p of PRIVATE_PATHS) expect(paths.has(p)).toBe(false);
    expect(isPublicRoute('/apex')).toBe(false);
    expect(isPublicRoute('/legal/terms')).toBe(true);
  });
});

describe('gated module inventory', () => {
  it('is read off MODULE_REGISTRY -- the 11 ecosystems + 5 B2C, never the 3 B2B protocols', () => {
    expect([...GATED_MODULE_ROUTES].sort()).toEqual(
      MODULE_REGISTRY.filter((m) => m.coinGated)
        .map((m) => m.route)
        .sort(),
    );
    expect(GATED_MODULE_ROUTES).toHaveLength(16);
    for (const b2b of ['u-key', 'u-pay', 'u-signature']) {
      expect(GATED_MODULE_ROUTES).not.toContain(b2b);
    }
  });
});

describe('locale path resolution (localePrefix: as-needed)', () => {
  it('leaves the default locale unprefixed and prefixes every other locale', () => {
    expect(routing.defaultLocale).toBe('en');
    expect(localePath('en', '/')).toBe('/');
    expect(localePath('en', '/legal/terms')).toBe('/legal/terms');
    expect(localePath('ko', '/')).toBe('/ko');
    expect(localePath('ko', '/legal/terms')).toBe('/ko/legal/terms');
  });

  it('never produces an /en prefix for any public route', () => {
    for (const route of PUBLIC_ROUTES) {
      expect(localePath('en', route.path).startsWith('/en')).toBe(false);
    }
  });

  it('renders the English home page as the bare origin, with no trailing slash', () => {
    expect(absoluteUrl('en', '/')).toBe(SITE_URL);
    expect(absoluteUrl('ko', '/')).toBe(`${SITE_URL}/ko`);
    expect(absoluteUrl('ja', '/company/about')).toBe(`${SITE_URL}/ja/company/about`);
  });
});

describe('hreflang clusters', () => {
  it('names all 20 locales plus x-default, with x-default on the English URL', () => {
    const languages = languageAlternates('/legal/privacy');
    expect(Object.keys(languages)).toHaveLength(LOCALES.length + 1);
    for (const locale of LOCALES) {
      expect(languages[locale]).toBe(absoluteUrl(locale, '/legal/privacy'));
    }
    expect(languages['x-default']).toBe(`${SITE_URL}/legal/privacy`);
  });

  it('self-references: a page\'s canonical is its own entry in its own cluster', () => {
    for (const route of PUBLIC_ROUTES) {
      for (const locale of LOCALES) {
        const { canonical, languages } = seoAlternates(locale, route.path);
        expect(canonical).toBe(absoluteUrl(locale, route.path));
        expect(languages[locale]).toBe(canonical);
      }
    }
  });

  it('points every alternate at a path that is genuinely public (never a gated or 404 route)', () => {
    for (const route of PUBLIC_ROUTES) {
      for (const url of Object.values(languageAlternates(route.path))) {
        expect(url.startsWith(SITE_URL)).toBe(true);
        expect(isDisallowed(url.slice(SITE_URL.length) || '/')).toBe(false);
      }
    }
  });
});

describe('sitemap', () => {
  const entries = sitemapEntries(FIXED_DATE);

  it('covers every public route in every locale, once each', () => {
    expect(entries).toHaveLength(PUBLIC_ROUTES.length * LOCALES.length);
    expect(entries).toHaveLength(340);
    expect(new Set(entries.map((e) => e.url)).size).toBe(entries.length);
  });

  it('emits absolute URLs on the canonical origin only', () => {
    for (const e of entries) {
      expect(e.url.startsWith(`${SITE_URL}/`) || e.url === SITE_URL).toBe(true);
      expect(e.url).not.toContain('//www.theunitas.global//');
    }
  });

  it('lists no /en/* URL -- those 308-redirect to the unprefixed path', () => {
    for (const e of entries) {
      expect(e.url === `${SITE_URL}/en` || e.url.startsWith(`${SITE_URL}/en/`)).toBe(false);
    }
  });

  it('lists no route that robots.txt disallows', () => {
    for (const e of entries) {
      expect(isDisallowed(e.url.slice(SITE_URL.length) || '/')).toBe(false);
    }
  });

  it('carries the complete hreflang cluster and the shared lastModified on every entry', () => {
    for (const e of entries) {
      expect(Object.keys(e.alternates.languages)).toHaveLength(LOCALES.length + 1);
      expect(e.lastModified).toBe(FIXED_DATE);
      expect(e.alternates.languages[routing.defaultLocale]).toBe(
        e.alternates.languages['x-default'],
      );
    }
  });

  it('is what app/sitemap.ts actually returns', () => {
    const generated = sitemap();
    expect(generated).toHaveLength(entries.length);
    expect(generated.map((e) => e.url)).toEqual(entries.map((e) => e.url));
    // Next only emits the xmlns:xhtml namespace when an entry declares
    // alternates, so a single bare entry would silently drop every hreflang.
    for (const e of generated) {
      expect(Object.keys(e.alternates?.languages ?? {}).length).toBe(LOCALES.length + 1);
    }
  });
});

describe('robots.txt', () => {
  const doc = robots();
  const rules = Array.isArray(doc.rules) ? doc.rules : [doc.rules];

  it('publishes the sitemap and the canonical host', () => {
    expect(doc.sitemap).toBe(SITEMAP_URL);
    expect(SITEMAP_URL).toBe(`${SITE_URL}/sitemap.xml`);
    expect(doc.host).toBe(SITE_HOST);
  });

  it('emits one block for * and one for each named engine, all with identical payloads', () => {
    expect(rules).toHaveLength(1 + NAMED_CRAWLERS.length);
    expect(rules.map((r) => r.userAgent)).toEqual(['*', ...NAMED_CRAWLERS]);
    // A named block REPLACES the * block for that agent, so every block has to
    // restate the full payload or those engines get an open crawl.
    const [wildcard, ...named] = rules;
    for (const rule of named) {
      expect(rule.allow).toEqual(wildcard.allow);
      expect(rule.disallow).toEqual(wildcard.disallow);
    }
    expect(rules.map((r) => r.userAgent)).toContain('Yeti'); // Naver
    expect(rules.map((r) => r.userAgent)).toContain('Daumoa'); // Daum
  });

  it('disallows the API, both URL forms of every gated module, /locked, /sovereign and the bypass token', () => {
    const disallow = robotsDisallow();
    expect(disallow).toContain('/api/');
    for (const route of GATED_MODULE_ROUTES) {
      expect(disallow).toContain(`/${route}`);
      expect(disallow).toContain(`/*/${route}`);
    }
    for (const p of PRIVATE_PATHS) {
      expect(disallow).toContain(p);
      expect(disallow).toContain(`/*${p}`);
    }
    expect(disallow).toContain('/*?sovereign_auth=');
    for (const rule of disallow) expect(rule.startsWith('/')).toBe(true);
  });

  it('actually blocks every non-public route in every locale form', () => {
    for (const locale of LOCALES) {
      for (const route of GATED_MODULE_ROUTES) {
        expect(isDisallowed(localePath(locale, `/${route}`))).toBe(true);
      }
      expect(isDisallowed(localePath(locale, '/locked'))).toBe(true);
      expect(isDisallowed(localePath(locale, '/sovereign'))).toBe(true);
      expect(isDisallowed(localePath(locale, '/sovereign/brand-kit'))).toBe(true);
    }
    expect(isDisallowed('/api/u-ai/insight')).toBe(true);
  });

  it('leaves every public route crawlable in every locale form', () => {
    for (const locale of LOCALES) {
      for (const route of PUBLIC_ROUTES) {
        expect(isDisallowed(localePath(locale, route.path))).toBe(false);
      }
    }
  });
});
