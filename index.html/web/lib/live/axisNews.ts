import { classifyNews, clipText, normTitle, type HotNewsCategory, type HotNewsItem } from './hotNews';
import { stripControl } from '@/lib/uai/webSynthesisCore';

/**
 * Pure maths for the per-axis live wire (owner instruction 2026-09-04 round
 * 6: "클릭 시 16대 축에 해당하는 방대하고 다양한 글로벌 실시간 정보가
 * 끊임없이 호출"). Isomorphic + fetch-free so the route stays thin and this
 * folds under vitest. Two keyless, 0원 sources:
 *
 * - GDELT DOC 2.0 (api.gdeltproject.org): the global news graph -- monitors
 *   print/broadcast/web news in 65+ languages, machine-translated so one
 *   English keyword query matches worldwide coverage; `sourcelang:` narrows
 *   a second pass to the visitor's own language. Supports arbitrary
 *   date windows, which is what makes the feed *endless*: page N is the
 *   24h window N days back (AXIS_NEWS_MAX_PAGE caps the archive walk).
 * - Google News RSS: per-edition topic boards (localized by hl/gl/ceid) and
 *   keyword search -- adds mainstream-outlet breadth for page 0 only.
 *
 * Fail-open everywhere: a source that errors, times out or rejects a query
 * simply contributes nothing; the route still answers with what it got.
 *
 * GDELT rate limit (verified live 2026-09-04): ONE request per 5 seconds
 * per IP, answered with a plain-text 429 otherwise -- and a violation parks
 * the IP in a penalty box for a while. So the route makes exactly one GDELT
 * call per request, spaced by GDELT_MIN_INTERVAL_MS per function instance,
 * and alternates the own-language and worldwide passes across pages
 * (gdeltPlan) instead of firing both at once. Google News, which has no such
 * limit, carries every page on its own (a different keyword per page), so
 * paging stays endless even while GDELT is throttled.
 */

export const AXIS_NEWS_MAX_PAGE = 13;
export const AXIS_NEWS_PAGE_CAP = 40;
export const GDELT_MIN_INTERVAL_MS = 5200;
const MAX_SUMMARY = 200;

/** English keyword groups per axis -- GDELT matches these against its
 *  machine-translated index, so the same query surfaces Korean, Thai or
 *  Estonian coverage when paired with `sourcelang:`. Multi-word terms must
 *  be quoted and OR-groups parenthesized per the DOC API grammar. */
export const AXIS_NEWS_QUERY: Record<HotNewsCategory, string[]> = {
  world: ['international', '"United Nations"', 'global', 'summit', 'worldwide'],
  politics: ['election', 'president', 'parliament', '"prime minister"', 'government', 'minister'],
  economy: ['economy', 'inflation', '"central bank"', '"stock market"', 'tariff', 'GDP'],
  science: ['scientists', 'NASA', 'research', 'discovery', 'climate', 'telescope'],
  technology: ['"artificial intelligence"', 'semiconductor', 'startup', 'smartphone', 'software', 'robot'],
  engineering: ['engineering', 'infrastructure', 'reactor', 'bridge', 'railway', 'aircraft', 'shipbuilding'],
  sports: ['football', 'olympic', 'championship', 'tournament', 'league', '"world cup"'],
  culture: ['film', 'festival', 'album', 'concert', 'heritage', 'museum'],
  art: ['exhibition', 'painting', 'sculpture', 'gallery', '"art museum"', 'artist', 'opera'],
  expression: ['journalist', '"press freedom"', '"social media"', 'censorship', 'broadcaster', 'influencer'],
  language: ['language', 'translation', 'linguistics', 'dialect', 'bilingual', 'literacy'],
  society: ['protest', 'migration', 'refugees', 'population', 'crime', '"birth rate"', 'community'],
  structure: ['infrastructure', '"urban planning"', 'metro', '"power grid"', '"supply chain"', 'housing'],
  pragma: ['consumer', 'lifestyle', 'tourism', 'travel', '"product recall"', 'shopping', 'food'],
  law: ['court', 'lawsuit', 'verdict', '"supreme court"', 'ruling', 'prosecutor', 'trial'],
  institution: ['"United Nations"', '"European Union"', 'IMF', '"World Bank"', 'regulator', 'ministry', 'reform'],
  education: ['university', 'school', 'students', 'education', 'scholarship', 'teachers'],
  welfare: ['hospital', 'vaccine', 'healthcare', 'pension', 'welfare', 'insurance', '"public health"'],
  security: ['military', 'missile', 'ceasefire', 'cyberattack', 'defense', 'terrorism', 'sanctions'],
  strategy: ['strategy', 'alliance', 'diplomacy', 'treaty', 'negotiation', 'geopolitics', 'summit'],
  disaster: ['earthquake', 'typhoon', 'hurricane', 'wildfire', 'flood', 'tsunami', 'eruption'],
};

