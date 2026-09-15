import { describe, expect, it } from 'vitest';
import {
  AXIS_NEWS_MAX_PAGE,
  axisTerm,
  axisWindow,
  bingNewsUrl,
  decodeEntities,
  foldGoogleNews,
  googleNewsGlobalUrl,
  googleNewsUrl,
  googleSearchQuery,
  mergeAxisWires,
  parseRss,
} from '@/lib/live/axisNews';
import { HOT_NEWS_CATEGORIES, classifyNews, isHotNewsCategory, type HotNewsItem } from '@/lib/live/hotNews';

describe('hotNews categories', () => {
  // REV-23 M3.2: 21 -> 20 (the catch-all 'world' axis deleted).
  // REV-29 M2.2: 20 -> 22 -- the two fused pairs are split so every title
  // box carries exactly one theme: welfare | health, security | conflict.
  it('exposes the 22 axes exactly once each, and no catch-all', () => {
    expect(HOT_NEWS_CATEGORIES).toHaveLength(22);
    expect(new Set(HOT_NEWS_CATEGORIES).size).toBe(22);
    expect(isHotNewsCategory('world')).toBe(false);
    for (const axis of ['language', 'culture', 'society', 'structure', 'art', 'expression', 'pragma', 'economy', 'engineering', 'technology', 'law', 'institution', 'education', 'welfare', 'security', 'strategy']) {
      expect(isHotNewsCategory(axis)).toBe(true);
    }
    expect(isHotNewsCategory('health')).toBe(true);
    expect(isHotNewsCategory('conflict')).toBe(true);
    // The split halves sit right beside their former hosts in rail order.
    expect(HOT_NEWS_CATEGORIES.indexOf('health')).toBe(HOT_NEWS_CATEGORIES.indexOf('welfare') + 1);
    expect(HOT_NEWS_CATEGORIES.indexOf('conflict')).toBe(HOT_NEWS_CATEGORIES.indexOf('security') + 1);
  });

  it('classifies the split categories into their own homes', () => {
    expect(classifyNews('Hospital reports measles outbreak, vaccine drive begins')).toBe('health');
    expect(classifyNews('Pension reform passes as welfare budget grows')).toBe('welfare');
    expect(classifyNews('Missile strike breaks ceasefire as troops advance')).toBe('conflict');
    expect(classifyNews('Sanctions target espionage ring, defense ministry says')).toBe('security');
    expect(classifyNews('백신 접종 시작, 병원 감염 확산 우려')).toBe('health');
    expect(classifyNews('국민연금 개편안 복지 예산 확대')).toBe('welfare');
    expect(classifyNews('미사일 공습으로 휴전 깨져, 반군 전선 확대')).toBe('conflict');
    expect(classifyNews('국방부, 사이버 공격 대응 안보 강화')).toBe('security');
    expect(classifyNews('Supreme court verdict overturns lower ruling')).toBe('law');
    expect(classifyNews('대학 입시 개편안 발표')).toBe('education');
    // M3.2: the unmatched fallback is the broadest REAL axis now, so no
    // story is stranded in a box that no longer exists.
    expect(classifyNews('Nothing in particular happened')).toBe('society');
  });
});

describe('axis terms + archive windows', () => {
  it('rotates one plain term per page, never an OR-group', () => {
    expect(axisTerm('economy', 0)).toBe('economy');
    expect(axisTerm('economy', 2)).toBe('central bank');
    expect(axisTerm('economy', 6)).toBe('economy');
    expect(axisTerm('law', 1)).not.toContain(' OR ');
  });

  it('windows search pages past the first term cycle, one week further back per cycle', () => {
    const now = new Date('2026-09-04T12:00:00Z');
    expect(axisWindow('economy', 0, now)).toBeNull();
    expect(axisWindow('economy', 5, now)).toBeNull();
    expect(axisWindow('economy', 6, now)).toEqual({ after: '2026-08-25', before: '2026-09-01' });
    expect(axisWindow('economy', 12, now)).toEqual({ after: '2026-08-18', before: '2026-08-25' });
    expect(googleSearchQuery('economy', 1, now)).toBe('inflation');
    expect(googleSearchQuery('economy', 7, now)).toBe('inflation after:2026-08-25 before:2026-09-01');
    expect(AXIS_NEWS_MAX_PAGE).toBeGreaterThan(5);
  });
});

