import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EXCLUDED_CROSS_P31, isExcludedCrossClass, parseEntityPages, resolveEntity, stripSectionAnchor } from '@/lib/uai/entityResolve';
import { collectWebSynthesis } from '@/lib/uai/webSynthesisCore';
import { deriveKeywords } from '@/lib/uai/shortcutCore';
import { analyzeSurface } from '@/lib/uai/heuristics';
import { formatSourceName, sourceNameOf } from '@/lib/uai/sourceName';
import type { AnalyticsLabels } from '@/lib/uai/shortcutCore';

// REV-21 SPEC.md §2.2 -- "검색어를 던지지 않는다". The founder-reported
// '공기' (air) → Thai-film drift came from sending the raw Korean string to
// the ENGLISH Wikipedia full-text search. These tests replay the live shape
// of every keyless endpoint with a mocked fetch and pin the contract: the
// raw query reaches the visitor's own wiki only; English is reached by the
// resolved entity's exact title; same-label Wikidata strays are class-gated.

const KO_QUERY = '공기';
const ENC = encodeURIComponent(KO_QUERY);

const json = (data: unknown) => ({ ok: true, json: async () => data }) as unknown as Response;

/** Every URL the synthesis asked for, in order. */
let requested: string[] = [];

function router(url: string): unknown {
  // ko generator=search (+extracts, +langlinks, +pageprops) -- the anchor leg.
  if (url.startsWith('https://ko.wikipedia.org/w/api.php') && url.includes('generator=search')) {
    return {
      query: {
        pages: [
          {
            pageid: 1,
            title: '공기',
            index: 1,
            extract: '공기는 지구를 둘러싼 기체이다. 질소와 산소가 대부분을 차지한다.',
            langlinks: [{ lang: 'en', title: 'Air' }],
            pageprops: { wikibase_item: 'Q7391292' },
          },
          { pageid: 2, title: '공기 (동음이의)', index: 2, extract: '공기는 다음을 가리킨다.', pageprops: { wikibase_item: 'Q1', disambiguation: '' } },
          { pageid: 3, title: '대기', index: 3, extract: '대기는 행성을 둘러싼 기체층이다.', langlinks: [{ lang: 'en', title: 'Atmosphere' }], pageprops: { wikibase_item: 'Q8104' } },
        ],
      },
    };
  }
  if (url.startsWith('https://ko.wikipedia.org/w/rest.php/v1/search/page')) {
    return { pages: [{ key: '공기', title: '공기', excerpt: '공기', description: '지구를 둘러싼 기체' }] };
  }
  if (url.startsWith('https://ko.wikipedia.org/api/rest_v1/page/summary/')) {
    return { title: '공기', extract: '공기는 지구를 둘러싼 기체이다.', content_urls: { desktop: { page: 'https://ko.wikipedia.org/wiki/%EA%B3%B5%EA%B8%B0' } } };
  }
  if (url.startsWith('https://www.wikidata.org/w/api.php?action=wbsearchentities')) {
    return {
      search: [
        { id: 'Q7391292', label: '공기', description: '지구를 둘러싼 기체', concepturi: 'http://www.wikidata.org/entity/Q7391292', match: { type: 'label' } },
        { id: 'Q29383577', label: '공기', description: 'textiles-embroidered highlighted in The MET collection', concepturi: 'http://www.wikidata.org/entity/Q29383577', match: { type: 'label' } },
        { id: 'Q16261070', label: '공기', description: '삼국지연의의 인물', concepturi: 'http://www.wikidata.org/entity/Q16261070', match: { type: 'label' } },
        { id: 'Q270791', label: '국영 기업', description: '국가 소유 기업', concepturi: 'http://www.wikidata.org/entity/Q270791', match: { type: 'alias' } },
      ],
    };
  }
  if (url.startsWith('https://www.wikidata.org/w/api.php?action=wbgetentities')) {
    return { entities: { Q29383577: { sitelinks: {} }, Q16261070: { sitelinks: { kowiki: { title: '공기 (촉한)' } } } } };
  }
  if (url.includes('action=wbgetclaims&entity=Q29383577')) return { claims: { P31: [{ mainsnak: { datavalue: { value: { id: 'Q44740228' } } } }] } };
  if (url.includes('action=wbgetclaims&entity=Q16261070')) return { claims: { P31: [{ mainsnak: { datavalue: { value: { id: 'Q95074' } } } }] } };
  // English -- reachable by the ANCHORED title only.
  if (url === 'https://en.wikipedia.org/api/rest_v1/page/summary/Air') {
    return { title: 'Atmosphere of Earth', type: 'standard', extract: 'The atmosphere of Earth is the layer of gases retained by gravity.', content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/Atmosphere_of_Earth' } } };
  }
  if (url.startsWith('https://en.wikipedia.org/w/rest.php/v1/search/page?q=Air&')) {
    return { pages: [{ title: 'Air', description: 'mixture of gases' }, { title: 'Atmosphere of Earth', description: 'layer of gases' }, { title: 'Air pollution', description: 'contamination of air' }] };
  }
  if (url.startsWith('https://en.wikipedia.org/w/rest.php/v1/search/page?q=' + ENC)) {
    // The homonym vector. Must never be called; answer with the real-world drift if it is.
    return { pages: [{ title: 'Gonggi' }, { title: 'Lee Jun-ho' }, { title: 'Signal (South Korean TV series)' }] };
  }
  if (url.startsWith('https://api.duckduckgo.com/?q=Air&')) {
    return { Type: 'D', Heading: 'Air', AbstractText: '', RelatedTopics: [{ Text: 'Air Jordan - A brand of shoes', FirstURL: 'https://duckduckgo.com/Air_Jordan' }] };
  }
  return null;
}

beforeEach(() => {
  requested = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL) => {
      const url = String(input);
      requested.push(url);
      const data = router(url);
      return data === null ? ({ ok: false, json: async () => ({}) } as unknown as Response) : json(data);
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

const labels: AnalyticsLabels = {
  ecosystems: (k) => k,
  constitution: (a) => `${a} · axis`,
  lens: (k) => `${k} · lens`,
};

describe('entity resolution', () => {
  it('picks the first non-disambiguation hit and strips a section anchor from the English title', () => {
    const ja = parseEntityPages(
      { query: { pages: [{ title: '空気 (曖昧さ回避)', index: 1, pageprops: { disambiguation: '' } }, { title: '空気', index: 2, langlinks: [{ lang: 'en', title: 'Atmosphere of Earth#Composition' }], pageprops: { wikibase_item: 'Q7391292' } }] } },
      'ja',
    );
    expect(ja).toEqual({ localeTitle: '空気', enTitle: 'Atmosphere of Earth', qid: 'Q7391292', disambiguation: false, lang: 'ja' });
    expect(stripSectionAnchor('Air')).toBe('Air');
    const only = parseEntityPages({ query: { pages: [{ title: 'Aire (desambiguación)', pageprops: { disambiguation: '' } }] } }, 'es');
    expect(only?.disambiguation).toBe(true);
    expect(parseEntityPages(null, 'ko')).toBeNull();
  });

  it('resolves through the locale wiki in one call', async () => {
    const r = await resolveEntity(KO_QUERY, 'ko', new AbortController().signal);
    expect(r).toMatchObject({ localeTitle: '공기', enTitle: 'Air', qid: 'Q7391292', disambiguation: false });
    expect(requested).toHaveLength(1);
    expect(requested[0]).toContain('ko.wikipedia.org');
  });

  it('excludes films, series, people and fictional characters as cross candidates', () => {
    expect(isExcludedCrossClass(['Q95074'])).toBe(true);
    expect(isExcludedCrossClass(['Q11424', 'Q2431196'])).toBe(true);
    expect(isExcludedCrossClass([])).toBe(true);
    expect(isExcludedCrossClass(['Q11432'])).toBe(false);
    expect(EXCLUDED_CROSS_P31.has('Q5')).toBe(true);
  });
});

describe("collectWebSynthesis('공기', 'ko')", () => {
  it('never sends the raw Korean string to the English Wikipedia or DuckDuckGo', async () => {
    await collectWebSynthesis(KO_QUERY, 'ko', { abortMs: 5000 });
    const englishCalls = requested.filter((u) => u.startsWith('https://en.wikipedia.org/') || u.startsWith('https://api.duckduckgo.com/'));
    expect(englishCalls.length).toBeGreaterThan(0);
    for (const u of englishCalls) expect(u, u).not.toContain(ENC);
    expect(requested.some((u) => u.startsWith('https://en.wikipedia.org/w/rest.php/v1/search/page?q=' + ENC))).toBe(false);
  });

  it('anchors on Q7391292 and reaches English by the exact title', async () => {
    const web = await collectWebSynthesis(KO_QUERY, 'ko', { abortMs: 5000 });
    expect(web.sourced).toBe(true);
    expect(web.anchor).toEqual({ qid: 'Q7391292', localeTitle: '공기', enTitle: 'Air', disambiguation: false });
    const en = web.sources.filter((s) => s.origin === 'wiki-en');
    expect(en[0]).toMatchObject({ title: 'Atmosphere of Earth', lang: 'en', qid: 'Q7391292' });
    expect(en.map((s) => s.title)).toEqual(['Atmosphere of Earth', 'Air pollution']);
    for (const stray of ['Gonggi', 'Lee Jun-ho', 'Signal (South Korean TV series)']) {
      expect(web.sources.map((s) => s.title)).not.toContain(stray);
      expect(web.digest).not.toContain(stray);
    }
  });

  it('keeps the anchor item and drops same-label Wikidata strays (no own-wiki page, excluded class)', async () => {
    const web = await collectWebSynthesis(KO_QUERY, 'ko', { abortMs: 5000 });
    const wd = web.sources.filter((s) => s.origin === 'wikidata');
    expect(wd.map((s) => s.qid)).toEqual(['Q7391292']);
    expect(web.digest).not.toContain('MET collection');
    expect(web.digest).not.toContain('삼국지연의');
  });

  it('discards a DuckDuckGo disambiguation answer whole', async () => {
    const web = await collectWebSynthesis(KO_QUERY, 'ko', { abortMs: 5000 });
    expect(web.sources.some((s) => s.origin === 'ddg')).toBe(false);
    expect(web.digest).not.toContain('Air Jordan');
  });

  it('grounding carries only own-language summaries and the anchored English summary', async () => {
    const web = await collectWebSynthesis(KO_QUERY, 'ko', { abortMs: 5000 });
    expect(web.grounding).toContain('지구를 둘러싼 기체');
    expect(web.grounding).toContain('atmosphere of Earth');
    expect(web.grounding).not.toContain('Air pollution');
    expect(web.grounding).not.toContain('대기는 행성');
  });

  it('entity keyword chips come from own-language pages only and carry the entity', async () => {
    const web = await collectWebSynthesis(KO_QUERY, 'ko', { abortMs: 5000 });
    const report = analyzeSurface(KO_QUERY, (k) => k, '', web);
    const chips = deriveKeywords(KO_QUERY, report, web, labels);
    const entity = chips.filter((c) => c.kind === 'entity');
    expect(entity.map((c) => c.label)).not.toContain('Atmosphere of Earth');
    expect(entity.map((c) => c.label)).not.toContain('Air pollution');
    expect(entity.every((c) => !c.lang || c.lang === 'ko')).toBe(true);
    expect(entity.some((c) => c.qid === 'Q8104')).toBe(true); // 대기, from the own-language extracts leg
  });
});

describe('sourceNameOf', () => {
  it('names the engine behind a URL, with the wiki language', () => {
    expect(formatSourceName(sourceNameOf('https://ko.wikipedia.org/wiki/%EA%B3%B5%EA%B8%B0'))).toBe('Wikipedia (ko)');
    expect(formatSourceName(sourceNameOf('http://www.wikidata.org/entity/Q7391292'))).toBe('Wikidata');
    expect(formatSourceName(sourceNameOf('https://duckduckgo.com/Air_Jordan'))).toBe('DuckDuckGo');
    expect(formatSourceName(sourceNameOf('https://news.google.com/rss/search?q=x'))).toBe('Google News');
    expect(formatSourceName(sourceNameOf('https://www.bing.com/news/search?q=x'))).toBe('Bing News');
    expect(formatSourceName(sourceNameOf('https://api.open-meteo.com/v1/forecast'))).toBe('Open-Meteo');
    expect(formatSourceName(sourceNameOf('not a url'))).toBe('Web');
    expect(formatSourceName(sourceNameOf('https://example.org/x'))).toBe('example.org');
  });
});