/** GDELT `sourcelang:` names per UNITAS locale (null = no own-language pass;
 *  the global pass still runs). Unsupported names make GDELT answer with a
 *  plain-text error, which the fold treats as an empty result. */
export const GDELT_SOURCE_LANG: Record<string, string | null> = {
  en: null,
  ko: 'korean',
  et: 'estonian',
  ja: 'japanese',
  zh: 'chinese',
  es: 'spanish',
  km: 'khmer',
  fr: 'french',
  de: 'german',
  pt: 'portuguese',
  vi: 'vietnamese',
  id: 'indonesian',
  ru: 'russian',
  hi: 'hindi',
  it: 'italian',
  tr: 'turkish',
  th: 'thai',
  pl: 'polish',
  nl: 'dutch',
  tl: 'tagalog',
};

/** Google News edition per locale (hl / gl). Locales without an edition
 *  fall back to the international English board. */
export const GOOGLE_NEWS_EDITION: Record<string, { hl: string; gl: string }> = {
  en: { hl: 'en-US', gl: 'US' },
  ko: { hl: 'ko', gl: 'KR' },
  et: { hl: 'en-US', gl: 'US' },
  ja: { hl: 'ja', gl: 'JP' },
  zh: { hl: 'zh-CN', gl: 'CN' },
  es: { hl: 'es', gl: 'ES' },
  km: { hl: 'en-US', gl: 'US' },
  fr: { hl: 'fr', gl: 'FR' },
  de: { hl: 'de', gl: 'DE' },
  pt: { hl: 'pt-BR', gl: 'BR' },
  vi: { hl: 'vi', gl: 'VN' },
  id: { hl: 'id', gl: 'ID' },
  ru: { hl: 'ru', gl: 'RU' },
  hi: { hl: 'hi', gl: 'IN' },
  it: { hl: 'it', gl: 'IT' },
  tr: { hl: 'tr', gl: 'TR' },
  th: { hl: 'th', gl: 'TH' },
  pl: { hl: 'pl', gl: 'PL' },
  nl: { hl: 'nl', gl: 'NL' },
  tl: { hl: 'en-PH', gl: 'PH' },
};

/** Bing News market (cc / setlang) per locale -- the third, independent
 *  keyword wire. Bing has its own edition list; locales without one use the
 *  en-US market. */
export const BING_NEWS_MARKET: Record<string, { cc: string; setlang: string }> = {
  en: { cc: 'US', setlang: 'en-US' },
  ko: { cc: 'KR', setlang: 'ko' },
  et: { cc: 'US', setlang: 'en-US' },
  ja: { cc: 'JP', setlang: 'ja' },
  zh: { cc: 'CN', setlang: 'zh-hans' },
  es: { cc: 'ES', setlang: 'es' },
  km: { cc: 'US', setlang: 'en-US' },
  fr: { cc: 'FR', setlang: 'fr' },
  de: { cc: 'DE', setlang: 'de' },
  pt: { cc: 'BR', setlang: 'pt-br' },
  vi: { cc: 'VN', setlang: 'vi' },
  id: { cc: 'ID', setlang: 'id' },
  ru: { cc: 'RU', setlang: 'ru' },
  hi: { cc: 'IN', setlang: 'hi' },
  it: { cc: 'IT', setlang: 'it' },
  tr: { cc: 'TR', setlang: 'tr' },
  th: { cc: 'TH', setlang: 'th' },
  pl: { cc: 'PL', setlang: 'pl' },
  nl: { cc: 'NL', setlang: 'nl' },
  tl: { cc: 'PH', setlang: 'en-US' },
};