describe('Google News RSS', () => {
  it('builds topic boards for mapped axes and search feeds otherwise', () => {
    const now = new Date('2026-09-04T12:00:00Z');
    const board = new URL(googleNewsUrl('economy', 'ko'));
    expect(board.pathname).toContain('/topic/BUSINESS');
    expect(board.searchParams.get('ceid')).toBe('KR:ko');
    const search = new URL(googleNewsUrl('law', 'ja'));
    expect(search.pathname).toBe('/rss/search');
    // one plain term per page, never an OR-group (non-English editions
    // answer OR-groups with an empty feed)
    expect(search.searchParams.get('q')).toBe('court');
    expect(search.searchParams.get('hl')).toBe('ja');
    expect(new URL(googleNewsUrl('economy', 'ko', 1)).searchParams.get('q')).toBe('inflation');
    expect(new URL(googleNewsUrl('economy', 'ko', 2)).searchParams.get('q')).toBe('central bank');
    // second cycle: same term, one archive week back
    expect(new URL(googleNewsUrl('economy', 'ko', 6, now)).searchParams.get('q')).toBe('economy after:2026-08-25 before:2026-09-01');
  });

  it('builds Bing market + global legs and folds News:Source', () => {
    const local = new URL(bingNewsUrl('law', 'ko', 0) ?? '');
    expect(local.searchParams.get('format')).toBe('rss');
    expect(local.searchParams.get('cc')).toBe('KR');
    expect(local.searchParams.get('q')).toBe('court');
    expect(new URL(bingNewsUrl('law', 'ko', 1) ?? '').searchParams.get('q')).toBe('lawsuit');
    expect(new URL(bingNewsUrl('law', 'ko', 1, true) ?? '').searchParams.get('setlang')).toBe('en-US');
    expect(bingNewsUrl('law', 'en', 0, true)).toBeNull();
    const parsed = parseRss('<rss><channel><item><title>Bing story</title><link>https://outlet.example/a</link><News:Source>Outlet</News:Source></item></channel></rss>');
    expect(parsed[0].sourceName).toBe('Outlet');
    const folded = foldGoogleNews(parsed, 'law', 'ko', 'bing');
    expect(folded[0].id.startsWith('live:bing:')).toBe(true);
    expect(folded[0].domain).toBe('Outlet');
  });

  it('adds the en-US worldwide search leg for every non-US edition', () => {
    expect(googleNewsGlobalUrl('law', 'en')).toBeNull();
    expect(googleNewsGlobalUrl('law', 'et')).toBeNull(); // Estonian falls back to the en-US edition already
    const ko = new URL(googleNewsGlobalUrl('law', 'ko', 2) ?? '');
    expect(ko.searchParams.get('ceid')).toBe('US:en');
    expect(ko.searchParams.get('q')).toBe('verdict');
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
  const mk = (title: string): HotNewsItem => ({ id: title, title, summary: '', url: 'https://x/' + title, category: 'society', source: 'live' });
  it('round-robins the wires in the order given and de-dupes', () => {
    const merged = mergeAxisWires([[mk('L1'), mk('L2')], [mk('B1')], [mk('G1'), mk('L1')]], 10);
    expect(merged.map((i) => i.title)).toEqual(['L1', 'B1', 'G1', 'L2']);
  });
  // REV-21 §2.1: the routes hand the wires over global-first
  // (lib/live/contextPriority.ts -- pinned in contextPriority.test.ts).
  it('honours the cap and tolerates empty wires', () => {
    const merged = mergeAxisWires([[mk('a'), mk('b'), mk('c')], [], [mk('d'), mk('e')]], 3);
    expect(merged).toHaveLength(3);
    expect(mergeAxisWires([])).toEqual([]);
  });
});
