import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { __resetWikimediaQueue, __setWikimediaSpacing } from '@/lib/uai/deeperFetch';
import { DEEPER_ADAPTERS, loadDeeperPage } from '@/lib/uai/deeperAdapters';
import { entityAnchor, placeAnchor } from '@/lib/uai/deeperAnchor';
import type { DeeperContext } from '@/lib/uai/deeperThemes';

// REV-21 SPEC.md §3.6 -- adapter fixtures replay the live shapes probed on
// 2026-09-12 (Wikidata claims / sitelinks, SPARQL bindings, pageviews,
// Commons imageinfo, OpenAlex, HN, EONET's mislabeled JSON, Open-Meteo
// archive + climate ensemble, USGS) with a mocked fetch. Every page must be
// fail-open and cursor-paged; every card must name a real source.

const ctx: DeeperContext = { locale: 'ko', lang: 'ko', country: 'KR' };
const air = entityAnchor({ localeTitle: '공기', enTitle: 'Air', qid: 'Q7391292', disambiguation: false, lang: 'ko' }, 'ko');
const seoul = placeAnchor({ name: 'Seoul', countryCode: 'KR', lat: 37.5665, lon: 126.978, qid: 'Q8684' }, 'ko');

const json = (data: unknown, ok = true) => ({ ok, status: ok ? 200 : 500, json: async () => data, text: async () => JSON.stringify(data) }) as unknown as Response;
const textBody = (body: string) => ({ ok: true, status: 200, json: async () => JSON.parse(body), text: async () => body }) as unknown as Response;

let requested: string[] = [];

