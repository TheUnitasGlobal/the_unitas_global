/**
 * Pure, isomorphic geo-matching helpers behind the "실시간 날씨" tab's city
 * search and "내 위치" resolution (owner instruction 2026-09-04 round 8:
 * global geo-matching must resolve every visitor's real region -- country /
 * state / city -- and split same-named cities cleanly, e.g. LaGrange GA vs
 * La Grange KY / IN / NC / OH).
 *
 * Measured against the live Open-Meteo gazetteer on 2026-09-04:
 *  - `name=LaGrange&count=5` never returns LaGrange, Georgia (pop 29,588):
 *    it sits 12th in a 20-row response that is NOT population-ordered, so a
 *    small `count` silently drops the largest same-named city. Hence
 *    GEOCODE_COUNT = 20 + population/exact-match re-ranking here.
 *  - "LaGrange" and "La Grange" return overlapping but different sets (the
 *    spaced form is the only one that yields La Grange, Illinois), so a
 *    query fans out over its spelling variants and the rows are merged by
 *    GeoNames id.
 * No React, no fetch -- LiveWeatherPanel wires the network side.
 */

export interface GeoPlace {
  /** GeoNames id from Open-Meteo -- the dedupe key when present. */
  id?: number;
  name: string;
  country?: string;
  /** ISO 3166-1 alpha-2, upper-case -- lets "my location" keep only the
   *  candidates inside the reverse-geocoded country. */
  countryCode?: string;
  /** First-order administrative division (US state, etc.) -- kept separate
   *  from `name` so a state-level result ("Georgia", feature_code ADM1)
   *  never collides on-screen with the identically-named country. */
  admin1?: string;
  /** feature_code === 'ADM1' -- this result IS a state/province, not a city. */
  isState?: boolean;
  /** feature_code === 'PCLI' -- this result IS a whole country. */
  isCountry?: boolean;
  population?: number;
  lat: number;
  lon: number;
  /** Resolved from the visitor's network address rather than GPS -- the UI
   *  flags it as an estimate. */
  approx?: boolean;
}

/** Rows to ask Open-Meteo for per spelling variant (see header). */
export const GEOCODE_COUNT = 20;
/** Candidates the disambiguation list shows at most. */
export const MAX_CANDIDATES = 12;
/** How far a gazetteer record may sit from a GPS fix and still be "here". */
export const GPS_MATCH_KM = 60;
/** Same, for a network-address fix (city-centroid accuracy at best). */
export const IP_MATCH_KM = 140;
/** How far a Wikipedia article's own coordinate may sit from a gazetteer
 *  record for the two to be the same place. */
export const WIKI_MATCH_KM = 40;

/** Diacritic-insensitive, case-insensitive, separator-free key: "La Grange"
 *  / "LaGrange" / "Lagrange" / "La-Grange" all fold to "lagrange". */
export function foldName(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[\s'’.\-]+/g, '');
}

/** Latin-script (incl. accented) queries go straight to the gazetteer; any
 *  other script (한글 / かな / 汉字 / кириллица …) needs the Wikipedia bridge. */
export function isLatinQuery(value: string): boolean {
  return /^[\x00-\x7F\u00C0-\u024F\u1E00-\u1EFF]*$/.test(value);
}

/** Spelling variants a compound Latin place name is filed under: the typed
 *  form, spaces collapsed ("La Grange" → "LaGrange"), camel-case split
 *  ("LaGrange" → "La Grange"), hyphens as spaces. Unique, typed form first. */
export function nameVariants(name: string): string[] {
  const base = name.trim().replace(/\s+/g, ' ');
  if (!base) return [];
  const out = [base];
  const push = (v: string) => {
    const t = v.trim().replace(/\s+/g, ' ');
    if (t && !out.some((o) => o.toLowerCase() === t.toLowerCase())) out.push(t);
  };
  push(base.replace(/[\s-]+/g, ''));
  push(base.replace(/-/g, ' '));
  // "LaGrange" / "McAllen" / "DeKalb" → "La Grange" / "Mc Allen" / "De Kalb"
  push(base.replace(/([a-z])([A-Z])/g, '$1 $2'));
  // "Saint X" ↔ "St. X" -- both spellings are common in the gazetteer.
  push(base.replace(/^St\.?\s+/i, 'Saint '));
  push(base.replace(/^Saint\s+/i, 'St. '));
  return out.slice(0, 4);
}

function placeKey(p: GeoPlace): string {
  return p.id !== undefined ? `id:${p.id}` : `ll:${p.lat.toFixed(3)},${p.lon.toFixed(3)}`;
}

/** Union of several gazetteer responses, first occurrence wins. */
export function mergePlaces(lists: GeoPlace[][]): GeoPlace[] {
  const seen = new Set<string>();
  const out: GeoPlace[] = [];
  for (const list of lists) {
    for (const p of list) {
      const k = placeKey(p);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(p);
    }
  }
  return out;
}

function matchScore(name: string, query: string): number {
  const n = foldName(name);
  const q = foldName(query);
  if (!n || !q) return 0;
  if (n === q) return 3;
  if (n.startsWith(q)) return 2;
  if (n.includes(q)) return 1;
  return 0;
}

/**
 * Stable ranking for the disambiguation list: exact folded-name matches
 * first, then prefix / substring matches, then by population (largest
 * first, unknown last). A typed "LaGrange" therefore leads with LaGrange,
 * Georgia (29,588) ahead of La Grange, Kentucky (8,619) and the rest --
 * every one still listed with its own state + country so the visitor can
 * pick any of them.
 */
export function rankPlaces(list: GeoPlace[], query: string): GeoPlace[] {
  return list
    .map((p, i) => ({ p, i, s: matchScore(p.name, query), pop: p.population ?? -1 }))
    .sort((a, b) => b.s - a.s || b.pop - a.pop || a.i - b.i)
    .map((x) => x.p);
}

/** Great-circle distance, km. */
export function distanceKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Closest candidate to a coordinate, provided it lies within `maxKm`. */
export function nearestWithin(candidates: GeoPlace[], lat: number, lon: number, maxKm: number): GeoPlace | null {
  let best: GeoPlace | null = null;
  let bestKm = Number.POSITIVE_INFINITY;
  for (const c of candidates) {
    const km = distanceKm(c.lat, c.lon, lat, lon);
    if (km < bestKm) {
      best = c;
      bestKm = km;
    }
  }
  return best && bestKm <= maxKm ? best : null;
}

/** Restricts to one country when the code is known; a candidate without a
 *  code (Wikipedia-only fallback rows) is kept rather than dropped. */
export function sameCountry(candidates: GeoPlace[], countryCode: string | undefined): GeoPlace[] {
  if (!countryCode) return candidates;
  const cc = countryCode.toUpperCase();
  return candidates.filter((c) => !c.countryCode || c.countryCode.toUpperCase() === cc);
}

/** English Wikipedia titles carry their disambiguator: "LaGrange, Georgia"
 *  / "Paris (city)" / "Tokyo Proper" → the bare place name the gazetteer
 *  is keyed on. */
export function stripEnglishTitle(title: string): string {
  return title
    .replace(/\s*\(.*\)\s*$/, '')
    .replace(/,.*$/, '')
    .replace(/\s+(Proper|City|Metropolis|Municipality|Township|Borough)\s*$/i, '')
    .trim();
}
