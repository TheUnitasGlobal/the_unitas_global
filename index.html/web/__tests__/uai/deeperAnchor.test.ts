import { describe, expect, it } from 'vitest';
import {
  anchorDataAttrs,
  anchorKey,
  anchorSupports,
  countryAnchor,
  entityAnchor,
  placeAnchor,
  qidAnchor,
  resolveDeeperPlace,
  textAnchor,
} from '@/lib/uai/deeperAnchor';
import { DEFAULT_PLACE } from '@/lib/live/useLiveWeather';
import type { GeoPlace } from '@/lib/live/geoMatch';

// REV-21 SPEC.md §12.2/§12.3 -- the anchor contract every Explore Deeper
// host builds, and the one place-resolution rule the country-scoped slots
// share (searched place → selected country's capital → locale default).

const busan: GeoPlace = { name: 'Busan', country: 'South Korea', countryCode: 'KR', lat: 35.1796, lon: 129.0756, qid: 'Q16520' };
const lagrange: GeoPlace = { name: 'LaGrange', admin1: 'Georgia', countryCode: 'US', lat: 33.0362, lon: -85.0322 };

describe('resolveDeeperPlace', () => {
  it('prefers the place the visitor searched when it sits inside the selected country', () => {
    expect(resolveDeeperPlace({ locale: 'ko', country: 'KR' }, busan)).toBe(busan);
    expect(resolveDeeperPlace({ locale: 'en' }, lagrange)).toBe(lagrange);
  });

  it("falls back to the selected country's capital when the cached place is elsewhere", () => {
    expect(resolveDeeperPlace({ locale: 'en', country: 'KR' }, lagrange)).toBe(DEFAULT_PLACE.ko);
    expect(resolveDeeperPlace({ locale: 'ko', country: 'US' }, busan)).toBe(DEFAULT_PLACE.en);
  });

  it('trusts a cached place with no country code, and lands on the locale default with nothing cached', () => {
    const bare: GeoPlace = { name: 'Somewhere', lat: 1, lon: 2 };
    expect(resolveDeeperPlace({ locale: 'ko', country: 'KR' }, bare)).toBe(bare);
    expect(resolveDeeperPlace({ locale: 'ja' })).toBe(DEFAULT_PLACE.ja);
    expect(resolveDeeperPlace({ locale: 'xx' })).toBe(DEFAULT_PLACE.en);
    // A country with no locale capital keeps the cached place rather than a random default.
    expect(resolveDeeperPlace({ locale: 'en', country: 'CH' }, lagrange)).toBe(lagrange);
  });
});

describe('anchor builders', () => {
  it('entityAnchor turns a coordinate-bearing entity into a place anchor', () => {
    const a = entityAnchor({ localeTitle: '부산광역시', enTitle: 'Busan', qid: 'Q16520', disambiguation: false, lang: 'ko', coord: { lat: 35.18, lon: 129.08 } }, 'ko');
    expect(a.kind).toBe('place');
    expect(a.coord).toEqual({ lat: 35.18, lon: 129.08 });
    expect(anchorSupports(a, 'entity')).toBe(true);
    expect(anchorSupports(a, 'place')).toBe(true);
    expect(anchorSupports(a, 'country')).toBe(false);
    const e = entityAnchor({ localeTitle: '공기', enTitle: 'Air', qid: 'Q7391292', disambiguation: false }, 'ko');
    expect(e.kind).toBe('entity');
    expect(anchorKey(e)).toBe('q:Q7391292');
  });

  it('placeAnchor carries the city QID, coordinates and country; text anchors are sources-only', () => {
    const p = placeAnchor(busan, 'ko', 'Q11663');
    expect(p).toMatchObject({ kind: 'place', qid: 'Q16520', countryCode: 'KR', coord: { lat: busan.lat, lon: busan.lon } });
    expect(placeAnchor(lagrange, 'en', 'Q11663').qid).toBe('Q11663');
    expect(anchorKey(placeAnchor(lagrange, 'en'))).toBe('p:33.036,-85.032');
    const t = textAnchor('  UNITAS  ', 'en');
    expect(t).toEqual({ kind: 'text', term: 'UNITAS', lang: 'en' });
    expect(anchorSupports(t, 'entity')).toBe(false);
    expect(anchorSupports(t, 'text')).toBe(true);
    expect(anchorKey(t)).toBe('t:en:unitas');
    expect(anchorKey(countryAnchor('kr', 'Korea', 'en'))).toBe('c:KR');
  });

  it('rejects malformed QIDs and stamps data attributes for the host root', () => {
    expect(qidAnchor('not-a-qid', 'x', 'en').qid).toBeUndefined();
    expect(anchorDataAttrs(null)).toEqual({ 'data-deeper-kind': 'none' });
    expect(anchorDataAttrs(qidAnchor('Q349', 'Sport', 'en'))).toMatchObject({ 'data-deeper-kind': 'entity', 'data-deeper-qid': 'Q349', 'data-deeper-term': 'Sport' });
  });
});
