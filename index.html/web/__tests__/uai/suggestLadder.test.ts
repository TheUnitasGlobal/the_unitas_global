import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  INITIAL_SUGGEST_CURSOR,
  LADDER_DRY_LIMIT,
  __clearSuggestCache,
  fetchGlobalTier,
  globalCandidates,
  ladderRowKey,
  loadLadderPage,
  rankBySitelinks,
  recipeFor,
  type SuggestCursor,
} from '@/lib/uai/suggestLadder';

// REV-21 SPEC.md §5.2 SI-5 / §12.6 D-27 -- the keyword ladder: global
// entities (label-prefix, ranked by language editions) ahead of the
// own-language prefix pages, cursor-paged, three dry legs end it, and the
// raw Korean prefix only ever reaches Korean-language endpoints.

const json = (data: unknown) => ({ ok: true, json: async () => data }) as unknown as Response;
let requested: string[] = [];

function route(url: string): unknown {
  if (url.startsWith('https://www.wikidata.org/w/api.php?action=wbsearchentities')) {
    return {
      search: [
        { id: 'Q7391292', label: '공기', description: '지구를 둘러싼 기체', match: { type: 'label' } },
        { id: 'Q1', label: '공기업', description: '국가 소유 기업', match: { type: 'label' } },
        { id: 'Q270791', label: '국영 기업', match: { type: 'alias' } },
        { id: 'Q9', label: '대기 공기', match: { type: 'label' } },
      ],
      'search-continue': 8,
    };
  }
  if (url.startsWith('https://www.wikidata.org/w/api.php?action=wbgetentities')) {
    return {
      entities: {
        Q7391292: { sitelinks: { kowiki: { title: '공기' }, enwiki: { title: 'Air' }, jawiki: { title: '空気' }, commonswiki: { title: 'Category:Air' } } },
        Q1: { sitelinks: { kowiki: { title: '공기업' } } },
      },
    };
  }
  if (url.includes('generator=prefixsearch')) {
    const offset = Number(/gpsoffset=(\d+)/.exec(url)?.[1] ?? 0);
    if (offset >= 16) return { query: { pages: [] } };
    return { continue: { gpsoffset: offset + 8 }, query: { pages: [{ title: '공기 (동음이의)', index: 1, pageprops: { disambiguation: '' } }, { title: '공기업', index: 2, description: '기업', pageprops: { wikibase_item: 'Q1' } }, { title: '공기 청정기', index: 3, extract: '공기를 정화하는 장치.' }] } };
  }
  if (url.includes('list=search&srsearch=morelike')) {
    return { continue: { sroffset: 8 }, query: { search: [{ title: '산소', snippet: '<span>산소</span>는 기체' }] } };
  }
  return null;
}

beforeEach(() => {
  requested = [];
  __clearSuggestCache();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL) => {
      const url = String(input);
      requested.push(url);
      const data = route(url);
      return data === null ? ({ ok: false, json: async () => ({}) } as unknown as Response) : json(data);
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe('global tier', () => {
  it('keeps label-prefix candidates only and ranks them by language editions', () => {
    const cands = globalCandidates({ search: [{ id: 'Q1', label: '공기업', match: { type: 'label' } }, { id: 'Q2', label: '대기', match: { type: 'label' } }, { id: 'Q3', label: '공기', match: { type: 'alias' } }] }, '공기');
    expect(cands.map((c) => c.id)).toEqual(['Q1']);
    const ranked = rankBySitelinks([{ id: 'A' }, { id: 'B' }], { entities: { A: { sitelinks: { kowiki: {}, commonswiki: {} } }, B: { sitelinks: { kowiki: {}, enwiki: {}, jawiki: {} } } } });
    expect(ranked.map((r) => `${r.id}:${r.sitelinks}`)).toEqual(['B:3', 'A:1']);
  });

  it('asks Wikidata in the visitor language and answers with the own-wiki title, qid and continue', async () => {
    const g = await fetchGlobalTier('공기', 'ko', undefined, 0);
    expect(requested[0]).toContain('language=ko');
    expect(requested[0]).toContain('search=%EA%B3%B5%EA%B8%B0');
    expect(g.rows.map((r) => r.qid)).toEqual(['Q7391292', 'Q1']); // 3 editions before 1; alias + non-prefix dropped
    expect(g.rows[0]).toMatchObject({ scope: 'global', title: '공기', sitelinks: 3, url: 'https://ko.wikipedia.org/wiki/%EA%B3%B5%EA%B8%B0' });
    expect(g.next).toBe(8);
  });
});

describe('ladder pages', () => {
  it('p0 runs global + local, p2 adds morelike of the top local hit, the cursor advances every leg', async () => {
    expect(recipeFor(0)).toEqual({ local: true, global: true, related: false });
    expect(recipeFor(2)).toEqual({ local: false, global: true, related: true });
    expect(recipeFor(5)).toEqual({ local: false, global: false, related: true });
    const p0 = await loadLadderPage('공기', 'ko', 0);
    expect(p0.rows.map((r) => r.scope)).toEqual(['global', 'global', 'local', 'local']); // the disambiguation page is skipped
    expect(p0.rows.find((r) => r.id === 'l:공기업')?.qid).toBe('Q1');
    expect(p0.cursor).toMatchObject({ gps: 8, wd: 8, morelike: { title: '공기업', sroffset: 0 }, dry: 0 });
    expect(p0.done).toBe(false);
    const p2 = await loadLadderPage('공기', 'ko', 2, p0.cursor);
    expect(p2.rows.some((r) => r.scope === 'related' && r.title === '산소')).toBe(true);
    expect(p2.rows.find((r) => r.scope === 'related')?.description).toBe('산소는 기체');
    expect(p2.cursor.morelike).toEqual({ title: '공기업', sroffset: 8 });
    // Every request stayed on Korean-language endpoints.
    for (const u of requested) expect(u.includes('en.wikipedia.org')).toBe(false);
  });

  it('ends after three dry legs and serves a cached page without refetching', async () => {
    let cursor: SuggestCursor = { ...INITIAL_SUGGEST_CURSOR, gps: 16, wd: null, morelike: null, dry: LADDER_DRY_LIMIT - 1 };
    const p = await loadLadderPage('공기', 'ko', 3, cursor); // p3 = local only, offset 16 -> empty
    expect(p.rows).toEqual([]);
    expect(p.done).toBe(true);
    expect(p.cursor.dry).toBe(LADDER_DRY_LIMIT);
    cursor = INITIAL_SUGGEST_CURSOR;
    await loadLadderPage('공기', 'ko', 0, cursor);
    const before = requested.length;
    await loadLadderPage('공기', 'ko', 0, cursor);
    expect(requested.length).toBe(before); // memory cache hit
    expect(ladderRowKey({ title: '  공기  청정기 ' })).toBe('공기 청정기');
  });
});