function route(url: string): Response | null {
  // ---- Wikidata entities / labels ------------------------------------
  if (url.includes('wbgetentities&ids=Q7391292&props=claims')) {
    return json({
      entities: {
        Q7391292: {
          descriptions: { ko: { value: '지구를 둘러싼 기체' } },
          sitelinks: { kowiki: { title: '공기' }, enwiki: { title: 'Air' }, jawiki: { title: '空気' }, commonswiki: { title: 'Category:Air' } },
          claims: {
            P31: [{ mainsnak: { datatype: 'wikibase-item', datavalue: { type: 'wikibase-entityid', value: { id: 'Q11344' } } } }],
            P2054: [{ mainsnak: { datatype: 'quantity', datavalue: { type: 'quantity', value: { amount: '+1.225' } } } }],
            P646: [{ mainsnak: { datatype: 'external-id', datavalue: { type: 'string', value: '/m/0k4j' } } }],
            P571: [{ mainsnak: { datatype: 'time', datavalue: { type: 'time', value: { time: '+1900-00-00T00:00:00Z' } } } }],
          },
        },
      },
    });
  }
  if (url.includes('wbgetentities&ids=Q7391292&props=labels|descriptions|aliases')) {
    return json({ entities: { Q7391292: { labels: { ko: { value: '공기' }, en: { value: 'air' }, ja: { value: '空気' } }, descriptions: { ko: { value: '지구를 둘러싼 기체' } }, aliases: { ko: [{ value: '대기' }] } } } });
  }
  if (url.includes('wbgetentities&ids=') && url.includes('&props=labels&')) {
    return json({ entities: { P31: { labels: { ko: { value: '다음 종류에 속함' } } }, P2054: { labels: { ko: { value: '밀도' } } }, P571: { labels: { en: { value: 'inception' } } }, Q11344: { labels: { ko: { value: '화학 물질' } } } } });
  }
  if (url.includes('wbgetentities&ids=Q8684&props=sitelinks&sitefilter=kowiki')) return json({ entities: { Q8684: { sitelinks: { kowiki: { title: '서울특별시' } } } } });
  if (url.includes('wbgetentities&ids=Q8684&props=sitelinks&sitefilter=enwiki')) return json({ entities: { Q8684: { sitelinks: { enwiki: { title: 'Seoul' } } } } });
  // ---- SPARQL ---------------------------------------------------------
  if (url.startsWith('https://query.wikidata.org/sparql')) {
    const q = decodeURIComponent(url);
    if (q.includes('wdt:P828')) {
      return json({ results: { bindings: [{ p: { value: 'http://www.wikidata.org/prop/direct/P1542' }, item: { value: 'http://www.wikidata.org/entity/Q1' }, itemLabel: { value: '바람' }, dir: { value: 'out' } }] } });
    }
    if (q.includes('wdt:P279')) {
      return json({ results: { bindings: [{ p: { value: 'http://www.wikidata.org/prop/direct/P279' }, item: { value: 'http://www.wikidata.org/entity/Q2' }, itemLabel: { value: '기체' }, dir: { value: 'out' } }, { p: { value: 'http://www.wikidata.org/prop/direct/P527' }, item: { value: 'http://www.wikidata.org/entity/Q3' }, itemLabel: { value: 'Q3' }, dir: { value: 'out' } }] } });
    }
    if (q.includes('wdt:P452|wdt:P1056')) {
      return json({ results: { bindings: [{ org: { value: 'http://www.wikidata.org/entity/Q10' }, orgLabel: { value: '에어 코리아' }, countryLabel: { value: '대한민국' } }, { org: { value: 'http://www.wikidata.org/entity/Q11' }, orgLabel: { value: 'Air Liquide' }, countryLabel: { value: '프랑스' } }] } });
    }
    return json({ results: { bindings: [] } });
  }
  if (url.includes('api.worldbank.org/v2/country/KR/indicator/NY.GDP.MKTP.CD')) return json([{}, [{ date: '2024', value: 1712000000000, country: { value: 'Korea, Rep.' } }]]);
  if (url.includes('api.worldbank.org')) return json([{}, [{ date: '2024', value: null }, { date: '2023', value: 51700000 }]]);
  // ---- Wikipedia --------------------------------------------------------
  if (url.includes('prop=linkshere')) return json({ continue: { lhcontinue: '9|0|0' }, query: { pages: [{ linkshere: [{ title: '산소', pageid: 5 }, { title: '대기권', pageid: 6 }] }] } });
  if (url.includes('prop=links&plnamespace=0')) return json({ query: { pages: [{ links: [{ title: '질소' }] }] } });
  if (url.includes('prop=categories')) return json({ query: { pages: [{ categories: [{ title: '분류:기체' }] }] } });
  if (url.includes('list=categorymembers')) return json({ continue: { cmcontinue: 'page|x|1' }, query: { categorymembers: [{ title: '공기', pageid: 1 }, { title: '헬륨', pageid: 2 }] } });
  if (url.includes('prop=revisions') && url.includes('rvdir=newer')) return json({ query: { pages: [{ revisions: [{ timestamp: '2004-03-01T00:00:00Z', user: '203.0.113.7', anon: true, size: 1200 }] }] } });
  if (url.includes('prop=revisions')) return json({ continue: { rvcontinue: '20240101|1' }, query: { pages: [{ revisions: [{ timestamp: '2026-09-01T00:00:00Z', user: 'ExampleBot', size: 24000, comment: '/* 성분 */ 정리' }, { timestamp: '2026-08-25T00:00:00Z', user: 'Editor', size: 23800, comment: '오타' }] }] } });
  if (url.includes('/metrics/pageviews/per-article/en.wikipedia/')) return json({ items: Array.from({ length: 30 }, (_, i) => ({ timestamp: `202608${String(i + 1).padStart(2, '0')}00`, views: 100 + i * 10 })) });
  if (url.includes('/metrics/pageviews/per-article/ko.wikipedia/')) return json({ items: [{ timestamp: '2026080100', views: 40 }, { timestamp: '2026080200', views: 60 }] });
  if (url.includes('/api/rest_v1/page/media-list/')) return json({ items: [{ title: 'File:Air.jpg', type: 'image', showInGallery: true }, { title: 'File:Icon.svg', type: 'image', showInGallery: false }] });
  if (url.includes('commons.wikimedia.org/w/api.php?action=query&titles=File%3AAir.jpg')) {
    return json({ query: { pages: [{ title: 'File:Air.jpg', imageinfo: [{ thumburl: 'https://upload.wikimedia.org/x/640px-Air.jpg', thumbwidth: 640, thumbheight: 480, descriptionurl: 'https://commons.wikimedia.org/wiki/File:Air.jpg', extmetadata: { LicenseShortName: { value: 'CC BY-SA 4.0' }, Artist: { value: '<a href="x">Jane Doe</a>' }, ImageDescription: { value: 'Blue sky' } } }] }] } });
  }
  if (url.includes('commons.wikimedia.org/w/api.php?action=query&generator=search')) return json({ continue: { gsroffset: 6 }, query: { pages: [{ title: 'File:Air.jpg', index: 1 }] } });
  // ---- OpenAlex / Crossref -----------------------------------------------
  if (url.startsWith('https://api.openalex.org/concepts?search=')) return json({ results: [{ id: 'https://openalex.org/C999', display_name: 'Airline', wikidata: 'https://www.wikidata.org/wiki/Q46970', works_count: 5 }, { id: 'https://openalex.org/C123', display_name: 'Air', wikidata: 'https://www.wikidata.org/wiki/Q7391292', works_count: 4200 }] });
  if (url.includes('group_by=publication_year')) return json({ group_by: [{ key: '2019', count: 10 }, { key: '2024', count: 90 }, { key: '2099', count: 5 }] });
  if (url.includes('sort=cited_by_count:desc')) return json({ results: [{ id: 'https://openalex.org/W1', display_name: 'On air', publication_year: 2020, cited_by_count: 1200, open_access: { is_oa: true }, authorships: [{ author: { display_name: 'A. Author' } }], doi: 'https://doi.org/10.1/x' }] });
  if (url.startsWith('https://api.crossref.org/works?query.bibliographic=%22Air%22')) return json({ message: { items: [{ title: ['Air quality'], DOI: '10.2/y', 'is-referenced-by-count': 33, issued: { 'date-parts': [[2018]] } }] } });
  // ---- Hacker News --------------------------------------------------------
  if (url.startsWith('https://hn.algolia.com/api/v1/search_by_date?query=%22Air%22&tags=show_hn')) return json({ hits: [{ objectID: '1', title: 'Show HN: Air monitor', url: 'https://example.com', points: 12, num_comments: 3, created_at: '2026-09-01T00:00:00Z' }], nbPages: 1, page: 0 });
  if (url.startsWith('https://hn.algolia.com/api/v1/search?query=%22Air%22')) return json({ hits: [{ objectID: '2', title: 'Air is everywhere', points: 240, num_comments: 88, created_at: '2026-07-01T00:00:00Z' }], nbPages: 2, page: 0 });
  // ---- entity-news route --------------------------------------------------
  if (url.startsWith('/api/live/entity-news?')) {
    const leg = new URLSearchParams(url.split('?')[1]).get('leg');
    return json({ ok: true, leg, page: 0, hasMore: leg === 'global', fetchedAt: 1, items: [{ id: 'live:gnews:a', title: 'Air headline', url: 'https://n.example/a', domain: 'n.example', wire: 'gnews' }, { id: 'live:bing:b', title: 'Air on Bing', url: 'https://b.example/b', wire: 'bing' }] });
  }
  // ---- Open-Meteo ---------------------------------------------------------
  if (url.startsWith('https://archive-api.open-meteo.com/')) return json({ daily: { time: ['1996-09-12'], temperature_2m_max: [27.4], temperature_2m_min: [18.1], precipitation_sum: [3.2] } });
  if (url.startsWith('https://climate-api.open-meteo.com/')) return json({ daily: { time: ['2050-09-12'], temperature_2m_max_CMCC_CM2_VHR4: [31.1], temperature_2m_max_EC_Earth3P_HR: [null], temperature_2m_max_MRI_AGCM3_2_S: [33.3], temperature_2m_min_CMCC_CM2_VHR4: [22.0], temperature_2m_min_MRI_AGCM3_2_S: [24.0] } });
  if (url.startsWith('https://flood-api.open-meteo.com/')) return json({ daily: { time: ['2026-09-12', '2026-09-13'], river_discharge: [120.5, 130.2] } });
  if (url.startsWith('https://marine-api.open-meteo.com/')) return json({ error: true, reason: 'No data is available for this location' }, false);
  // ---- Earth -------------------------------------------------------------
  if (url.startsWith('https://eonet.gsfc.nasa.gov/api/v3/events?status=open&days=30&bbox=')) return textBody(JSON.stringify({ events: [{ id: 'EONET_1', title: 'Typhoon Example', link: 'https://eonet.gsfc.nasa.gov/api/v3/events/EONET_1', categories: [{ title: 'Severe Storms' }], geometry: [{ date: '2026-09-10T00:00:00Z' }] }] }));
  if (url.startsWith('https://earthquake.usgs.gov/fdsnws/event/1/query')) return json({ features: [{ id: 'us1', properties: { mag: 4.2, place: '30 km E of Pohang', time: 1757600000000, url: 'https://earthquake.usgs.gov/x' } }] });
  if (url.startsWith('https://api.weather.gov/alerts/active')) return json({ features: [{ id: 'nws1', properties: { headline: 'Heat Advisory', event: 'Heat Advisory', severity: 'Moderate', effective: '2026-09-12T00:00:00Z' } }] });
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

describe('Wikidata adapters', () => {
  it('dataTwin counts stated vs external properties, localizes labels and pages in chunks', async () => {
    const page = await DEEPER_ADAPTERS.dataTwin.load(air, ctx);
    const head = page.cards.find((c) => c.id === 'twin-head')!;
    expect(head.facts?.find((f) => f.label === 'f1')?.value).toBe('3'); // P31, P2054, P571 -- P646 is an external id
    expect(head.facts?.find((f) => f.label === 'f2')?.value).toBe('4');
    expect(head.facts?.find((f) => f.label === 'f6')?.value).toBe('1');
    const rows = page.cards.find((c) => c.id === 'twin-0')!;
    // numeric property order (P31, P571, P2054); ko label first, en fallback
    expect(rows.facts?.map((f) => f.label)).toEqual(['다음 종류에 속함', 'inception', '밀도']);
    expect(rows.facts?.find((f) => f.label === '다음 종류에 속함')?.value).toBe('화학 물질');
    expect(rows.facts?.find((f) => f.label === '밀도')?.value).toBe('1.2');
    expect(rows.facts?.find((f) => f.label === 'inception')?.value).toBe('1900');
    expect(rows.items?.[0]).toMatchObject({ qid: 'Q11344', title: '화학 물질' });
    expect(page.cursor).toBeNull(); // 3 stated < one chunk of 6
    expect(page.sources).toEqual(['wikidata']);
  });

  it('causalHack folds the sparse causal leg into the structural neighbourhood and drops unlabeled items', async () => {
    const page = await DEEPER_ADAPTERS.causalHack.load(air, ctx);
    const fields = page.cards.map((c) => c.field);
    expect(fields).toContain('f2'); // has effect -> 바람
    expect(fields).toContain('f5'); // subclass of -> 기체
    const parts = page.cards.find((c) => c.field === 'f6');
    expect(parts).toBeUndefined(); // 'Q3' had no label -> dropped
    expect(page.cards.every((c) => c.sourceId === 'wikidataQuery')).toBe(true);
    expect(page.cursor).toBeNull();
  });

  it('zeroPoint lists labels in twenty languages first, then Wiktionary senses', async () => {
    const first = await DEEPER_ADAPTERS.zeroPoint.load(air, ctx);
    expect(first.cards[0]).toMatchObject({ kind: 'chips', field: 'f1' });
    expect(first.cards[0].items?.map((i) => i.meta)).toEqual(['en', 'ko', 'ja']);
    expect(first.cards[1]?.facts?.find((f) => f.label === 'f3')?.value).toBe('대기');
    expect(first.cursor).toEqual({ stage: 'senses' });
    const senses = await DEEPER_ADAPTERS.zeroPoint.load(air, ctx, first.cursor);
    expect(senses.cursor).toBeNull();
    expect(senses.sources).toEqual(['wiktionary']);
  });

  it('marketMoat lists the players, groups them by country and adds the selected country section once', async () => {
    const page = await DEEPER_ADAPTERS.marketMoat.load(air, ctx);
    expect(page.cards.find((c) => c.field === 'f1')?.items?.map((i) => i.title)).toEqual(['에어 코리아', 'Air Liquide']);
    expect(page.cards.find((c) => c.field === 'f2')?.facts?.map((f) => f.label)).toEqual(['대한민국', '프랑스']);
    const country = page.cards.find((c) => c.scope === 'country')!;
    expect(country.sourceId).toBe('worldBank');
    expect(country.facts?.find((f) => f.label === 'f3')?.value).toBe('$1.7T');
    expect(country.facts?.find((f) => f.label === 'f4')?.value).toBe('51.7M');
    expect(requested.filter((u) => u.includes('worldbank')).every((u) => u.includes('source=2'))).toBe(true);
    expect(page.sources).toEqual(['wikidataQuery', 'worldBank']);
  });
});

describe('Wikipedia adapters', () => {
  it('valueCycle pages inbound links first (with continuation) and then outbound links', async () => {
    const p1 = await DEEPER_ADAPTERS.valueCycle.load(air, ctx);
    expect(p1.cards[0]).toMatchObject({ field: 'f1', scope: 'country' });
    expect(p1.cards[0].items?.map((i) => i.title)).toEqual(['산소', '대기권']);
    expect(p1.cursor).toEqual({ leg: 'in', cont: '9|0|0' });
    const p2 = await DEEPER_ADAPTERS.valueCycle.load(air, ctx, { leg: 'out', cont: '' });
    expect(p2.cards[0].items?.[0].title).toBe('질소');
    expect(p2.cursor).toBeNull();
    expect(requested.some((u) => u.includes('titles=%EA%B3%B5%EA%B8%B0'))).toBe(true); // the exact title, never a search
  });

  it('omniWave draws a 30-day spark per scope with total and trend, walking back 30 days per page', async () => {
    const page = await DEEPER_ADAPTERS.omniWave.load(air, ctx);
    const en = page.cards.find((c) => c.scope === 'global')!;
    expect(en.series?.points.length).toBe(30);
    expect(en.facts?.find((f) => f.label === 'f2')?.value).toMatch(/^\+\d+%$/);
    const ko = page.cards.find((c) => c.scope === 'country')!;
    expect(ko.facts?.find((f) => f.label === 'f1')?.value).toBe('100');
    expect(page.cursor && typeof page.cursor.end === 'string').toBe(true);
    expect(requested.some((u) => u.includes('/per-article/en.wikipedia/all-access/user/Air/daily/'))).toBe(true);
  });

  it('hologramField shows the article media with license + author, then Commons search', async () => {
    const page = await DEEPER_ADAPTERS.hologramField.load(air, ctx);
    expect(page.cards).toHaveLength(1); // the gallery-hidden icon is skipped
    expect(page.cards[0].image).toMatchObject({ src: 'https://upload.wikimedia.org/x/640px-Air.jpg', license: 'CC BY-SA 4.0', author: 'Jane Doe', alt: 'Blue sky', width: 640, height: 480 });
    expect(page.cursor).toEqual({ stage: 'search', offset: 0 });
    const more = await DEEPER_ADAPTERS.hologramField.load(air, ctx, page.cursor);
    expect(requested.some((u) => u.includes('gsrsearch=%22Air%22') && u.includes('gsrnamespace=6'))).toBe(true);
    expect(more.cursor).toEqual({ stage: 'search', offset: 6 });
  });

  it('fractalDim lists categories, then siblings per category with a continuation', async () => {
    const page = await DEEPER_ADAPTERS.fractalDim.load(air, ctx);
    expect(page.cards[0]).toMatchObject({ kind: 'chips', field: 'f1' });
    expect(page.cards[0].items?.[0].title).toBe('기체');
    const siblings = page.cards.find((c) => c.field === 'f2')!;
    expect(siblings.items?.map((i) => i.title)).toEqual(['헬륨']); // the anchor itself is not its own sibling
    expect(page.cursor).toEqual({ catIndex: 0, cmcontinue: 'page|x|1' });
  });

  it('chronosGate masks IP authors, flags bots and hands over to the English history at the end', async () => {
    const page = await DEEPER_ADAPTERS.chronosGate.load(air, ctx);
    const head = page.cards[0];
    expect(head.facts?.find((f) => f.label === 'f1')?.value).toBe('2004-03-01');
    expect(head.facts?.find((f) => f.label === 'f2')?.value).toBe('·····');
    expect(head.facts?.find((f) => f.label === 'f5')?.value).toBe('50%');
    expect(head.facts?.find((f) => f.label === 'f6')?.value).toBe('×20.0');
    expect(page.cards[1].items?.[0].meta).toContain('🤖');
    expect(page.cursor).toEqual({ lang: 'ko', rvcontinue: '20240101|1' });
  });
});

describe('open-data adapters', () => {
  it('evolutionArc matches the OpenAlex concept by QID (not by name), draws the histogram and adds Crossref once', async () => {
    const page = await DEEPER_ADAPTERS.evolutionArc.load(air, ctx);
    expect(requested.some((u) => u.includes('concepts.id:C123'))).toBe(true);
    expect(requested.some((u) => u.includes('concepts.id:C999'))).toBe(false);
    const hist = page.cards.find((c) => c.kind === 'spark')!;
    expect(hist.series?.dates).toEqual(['2019', '2024']); // 2099 filtered
    expect(hist.facts?.find((f) => f.label === 'f5')?.value).toBe('2024');
    expect(page.cards.find((c) => c.sourceId === 'crossref')?.items?.[0]).toMatchObject({ title: 'Air quality', url: 'https://doi.org/10.2/y' });
    expect(page.sources).toEqual(['openAlex', 'crossref']);
    expect(page.cursor).toMatchObject({ conceptId: 'C123', sort: 'recent' }); // one cited page of one work -> straight to recent
  });

  it('ventureSignal feeds the exact quoted English phrase to both HN legs and computes the blue-ocean index', async () => {
    const page = await DEEPER_ADAPTERS.ventureSignal.load(air, ctx);
    expect(page.cards[0].facts?.find((f) => f.label === 'f3')?.value).toBe('0.50');
    expect(page.cards[1].items?.[0].title).toBe('Show HN: Air monitor');
    expect(page.cursor).toEqual({ leg: 'discuss', page: 0 });
    expect(requested.every((u) => !u.includes('%EA%B3%B5%EA%B8%B0'))).toBe(true); // never the Korean string
  });

  it('omniPress names each wire on its own card and walks global -> country', async () => {
    const page = await DEEPER_ADAPTERS.omniPress.load(air, ctx);
    expect(page.cards.map((c) => c.sourceId)).toEqual(['googleNews', 'bingNews']);
    expect(page.cards[0].scope).toBe('global');
    expect(page.cursor).toEqual({ leg: 'global', page: 1 });
    const country = await DEEPER_ADAPTERS.omniPress.load(air, ctx, { leg: 'country', page: 0 });
    expect(country.cards[0].scope).toBe('country');
    expect(country.cursor).toBeNull();
    expect(requested[0]).toContain('enTitle=Air');
    expect(requested[0]).toContain('localeTitle=%EA%B3%B5%EA%B8%B0');
  });

  it('timeFlux reads the same day years ago from the archive, then the 2050 ensemble median (null model ignored)', async () => {
    const past = await DEEPER_ADAPTERS.timeFlux.load(seoul, ctx, { mode: 'past', step: 4 });
    expect(past.cards[0].facts?.find((f) => f.label === 'f2')?.value).toBe('27° / 18°');
    expect(past.cards[0].facts?.find((f) => f.label === 'f3')?.value).toBe('3.2 mm');
    const future = await DEEPER_ADAPTERS.timeFlux.load(seoul, ctx, { mode: 'future', step: 2 });
    expect(future.cards[0].facts?.find((f) => f.label === 'f2')?.value).toBe('32° / 23°');
    expect(future.cards[0].facts?.find((f) => f.label === 'f6')?.value).toBe('2');
    expect(future.cursor).toBeNull();
    expect(DEEPER_ADAPTERS.timeFlux.key).toBe('timeFlux');
  });

  it('terraPulse walks EONET (mislabeled JSON) -> USGS -> water -> alerts, gating NWS on the US', async () => {
    const events = await DEEPER_ADAPTERS.terraPulse.load(seoul, ctx);
    expect(events.cards[0].items?.[0].title).toBe('Typhoon Example');
    expect(events.cursor).toEqual({ leg: 0, offset: 1 });
    const quakes = await DEEPER_ADAPTERS.terraPulse.load(seoul, ctx, { leg: 1, offset: 0 });
    expect(quakes.cards[0].items?.[0].title).toBe('M4.2 · 30 km E of Pohang');
    expect(requested.some((u) => u.includes('maxradiuskm=800'))).toBe(true);
    const water = await DEEPER_ADAPTERS.terraPulse.load(seoul, ctx, { leg: 2, offset: 0 });
    expect(water.cards.map((c) => c.field)).toEqual(['f3']); // marine errored inland -> only the flood spark
    const alerts = await DEEPER_ADAPTERS.terraPulse.load(seoul, ctx, { leg: 3, offset: 0 });
    expect(alerts.cards).toHaveLength(0); // KR -> NWS never called
    expect(requested.some((u) => u.startsWith('https://api.weather.gov'))).toBe(false);
    expect(alerts.cursor).toBeNull();
    const us = await DEEPER_ADAPTERS.terraPulse.load(placeAnchor({ name: 'Austin', countryCode: 'US', lat: 30.27, lon: -97.74 }, 'en'), { ...ctx, country: 'US' }, { leg: 3, offset: 0 });
    expect(us.cards[0].items?.[0].title).toBe('Heat Advisory');
  });
});

describe('loadDeeperPage', () => {
  it('turns an adapter crash into an empty page that still names the theme sources', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    const page = await loadDeeperPage('dataTwin', air, ctx);
    expect(page.cards).toEqual([]);
    expect(page.cursor).toBeNull();
    expect(page.sources).toEqual(['wikidata']);
  });
});
