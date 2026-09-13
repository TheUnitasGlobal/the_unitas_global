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

  it('ledgers every browser storage key under the unitas. prefix, once', () => {
    const keys = BROWSER_STORAGE_LEDGER.map((e) => e.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const e of BROWSER_STORAGE_LEDGER) {
      expect(e.key).toMatch(/^unitas\./);
      expect(e.purpose.ko.length).toBeGreaterThan(0);
      expect(e.retention.en.length).toBeGreaterThan(0);
    }
    expect(keys).toContain('unitas.weather.v1');
    expect(keys).toContain('unitas.uai.websynth.v4');
  });
});