/** Google News topic board per axis where one exists; the rest use the
 *  keyword search feed instead. */
export const GOOGLE_NEWS_TOPIC: Partial<Record<HotNewsCategory, string>> = {
  world: 'WORLD',
  politics: 'NATION',
  economy: 'BUSINESS',
  science: 'SCIENCE',
  technology: 'TECHNOLOGY',
  engineering: 'SCIENCE',
  sports: 'SPORTS',
  culture: 'ENTERTAINMENT',
  art: 'ENTERTAINMENT',
  welfare: 'HEALTH',
};

export function gdeltQuery(axis: HotNewsCategory, sourceLang: string | null): string {
  const terms = AXIS_NEWS_QUERY[axis];
  const group = terms.length > 1 ? `(${terms.join(' OR ')})` : terms[0];
  return sourceLang ? `${group} sourcelang:${sourceLang}` : group;
}

function gdeltStamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`;
}

/** Page N = the 24h window ending N days ago (page 0 = the last 24h). */
export function gdeltWindow(page: number, now = new Date()): { start: string; end: string } {
  const end = new Date(now.getTime() - page * 24 * 60 * 60 * 1000);
  const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
  return { start: gdeltStamp(start), end: gdeltStamp(end) };
}

/**
 * Which single GDELT pass a page gets. Locales with an own-language wire
 * alternate: even pages = own language, odd pages = worldwide, both walking
 * the same 24h window every two pages; English (no own-language pass) walks
 * one worldwide window per page.
 */
export function gdeltPlan(locale: string, page: number): { sourceLang: string | null; window: number } {
  const lang = GDELT_SOURCE_LANG[locale] ?? null;
  if (!lang) return { sourceLang: null, window: page };
  return page % 2 === 0 ? { sourceLang: lang, window: page / 2 } : { sourceLang: null, window: (page - 1) / 2 };
}

/** Plain-text 429 body GDELT returns when the 5s spacing is violated. */
export function isGdeltRateLimited(status: number, body: string): boolean {
  return status === 429 || /limit requests to one every/i.test(body);
}

export function gdeltUrl(axis: HotNewsCategory, sourceLang: string | null, page: number, now = new Date()): string {
  const { start, end } = gdeltWindow(page, now);
  const params = new URLSearchParams({
    query: gdeltQuery(axis, sourceLang),
    mode: 'ArtList',
    format: 'json',
    maxrecords: '50',
    sort: 'DateDesc',
    startdatetime: start,
    enddatetime: end,
  });
  return `https://api.gdeltproject.org/api/v2/doc/doc?${params.toString()}`;
}

/**
 * Google News feed for one page of one axis. Page 0 = the localized topic
 * board where one exists; otherwise a keyword search on the page's rotated
 * term (axisTerm), so every page pulls a genuinely different slice of the
 * outlet universe -- the endless-paging guarantee that does not depend on
 * GDELT's rate budget.
 */
export function googleNewsUrl(axis: HotNewsCategory, locale: string, page = 0): string {
  const edition = GOOGLE_NEWS_EDITION[locale] ?? GOOGLE_NEWS_EDITION.en;
  const ceid = `${edition.gl}:${edition.hl.split('-')[0]}`;
  const topic = GOOGLE_NEWS_TOPIC[axis];
  const params = new URLSearchParams({ hl: edition.hl, gl: edition.gl, ceid });
  if (page === 0 && topic) {
    return `https://news.google.com/rss/headlines/section/topic/${topic}?${params.toString()}`;
  }
  params.set('q', axisTerm(axis, page));
  return `https://news.google.com/rss/search?${params.toString()}`;
}

/**
 * The worldwide (en-US edition) keyword search for the same axis/page --
 * fetched alongside the locale's own edition on every request. Verified
 * live 2026-09-04: from Vercel's US egress, a non-English edition answers
 * an English keyword search with an empty feed (locally, from a Korean IP,
 * the same URL returns 100 items), so without this leg every non-topic
 * axis would be blank for non-English visitors whenever GDELT is
 * throttled. Null when the locale's edition already *is* en-US.
 */
