import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DEEPER_MAX_THEMES_COMPACT,
  DEEPER_THEMES,
  deeperPageKey,
  deeperTheme,
  isDeeperThemeKey,
  themesFor,
  type DeeperThemeKey,
} from '@/lib/uai/deeperThemes';
import { DEEPER_ADAPTERS } from '@/lib/uai/deeperAdapters';
import { entityAnchor, placeAnchor, textAnchor } from '@/lib/uai/deeperAnchor';
import { sourceById } from '@/lib/uai/sourceRegistry';
import { DISCOVERY_ROTATION } from '@/lib/live/discoverySlots';
import { AWARD_KEYS } from '@/lib/live/awardsThemes';
import { GLOBAL_RANKING_THEMES } from '@/lib/globalRankings';
import { HOT_NEWS_CATEGORIES } from '@/lib/live/hotNews';

// REV-21 SPEC.md §3.3 / §12.5 -- the fourteen Explore Deeper lenses: unique
// keys that collide with no other registry, real sources, an anchor need,
// an adapter each, and the host ordering rules.

const air = entityAnchor({ localeTitle: '공기', enTitle: 'Air', qid: 'Q7391292', disambiguation: false, lang: 'ko' }, 'ko');
const seoul = placeAnchor({ name: 'Seoul', countryCode: 'KR', lat: 37.5665, lon: 126.978, qid: 'Q8684' }, 'ko');

describe('deeper theme registry', () => {
  // REV-23 M6 added `bigTechPulse`, the omni-tech absorption lens.
  it('ships exactly 15 themes with unique keys, real sources and a positive TTL', () => {
    expect(DEEPER_THEMES.length).toBe(15);
    const keys = DEEPER_THEMES.map((t) => t.key);
    expect(new Set(keys).size).toBe(15);
    for (const theme of DEEPER_THEMES) {
      expect(theme.sources.length, theme.key).toBeGreaterThan(0);
      for (const id of theme.sources) expect(sourceById(id), `${theme.key}:${id}`).toBeTruthy();
      expect(theme.ttlMs, theme.key).toBeGreaterThan(0);
      expect(['entity', 'place', 'country']).toContain(theme.needs);
      expect(theme.constitution.length, theme.key).toBeGreaterThan(0);
      expect(theme.color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(DEEPER_ADAPTERS[theme.key].key).toBe(theme.key);
    }
    expect(isDeeperThemeKey('omniPress')).toBe(true);
    expect(isDeeperThemeKey('nation')).toBe(false);
  });

  it('collides with no slot, award, ranking theme or news axis key', () => {
    const others = new Set<string>([...DISCOVERY_ROTATION, ...AWARD_KEYS, ...GLOBAL_RANKING_THEMES.map((t) => t.key), ...HOT_NEWS_CATEGORIES]);
    for (const theme of DEEPER_THEMES) expect(others.has(theme.key), theme.key).toBe(false);
  });

  it('every theme carries title, hook and six field labels in the en and ko message trees', () => {
    for (const locale of ['en', 'ko']) {
      const messages = JSON.parse(readFileSync(join(__dirname, '../../messages', `${locale}.json`), 'utf8')) as { Rev21: { deeper: { themes: Record<string, Record<string, string>> } } };
      for (const theme of DEEPER_THEMES) {
        const block = messages.Rev21.deeper.themes[theme.key];
        expect(block, `${locale}:${theme.key}`).toBeTruthy();
        for (const f of ['title', 'hook', 'f1', 'f2', 'f3', 'f4', 'f5', 'f6']) expect(block[f]?.trim().length, `${locale}:${theme.key}.${f}`).toBeGreaterThan(0);
      }
    }
  });
});

describe('themesFor', () => {
  it('leads with the place themes on the weather host and with the market signals on entity hosts', () => {
    const weather = themesFor('weather', seoul).map((t) => t.key);
    expect(weather.slice(0, 2)).toEqual(['timeFlux', 'terraPulse']);
    expect(weather).toContain('dataTwin'); // the city has a QID, so entity lenses stay on
    const feed = themesFor('feed', air).map((t) => t.key);
    // M6: the omni-tech lens leads the entity order.
    expect(feed.slice(0, 3)).toEqual(['bigTechPulse', 'ventureSignal', 'omniPress']);
    expect(feed).not.toContain('timeFlux'); // no coordinate -> no place lens
    expect(feed).not.toContain('terraPulse');
    expect(feed.length).toBe(13);
  });

  it('offers nothing for a text anchor, a missing anchor or a disambiguated subject', () => {
    expect(themesFor('feed', textAnchor('UNITAS', 'en'))).toEqual([]);
    expect(themesFor('feed', null)).toEqual([]);
    expect(themesFor('feed', { ...air, disambiguation: true })).toEqual([]);
  });

  it('lifts the leading axis themes when the surface report leans that way', () => {
    const report = { constitution: [{ axis: 'economy' as const, score: 88, band: 'high' as const }, { axis: 'logic' as const, score: 40, band: 'mid' as const }] };
    const lifted = themesFor('keywordTier', air, report).map((t) => t.key);
    // M6: bigTechPulse also declares the economy axis, and it leads the
    // entity order, so an economy-leaning report floats all three.
    expect(lifted.slice(0, 3)).toEqual(['bigTechPulse', 'ventureSignal', 'marketMoat']);
    // a weak report leaves the host order untouched
    const weak = { constitution: [{ axis: 'art' as const, score: 30, band: 'low' as const }] };
    expect(themesFor('keywordTier', air, weak).map((t) => t.key)).toEqual(themesFor('keywordTier', air).map((t) => t.key));
    expect(DEEPER_MAX_THEMES_COMPACT).toBeLessThan(lifted.length);
  });

  it('builds a stable page key regardless of cursor key order', () => {
    const a = deeperPageKey('dataTwin', 'q:Q1', { locale: 'ko', country: 'KR' }, { chunk: 1, stage: 'x' });
    const b = deeperPageKey('dataTwin', 'q:Q1', { locale: 'ko', country: 'KR' }, { stage: 'x', chunk: 1 });
    expect(a).toBe(b);
    expect(deeperPageKey('dataTwin', 'q:Q1', { locale: 'ko', country: 'KR' }, null)).not.toBe(a);
    expect(deeperTheme('terraPulse').needs).toBe('place');
    const key: DeeperThemeKey = 'omniPress';
    expect(deeperTheme(key).sources).toEqual(['googleNews', 'bingNews']);
  });
});
