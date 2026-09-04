import { describe, expect, it } from 'vitest';
import {
  AXIS_NEWS_MAX_PAGE,
  decodeEntities,
  foldGdelt,
  foldGoogleNews,
  gdeltDateToIso,
  gdeltPlan,
  gdeltQuery,
  gdeltUrl,
  gdeltWindow,
  googleNewsUrl,
  isGdeltRateLimited,
  mergeAxisWires,
  parseRss,
} from '@/lib/live/axisNews';
import { HOT_NEWS_CATEGORIES, classifyNews, isHotNewsCategory, type HotNewsItem } from '@/lib/live/hotNews';

describe('hotNews categories', () => {
  it('exposes the 21 fused axes exactly once each', () => {
    expect(HOT_NEWS_CATEGORIES).toHaveLength(21);
    expect(new Set(HOT_NEWS_CATEGORIES).size).toBe(21);
    for (const axis of ['language', 'culture', 'society', 'structure', 'art', 'expression', 'pragma', 'economy', 'engineering', 'technology', 'law', 'institution', 'education', 'welfare', 'security', 'strategy']) {
      expect(isHotNewsCategory(axis)).toBe(true);
    }
    expect(isHotNewsCategory('health')).toBe(false);
    expect(isHotNewsCategory('conflict')).toBe(false);
  });

  it('classifies the absorbed categories into their new homes', () => {
    expect(classifyNews('Hospital reports measles outbreak, vaccine drive begins')).toBe('welfare');
    expect(classifyNews('Missile strike breaks ceasefire as troops advance')).toBe('security');
    expect(classifyNews('Supreme court verdict overturns lower ruling')).toBe('law');
    expect(classifyNews('대학 입시 개편안 발표')).toBe('education');
    expect(classifyNews('Nothing in particular happened')).toBe('world');
  });
});

describe('GDELT query + window', () => {
  it('parenthesises OR groups and appends sourcelang', () => {
    expect(gdeltQuery('economy', 'korean')).toBe('(economy OR inflation OR "central bank" OR "stock market" OR tariff OR GDP) sourcelang:korean');
    expect(gdeltQuery('economy', null)).toBe('(economy OR inflation OR "central bank" OR "stock market" OR tariff OR GDP)');
  });

  it('pages back through 24h windows', () => {
    const now = new Date('2026-09-04T12:00:00Z');
    expect(gdeltWindow(0, now)).toEqual({ start: '20260903120000', end: '20260904120000' });
    expect(gdeltWindow(2, now)).toEqual({ start: '20260901120000', end: '20260902120000' });
    const url = new URL(gdeltUrl('law', 'thai', 1, now));
    expect(url.searchParams.get('mode')).toBe('ArtList');
    expect(url.searchParams.get('startdatetime')).toBe('20260902120000');
    expect(url.searchParams.get('query')).toContain('sourcelang:thai');
    expect(AXIS_NEWS_MAX_PAGE).toBeGreaterThan(5);
  });

  it('alternates own-language and worldwide passes per page, one call each', () => {
    expect(gdeltPlan('ko', 0)).toEqual({ sourceLang: 'korean', window: 0 });
    expect(gdeltPlan('ko', 1)).toEqual({ sourceLang: null, window: 0 });
    expect(gdeltPlan('ko', 2)).toEqual({ sourceLang: 'korean', window: 1 });
    expect(gdeltPlan('en', 3)).toEqual({ sourceLang: null, window: 3 });
  });

  it('recognises the plain-text rate-limit answer', () => {
    expect(isGdeltRateLimited(429, '')).toBe(true);
    expect(isGdeltRateLimited(200, 'Please limit requests to one every 5 seconds')).toBe(true);
    expect(isGdeltRateLimited(200, '{"articles":[]}')).toBe(false);
  });

  it('converts seendate stamps to ISO', () => {
    expect(gdeltDateToIso('20260904T101500Z')).toBe('2026-09-04T10:15:00Z');
    expect(gdeltDateToIso('garbage')).toBeUndefined();
  });

  it('folds articles, skipping bad urls and duplicate titles', () => {
    const items = foldGdelt(
      [
        { title: 'Court rules on tariff case', url: 'https://a.example/1', seendate: '20260904T101500Z', domain: 'a.example', language: 'English' },
        { title: 'Court rules on tariff case', url: 'https://b.example/2' },
        { title: 'No url', url: 'ftp://nope' },
      ],
      'law',
    );
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ source: 'live', category: 'law', domain: 'a.example', lang: 'English', publishedAt: '2026-09-04T10:15:00Z' });
  });
});

describe('Google News RSS', () => {
  it('builds topic boards for mapped axes and search feeds otherwise', () => {
    const board = new URL(googleNewsUrl('economy', 'ko'));
    expect(board.pathname).toContain('/topic/BUSINESS');
    expect(board.searchParams.get('ceid')).toBe('KR:ko');
    const search = new URL(googleNewsUrl('law', 'ja'));
    expect(search.pathname).toBe('/rss/search');
    expect(search.searchParams.get('q')).toContain('court OR lawsuit');
    expect(search.searchParams.get('hl')).toBe('ja');
    // later pages rotate through single terms so every page is a new slice
    expect(new URL(googleNewsUrl('economy', 'ko', 1)).searchParams.get('q')).toBe('economy');
    expect(new URL(googleNewsUrl('economy', 'ko', 2)).searchParams.get('q')).toBe('inflation');
    expect(new URL(googleNewsUrl('economy', 'ko', 7)).searchParams.get('q')).toBe('economy');
  });

  it('parses items, strips outlet suffixes and decodes entities', () => {
    const xml = `<?xml version="1.0"?><rss><channel>
      <item><title>Markets rally &amp; bonds slide - Reuters</title><link>https://news.google.com/x</link>
        <pubDate>Thu, 04 Sep 2026 10:00:00 GMT</pubDate><description>&lt;a href="x"&gt;Markets rally &amp; bonds slide&lt;/a&gt;</description>
        <source url="https://www.reuters.com">Reuters</source></item>
      <item><title><![CDATA[Second story]]></title><link>https://news.google.com/y</link></item>
      <item><title>No link</title></item>
    </channel></rss>`;
    const parsed = parseRss(xml);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].title).toBe('Markets rally & bonds slide - Reuters');
    expect(parsed[0].sourceName).toBe('Reuters');
    const folded = foldGoogleNews(parsed, 'economy', 'en');
    expect(folded[0].title).toBe('Markets rally & bonds slide');
    expect(folded[0].domain).toBe('reuters.com');
    expect(folded[0].summary).toBe('');
    expect(folded[0].publishedAt).toBe('2026-09-04T10:00:00.000Z');
    expect(folded[1].title).toBe('Second story');
    expect(decodeEntities('&#x27;a&#39;&quot;')).toBe(`'a'"`);
  });
});

describe('mergeAxisWires', () => {
  const mk = (title: string): HotNewsItem => ({ id: title, title, summary: '', url: 'https://x/' + title, category: 'world', source: 'live' });
  it('round-robins local / board / global and de-dupes', () => {
    const merged = mergeAxisWires([mk('L1'), mk('L2')], [mk('G1'), mk('L1')], [mk('B1')], 10);
    expect(merged.map((i) => i.title)).toEqual(['L1', 'B1', 'G1', 'L2']);
  });
  it('honours the cap', () => {
    const merged = mergeAxisWires([mk('a'), mk('b'), mk('c')], [mk('d'), mk('e')], [], 3);
    expect(merged).toHaveLength(3);
  });
});