export function googleNewsGlobalUrl(axis: HotNewsCategory, locale: string, page = 0): string | null {
  const edition = GOOGLE_NEWS_EDITION[locale] ?? GOOGLE_NEWS_EDITION.en;
  if (edition.hl === GOOGLE_NEWS_EDITION.en.hl && edition.gl === GOOGLE_NEWS_EDITION.en.gl) return null;
  const params = new URLSearchParams({ hl: 'en-US', gl: 'US', ceid: 'US:en', q: axisTerm(axis, page) });
  return `https://news.google.com/rss/search?${params.toString()}`;
}

/**
 * The page's keyword for every RSS wire: exactly ONE plain term, rotated
 * per page so each page is a new slice of the outlet universe. Verified
 * live 2026-09-04 from Vercel: Google's non-English editions (ko, th, …)
 * answer an `a OR b OR c` query with an empty feed while the single term
 * `court` returns 100 items, and Bing's news RSS ignores OR-groups
 * entirely -- so no keyword wire ever sends an OR-group.
 */
export function axisTerm(axis: HotNewsCategory, page: number): string {
  const terms = AXIS_NEWS_QUERY[axis].map((t) => t.replace(/"/g, ''));
  return terms[page % terms.length];
}

/**
 * Bing News RSS keyword search -- keyless, no documented rate limit,
 * per-market localized, direct article links. Third leg beside GDELT and
 * Google so that a throttle on any one wire (Google intermittently answers
 * datacenter egress with an empty search feed; GDELT enforces 1 req / 5s)
 * never blanks an axis. `global` = the en-US market for non-US locales.
 */
export function bingNewsUrl(axis: HotNewsCategory, locale: string, page = 0, global = false): string | null {
  const market = global ? BING_NEWS_MARKET.en : (BING_NEWS_MARKET[locale] ?? BING_NEWS_MARKET.en);
  if (global && (BING_NEWS_MARKET[locale] ?? BING_NEWS_MARKET.en).setlang === BING_NEWS_MARKET.en.setlang) return null;
  const params = new URLSearchParams({
    q: axisTerm(axis, page),
    format: 'rss',
    cc: market.cc,
    setlang: market.setlang,
    qft: 'sortbydate="1"',
  });
  return `https://www.bing.com/news/search?${params.toString()}`;
}

/** The GDELT ArtList JSON shape (only the parts folded here). */
export interface GdeltArticle {
  url?: string;
  title?: string;
  seendate?: string;
  domain?: string;
  language?: string;
  sourcecountry?: string;
  socialimage?: string;
}

/** "20260904T101500Z" -> ISO 8601. */
export function gdeltDateToIso(seendate: string | undefined): string | undefined {
  if (!seendate) return undefined;
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(seendate);
  if (!m) return undefined;
  return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`;
}

/** Fold a GDELT ArtList payload into live wire items for one axis. Title
 *  language is whatever the outlet wrote in -- the wire does not translate
 *  headlines, it only *matches* across languages. */
export function foldGdelt(articles: GdeltArticle[], axis: HotNewsCategory): HotNewsItem[] {
  const items: HotNewsItem[] = [];
  const seen = new Set<string>();
  for (const a of articles) {
    const title = clipText(stripControl(a.title ?? ''), 160);
    const url = a.url ?? '';
    if (!title || !/^https?:\/\//.test(url)) continue;
    const key = normTitle(title);
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({
      id: `live:gdelt:${key}`,
      title,
      summary: '',
      url,
      category: axis,
      source: 'live',
      thumbnail: a.socialimage || undefined,
      domain: a.domain || undefined,
      publishedAt: gdeltDateToIso(a.seendate),
      lang: a.language || undefined,
    });
  }
  return items;
}

const ENTITY: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
    if (code[0] === '#') {
      const num = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(num) && num > 0 ? String.fromCodePoint(num) : whole;
    }
    return ENTITY[code.toLowerCase()] ?? whole;
  });
}

function stripCdata(s: string): string {
  return s.replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, '$1');
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function tag(block: string, name: string): string {
  const m = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i').exec(block);
  return m ? decodeEntities(stripCdata(m[1]).trim()) : '';
}

export interface RssItem {
  title: string;
  link: string;
  pubDate?: string;
  description?: string;
  sourceName?: string;
  sourceUrl?: string;
}

/** Minimal RSS 2.0 item parser -- regex-driven on purpose (no XML dependency
 *  in the edge bundle; Google's feed is machine-generated and regular). */
export function parseRss(xml: string): RssItem[] {
  const out: RssItem[] = [];
  const re = /<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const block = m[1];
    const title = tag(block, 'title');
    const link = tag(block, 'link') || (/<guid[^>]*>([\s\S]*?)<\/guid>/i.exec(block)?.[1] ?? '').trim();
    if (!title || !link) continue;
    const sourceMatch = /<source(?:\s+url="([^"]*)")?[^>]*>([\s\S]*?)<\/source>/i.exec(block);
    // Bing carries the outlet as <News:Source> instead of RSS <source>.
    const bingSource = tag(block, 'News:Source');
    out.push({
      title,
      link,
      pubDate: tag(block, 'pubDate') || undefined,
      description: tag(block, 'description') || undefined,
      sourceName: sourceMatch ? decodeEntities(stripCdata(sourceMatch[2]).trim()) : bingSource || undefined,
      sourceUrl: sourceMatch?.[1] ? decodeEntities(sourceMatch[1]) : undefined,
    });
  }
  return out;
}

function domainOf(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return undefined;
  }
}

/** Google's titles end in " - Outlet"; the outlet already rides `source`. */
function trimOutletSuffix(title: string, outlet: string | undefined): string {
  if (!outlet) return title;
  const suffix = ` - ${outlet}`;
  return title.endsWith(suffix) ? title.slice(0, -suffix.length).trim() : title;
}

export function foldGoogleNews(
  items: RssItem[],
  axis: HotNewsCategory,
  lang: string,
  wire: 'gnews' | 'bing' = 'gnews',
): HotNewsItem[] {
  const out: HotNewsItem[] = [];
  const seen = new Set<string>();
  for (const it of items) {
    const title = clipText(stripControl(trimOutletSuffix(it.title, it.sourceName)), 160);
    if (!title || !/^https?:\/\//.test(it.link)) continue;
    const key = normTitle(title);
    if (seen.has(key)) continue;
    seen.add(key);
    const description = it.description ? clipText(stripControl(stripTags(decodeEntities(it.description))), MAX_SUMMARY) : '';
    const publishedAt = it.pubDate ? new Date(it.pubDate) : null;
    out.push({
      id: `live:${wire}:${key}`,
      title,
      // Google's description is usually just the headline again -- drop it
      // when it adds nothing over the title.
      summary: description && normTitle(description) !== key && !description.startsWith(title) ? description : '',
      url: it.link,
      category: axis,
      source: 'live',
      domain: domainOf(it.sourceUrl) ?? it.sourceName ?? (wire === 'bing' ? domainOf(it.link) : undefined),
      publishedAt: publishedAt && !Number.isNaN(publishedAt.getTime()) ? publishedAt.toISOString() : undefined,
      lang,
    });
  }
  return out;
}

/**
 * Interleave the own-language wire, the worldwide wire and the mainstream
 * board so no single source dominates the top of the list; de-dupe by
 * title; cap. Items whose text clearly belongs to a sharper axis than the
 * one requested are kept (they matched the axis query) but nothing is
 * re-labelled -- the chip the visitor tapped is the truth of this list.
 */
export function mergeAxisWires(
  local: HotNewsItem[],
  global: HotNewsItem[],
  board: HotNewsItem[],
  cap = AXIS_NEWS_PAGE_CAP,
  extra: HotNewsItem[] = [],
): HotNewsItem[] {
  const seen = new Set<string>();
  const out: HotNewsItem[] = [];
  const max = Math.max(local.length, global.length, board.length, extra.length);
  for (let i = 0; i < max && out.length < cap; i++) {
    for (const list of [local, board, global, extra]) {
      const item = list[i];
      if (!item) continue;
      const key = normTitle(item.title);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(item);
      if (out.length >= cap) break;
    }
  }
  return out;
}

/** Re-check a live item's own text against the classifier so the "전체"
 *  view can still bucket it if it is ever folded back into the base feed. */
export function reclassifyLive(item: HotNewsItem): HotNewsCategory {
  return classifyNews(`${item.title} ${item.summary}`);
}
