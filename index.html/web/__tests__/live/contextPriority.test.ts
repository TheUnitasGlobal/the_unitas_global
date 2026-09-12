import { describe, expect, it } from 'vitest';
import { routing } from '@/i18n/routing';
import { CONTEXT_SCOPES, contextOrder, orderFeaturedFeeds, orderNewsWires, resolveCountry } from '@/lib/live/contextPriority';
import { buildSlotContext, localeCountry, slotCacheKey } from '@/lib/live/slotContext';
import { mergeAxisWires } from '@/lib/live/axisNews';
import { mergeNewsFeeds, type HotNewsItem } from '@/lib/live/hotNews';

// REV-21 SPEC.md §2.1 -- output priority 1 = global (worldwide), 2 = the
// visitor's selected country, for every locale including en.

const mk = (title: string): HotNewsItem => ({ id: title, title, summary: '', url: `https://x/${title}`, category: 'world', source: 'live' });

describe('context priority', () => {
  it('is global first, country second, for all 20 locales', () => {
    expect(CONTEXT_SCOPES).toEqual(['global', 'country']);
    for (const locale of routing.locales) expect(contextOrder(locale)).toEqual(['global', 'country']);
  });

  it('orders the four news legs worldwide → bingGlobal → own → bing', () => {
    const wires = orderNewsWires({ worldwide: [mk('W')], bingGlobal: [mk('BG')], own: [mk('O')], bing: [mk('B')] });
    expect(mergeAxisWires(wires, 10).map((i) => i.title)).toEqual(['W', 'BG', 'O', 'B']);
  });

  it('the first merged item is global whenever the global wire has anything', () => {
    const merged = mergeAxisWires(orderNewsWires({ worldwide: [mk('G1'), mk('G2')], bingGlobal: [], own: [mk('L1'), mk('L2'), mk('L3')], bing: [mk('B1')] }), 10);
    expect(merged[0].title).toBe('G1');
    expect(merged.map((i) => i.title)).toEqual(['G1', 'L1', 'B1', 'G2', 'L2', 'L3']);
  });

  it('featured feeds interleave global before local', () => {
    const itn = (title: string): HotNewsItem => ({ ...mk(title), source: 'itn' });
    const [a, b] = orderFeaturedFeeds({ global: [itn('G')], local: [itn('L')] });
    expect(mergeNewsFeeds(a, b).map((i) => i.title)).toEqual(['G', 'L']);
  });

  it('resolves the selected country by descending intent and normalises it', () => {
    expect(resolveCountry({ profileCountry: 'kr', cachedPlaceCountry: 'JP', localeCountry: 'US' })).toBe('KR');
    expect(resolveCountry({ profileCountry: null, cachedPlaceCountry: 'jp', localeCountry: 'US' })).toBe('JP');
    expect(resolveCountry({ profileCountry: '', cachedPlaceCountry: undefined, localeCountry: 'ee' })).toBe('EE');
    expect(resolveCountry({ profileCountry: 'Korea', cachedPlaceCountry: '1', localeCountry: null })).toBe('US');
  });

  it('every locale implies a country and the slot cache key carries locale + country', () => {
    for (const locale of routing.locales) expect(localeCountry(locale)).toMatch(/^[A-Z]{2}$/);
    expect(localeCountry('ko')).toBe('KR');
    expect(buildSlotContext('ko', null, null)).toEqual({ locale: 'ko', country: 'KR' });
    expect(buildSlotContext('ko', null, 'JP').country).toBe('JP');
    expect(slotCacheKey({ locale: 'ko', country: 'KR' }, 'air')).toBe('ko:KR:air');
    expect(slotCacheKey({ locale: 'en', country: 'KR' }, 'air')).not.toBe(slotCacheKey({ locale: 'ko', country: 'KR' }, 'air'));
  });
});
