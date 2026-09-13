import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { __resetWikimediaQueue, __setWikimediaSpacing } from '@/lib/uai/deeperFetch';
import { entityAnchor } from '@/lib/uai/deeperAnchor';
import { INITIAL_LADDER_CURSOR, buildStreamPage } from '@/lib/uai/stream/dataLadder';
import { LOCAL_KINDS, STREAM_DEEPER_EVERY, STREAM_PAGE_CAP, STREAM_SOFT_PAUSE_EVERY, streamRecipe } from '@/lib/uai/stream/streamTypes';
import { engraveTier } from '@/lib/uai/stream/useHyperStream';

// The stream's page recipe and the isomorphic data ladder: page 0 is
// network-free, later pages carry the paged kinds, Explore Deeper is
// re-injected on cadence, every network leg is keyed on the anchor (never
// the raw Korean string), the cursor advances per leg, thin pages are
// flagged, and nothing ever throws.
//
// REV-23 M2.2: rewritten for the eleven-kind diet -- identity, timeline and
// the COGS card the old assertions were built on no longer exist.

const ctxBase = { locale: 'ko', lang: 'ko', country: 'KR' };
const air = entityAnchor({ localeTitle: '공기', enTitle: 'Air', qid: 'Q7391292', disambiguation: false, lang: 'ko' }, 'ko');
const json = (data: unknown) => ({ ok: true, status: 200, json: async () => data, text: async () => JSON.stringify(data) }) as unknown as Response;
let requested: string[] = [];

function route(url: string): Response | null {
  if (url.includes('prop=links&plnamespace=0')) return json({ continue: { plcontinue: '1|0|x' }, query: { pages: [{ links: [{ title: '산소' }, { title: '질소' }] }] } });
  if (url.includes('prop=extlinks')) return json({ query: { pages: [{ extlinks: [{ url: 'https://example.org/air' }, { url: 'https://ko.wikipedia.org/x' }] }] } });
  if (url.startsWith('/api/live/entity-news?')) {
    const leg = new URLSearchParams(url.split('?')[1]).get('leg');
    return json({ items: leg === 'global' ? [{ id: 'live:gnews:a', title: 'Air headline', url: 'https://n.example/a', wire: 'gnews' }] : [] });
  }
  if (url.startsWith('https://api.openalex.org/works?search=%22Air%22')) return json({ results: [{ id: 'W1', display_name: 'On air', publication_year: 2020, cited_by_count: 10 }] });
  if (url.startsWith('https://openlibrary.org/search.json')) return json({ docs: [{ key: '/works/OL1', title: 'Air (book)', author_name: ['A'], first_publish_year: 1999 }] });
  if (url.includes('/metrics/pageviews/per-article/en.wikipedia/')) return json({ items: [{ timestamp: '2026080100', views: 10 }, { timestamp: '2026080200', views: 30 }] });
  if (url.startsWith('https://hn.algolia.com/api/v1/search?query=%22Air%22')) return json({ hits: [{ objectID: '1', title: 'Air talk', points: 50, num_comments: 3 }], nbPages: 1 });
  return null;
}

beforeAll(() => __setWikimediaSpacing(0));
beforeEach(() => {
  requested = [];
  __resetWikimediaQueue();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL) => {
      const url = String(input);
      requested.push(url);
      return route(url) ?? ({ ok: false, status: 404, json: async () => ({}), text: async () => '' } as unknown as Response);
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe('stream recipe', () => {
  it('page 0 is network-free and is the web synthesis alone', () => {
    expect(streamRecipe(0).every((k) => LOCAL_KINDS.has(k))).toBe(true);
    expect(streamRecipe(0)).toEqual(['sources']);
  });

  it('Explore Deeper opens page 1 and returns on its cadence', () => {
    expect(streamRecipe(1)).toContain('deeper');
    expect(streamRecipe(STREAM_DEEPER_EVERY)).toContain('deeper');
    expect(streamRecipe(STREAM_DEEPER_EVERY * 2)).toContain('deeper');
    expect(streamRecipe(7)).not.toContain('deeper');
  });

  it('keeps the paging constants and the tier ladder', () => {
    expect(STREAM_PAGE_CAP).toBe(60);
    expect(STREAM_SOFT_PAUSE_EVERY).toBe(10);
    expect(engraveTier(0)).toBe('spark');
    expect(engraveTier(8)).toBe('orbit');
    expect(engraveTier(20)).toBe('nexus');
    expect(engraveTier(40)).toBe('singularity');
  });
});

describe('buildStreamPage', () => {
  it('p1: concepts (exact title) + sites (wiki hosts filtered); the raw Korean string never reaches an English engine', async () => {
    const { page, cursor } = await buildStreamPage('공기', 1, air, ctxBase);
    expect(page.cards.find((c) => c.kind === 'concepts')?.items?.map((i) => i.query)).toEqual(['산소', '질소']);
    expect(page.cards.find((c) => c.kind === 'sites')?.items?.map((i) => i.title)).toEqual(['example.org']);
    expect(page.thin).toBe(false);
    expect(cursor.concepts).toBe('1|0|x');
    expect(cursor.sitesOffset).toBe(12);
    expect(requested.some((u) => u.includes('titles=%EA%B3%B5%EA%B8%B0') && u.includes('prop=links'))).toBe(true);
    for (const u of requested) expect(u.includes('%EA%B3%B5%EA%B8%B0') && u.includes('en.wikipedia')).toBe(false);
  });

  it('p2: news (global lands, country empty) + derived, and the cursor advances per leg', async () => {
    const { page, cursor } = await buildStreamPage('공기', 2, air, ctxBase);
    const news = page.cards.filter((c) => c.kind === 'news');
    expect(news).toHaveLength(1);
    expect(news[0].scope).toBe('global');
    expect(page.cards.find((c) => c.kind === 'derived')?.items?.map((i) => i.sourceId)).toEqual(['openAlex', 'openLibrary']);
    expect(cursor.newsGlobal).toBe(1);
    expect(cursor.newsCountry).toBe(0);
    expect(cursor.derived).toBe(1);
  });

  it('p3: attention spark + community; a page whose every leg fails is thin and empty', async () => {
    const { page } = await buildStreamPage('공기', 3, air, ctxBase);
    expect(page.cards.find((c) => c.kind === 'attention')?.facts?.find((f) => f.label === 'views30')?.value).toBe('40');
    expect(page.cards.find((c) => c.kind === 'community')?.items?.[0].title).toBe('Air talk');

    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}), text: async () => '' }) as unknown as Response));
    const empty = await buildStreamPage('공기', 3, air, ctxBase);
    expect(empty.page.thin).toBe(true);
    // The COGS card used to keep every page non-empty. With it deleted, a
    // fully-failed page really is empty -- and must still not throw.
    expect(empty.page.cards).toEqual([]);
  });

  it('refuses pages outside the cap without throwing', async () => {
    expect((await buildStreamPage('공기', STREAM_PAGE_CAP + 1, air, ctxBase)).page.cards).toEqual([]);
    expect((await buildStreamPage('공기', 0, air, ctxBase)).page.thin).toBe(true);
  });

  it('leaves the cursor untouched for legs the page did not ask for', async () => {
    const { cursor } = await buildStreamPage('공기', 3, air, ctxBase);
    expect(cursor.sitesOffset).toBe(INITIAL_LADDER_CURSOR.sitesOffset);
    expect(cursor.newsGlobal).toBe(INITIAL_LADDER_CURSOR.newsGlobal);
    expect(cursor.globalDone).toBe(false);
  });
});
