/**
 * REV-21 SPEC §12.5 #13 omniPress / §12.7 `news` card -- pure URL maths
 * for the entity news wires (Google News RSS + Bing News RSS), shared by
 * the route and its unit tests. The founder's v2 rule: never Google alone;
 * the two wires are named individually.
 *
 * Probe findings (2026-09-12) baked in:
 *  - Google respects a quoted phrase -> the exact ENGLISH title, quoted,
 *    on the worldwide (en-US) edition; the exact LOCALE title, quoted, on
 *    the selected country's edition.
 *  - Bing ignores quotes -> the unquoted English title only when it is two
 *    words or more (a one-word 'Air' would drown in homonyms); the locale
 *    title on the country market when it is CJK or two words or more.
 *  - Pages past the first carry Google's `after:`/`before:` week window
 *    (the archive walk); Bing has no paging, so it contributes to page 0
 *    only.
 */
import { BING_NEWS_MARKET, GOOGLE_NEWS_EDITION } from './axisNews';

export const ENTITY_NEWS_WINDOW_DAYS = 7;
export const ENTITY_NEWS_MAX_PAGE = 12;
export const ENTITY_NEWS_PAGE_CAP = 20;

const CJK = /[\p{Script=Han}\p{Script=Hangul}\p{Script=Hiragana}\p{Script=Katakana}]/u;

export function wordCount(term: string): number {
  return term.trim().split(/\s+/).filter(Boolean).length;
}

/** Bing may see this term: CJK (one ideograph is a word) or ≥ 2 words. */
export function bingEligible(term: string): boolean {
  const t = term.trim();
  return t.length > 0 && (CJK.test(t) || wordCount(t) >= 2);
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function entityWindow(page: number, now = new Date()): { after: string; before: string } | null {
  if (page <= 0) return null;
  const before = new Date(now.getTime() - (3 + (page - 1) * ENTITY_NEWS_WINDOW_DAYS) * 86_400_000);
  const after = new Date(before.getTime() - ENTITY_NEWS_WINDOW_DAYS * 86_400_000);
  return { after: isoDay(after), before: isoDay(before) };
}

/** The locale whose Google edition / Bing market sits in `country`. */
export function localeForCountry(country: string, fallback: string): string {
  const c = country.toUpperCase();
  return Object.keys(GOOGLE_NEWS_EDITION).find((l) => GOOGLE_NEWS_EDITION[l].gl === c) ?? fallback;
}

export interface EntityWireUrls {
  google: string | null;
  bing: string | null;
}

/** Worldwide leg: the quoted English title on the en-US edition + market. */
export function globalEntityWires(enTitle: string | undefined, page: number, now = new Date()): EntityWireUrls {
  const title = (enTitle ?? '').replace(/"/g, '').trim();
  if (!title) return { google: null, bing: null };
  const window = entityWindow(page, now);
  const q = window ? `"${title}" after:${window.after} before:${window.before}` : `"${title}"`;
  const google = `https://news.google.com/rss/search?${new URLSearchParams({ q, hl: 'en-US', gl: 'US', ceid: 'US:en' }).toString()}`;
  const bing =
    page === 0 && bingEligible(title) && !CJK.test(title)
      ? `https://www.bing.com/news/search?${new URLSearchParams({ q: title, format: 'rss', cc: 'US', setlang: 'en-US', qft: 'sortbydate="1"' }).toString()}`
      : null;
  return { google, bing };
}

/** Country leg: the quoted locale title on the selected country's edition
 *  and market (skipped when that would just repeat the worldwide leg). */
export function countryEntityWires(localeTitle: string | undefined, enTitle: string | undefined, locale: string, country: string, page: number, now = new Date()): EntityWireUrls {
  const editionLocale = localeForCountry(country, locale);
  const edition = GOOGLE_NEWS_EDITION[editionLocale] ?? GOOGLE_NEWS_EDITION.en;
  const market = BING_NEWS_MARKET[editionLocale] ?? BING_NEWS_MARKET.en;
  const isWorldwide = edition.hl === 'en-US' && edition.gl === 'US';
  const title = ((editionLocale === 'en' ? enTitle : localeTitle) ?? localeTitle ?? enTitle ?? '').replace(/"/g, '').trim();
  if (!title || isWorldwide) return { google: null, bing: null };
  const window = entityWindow(page, now);
  const q = window ? `"${title}" after:${window.after} before:${window.before}` : `"${title}"`;
  const ceid = `${edition.gl}:${edition.hl.split('-')[0]}`;
  const google = `https://news.google.com/rss/search?${new URLSearchParams({ q, hl: edition.hl, gl: edition.gl, ceid }).toString()}`;
  const bing =
    page === 0 && bingEligible(title)
      ? `https://www.bing.com/news/search?${new URLSearchParams({ q: title, format: 'rss', cc: market.cc, setlang: market.setlang, qft: 'sortbydate="1"' }).toString()}`
      : null;
  return { google, bing };
}
