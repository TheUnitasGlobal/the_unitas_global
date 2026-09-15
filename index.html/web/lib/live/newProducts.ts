/**
 * REV-29 MISSION 3 -- "글로벌 신상품" (founder directive 2026-09-15).
 *
 * A shortcut theme with no counterpart anywhere on the site: the products
 * the world has JUST released -- cars, smartphones, mobility (motorcycles
 * and aircraft), consumer gadgets and video games -- one family per day on
 * the rotating card, all five families as tabs inside the deep modal.
 *
 * SOURCE. The English Wikipedia category tree is the single most complete
 * keyless registry of product launches on the open web: every article about
 * a new model lands in `Category:Cars introduced in <year>`,
 * `Category:Mobile phones introduced in <year>`, and so on, within hours of
 * being written. Two ordinary MediaWiki API calls, both CORS `*`, both 0원:
 *
 *   1. `list=categorymembers` sorted by `timestamp` (newest page first) --
 *      the "what just got written about" ordering that makes this a live
 *      launch wire rather than an alphabetical list;
 *   2. `prop=extracts|pageimages|langlinks` over those titles -- one-line
 *      description, a thumbnail and the visitor's own-language title when
 *      that Wikipedia has the article.
 *
 * Fail-open: any leg that errors contributes nothing; the card still
 * renders with what arrived. Pure helpers are exported for vitest.
 */
import { Bike, Car, Gamepad2, PackageOpen, Smartphone, type LucideIcon } from 'lucide-react';

export type ProductFamilyKey = 'cars' | 'phones' | 'mobility' | 'gadgets' | 'games';

export interface ProductFamily {
  key: ProductFamilyKey;
  icon: LucideIcon;
  color: string;
  /** The Wikidata item the family is ABOUT (Explore Deeper / outbound). */
  qid: string;
  /** English Wikipedia category titles (without the `Category:` prefix) for
   *  a launch year. Several families draw on more than one tree. */
  categories: (year: number) => string[];
}

export const PRODUCT_FAMILIES: readonly ProductFamily[] = [
  { key: 'cars', icon: Car, color: '#2563eb', qid: 'Q1420', categories: (y) => [`Cars introduced in ${y}`] },
  { key: 'phones', icon: Smartphone, color: '#7c3aed', qid: 'Q22645', categories: (y) => [`Mobile phones introduced in ${y}`] },
  { key: 'mobility', icon: Bike, color: '#0d9488', qid: 'Q42889', categories: (y) => [`Motorcycles introduced in ${y}`, `Aircraft first flown in ${y}`] },
  { key: 'gadgets', icon: PackageOpen, color: '#ea580c', qid: 'Q2424752', categories: (y) => [`Products introduced in ${y}`, `Computer-related introductions in ${y}`] },
  { key: 'games', icon: Gamepad2, color: '#db2777', qid: 'Q7889', categories: (y) => [`${y} video games`] },
];

export const PRODUCT_FAMILY_KEYS: readonly ProductFamilyKey[] = PRODUCT_FAMILIES.map((f) => f.key);

const BY_KEY = new Map<ProductFamilyKey, ProductFamily>(PRODUCT_FAMILIES.map((f) => [f.key, f]));

export function productFamily(key: string | undefined): ProductFamily {
  return (key && BY_KEY.get(key as ProductFamilyKey)) || PRODUCT_FAMILIES[0];
}

export function isProductFamilyKey(value: unknown): value is ProductFamilyKey {
  return typeof value === 'string' && BY_KEY.has(value as ProductFamilyKey);
}

/** Pure: the family the rotating card shows on a given day index -- the
 *  same "SSR and CSR agree on the first frame" rule the awards slot uses. */
export function familyOfDay(dayIndex: number): ProductFamily {
  const n = PRODUCT_FAMILIES.length;
  return PRODUCT_FAMILIES[((dayIndex % n) + n) % n];
}

/** How many products the rotating card shows / the deep modal shows. */
export const PRODUCT_CARD_ITEMS = 4;
export const PRODUCT_DEEP_ITEMS = 12;
/** A launch year with fewer members than this pulls the previous year too. */
export const PRODUCT_MIN_FILL = 4;

const EN_API = 'https://en.wikipedia.org/w/api.php';

/** Pure: newest-first members of one English Wikipedia category. */
export function categoryMembersUrl(category: string, limit = PRODUCT_DEEP_ITEMS): string {
  const params = new URLSearchParams({
    action: 'query',
    list: 'categorymembers',
    cmtitle: `Category:${category}`,
    cmlimit: String(limit),
    cmsort: 'timestamp',
    cmdir: 'desc',
    cmtype: 'page',
    cmnamespace: '0',
    format: 'json',
    origin: '*',
  });
  return `${EN_API}?${params.toString()}`;
}

/** Pure: one-sentence intro, thumbnail and (non-English) own-language
 *  title for a batch of English titles. */
export function pageDetailsUrl(titles: readonly string[], lang: string): string {
  const params = new URLSearchParams({
    action: 'query',
    titles: titles.join('|'),
    prop: lang === 'en' ? 'extracts|pageimages' : 'extracts|pageimages|langlinks',
    exintro: '1',
    explaintext: '1',
    exsentences: '1',
    exlimit: 'max',
    piprop: 'thumbnail',
    pithumbsize: '240',
    format: 'json',
    origin: '*',
  });
  if (lang !== 'en') {
    params.set('lllang', lang);
    params.set('lllimit', 'max');
  }
  return `${EN_API}?${params.toString()}`;
}

