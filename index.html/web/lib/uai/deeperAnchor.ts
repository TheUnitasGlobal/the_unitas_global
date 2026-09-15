/**
 * REV-21 §3 / SPEC §12.2-§12.3 -- the ANCHOR every "다른출처·다른플랫폼 열기" (Explore
 * Deeper) host hands to the themes: the entity, place or country a popup
 * is about, carried as identifiers (Wikidata QID, coordinates, ISO country)
 * so no theme ever re-searches a translated title -- the '공기 → Thai film'
 * path this revision closes.
 *
 * Hosts build one of these from what they already know (M5a plumbing):
 *  - weather modal        -> placeAnchor(place)            (coord + place.qid)
 *  - news / feed modals   -> slot QID (SLOT_QID)           entityAnchor
 *  - ranking detail modal -> rankingEntryQid(theme, rank)  entityAnchor
 *  - keyword tier / tower -> WebSynthesis.anchor           entityAnchor
 *  - anything without an identifier -> textAnchor (sources-only mode, D-23)
 *
 * Pure and isomorphic: no React, no fetch. `resolveDeeperPlace` is the one
 * helper the country-scoped slot adapters (air / nation / nearby) share so
 * the visitor's selected country (REV-21 §2.1) is honoured everywhere.
 */
import type { GeoPlace } from '@/lib/live/geoMatch';
import { DEFAULT_PLACE } from '@/lib/live/useLiveWeather';
import { isQid, type EntityCoord, type ResolvedEntity } from './entityResolve';
import type { WebAnchor } from './types';

export type DeeperAnchorKind = 'entity' | 'place' | 'country' | 'text';

export interface DeeperAnchor {
  kind: DeeperAnchorKind;
  /** What the visitor sees as the subject, in their own language. */
  term: string;
  /** Wikipedia language subdomain the term belongs to ('ko', 'en', ...). */
  lang: string;
  qid?: string;
  localeTitle?: string;
  enTitle?: string;
  coord?: EntityCoord;
  /** ISO 3166-1 alpha-2, upper-case. */
  countryCode?: string;
  place?: GeoPlace;
  disambiguation?: boolean;
}

/** An entity anchor from a resolved entity or a synthesis anchor. */
export function entityAnchor(source: ResolvedEntity | WebAnchor, lang: string, term?: string): DeeperAnchor {
  const coord = 'coord' in source ? source.coord : undefined;
  return {
    kind: coord ? 'place' : 'entity',
    term: term ?? source.localeTitle,
    lang,
    qid: isQid(source.qid) ? source.qid : undefined,
    localeTitle: source.localeTitle,
    enTitle: source.enTitle,
    disambiguation: source.disambiguation,
    ...(coord ? { coord } : {}),
  };
}

/** An entity anchor from a bare QID dictionary hit (slot / theme / axis). */
export function qidAnchor(qid: string, term: string, lang: string, enTitle?: string): DeeperAnchor {
  return { kind: 'entity', term, lang, qid: isQid(qid) ? qid : undefined, enTitle, localeTitle: term };
}

/** A place anchor from the weather panel's place (SPEC §12.2 weather row:
 *  P + the city's QID when the geocoder found one). */
export function placeAnchor(place: GeoPlace, lang: string, qid?: string): DeeperAnchor {
  const id = place.qid ?? qid;
  return {
    kind: 'place',
    term: place.name,
    lang,
    qid: isQid(id) ? id : undefined,
    coord: { lat: place.lat, lon: place.lon },
    countryCode: place.countryCode,
    place,
  };
}

export function countryAnchor(countryCode: string, term: string, lang: string, qid?: string): DeeperAnchor {
  return { kind: 'country', term, lang, countryCode: countryCode.toUpperCase(), qid: isQid(qid) ? qid : undefined };
}

/** The sources-only fallback (D-23): a subject with no identifier. */
export function textAnchor(term: string, lang: string): DeeperAnchor {
  return { kind: 'text', term: term.trim(), lang };
}

/** Stable cache / dedupe key for an anchor. */
export function anchorKey(a: DeeperAnchor): string {
  if (a.qid) return `q:${a.qid}`;
  if (a.coord) return `p:${a.coord.lat.toFixed(3)},${a.coord.lon.toFixed(3)}`;
  if (a.countryCode) return `c:${a.countryCode}`;
  return `t:${a.lang}:${a.term.toLowerCase()}`;
}

/** True when a theme that needs a QID / coordinate can run on this anchor. */
export function anchorSupports(a: DeeperAnchor, need: DeeperAnchorKind): boolean {
  if (need === 'text') return a.term.length > 0;
  if (need === 'entity') return Boolean(a.qid);
  if (need === 'place') return Boolean(a.coord);
  return Boolean(a.countryCode);
}

/** `data-*` attributes a host stamps on its modal root so the placed block
 *  (and the E2E back-count matrix) can read the anchor without props. */
export function anchorDataAttrs(a: DeeperAnchor | null | undefined): Record<string, string | undefined> {
  if (!a) return { 'data-anchor-kind': 'none' };
  return {
    'data-anchor-kind': a.kind,
    'data-anchor-qid': a.qid,
    'data-anchor-term': a.term,
    'data-anchor-country': a.countryCode,
  };
}

/* ------------------------------------------------------------------ */
/* Place resolution shared by the country-scoped slots (SPEC §12.3 c)   */
/* ------------------------------------------------------------------ */

export interface DeeperPlaceContext {
  locale: string;
  /** REV-21 §2.1: the visitor's selected country (profile → searched place
   *  → locale default), already resolved by buildSlotContext. */
  country?: string;
}

/** The locale whose default place sits in `countryCode`, if any. */
function defaultPlaceForCountry(countryCode: string): GeoPlace | undefined {
  return Object.values(DEFAULT_PLACE).find((p) => p.countryCode === countryCode);
}

/**
 * Which place a country-scoped adapter (air / nation / nearby) and the
 * place-anchored themes should use, by descending intent:
 *  1. the place the visitor searched or located in the weather panel
 *     (`cachedPlace`) -- as long as it is inside the selected country;
 *  2. the selected country's capital (its locale default place) when the
 *     profile country differs from the cached place;
 *  3. the locale's default place.
 * A cached place with no country code is trusted as-is (a bare reverse
 * geocode is still the visitor's own position).
 */
export function resolveDeeperPlace(ctx: DeeperPlaceContext, cachedPlace?: GeoPlace | null): GeoPlace {
  const country = (ctx.country ?? '').toUpperCase();
  if (cachedPlace && (!country || !cachedPlace.countryCode || cachedPlace.countryCode === country)) return cachedPlace;
  if (country) {
    const capital = defaultPlaceForCountry(country);
    if (capital) return capital;
  }
  return cachedPlace ?? DEFAULT_PLACE[ctx.locale] ?? DEFAULT_PLACE.en;
}
