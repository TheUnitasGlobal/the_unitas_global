import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * REV-26 MISSION 2 -- the service worker's contract, held against the file.
 *
 * `public/sw.js` makes three promises in prose. Prose does not hold, so they
 * are asserted here:
 *
 *  1. IT NEVER CACHES. The project deploys on every revision; an offline cache
 *     would serve stale bundles. Measured at runtime too (Cache Storage is
 *     empty after a real load), but a static guard is what stops someone
 *     adding `caches.open(...)` in a hurry six months from now.
 *  2. IT KEEPS A FETCH HANDLER. Chrome dropped the fetch-handler requirement
 *     for menu installs (mobile 108 / desktop 112), but the algorithm that
 *     fires `beforeinstallprompt` -- this project's one-click install -- still
 *     needs one present. Deleting it would silently kill the install prompt.
 *  3. IT DOES NOT ANSWER IMMUTABLE BUILD OUTPUT. Re-issuing `/_next/static/*`
 *     from the worker cost a measured 5.2ms per asset (139ms across 32) and
 *     took those requests out of the page's scope entirely -- which is how the
 *     F-2 pre-hydration test came to skip on every engine for two revisions.
 *
 * Reading the shipped file rather than importing it is the point: this is the
 * exact text the browser will run.
 */

const SW = readFileSync(fileURLToPath(new URL('../../public/sw.js', import.meta.url)), 'utf8');

/** The file minus comments -- promises are about CODE, not about prose. */
const CODE = SW.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[^\n]*\/\/[^\n]*$/gm, '');

describe('service worker -- it never caches', () => {
  it('writes to no cache, by any of the Cache Storage write APIs', () => {
    for (const forbidden of ['caches.open', '.put(', '.addAll(', 'cache.add(', 'caches.match(']) {
      expect(CODE.includes(forbidden), `sw.js must not call ${forbidden} -- this project has no offline cache`).toBe(false);
    }
  });

  it('purges Cache Storage when a new generation activates', () => {
    expect(CODE).toMatch(/addEventListener\(\s*['"]activate['"]/);
    expect(CODE).toMatch(/caches\.keys\(\)/);
    expect(CODE).toMatch(/caches\.delete\(/);
  });

  it('takes over immediately, so a new generation cannot be shadowed by an old one', () => {
    expect(CODE).toMatch(/skipWaiting\(\)/);
    expect(CODE).toMatch(/clients\.claim\(\)/);
  });

  it('carries a version marker, which is what makes installed clients fetch a new generation', () => {
    expect(CODE).toMatch(/UNITAS_PWA_ICON_VERSION\s*=\s*['"][\w.-]+['"]/);
  });
});

describe('service worker -- it keeps the install signal', () => {
  it('registers a fetch handler (beforeinstallprompt still requires one)', () => {
    expect(CODE).toMatch(/addEventListener\(\s*['"]fetch['"]/);
  });

  it('is not an EMPTY fetch handler -- it still answers real requests', () => {
    // Chrome names empty fetch handlers as the anti-pattern that "hurt web
    // performance", and newer Chromium can skip them outright. This one
    // answers everything except immutable build output.
    expect(CODE).toMatch(/event\.respondWith\(/);
  });
});

describe('service worker -- it does not stand in front of immutable build output', () => {
  it('lets /_next/static fall through to the network', () => {
    expect(CODE).toMatch(/_next\/static\//);
    expect(CODE, 'the bypass must be a real early return, not a comment').toMatch(/isImmutableBuildOutput\([^)]*\)\s*\)\s*return;/);
  });

  it('scopes the bypass to this origin, so a third-party URL is never mis-classified', () => {
    expect(CODE).toMatch(/origin\s*===\s*self\.location\.origin/);
  });

  it('fails closed when the URL cannot be parsed', () => {
    // A malformed request URL must not be treated as immutable.
    expect(CODE).toMatch(/catch\s*\(_\)\s*\{\s*return false;/);
  });
});

/* ------------------------------------------------------------------ */
/* The rule itself, executed                                            */
/* ------------------------------------------------------------------ */

describe('isImmutableBuildOutput, run', () => {
  /**
   * Evaluate the shipped helper in isolation, with a stubbed worker scope.
   * `new Function` here is fed OUR OWN repository file, read from disk in a
   * test -- executing the exact text the browser will run is the point. No
   * caller-supplied or network-supplied string ever reaches it.
   */
  function loadRule(origin = 'https://www.theunitas.global') {
    const source = /function isImmutableBuildOutput[\s\S]*?\n\}/.exec(SW);
    expect(source, 'the helper must still be a named function in sw.js').not.toBeNull();
    const factory = new Function('self', `${source![0]}; return isImmutableBuildOutput;`);
    return factory({ location: { origin } }) as (request: { url: string }) => boolean;
  }

  const rule = loadRule();

  it('bypasses this origin’s content-hashed chunks', () => {
    expect(rule({ url: 'https://www.theunitas.global/_next/static/chunks/2117-a8bf301ef488d9c8.js' })).toBe(true);
    expect(rule({ url: 'https://www.theunitas.global/_next/static/css/abc.css' })).toBe(true);
  });

  it('does NOT bypass navigations, API routes or anything else on this origin', () => {
    for (const url of [
      'https://www.theunitas.global/',
      'https://www.theunitas.global/ko',
      'https://www.theunitas.global/api/sovereign/verify',
      'https://www.theunitas.global/sw.js',
      'https://www.theunitas.global/ownership-manifest.json',
      'https://www.theunitas.global/_next/image?url=%2Ficon.png',
    ]) {
      expect(rule({ url }), url).toBe(false);
    }
  });

  it('does NOT bypass another origin that happens to use the same path', () => {
    expect(rule({ url: 'https://evil.example/_next/static/chunks/x.js' })).toBe(false);
  });

  it('does not throw on a malformed URL', () => {
    expect(() => rule({ url: 'not a url' })).not.toThrow();
    expect(rule({ url: 'not a url' })).toBe(false);
  });
});