export interface CategoryMembersResponse {
  query?: { categorymembers?: Array<{ pageid?: number; title?: string; timestamp?: string }> };
}

export interface PageDetailsResponse {
  query?: {
    pages?: Record<
      string,
      {
        pageid?: number;
        title?: string;
        extract?: string;
        thumbnail?: { source?: string; width?: number; height?: number };
        langlinks?: Array<{ lang?: string; '*'?: string; title?: string }>;
        missing?: string | boolean;
      }
    >;
  };
}

export interface ProductEntry {
  id: string;
  /** English article title. */
  title: string;
  /** The visitor's own-language title when that Wikipedia has the article. */
  localTitle?: string;
  /** One-sentence intro (English), clipped. */
  description: string;
  image?: string;
  /** Article URL -- the own-language edition when a langlink exists. */
  url: string;
  family: ProductFamilyKey;
  year: number;
  /** Page creation / listing timestamp (newest first). */
  listedAt?: string;
}

const MAX_DESCRIPTION = 140;

function clip(s: string, max: number): string {
  const chars = Array.from(s.trim());
  return chars.length <= max ? chars.join('') : `${chars.slice(0, max - 1).join('').trimEnd()}…`;
}

/** Strips the "(2026 film)"-style disambiguation tail from a title for display. */
export function displayTitle(title: string): string {
  return title.replace(/\s*\([^)]*\)\s*$/, '').trim() || title;
}

function wikiUrl(lang: string, title: string): string {
  return `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
}

/** Pure: fold a details response over the ordered member list. Members the
 *  details call did not answer for keep their title and a bare link. */
export function foldProductPages(
  members: ReadonlyArray<{ title: string; timestamp?: string }>,
  details: PageDetailsResponse | null,
  family: ProductFamilyKey,
  year: number,
  lang: string,
): ProductEntry[] {
  const byTitle = new Map<string, NonNullable<NonNullable<PageDetailsResponse['query']>['pages']>[string]>();
  for (const page of Object.values(details?.query?.pages ?? {})) {
    if (page?.title && page.missing === undefined) byTitle.set(page.title, page);
  }
  const seen = new Set<string>();
  const out: ProductEntry[] = [];
  for (const m of members) {
    if (!m.title || seen.has(m.title)) continue;
    // Category housekeeping pages ("List of ...", "Template:...") are not launches.
    if (/^(list of|lists of|template:|category:|portal:|draft:)/i.test(m.title)) continue;
    seen.add(m.title);
    const page = byTitle.get(m.title);
    const local = page?.langlinks?.find((l) => l.lang === lang);
    const localTitle = local ? (local['*'] ?? local.title) : undefined;
    out.push({
      id: `product:${family}:${year}:${m.title}`,
      title: displayTitle(m.title),
      localTitle: localTitle ? displayTitle(localTitle) : undefined,
      description: page?.extract ? clip(page.extract, MAX_DESCRIPTION) : '',
      image: page?.thumbnail?.source,
      url: localTitle && lang !== 'en' ? wikiUrl(lang, localTitle) : wikiUrl('en', m.title),
      family,
      year,
      listedAt: m.timestamp,
    });
  }
  return out;
}

async function fetchJson<T>(url: string, signal: AbortSignal | undefined, timeoutMs = 7000): Promise<T | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    if (signal) signal.addEventListener('abort', () => controller.abort(), { once: true });
    const res = await fetch(url, { signal: controller.signal, headers: { accept: 'application/json' } });
    clearTimeout(timer);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function membersForYear(family: ProductFamily, year: number, signal?: AbortSignal): Promise<Array<{ title: string; timestamp?: string }>> {
  const legs = await Promise.all(family.categories(year).map((cat) => fetchJson<CategoryMembersResponse>(categoryMembersUrl(cat), signal)));
  const merged: Array<{ title: string; timestamp?: string }> = [];
  for (const leg of legs) {
    for (const m of leg?.query?.categorymembers ?? []) if (m.title) merged.push({ title: m.title, timestamp: m.timestamp });
  }
  // Newest listing first across the family's category trees.
  merged.sort((a, b) => (b.timestamp ?? '').localeCompare(a.timestamp ?? ''));
  return merged;
}

export interface ProductRoll {
  family: ProductFamilyKey;
  year: number;
  entries: ProductEntry[];
}

/**
 * The family's newest launches: this year's category trees first, and the
 * previous year's as well when this year is still thin (January, or a
 * family whose year category is sparse), so the card is never empty.
 */
export async function loadProductRoll(family: ProductFamily, lang: string, signal?: AbortSignal, now = new Date()): Promise<ProductRoll> {
  const year = now.getUTCFullYear();
  let members = await membersForYear(family, year, signal);
  let entriesYear = year;
  if (members.length < PRODUCT_MIN_FILL) {
    const previous = await membersForYear(family, year - 1, signal);
    if (members.length === 0) entriesYear = year - 1;
    members = [...members, ...previous];
  }
  const top = members.slice(0, PRODUCT_DEEP_ITEMS);
  if (top.length === 0) return { family: family.key, year: entriesYear, entries: [] };
  const details = await fetchJson<PageDetailsResponse>(pageDetailsUrl(top.map((m) => m.title), lang), signal);
  return { family: family.key, year: entriesYear, entries: foldProductPages(top, details, family.key, entriesYear, lang) };
}
