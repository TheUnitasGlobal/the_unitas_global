import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  EXCLUDED_CROSS_P31,
  entitySearchUrl,
  isExcludedCrossClass,
  isQid,
  parseEntityPages,
  parseWikiLinks,
  resolveEntity,
  sitelinkTitles,
  stripSectionAnchor,
  wikiLinksUrl,
} from '@/lib/uai/entityResolve';
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
  // A pinned entity's own sitelinks (SPEC §12.3 e): 대기 = Atmosphere.
  if (url.startsWith('https://www.wikidata.org/w/api.php?action=wbgetentities&ids=Q8104&')) {
    return { entities: { Q8104: { sitelinks: { kowiki: { title: '대기' }, enwiki: { title: 'Atmosphere#Earth' } } } } };
  }
  if (url.startsWith('https://www.wikidata.org/w/api.php?action=wbgetentities')) {
    return { entities: { Q29383577: { sitelinks: {} }, Q16261070: { sitelinks: { kowiki: { title: '공기 (촉한)' } } } } };
  }
  if (url === 'https://en.wikipedia.org/api/rest_v1/page/summary/Atmosphere') {
    return { title: 'Atmosphere', type: 'standard', extract: 'An atmosphere is a layer of gases that envelop an astronomical object.', content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/Atmosphere' } } };
  }
  if (url.startsWith('https://en.wikipedia.org/w/rest.php/v1/search/page?q=Atmosphere&')) {
    return { pages: [{ title: 'Atmosphere', description: 'layer of gas' }, { title: 'Atmosphere of Mars', description: 'gas layer of Mars' }] };
  }
  if (url.startsWith('https://api.duckduckgo.com/?q=Atmosphere&')) {
    return { Type: 'A', Heading: 'Atmosphere', AbstractText: 'An atmosphere is a layer of gas.', AbstractURL: 'https://en.wikipedia.org/wiki/Atmosphere', RelatedTopics: [] };
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

  // SPEC §12.3 (d): the page's primary coordinate rides on the same call.
  it('exposes the primary coordinate of a place page and asks for it on the entity leg', () => {
    const r = parseEntityPages(
      { query: { pages: [{ title: '부산광역시', index: 1, langlinks: [{ lang: 'en', title: 'Busan' }], pageprops: { wikibase_item: 'Q16520' }, coordinates: [{ lat: 35.18, lon: 129.08, primary: '' }] }] } },
      'ko',
    );
    expect(r?.coord).toEqual({ lat: 35.18, lon: 129.08 });
    expect(parseEntityPages({ query: { pages: [{ title: '공기', index: 1 }] } }, 'ko')?.coord).toBeUndefined();
    const url = entitySearchUrl('ko', '부산', 3, '|extracts&exintro=1');
    expect(url).toContain('prop=langlinks|pageprops|coordinates|extracts&exintro=1&coprimary=primary');
    expect(isQid('Q7391292')).toBe(true);
    expect(isQid('7391292')).toBe(false);
    expect(isQid('Q1; DROP')).toBe(false);
  });

  // SPEC §12.3 (d): no page on the locale wiki -> Wikidata label fallback.
  it('falls back to a Wikidata label match with an own-wiki sitelink, skipping excluded classes', async () => {
    const asked: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL) => {
        const url = String(input);
        asked.push(url);
        if (url.startsWith('https://et.wikipedia.org/w/api.php') && url.includes('generator=search')) return json({ query: { pages: [] } });
        if (url.startsWith('https://www.wikidata.org/w/api.php?action=wbsearchentities')) {
          return json({
            search: [
              { id: 'Q11424', label: 'õhk', description: 'film', match: { type: 'label' } },
              { id: 'Q7391292', label: 'õhk', description: 'Maa atmosfääri gaasisegu', match: { type: 'label' } },
              { id: 'Q270791', label: 'riigiettevõte', match: { type: 'alias' } },
            ],
          });
        }
        if (url.startsWith('https://www.wikidata.org/w/api.php?action=wbgetentities')) {
          return json({
            entities: {
              Q11424: { sitelinks: { etwiki: { title: 'Õhk (film)' }, enwiki: { title: 'Air (film)' } }, labels: {} },
              Q7391292: { sitelinks: { enwiki: { title: 'Air' } }, labels: { et: { value: 'õhk' }, en: { value: 'air' } } },
            },
          });
        }
        if (url.includes('wbgetclaims&entity=Q11424')) return json({ claims: { P31: [{ mainsnak: { datavalue: { value: { id: 'Q11424' } } } }] } });
        if (url.includes('wbgetclaims&entity=Q7391292')) return json({ claims: { P31: [{ mainsnak: { datavalue: { value: { id: 'Q11344' } } } }] } });
        return { ok: false, json: async () => ({}) } as unknown as Response;
      }),
    );
    const r = await resolveEntity('õhk', 'et', new AbortController().signal);
    expect(r).toEqual({ localeTitle: 'õhk', enTitle: 'Air', qid: 'Q7391292', disambiguation: false, lang: 'et', origin: 'wikidata' });
    // The film shared the label and even had an own-wiki page -- the class gate dropped it.
    expect(asked.some((u) => u.includes('wbgetclaims&entity=Q11424'))).toBe(true);
    expect(await resolveEntity('õhk', 'et', new AbortController().signal, { wikidataFallback: false })).toBeNull();
  });

  // SPEC §12.3 (f)/(g): sitelink titles in several languages; outgoing links with a cursor.
  it('reads sitelink titles in one call and parses an outgoing-links page with its continuation', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL) => {
        const url = String(input);
        if (url.includes('wbgetentities&ids=Q7391292&props=sitelinks&sitefilter=kowiki|enwiki|jawiki')) {
          return json({ entities: { Q7391292: { sitelinks: { kowiki: { title: '공기' }, enwiki: { title: 'Air' } } } } });
        }
        return { ok: false, json: async () => ({}) } as unknown as Response;
      }),
    );
    expect(await sitelinkTitles('Q7391292', ['ko', 'en', 'ja'], new AbortController().signal)).toEqual({ ko: '공기', en: 'Air' });
    expect(await sitelinkTitles('nope', ['ko'], new AbortController().signal)).toEqual({});
    expect(parseWikiLinks({ continue: { plcontinue: '123|0|Zzz' }, query: { pages: [{ title: '공기', links: [{ title: '산소' }, { title: '질소' }] }] } })).toEqual({
      links: ['산소', '질소'],
      next: '123|0|Zzz',
    });
    expect(parseWikiLinks(null)).toEqual({ links: [] });
    expect(wikiLinksUrl('ko', '공기', '123|0|Zzz')).toContain('&plcontinue=123%7C0%7CZzz&');
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

  // SPEC §12.3 (e): a chip's QID pins the anchor -- the visitor tapped 대기
  // (Q8104), so the English legs run on ITS sitelink, not on the string's
  // own top hit.
  it('a pinned qid overrides the string anchor and drives the English legs through its sitelink', async () => {
    const web = await collectWebSynthesis(KO_QUERY, 'ko', { abortMs: 5000, qid: 'Q8104' });
    expect(web.anchor).toEqual({ qid: 'Q8104', localeTitle: '대기', enTitle: 'Atmosphere', disambiguation: false });
    expect(requested.some((u) => u.includes('wbgetentities&ids=Q8104&props=sitelinks&sitefilter=kowiki|enwiki'))).toBe(true);
    expect(requested).toContain('https://en.wikipedia.org/api/rest_v1/page/summary/Atmosphere');
    expect(requested.some((u) => u === 'https://en.wikipedia.org/api/rest_v1/page/summary/Air')).toBe(false);
    const en = web.sources.filter((s) => s.origin === 'wiki-en');
    expect(en[0]).toMatchObject({ title: 'Atmosphere', qid: 'Q8104' });
    for (const u of requested.filter((x) => x.startsWith('https://en.wikipedia.org/') || x.startsWith('https://api.duckduckgo.com/'))) expect(u).not.toContain(ENC);
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
