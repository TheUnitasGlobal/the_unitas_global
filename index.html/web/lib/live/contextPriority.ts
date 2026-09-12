/**
 * REV-21 §2.1 -- the single source of truth for output priority: GLOBAL
 * (worldwide) first, the visitor's SELECTED COUNTRY second (founder
 * directive 2026-09-12). Every news wire merge and every slot card section
 * order reads this constant instead of hard-coding "own language first".
 *
 * Pure: no React, no fetch. `orderNewsWires` is what the three news routes
 * (hot-news / axis-news / hub-news) hand to `mergeAxisWires` /
 * `mergeNewsFeeds`, so a unit test can pin the order without spinning a
 * server.
 */

export const CONTEXT_SCOPES = ['global', 'country'] as const;
export type ContextScope = (typeof CONTEXT_SCOPES)[number];

/** Output order for any locale. Deliberately locale-independent -- English
 *  visitors get the worldwide board first too (en's "own" wire IS the US
 *  edition, so nothing is lost). */
export function contextOrder(_locale?: string): readonly ContextScope[] {
  return CONTEXT_SCOPES;
}

export interface NewsWireLegs<T> {
  /** en-US Google News search (worldwide). */
  worldwide: T[];
  /** en-US Bing News market (worldwide). */
  bingGlobal: T[];
  /** The locale's own Google News edition (selected country). */
  own: T[];
  /** The locale's own Bing News market (selected country). */
  bing: T[];
}

/** Wires in merge order: worldwide legs lead, the selected country's legs
 *  follow. Round-robin merging (mergeAxisWires) then interleaves them so the
 *  first item is always a global one whenever the global wire returned
 *  anything at all. */
export function orderNewsWires<T>(legs: NewsWireLegs<T>): T[][] {
  return [legs.worldwide, legs.bingGlobal, legs.own, legs.bing];
}

/** Same rule for the Wikimedia featured feeds: (global, local). */
export function orderFeaturedFeeds<T>(legs: { global: T[]; local: T[] }): [T[], T[]] {
  return [legs.global, legs.local];
}

export interface CountryInputs {
  /** Signed-in visitor's `profiles.country` (ISO 3166-1 alpha-2). */
  profileCountry?: string | null;
  /** Country of the place the visitor last searched in the weather panel. */
  cachedPlaceCountry?: string | null;
  /** Country the locale's default place / news edition implies. */
  localeCountry?: string | null;
}

/** ISO2 country for the "selected country" scope, by descending intent:
 *  the profile the visitor set, the city they searched, then what the
 *  language alone implies. Always upper-cased; `US` when nothing is known. */
export function resolveCountry(inputs: CountryInputs): string {
  for (const raw of [inputs.profileCountry, inputs.cachedPlaceCountry, inputs.localeCountry]) {
    const c = (raw ?? '').trim().toUpperCase();
    if (/^[A-Z]{2}$/.test(c)) return c;
  }
  return 'US';
}
