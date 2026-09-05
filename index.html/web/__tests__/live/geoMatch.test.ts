import { describe, expect, it } from 'vitest';
import {
  foldName,
  isLatinQuery,
  mergePlaces,
  nameVariants,
  nearestWithin,
  rankPlaces,
  sameCountry,
  stripEnglishTitle,
  type GeoPlace,
} from '@/lib/live/geoMatch';

// Live Open-Meteo rows captured 2026-09-04 for `name=LaGrange&count=20`
// (order preserved -- note Georgia, the largest, arrives 12th).
const LAGRANGE_ROWS: GeoPlace[] = [
  { id: 4297238, name: 'La Grange', admin1: 'Kentucky', countryCode: 'US', population: 8619, lat: 38.40757, lon: -85.37885 },
  { id: 4703958, name: 'La Grange', admin1: 'Texas', countryCode: 'US', population: 4712, lat: 29.9055, lon: -96.87665 },
  { id: 4922472, name: 'Lagrange', admin1: 'Indiana', countryCode: 'US', population: 2715, lat: 41.64172, lon: -85.41665 },
  { id: 4474627, name: 'La Grange', admin1: 'North Carolina', countryCode: 'US', population: 2804, lat: 35.30683, lon: -77.78803 },
  { id: 5160041, name: 'Lagrange', admin1: 'Ohio', countryCode: 'US', population: 2103, lat: 41.23728, lon: -82.11987 },
  { id: 3008956, name: 'Lagrange', admin1: 'Occitanie', countryCode: 'FR', population: 225, lat: 43.12632, lon: 0.34549 },
  { id: 4204230, name: 'La Grange', admin1: 'Georgia', countryCode: 'US', population: 29588, lat: 33.03929, lon: -85.03133 },
  { id: 5123748, name: 'Lagrange', admin1: 'New York', countryCode: 'US', lat: 41.4487, lon: -74.28543 },
];

describe('geoMatch · name folding and variants', () => {
  it('folds spacing, case, hyphens and diacritics to one key', () => {
    expect(foldName('La Grange')).toBe('lagrange');
    expect(foldName('LaGrange')).toBe('lagrange');
    expect(foldName('La-Grange')).toBe('lagrange');
    expect(foldName('Zürich')).toBe('zurich');
  });

  it('fans a compound name out over its gazetteer spellings, typed form first', () => {
    expect(nameVariants('LaGrange')).toEqual(['LaGrange', 'La Grange']);
    expect(nameVariants('La Grange')).toEqual(['La Grange', 'LaGrange']);
    expect(nameVariants('St. Louis')).toEqual(['St. Louis', 'St.Louis', 'Saint Louis']);
    expect(nameVariants('   ')).toEqual([]);
  });

  it('routes Latin scripts to the gazetteer and everything else to the wiki bridge', () => {
    expect(isLatinQuery('LaGrange')).toBe(true);
    expect(isLatinQuery('São Paulo')).toBe(true);
    expect(isLatinQuery('라그레인지')).toBe(false);
    expect(isLatinQuery('東京')).toBe(false);
    expect(isLatinQuery('Москва')).toBe(false);
  });
});

describe('geoMatch · ranking and merging', () => {
  it('puts LaGrange, Georgia first for a typed "LaGrange" despite arriving 12th', () => {
    const ranked = rankPlaces(LAGRANGE_ROWS, 'LaGrange');
    expect(ranked[0]).toMatchObject({ admin1: 'Georgia', countryCode: 'US' });
    expect(ranked[1]).toMatchObject({ admin1: 'Kentucky' });
    // every same-named sibling survives, each still carrying its own state
    expect(ranked.map((p) => p.admin1)).toEqual(
      expect.arrayContaining(['Georgia', 'Kentucky', 'Indiana', 'North Carolina', 'Ohio']),
    );
    // unknown population sorts last among equals
    expect(ranked[ranked.length - 1]).toMatchObject({ admin1: 'New York' });
  });

  it('prefers exact matches over prefix matches regardless of population', () => {
    const rows: GeoPlace[] = [
      { id: 1, name: 'Georgia', isCountry: true, population: 3_700_000, lat: 42, lon: 43.5 },
      { id: 2, name: 'Georgetown', population: 5_000_000, lat: 6.8, lon: -58.2 },
    ];
    expect(rankPlaces(rows, 'Georgia')[0].id).toBe(1);
  });

  it('merges variant responses by GeoNames id, first occurrence winning', () => {
    const a = LAGRANGE_ROWS.slice(0, 3);
    const b = [LAGRANGE_ROWS[1], LAGRANGE_ROWS[6]];
    const merged = mergePlaces([a, b]);
    expect(merged).toHaveLength(4);
    expect(merged.map((p) => p.id)).toEqual([4297238, 4703958, 4922472, 4204230]);
  });

  it('falls back to rounded coordinates as the dedupe key without an id', () => {
    const merged = mergePlaces([
      [{ name: 'X', lat: 1.00001, lon: 2.00001 }],
      [{ name: 'X', lat: 1.00002, lon: 2.00002 }],
    ]);
    expect(merged).toHaveLength(1);
  });
});

describe('geoMatch · "my location" resolution', () => {
  it('snaps a GPS fix in LaGrange, GA to the Georgia record, not Kentucky', () => {
    const best = nearestWithin(LAGRANGE_ROWS, 33.0362, -85.0322, 60);
    expect(best).toMatchObject({ admin1: 'Georgia' });
  });

  it('returns null when nothing is within range', () => {
    expect(nearestWithin(LAGRANGE_ROWS, 51.5, -0.12, 60)).toBeNull();
    expect(nearestWithin([], 33, -85, 60)).toBeNull();
  });

  it('keeps only the reverse-geocoded country, but never drops code-less rows', () => {
    const rows = sameCountry(LAGRANGE_ROWS, 'us');
    expect(rows.every((p) => p.countryCode === 'US')).toBe(true);
    expect(sameCountry([{ name: 'wiki-only', lat: 0, lon: 0 }], 'US')).toHaveLength(1);
    expect(sameCountry(LAGRANGE_ROWS, undefined)).toHaveLength(LAGRANGE_ROWS.length);
  });

  it('reduces English Wikipedia titles to the bare gazetteer name', () => {
    expect(stripEnglishTitle('LaGrange, Georgia')).toBe('LaGrange');
    expect(stripEnglishTitle('La Grange, Kentucky')).toBe('La Grange');
    expect(stripEnglishTitle('Paris (city)')).toBe('Paris');
    expect(stripEnglishTitle('Tokyo Proper')).toBe('Tokyo');
    expect(stripEnglishTitle('Seoul')).toBe('Seoul');
  });
});
