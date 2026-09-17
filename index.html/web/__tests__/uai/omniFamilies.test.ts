import { describe, expect, it } from 'vitest';
import type { SlotKey } from '@/lib/live/discoverySlots';
import {
  OMNI_FAMILIES,
  OMNI_FAMILY_ROWS,
  OMNI_PLATFORMS_CAP,
  OMNI_PLATFORM_ROW_HEAD,
  OMNI_SOURCES_CAP,
  OMNI_SOURCE_ROW,
  OMNI_SOURCE_ROW_HEAD,
  OUTBOUND_BRAND_ROW,
  omniFamilyForSlot,
  omniOpenUrl,
  omniRowsFor,
  outboundSearchUrl,
  sourceById,
  sourceLabel,
  type OmniFamily,
  type SourceId,
} from '@/lib/uai/sourceRegistry';

/**
 * REV-34 M2 (founder directive 2026-09-16, D-8) -- the per-family rows of
 * the omni-open block. What is pinned here is everything the renderer and
 * the E2E contract (rev29-verify: wikipedia + wikidata visible in the
 * sources row, googleSearch + bingSearch visible in the platform row)
 * silently rely on: the mandated heads, the disjointness of the two rows,
 * the outbound-only platform rule, the caps, the ch.7 engines in the
 * default row, and a bare term reaching every id as a real search URL.
 */

const TERM = '공기';
const ENCODED = encodeURIComponent(TERM);

/** Exhaustive by type: adding a SlotKey without a family entry fails tsc. */
const SLOT_KEYS: Record<SlotKey, true> = {
  weather: true,
  awards: true,
  newProducts: true,
  history: true,
  quake: true,
  mostRead: true,
  fx: true,
  crypto: true,
  devPulse: true,
  paper: true,
  library: true,
  art: true,
  air: true,
  nation: true,
  nearby: true,
  uRanking: true,
};

/** Codex ch.7: the ten omni-business engines the default platform row must always carry. */
const CH7_ENGINES: readonly SourceId[] = [
  'googleSearch',
  'naverSearch',
  'yandex',
  'seznam',
  'bingSearch',
  'duckduckgoSearch',
  'yahooSearch',
  'ecosia',
  'qwant',
  'appleMaps',
];

/** D-8: apps without a keyless public search URL never enter a row. */
const BANNED_LABELS = /telegram|discord|kakao|line\b|wechat/i;

