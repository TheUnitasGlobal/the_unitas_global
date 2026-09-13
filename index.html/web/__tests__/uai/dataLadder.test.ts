import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { __resetWikimediaQueue, __setWikimediaSpacing } from '@/lib/uai/deeperFetch';
import { entityAnchor } from '@/lib/uai/deeperAnchor';
import { INITIAL_LADDER_CURSOR, buildStreamPage } from '@/lib/uai/stream/dataLadder';
import { LOCAL_KINDS, STAGE1_KINDS, STREAM_CHAIN_EVERY, STREAM_DEEPER_EVERY, STREAM_PAGE_CAP, STREAM_SOFT_PAUSE_EVERY, streamRecipe } from '@/lib/uai/stream/streamTypes';
import { engraveTier } from '@/lib/uai/stream/useHyperStream';
import type { ConstitutionScore } from '@/lib/uai/types';

// REV-21 SPEC.md §12.7 -- the stream's page recipe and the isomorphic data
// ladder: page 0 is network-free, later pages carry the paged kinds with a
// COGS card on every page, chain / deeper re-injected on cadence, every
// network leg keyed on the anchor (never the raw Korean string), cursor
// advancing per leg, thin pages flagged, never a throw.

const ctxBase = { locale: 'ko', lang: 'ko', country: 'KR', constitution: [{ axis: 'logic', score: 70, band: 'high' }] as ConstitutionScore[] };
const air = entityAnchor({ localeTitle: '공기', enTitle: 'Air', qid: 'Q7391292', disambiguation: false, lang: 'ko' }, 'ko');
const json = (data: unknown) => ({ ok: true, status: 200, json: async () => data, text: async () => JSON.stringify(data) }) as unknown as Response;
let requested: string[] = [];

function route(url: string): Response | null {
  if (url.includes('wbgetentities&ids=Q7391292')) return json({ entities: { Q7391292: { descriptions: { ko: { value: '지구를 둘러싼 기체' } }, sitelinks: { kowiki: {}, enwiki: {}, jawiki: {} }, claims: { P31: [{ mainsnak: { datavalue: { value: { id: 'Q11344' } } } }] } } } });
  if (url.includes('wbgetentities&ids=Q11344')) return json({ entities: { Q11344: { labels: { ko: { value: '화학 물질' } } } } });
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
  if (url.includes('prop=revisions')) return json({ query: { pages: [{ revisions: [{ timestamp: '2026-09-01T00:00:00Z', user: '10.0.0.1', anon: true, comment: 'x' }] }] } });
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
  it('page 0 is network-free, every later page carries a COGS card, chain / deeper return on cadence', () => {
    expect(streamRecipe(0).every((k) => LOCAL_KINDS.has(k))).toBe(true);
    expect(streamRecipe(0)).toContain('deepGate');
    expect(streamRecipe(1)).toContain('deeper');
    for (let p = 1; p <= 30; p += 1) expect(streamRecipe(p), `p${p}`).toContain('cogs');
    expect(streamRecipe(STREAM_CHAIN_EVERY * 2)).toContain('chain');
    expect(streamRecipe(STREAM_DEEPER_EVERY * 2)).toContain('deeper');
    expect(streamRecipe(7)).not.toContain('chain');
    expect(STAGE1_KINDS.length).toBe(16);
    expect(STREAM_PAGE_CAP).toBe(60);
    expect(STREAM_SOFT_PAUSE_EVERY).toBe(10);
    expect(engraveTier(0)).toBe('spark');
    expect(engraveTier(8)).toBe('orbit');
    expect(engraveTier(20)).toBe('nexus');
    expect(engraveTier(40)).toBe('singularity');
  });
});

describe('buildStreamPage', () => {
  it('p1: identity from Wikidata + the COGS card; the raw Korean string never reaches an English engine', async () => {
    const { page, cursor } = await buildStreamPage('공기', 1, air, ctxBase);
    const identity = page.cards.find((c) => c.kind === 'identity')!;
    expect(identity.text).toBe('지구를 둘러싼 기체');
    expect(identity.facts?.find((f) => f.label === 'editions')?.value).toBe('3');
    expect(identity.facts?.find((f) => f.label === 'instanceOf')?.value).toBe('화학 물질');
    expect(identity.items?.[0]).toMatchObject({ qid: 'Q11344', query: '화학 물질' });
    expect(page.cards.find((c) => c.kind === 'cogs')?.cogs?.group).toBe('origin');
    expect(page.thin).toBe(false);
    expect(cursor).toEqual(INITIAL_LADDER_CURSOR);
    for (const u of requested) expect(u.includes('%EA%B3%B5%EA%B8%B0') && u.includes('en.wikipedia')).toBe(false);
  });

  it('p2: concepts (exact title), sites (wiki hosts filtered), news (global + empty country) and the cursor advances per leg', async () => {
    const { page, cursor } = await buildStreamPage('공기', 2, air, ctxBase);
    expect(page.cards.find((c) => c.kind === 'concepts')?.items?.map((i) => i.query)).toEqual(['산소', '질소']);
    expect(page.cards.find((c) => c.kind === 'sites')?.items?.map((i) => i.title)).toEqual(['example.org']);
    const news = page.cards.filter((c) => c.kind === 'news');
    expect(news).toHaveLength(1);
    expect(news[0].scope).toBe('global');
    expect(cursor.concepts).toBe('1|0|x');
    expect(cursor.sitesOffset).toBe(12);
    expect(cursor.newsGlobal).toBe(1);
    expect(cursor.newsCountry).toBe(0);
    expect(requested.some((u) => u.includes('titles=%EA%B3%B5%EA%B8%B0') && u.includes('prop=links'))).toBe(true);
  });

  it('p3: derived (OpenAlex + Open Library), attention spark and community; a page with no network card is thin', async () => {
    const { page } = await buildStreamPage('공기', 3, air, ctxBase);
    const derived = page.cards.find((c) => c.kind === 'derived')!;
    expect(derived.items?.map((i) => i.sourceId)).toEqual(['openAlex', 'openLibrary']);
    expect(page.cards.find((c) => c.kind === 'attention')?.facts?.find((f) => f.label === 'views30')?.value).toBe('40');
    expect(page.cards.find((c) => c.kind === 'community')?.items?.[0].title).toBe('Air talk');
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}), text: async () => '' }) as unknown as Response));
    const empty = await buildStreamPage('공기', 3, air, ctxBase);
    expect(empty.page.thin).toBe(true);
    expect(empty.page.cards.map((c) => c.kind)).toEqual(['cogs']);
    expect((await buildStreamPage('공기', STREAM_PAGE_CAP + 1, air, ctxBase)).page.cards).toEqual([]);
  });

  it('timeline masks IP authors and stops paging once the history is exhausted', async () => {
    // M10 moved timeline off p4 (visual is a two-step Wikimedia leg, so
    // p4 has no budget left for it); it now returns on the p9+ round-robin.
    const { page, cursor } = await buildStreamPage('공기', 11, air, ctxBase);
    const timeline = page.cards.find((c) => c.kind === 'timeline')!;
    expect(timeline.items?.[0].meta).toContain('·····');
    expect(cursor.timelineDone).toBe(true);
  });
});
