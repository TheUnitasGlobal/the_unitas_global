import { describe, expect, it } from 'vitest';
import {
  HUB_ROTATE_MS,
  HUB_THEMES,
  HUB_THEME_KEYS,
  discoveryLinks,
  hubThemeTerm,
  isHubThemeKey,
  rotateIndex,
} from '../../lib/live/hubThemes';
import { HUB_THEME_AXIS, hubWireUrls } from '../../lib/live/hubNews';

// REV-19 SPEC.md §8 -- the live hub's pure model: nine themes, deterministic
// rotation, keyless wire URLs and discovery links.

describe('hub themes', () => {
  it('ships exactly the nine owner-named themes, each with an English term and a Korean term', () => {
    expect(HUB_THEME_KEYS).toEqual(['game', 'sports', 'movie', 'bestseller', 'shopping', 'stock', 'webtoon', 'fashion', 'food']);
    for (const theme of HUB_THEMES) {
      expect(theme.terms.en.length).toBeGreaterThan(0);
      expect(theme.terms.ko.length).toBeGreaterThan(0);
      expect(theme.color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(HUB_THEME_AXIS[theme.key]).toBeTruthy();
    }
    expect(isHubThemeKey('game')).toBe(true);
    expect(isHubThemeKey('weather')).toBe(false);
  });

  it('falls back to English for locales without an own-language term', () => {
    expect(hubThemeTerm('game', 'ko')).toBe('게임');
    expect(hubThemeTerm('game', 'km')).toBe('video game');
  });

  it('rotates deterministically on the clock', () => {
    expect(rotateIndex(0, 9)).toBe(0);
    expect(rotateIndex(HUB_ROTATE_MS - 1, 9)).toBe(0);
    expect(rotateIndex(HUB_ROTATE_MS, 9)).toBe(1);
    expect(rotateIndex(HUB_ROTATE_MS * 9, 9)).toBe(0);
    expect(rotateIndex(123456, 0)).toBe(0);
  });

  it('builds four keyless RSS legs (own-language + worldwide) and drops the worldwide legs for en', () => {
    const ko = hubWireUrls('stock', 'ko');
    expect(ko.google).toContain('news.google.com/rss/search');
    expect(decodeURIComponent(ko.google)).toContain('q=주식');
    expect(ko.googleGlobal).toContain('q=stock+market');
    expect(ko.bing).toContain('bing.com/news/search');
    expect(ko.bingGlobal).toContain('setlang=en-US');
    const en = hubWireUrls('stock', 'en');
    expect(en.googleGlobal).toBeNull();
    expect(en.bingGlobal).toBeNull();
  });

  it('produces locale-aware outbound discovery links and nothing for a blank subject', () => {
    const links = discoveryLinks('Seoul', 'ko');
    expect(links.map((l) => l.kind)).toEqual(['wikipedia', 'news', 'youtube', 'search']);
    expect(links[0].href).toContain('https://ko.wikipedia.org/');
    expect(links[2].href).toContain('search_query=Seoul');
    expect(discoveryLinks('   ', 'en')).toEqual([]);
  });
});