describe('REV-34 omni-open families', () => {
  it('lists every family exactly once, with default first', () => {
    expect(OMNI_FAMILIES[0]).toBe('default');
    expect(new Set(OMNI_FAMILIES).size).toBe(OMNI_FAMILIES.length);
    expect(OMNI_FAMILIES).toEqual(
      expect.arrayContaining<OmniFamily>([
        'default',
        'place',
        'news',
        'products',
        'fx',
        'crypto',
        'science',
        'dev',
        'library',
        'art',
        'shorts',
        'unitas',
      ]),
    );
    // REV-35 M1 (D-2): the `rankings` family died with the world ranking.
    expect(OMNI_FAMILIES.length).toBe(12);
    expect(OMNI_FAMILIES as readonly string[]).not.toContain('rankings');
  });

  it('the default family IS the two exported row constants', () => {
    expect(omniRowsFor('default').sources).toBe(OMNI_SOURCE_ROW);
    expect(omniRowsFor('default').platforms).toBe(OUTBOUND_BRAND_ROW);
    expect(omniRowsFor()).toBe(OMNI_FAMILY_ROWS.default);
  });

  it('every family opens its rows with the mandated heads and stays within the caps', () => {
    for (const family of OMNI_FAMILIES) {
      const { sources, platforms } = omniRowsFor(family);
      expect(sources.slice(0, 2), `${family} sources head`).toEqual(OMNI_SOURCE_ROW_HEAD);
      expect(platforms.slice(0, 2), `${family} platforms head`).toEqual(OMNI_PLATFORM_ROW_HEAD);
      expect(sources.length, `${family} sources ≥ 3`).toBeGreaterThanOrEqual(3);
      expect(platforms.length, `${family} platforms ≥ 3`).toBeGreaterThanOrEqual(3);
      expect(sources.length, `${family} sources cap`).toBeLessThanOrEqual(OMNI_SOURCES_CAP);
      expect(platforms.length, `${family} platforms cap`).toBeLessThanOrEqual(OMNI_PLATFORMS_CAP);
    }
  });

  it('a family never names the same id twice, nor in both rows', () => {
    for (const family of OMNI_FAMILIES) {
      const { sources, platforms } = omniRowsFor(family);
      expect(new Set(sources).size, `${family} sources unique`).toBe(sources.length);
      expect(new Set(platforms).size, `${family} platforms unique`).toBe(platforms.length);
      const overlap = sources.filter((id) => (platforms as readonly string[]).includes(id));
      expect(overlap, `${family}: a source must not also be a platform`).toEqual([]);
    }
  });

  it('platforms are outbound-only rows; sources are opened corpora (browser or outbound), never a wire or first-party', () => {
    for (const family of OMNI_FAMILIES) {
      const { sources, platforms } = omniRowsFor(family);
      for (const id of platforms) {
        const s = sourceById(id);
        expect(s.side, `${family}/${id} side`).toBe('outbound');
        expect(s.licenseClass, `${family}/${id} license`).toBe('outbound-only');
        expect(s.attribution.en, `${family}/${id} en attribution`).toContain('not affiliated');
        expect(s.attribution.ko, `${family}/${id} ko attribution`).toContain('제휴');
      }
      for (const id of sources) {
        expect(['browser', 'outbound'], `${family}/${id} side`).toContain(sourceById(id).side);
      }
    }
  });

  it('every id in every row answers a bare term with a URL that carries the term', () => {
    for (const family of OMNI_FAMILIES) {
      const { sources, platforms } = omniRowsFor(family);
      for (const id of sources) {
        const url = omniOpenUrl(id, TERM, 'ko');
        expect(url, `${family}/${id}`).toMatch(/^https:\/\//);
        expect(url, `${family}/${id} must carry the term`).toContain(ENCODED);
        expect(url, `${family}/${id} must not be the homepage`).not.toBe(sourceById(id).homepage);
      }
      for (const id of platforms) {
        const url = outboundSearchUrl(id, TERM, 'ko');
        expect(url, `${family}/${id}`).toMatch(/^https:\/\//);
        expect(url, `${family}/${id} must carry the term`).toContain(ENCODED);
        expect(url, `${family}/${id} must not be the homepage`).not.toBe(sourceById(id).homepage);
      }
    }
  });

  it('labels are unique across every id any family names, in both locales', () => {
    const ids = new Set<SourceId>();
    for (const family of OMNI_FAMILIES) {
      const { sources, platforms } = omniRowsFor(family);
      for (const id of [...sources, ...platforms]) ids.add(id);
    }
    for (const locale of ['en', 'ko']) {
      const labels = [...ids].map((id) => sourceLabel(id, locale));
      expect(new Set(labels).size, `${locale} labels unique`).toBe(labels.length);
      for (const label of labels) expect(label, `${locale} banned app`).not.toMatch(BANNED_LABELS);
    }
  });

  it('the default platform row carries the ten omni-business engines of Codex ch.7', () => {
    for (const id of CH7_ENGINES) expect(OUTBOUND_BRAND_ROW, id).toContain(id);
  });

  it('the compact slice of every family is a usable pair of rows', () => {
    for (const family of OMNI_FAMILIES) {
      const { sources, platforms } = omniRowsFor(family);
      expect(sources.slice(0, 3), `${family} compact sources`).toEqual(expect.arrayContaining(['wikipedia', 'wikidata']));
      expect(platforms.slice(0, 3), `${family} compact platforms`).toEqual(expect.arrayContaining(['googleSearch', 'bingSearch']));
      expect(sources.slice(0, 3).length).toBe(3);
      expect(platforms.slice(0, 3).length).toBe(3);
    }
  });

  it('maps every discovery slot to a family and falls to default for a stranger', () => {
    for (const key of Object.keys(SLOT_KEYS) as SlotKey[]) {
      const family = omniFamilyForSlot(key);
      expect(OMNI_FAMILIES, key).toContain(family);
    }
    expect(omniFamilyForSlot('weather')).toBe('place');
    expect(omniFamilyForSlot('quake')).toBe('place');
    expect(omniFamilyForSlot('air')).toBe('place');
    expect(omniFamilyForSlot('nation')).toBe('place');
    expect(omniFamilyForSlot('nearby')).toBe('place');
    expect(omniFamilyForSlot('newProducts')).toBe('products');
    expect(omniFamilyForSlot('fx')).toBe('fx');
    expect(omniFamilyForSlot('crypto')).toBe('crypto');
    expect(omniFamilyForSlot('devPulse')).toBe('dev');
    expect(omniFamilyForSlot('paper')).toBe('science');
    expect(omniFamilyForSlot('library')).toBe('library');
    expect(omniFamilyForSlot('art')).toBe('art');
    // REV-35 M1 (D-6): the one leaderboard opens UNITAS' own family; the
    // retired slot keys are strangers now and fall to default.
    expect(omniFamilyForSlot('uRanking')).toBe('unitas');
    expect(omniFamilyForSlot('worldRanking')).toBe('default');
    expect(omniFamilyForSlot('unitasRanking')).toBe('default');
    expect(omniFamilyForSlot('awards')).toBe('default');
    expect(omniFamilyForSlot('no-such-slot')).toBe('default');
  });

  it('theme families reach their own corpora', () => {
    expect(omniRowsFor('fx').platforms).toContain('tradingView');
    expect(omniRowsFor('fx').platforms).toContain('yahooFinance');
    expect(omniRowsFor('crypto').sources).toContain('coinGecko');
    expect(omniRowsFor('science').sources).toContain('arxiv');
    expect(omniRowsFor('science').sources).toContain('openAlex');
    expect(omniRowsFor('dev').sources).toContain('github');
    expect(omniRowsFor('dev').platforms).toContain('stackOverflow');
    expect(omniRowsFor('library').sources).toContain('openLibrary');
    expect(omniRowsFor('art').sources).toContain('theMet');
    expect(omniRowsFor('place').platforms).toContain('googleMaps');
    expect(omniRowsFor('place').platforms).toContain('appleMaps');
    expect(omniRowsFor('news').platforms).toContain('naverNews');
    expect(omniRowsFor('shorts').platforms).toContain('youtube');
    expect(omniRowsFor('shorts').platforms).toContain('tiktok');
    expect(omniRowsFor('products').sources).toContain('productHunt');
  });
});
