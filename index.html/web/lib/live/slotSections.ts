/**
 * REV-21 §2.1 (§2A.3) -- "글로벌 1순위 · 선택 국가 2순위" as data.
 *
 * A slot speaks in one or two output scopes. `SLOT_SCOPES` declares which,
 * and `buildSlotSections` splits one loaded `SlotCard` into the sections the
 * card and its deep modal render in order: `data-scope="global"` first,
 * `data-scope="country"` second. A slot that only ever speaks worldwide
 * (quake, crypto, dev pulse, papers, library, art) yields ONE global section
 * and the component hides the scope header; weather / air / nation only ever
 * speak about the visitor's country and yield one country section.
 *
 * Pure module -- no React, no window, no fetch -- so the whole scope contract
 * is unit-testable and the adapters stay free of presentation concerns.
 */
import type { SlotCard, SlotKey, SlotScope, SlotSection } from '@/lib/live/discoverySlots';

/** Worldwide-only: the feed itself has no national edition. `history` (the
 *  locale Wikipedia's "on this day") and the U-Ranking slot (REV-35 M1, the
 *  one leaderboard, cross-ecosystem by construction) join the SPEC's list --
 *  their subject is the world, rendered in the visitor's language. */
const GLOBAL_ONLY: readonly SlotKey[] = [
  'newProducts',
  'history',
  'quake',
  'crypto',
  'devPulse',
  'paper',
  'library',
  'art',
  'uRanking',
];

/** Country-only: every one of these is ABOUT the visitor's place. `mostRead`
 *  (the locale Wikipedia's most-read list) and `nearby` (a geosearch around
 *  that place) join the SPEC's weather / air / nation. */
const COUNTRY_ONLY: readonly SlotKey[] = ['weather', 'air', 'nation', 'nearby', 'mostRead'];

const GLOBAL: readonly SlotScope[] = ['global'];
const COUNTRY: readonly SlotScope[] = ['country'];
/** SPEC order is fixed and global-first for every two-scope slot. */
const BOTH: readonly SlotScope[] = ['global', 'country'];

/** Which scopes each slot renders, in render order. */
export const SLOT_SCOPES: Record<string, readonly SlotScope[]> = {
  ...Object.fromEntries(GLOBAL_ONLY.map((k) => [k, GLOBAL])),
  ...Object.fromEntries(COUNTRY_ONLY.map((k) => [k, COUNTRY])),
  // REV-23 M3.1: the nine news themes that raced a worldwide leg against the
  // visitor's own-language leg are gone from this rail. `fx` is the one slot
  // left that quotes the world and then the visitor's own currency.
  fx: BOTH,
};

export function slotScopes(key: SlotKey): readonly SlotScope[] {
  return SLOT_SCOPES[key] ?? GLOBAL;
}

/**
 * Split a loaded card into its scope sections. Facts and items carry an
 * optional `scope`; anything unmarked belongs to the slot's FIRST scope
 * (global for a two-scope slot), so an adapter that never learned about
 * scopes still renders exactly as before under one section. Empty sections
 * are dropped -- a country leg that returned nothing must not paint an empty
 * "Your country" header.
 */
export function buildSlotSections(key: SlotKey, card: SlotCard): SlotSection[] {
  if (card.facts.length === 0 && card.items.length === 0) return [];
  const scopes = slotScopes(key);
  const fallback = scopes[0];
  if (scopes.length === 1) return [{ scope: fallback, facts: card.facts, items: card.items }];
  const split = scopes.map((scope) => ({
    scope,
    facts: card.facts.filter((f) => (f.scope ?? fallback) === scope),
    items: card.items.filter((i) => (i.scope ?? fallback) === scope),
  }));
  const filled = split.filter((s) => s.facts.length > 0 || s.items.length > 0);
  return filled.length > 0 ? filled : [{ scope: fallback, facts: card.facts, items: card.items }];
}

/** Attach the sections to a freshly loaded card (registry-level wrapper --
 *  every consumer of `DiscoverySlot.load` gets them without asking). */
export function withSlotSections(key: SlotKey, card: SlotCard): SlotCard {
  return { ...card, sections: buildSlotSections(key, card) };
}

/**
 * REV-21 §2.1: a news item's scope. The worldwide legs are folded as `en`
 * and the visitor's own legs as the locale, so an `en` visitor's two legs
 * are indistinguishable -- that card honestly declares one global section
 * rather than inventing a country split.
 */
export function newsItemScope(itemLang: string | undefined, locale: string): SlotScope {
  if (locale === 'en') return 'global';
  return itemLang && itemLang === locale ? 'country' : 'global';
}

/** ISO 3166-1 alpha-2 → ISO 4217, for every country the 20 locales resolve
 *  to (lib/live/slotContext.localeCountry). */
export const COUNTRY_CURRENCY: Record<string, string> = {
  US: 'USD',
  KR: 'KRW',
  EE: 'EUR',
  JP: 'JPY',
  CN: 'CNY',
  ES: 'EUR',
  KH: 'KHR',
  FR: 'EUR',
  DE: 'EUR',
  PT: 'EUR',
  VN: 'VND',
  ID: 'IDR',
  RU: 'RUB',
  IN: 'INR',
  IT: 'EUR',
  TR: 'TRY',
  TH: 'THB',
  PL: 'PLN',
  NL: 'EUR',
  PH: 'PHP',
};

/** Frankfurter republishes the ECB reference rates and nothing else, so a
 *  currency outside this set has no rate to show (KHR, VND, RUB). */
export const FRANKFURTER_SYMBOLS: readonly string[] = [
  'AUD', 'BGN', 'BRL', 'CAD', 'CHF', 'CNY', 'CZK', 'DKK', 'EUR', 'GBP',
  'HKD', 'HUF', 'IDR', 'ILS', 'INR', 'ISK', 'JPY', 'KRW', 'MXN', 'MYR',
  'NOK', 'NZD', 'PHP', 'PLN', 'RON', 'SEK', 'SGD', 'THB', 'TRY', 'USD',
  'ZAR',
];

/**
 * The quote the fx card emphasises as its country section, or null when the
 * visitor's currency IS the base (nothing to add) or the ECB does not
 * publish it (no invented rate -- the card stays global-only).
 */
export function fxCountryQuote(country: string | undefined, base: string): string | null {
  const currency = COUNTRY_CURRENCY[(country ?? '').toUpperCase()];
  if (!currency || currency === base.toUpperCase()) return null;
  return FRANKFURTER_SYMBOLS.includes(currency) ? currency : null;
}
