import { describe, expect, it } from 'vitest';
import {
  BROWSER_STORAGE_LEDGER,
  OUTBOUND_BRAND_ROW,
  SOURCE_REGISTRY,
  browserCalledSources,
  fetchedSources,
  outboundSearchUrl,
  sourceAttribution,
  sourceById,
  sourceForUrl,
  sourceLabel,
  sourcesBySide,
} from '@/lib/uai/sourceRegistry';
import { formatSourceName, sourceNameOf } from '@/lib/uai/sourceName';

// REV-21 SPEC.md §12.4 -- the omni-tech source registry is the single legal
// and naming authority: every badge, provider row and privacy section
// derives from it, so its invariants are pinned here.

describe('source registry', () => {
  it('has unique ids and complete legal metadata on every source', () => {
    const ids = SOURCE_REGISTRY.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of SOURCE_REGISTRY) {
      expect(s.displayName.en.trim().length, s.id).toBeGreaterThan(0);
      expect(s.displayName.ko.trim().length, s.id).toBeGreaterThan(0);
      expect(s.attribution.en.trim().length, s.id).toBeGreaterThan(0);
      expect(s.attribution.ko.trim().length, s.id).toBeGreaterThan(0);
      expect(s.homepage, s.id).toMatch(/^https:\/\//);
      expect(s.anchorKind.length, s.id).toBeGreaterThan(0);
      expect(['server', 'browser', 'outbound', 'first-party']).toContain(s.side);
    }
  });

  it('keeps the two RSS wires as the ONLY server-side sources, each headline-only', () => {
    const server = sourcesBySide('server').map((s) => s.id).sort();
    expect(server).toEqual(['bingNews', 'googleNews']);
    for (const s of sourcesBySide('server')) expect(s.licenseClass).toBe('rss-headline-only');
  });

  it('names Microsoft behind Bing and never renders an outbound source as fetched', () => {
    expect(sourceLabel('bingNews', 'en', true)).toBe('Bing News · Microsoft');
    expect(sourceLabel('bingNews', 'ko')).toBe('Bing 뉴스');
    expect(sourceLabel('wikipedia', 'en', true)).toBe('Wikipedia · Wikimedia Foundation');
    for (const id of OUTBOUND_BRAND_ROW) {
      expect(sourceById(id).side, id).toBe('outbound');
      expect(sourceById(id).licenseClass, id).toBe('outbound-only');
      expect(sourceAttribution(id, 'en'), id).toContain('not affiliated');
      expect(sourceAttribution(id, 'ko'), id).toContain('제휴');
    }
    expect(fetchedSources().some((s) => s.side === 'outbound')).toBe(false);
    expect(browserCalledSources().every((s) => s.side === 'browser')).toBe(true);
  });

  it('builds keyless outbound search URLs with the term encoded', () => {
    expect(outboundSearchUrl('googleSearch', '공기', 'ko')).toBe('https://www.google.com/search?q=%EA%B3%B5%EA%B8%B0&hl=ko');
    expect(outboundSearchUrl('bingSearch', 'Air')).toContain('bing.com/search?q=Air');
    expect(outboundSearchUrl('x', 'Air')).toBe('https://x.com/search?q=Air');
    expect(outboundSearchUrl('unitasIndex', 'Air')).toBe(sourceById('unitasIndex').homepage);
  });

  // REV-34 M2 (D-8): the REV-23 arXiv link pointed at /abs/, which takes an
  // identifier and 404s on a query. The listing endpoint is /search/.
  it('sends an arXiv query to the /search/ listing, never to /abs/', () => {
    const url = outboundSearchUrl('arxiv', 'quantum error correction');
    expect(url).toMatch(/^https:\/\/arxiv\.org\/search\/\?/);
    expect(url).toContain('query=quantum%20error%20correction');
    expect(url).toContain('searchtype=all');
    expect(url).not.toContain('/abs/');
  });

  it('REV-34: every outbound engine the family rows name is registered once and searches with the term', () => {
    const added = [
      'naverSearch', 'naverNews', 'naverCafe', 'naverBlog', 'yandex', 'seznam', 'duckduckgoSearch', 'yahooSearch',
      'ecosia', 'qwant', 'brave', 'baidu', 'appleMaps', 'googleMaps', 'googleTrends', 'googlePatents', 'secEdgar',
      'oecd', 'tradingView', 'yahooFinance', 'productHunt', 'crunchbase', 'huggingFace', 'kaggle', 'stackOverflow',
      'devTo', 'medium', 'substack', 'bluesky', 'mastodon', 'pinterest',
    ] as const;
    for (const id of added) {
      expect(SOURCE_REGISTRY.filter((s) => s.id === id).length, `${id} registered once`).toBe(1);
      const s = sourceById(id);
      expect(s.side, id).toBe('outbound');
      expect(s.licenseClass, id).toBe('outbound-only');
      const url = outboundSearchUrl(id, '공기', 'ko');
      expect(url, id).toContain('%EA%B3%B5%EA%B8%B0');
      expect(url, id).not.toBe(s.homepage);
    }
    // Every SourceId on the outbound side is in OmniOpen's reach: the switch
    // never falls through to a bare homepage for an outbound row.
    for (const s of sourcesBySide('outbound')) {
      expect(outboundSearchUrl(s.id, 'Air'), `${s.id} has a search URL`).not.toBe(s.homepage);
    }
  });

  it('REV-34: the new hosts resolve to their own rows without stealing existing ones', () => {
    expect(sourceForUrl('https://search.naver.com/search.naver?query=x')?.source.id).toBe('naverSearch');
    expect(sourceForUrl('https://news.naver.com/main/x')?.source.id).toBe('naverNews');
    expect(sourceForUrl('https://section.cafe.naver.com/ca-fe/x')?.source.id).toBe('naverCafe');
    expect(sourceForUrl('https://section.blog.naver.com/x')?.source.id).toBe('naverBlog');
    expect(sourceForUrl('https://yandex.com/search/?text=x')?.source.id).toBe('yandex');
    expect(sourceForUrl('https://search.seznam.cz/?q=x')?.source.id).toBe('seznam');
    expect(sourceForUrl('https://bsky.app/search?q=x')?.source.id).toBe('bluesky');
    expect(sourceForUrl('https://finance.yahoo.com/lookup/?s=x')?.source.id).toBe('yahooFinance');
    expect(sourceForUrl('https://search.yahoo.com/search?p=x')?.source.id).toBe('yahooSearch');
    expect(sourceForUrl('https://maps.apple.com/?q=x')?.source.id).toBe('appleMaps');
    expect(sourceForUrl('https://patents.google.com/?q=x')?.source.id).toBe('googlePatents');
    expect(sourceForUrl('https://trends.google.com/trends/explore?q=x')?.source.id).toBe('googleTrends');
    // Existing ownership is untouched: the browser-side Instant Answer row
    // keeps duckduckgo.com, Google Search keeps google.com, Scholar its host.
    expect(sourceForUrl('https://duckduckgo.com/?q=x')?.source.id).toBe('duckduckgo');
    expect(sourceForUrl('https://www.google.com/search?q=x')?.source.id).toBe('googleSearch');
    expect(sourceForUrl('https://scholar.google.com/scholar?q=x')?.source.id).toBe('googleScholar');
    expect(sourceForUrl('https://news.google.com/search?q=x')?.source.id).toBe('googleNews');
  });

  it('REV-34: display names stay unique with the owner appended (the privacy page rule)', () => {
    for (const locale of ['en', 'ko']) {
      const names = SOURCE_REGISTRY.map((s) => sourceLabel(s.id, locale, true));
      expect(new Set(names).size, `${locale} owner-qualified names`).toBe(names.length);
    }
    expect(sourceLabel('duckduckgoSearch', 'en')).not.toBe(sourceLabel('duckduckgo', 'en'));
    expect(sourceLabel('kaggle', 'en', true)).toBe('Kaggle · Google');
  });

  it('resolves URLs to the right source, exact hosts before suffixes, path-aware for Bing', () => {
    expect(sourceForUrl('https://news.google.com/rss/search?q=x')?.source.id).toBe('googleNews');
    expect(sourceForUrl('https://www.google.com/search?q=x')?.source.id).toBe('googleSearch');
    expect(sourceForUrl('https://www.bing.com/news/apiclick.aspx?x=1')?.source.id).toBe('bingNews');
    expect(sourceForUrl('https://www.bing.com/search?q=x')?.source.id).toBe('bingSearch');
    expect(sourceForUrl('https://ko.wikipedia.org/wiki/%EA%B3%B5%EA%B8%B0')).toMatchObject({ source: { id: 'wikipedia' }, lang: 'ko' });
    expect(sourceForUrl('https://commons.wikimedia.org/wiki/File:x.jpg')?.source.id).toBe('wikimediaCommons');
    expect(sourceForUrl('https://wikimedia.org/api/rest_v1/metrics/pageviews/x')?.source.id).toBe('wikimediaPageviews');
    expect(sourceForUrl('https://meta.wikimedia.org/wiki/x')).toBeNull();
    expect(sourceForUrl('https://api.frankfurter.dev/v2/rates?base=USD')?.source.id).toBe('frankfurter');
    expect(sourceForUrl('https://eonet.gsfc.nasa.gov/api/v3/events')?.source.id).toBe('nasaEonet');
    expect(sourceForUrl('https://api.weather.gov/alerts/active')?.source.id).toBe('noaaNws');
    expect(sourceForUrl('https://twitter.com/x')?.source.id).toBe('x');
    expect(sourceForUrl('https://x.com/x')?.source.id).toBe('x');
    expect(sourceForUrl('not a url')).toBeNull();
  });

  it('drives the attribution badge (sourceNameOf) from the registry', () => {
    expect(formatSourceName(sourceNameOf('https://api.frankfurter.dev/v2/rates'))).toBe('Frankfurter (ECB)');
    expect(formatSourceName(sourceNameOf('https://eonet.gsfc.nasa.gov/api/v3/events'))).toBe('NASA EONET');
    expect(formatSourceName(sourceNameOf('https://meta.wikimedia.org/wiki/x'))).toBe('Wikimedia');
    expect(sourceNameOf('https://ko.wikipedia.org/wiki/x').id).toBe('wikipedia');
    expect(sourceNameOf('https://www.bing.com/news/search?q=x')).toMatchObject({ name: 'Bing News', id: 'bingNews' });
  });

  it('ledgers every browser storage key under the unitas prefix, once', () => {
    const keys = BROWSER_STORAGE_LEDGER.map((e) => e.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const e of BROWSER_STORAGE_LEDGER) {
      // REV-21 M9: the site-wide inventory covers both the dot and the underscore key families.
      expect(e.key).toMatch(/^unitas[._]/);
      expect(e.purpose.ko.length).toBeGreaterThan(0);
      expect(e.retention.en.length).toBeGreaterThan(0);
    }
    expect(keys).toContain('unitas.weather.v1');
    expect(keys).toContain('unitas.uai.websynth.v4');
  });
});
