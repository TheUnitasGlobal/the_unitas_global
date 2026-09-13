import { describe, expect, it } from 'vitest';
import { bingEligible, countryEntityWires, entityWindow, globalEntityWires, localeForCountry, wordCount } from '@/lib/live/entityNews';

// REV-21 SPEC.md §12.4 / §12.5 #13 -- the entity news wires: Google gets the
// quoted exact title; Bing only an unquoted title of two words or more (it
// ignores quotes -- probe 2026-09-12); worldwide leg first, country second.

const now = new Date('2026-09-12T12:00:00Z');

describe('entity news wires', () => {
  it('quotes the English title for Google and gives Bing only multi-word or CJK titles', () => {
    expect(bingEligible('Air')).toBe(false);
    expect(bingEligible('Atmosphere of Earth')).toBe(true);
    expect(bingEligible('공기')).toBe(true);
    expect(wordCount('  Atmosphere of Earth ')).toBe(3);
    const one = globalEntityWires('Air', 0, now);
    expect(one.google).toContain('q=%22Air%22');
    expect(one.google).toContain('hl=en-US&gl=US&ceid=US%3Aen');
    expect(one.bing).toBeNull();
    const many = globalEntityWires('Atmosphere of Earth', 0, now);
    expect(many.bing).toContain('q=Atmosphere+of+Earth');
    expect(many.bing).toContain('cc=US');
    expect(globalEntityWires(undefined, 0, now)).toEqual({ google: null, bing: null });
  });

  it('walks the archive with after/before windows on later pages, Bing on page 0 only', () => {
    expect(entityWindow(0, now)).toBeNull();
    expect(entityWindow(1, now)).toEqual({ after: '2026-09-02', before: '2026-09-09' });
    expect(entityWindow(2, now)).toEqual({ after: '2026-08-26', before: '2026-09-02' });
    const p1 = globalEntityWires('Atmosphere of Earth', 1, now);
    expect(p1.google).toContain('after%3A2026-09-02+before%3A2026-09-09');
    expect(p1.bing).toBeNull();
  });

  it('routes the country leg to the selected country edition and market, skipping a worldwide repeat', () => {
    expect(localeForCountry('KR', 'en')).toBe('ko');
    expect(localeForCountry('XX', 'en')).toBe('en');
    const kr = countryEntityWires('공기', 'Air', 'en', 'KR', 0, now);
    expect(kr.google).toContain('q=%22%EA%B3%B5%EA%B8%B0%22');
    expect(kr.google).toContain('hl=ko&gl=KR&ceid=KR%3Ako');
    expect(kr.bing).toContain('cc=KR&setlang=ko');
    const us = countryEntityWires('공기', 'Air', 'ko', 'US', 0, now);
    expect(us).toEqual({ google: null, bing: null });
    const fr = countryEntityWires('Air', 'Air', 'fr', 'FR', 0, now);
    expect(fr.google).toContain('hl=fr&gl=FR');
    expect(fr.bing).toBeNull(); // one word
  });
});
