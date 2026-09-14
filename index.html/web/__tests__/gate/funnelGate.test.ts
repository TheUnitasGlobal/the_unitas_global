import { describe, expect, it } from 'vitest';
import {
  GATE_PATH_SEGMENT,
  gatewayPathFor,
  isGateExemptPath,
  isGatePath,
  isIndexerAgent,
  resolveGateVerdict,
} from '../../lib/gate/funnelGate';

// Pure helpers only -- no fixtures shared with other __tests__/** files
// (see CLAUDE.md "Module-level test isolation").

const HUMAN_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36';

function verdict(over: Partial<Parameters<typeof resolveGateVerdict>[0]> = {}) {
  return resolveGateVerdict({
    pathname: '/',
    userAgent: HUMAN_UA,
    hasSovereign: false,
    ...over,
  });
}

describe('isGateExemptPath', () => {
  it('exempts infrastructure the gate must never seal', () => {
    for (const p of [
      '/api/u-ai/stream',
      '/_next/static/chunk.js',
      '/_vercel/insights',
      '/assets/svg/unitas-mark.svg',
      '/icons/icon-512.png',
      '/sitemap.xml',
      '/robots.txt',
      '/manifest.webmanifest',
      '/favicon.ico',
      '/a1b2c3d4.txt', // IndexNow key file
    ]) {
      expect(isGateExemptPath(p), p).toBe(true);
    }
  });

  it('exempts the gateway route itself, prefixed or not', () => {
    expect(isGateExemptPath(`/${GATE_PATH_SEGMENT}`)).toBe(true);
    expect(isGateExemptPath(`/ko/${GATE_PATH_SEGMENT}`)).toBe(true);
    expect(isGatePath(`/pt/${GATE_PATH_SEGMENT}/`)).toBe(true);
  });

  it('does NOT exempt any real page -- that is the whole point', () => {
    for (const p of ['/', '/ko', '/company/about', '/ja/legal/terms', '/u-ai', '/ko/u-pay', '/arche']) {
      expect(isGateExemptPath(p), p).toBe(false);
    }
  });

  it('does not mistake a locale segment for the gateway', () => {
    expect(isGatePath('/gatewayish')).toBe(false);
    expect(isGatePath('/ko/gateway-notes')).toBe(false);
  });
});

describe('isIndexerAgent', () => {
  it('recognises the five console crawlers plus the sub-belt', () => {
    const bots = [
      'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
      'Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)',
      'Mozilla/5.0 (compatible; Yeti/1.1; +http://naver.me/spd)',
      'Mozilla/5.0 (compatible; SeznamBot/4.0; +http://napoveda.seznam.cz/seznambot-intro/)',
      'DuckDuckBot/1.1; (+http://duckduckgo.com/duckduckbot.html)',
      'Mozilla/5.0 (Macintosh) AppleWebKit/600 (KHTML, like Gecko) Version/8.0 Safari/600 Applebot/0.1',
      'facebookexternalhit/1.1',
      'Twitterbot/1.0',
      'LinkedInBot/1.0',
    ];
    for (const ua of bots) expect(isIndexerAgent(ua), ua).toBe(true);
  });

  it('is false for a real browser and for a missing UA', () => {
    expect(isIndexerAgent(HUMAN_UA)).toBe(false);
    expect(isIndexerAgent(null)).toBe(false);
    expect(isIndexerAgent(undefined)).toBe(false);
    expect(isIndexerAgent('')).toBe(false);
  });
});

describe('the environment bypass is gone (REV-24 M2)', () => {
  it('exports no bypass symbol any more', async () => {
    const mod = (await import('../../lib/gate/funnelGate')) as Record<string, unknown>;
    expect(mod.GATE_BYPASS_ENV).toBeUndefined();
    expect(mod.isGateBypassed).toBeUndefined();
  });

  it('ignores an env flag entirely -- no variable can open the funnel', () => {
    // The shape the retired flag used to take, offered as an unknown extra
    // property: the verdict must not change.
    const rogue = { pathname: '/', userAgent: HUMAN_UA, hasSovereign: false, bypass: true, UNITAS_GATE_BYPASS: '1' };
    expect(resolveGateVerdict(rogue as Parameters<typeof resolveGateVerdict>[0])).toBe('seal');
  });
});

describe('resolveGateVerdict', () => {
  it('SEALS an ordinary human on every real page -- the MISSION 1 defect', () => {
    for (const p of ['/', '/ko', '/company/about', '/ja/legal/terms', '/u-ai', '/tr/support/help-center']) {
      expect(verdict({ pathname: p }), p).toBe('seal');
    }
  });

  it('seals a deep link arriving from an external search result', () => {
    // The exact reported defect: a Bing result took the visitor straight in.
    expect(verdict({ pathname: '/ko/u-signature' })).toBe('seal');
  });

  it('passes a verified sovereign founder', () => {
    expect(verdict({ hasSovereign: true })).toBe('pass');
    expect(verdict({ pathname: '/ko/company/about', hasSovereign: true })).toBe('pass');
  });

  it('passes indexers so the SEO corpus keeps resolving (Codex ch.13)', () => {
    expect(verdict({ userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1)' })).toBe('pass');
    expect(verdict({ pathname: '/ko/legal/terms', userAgent: 'bingbot/2.0' })).toBe('pass');
  });

  it('passes exempt infrastructure regardless of identity', () => {
    expect(verdict({ pathname: '/sitemap.xml' })).toBe('pass');
    expect(verdict({ pathname: `/ko/${GATE_PATH_SEGMENT}` })).toBe('pass');
  });

  it('fails CLOSED: no identity, unknown agent -> seal', () => {
    expect(verdict({ userAgent: null })).toBe('seal');
    expect(verdict({ userAgent: '' })).toBe('seal');
  });
});

describe('gatewayPathFor', () => {
  it('builds a locale-prefixed gateway path that isGatePath accepts', () => {
    for (const locale of ['en', 'ko', 'pt', 'zh']) {
      const p = gatewayPathFor(locale);
      expect(p).toBe(`/${locale}/${GATE_PATH_SEGMENT}`);
      expect(isGatePath(p)).toBe(true);
    }
  });
});
