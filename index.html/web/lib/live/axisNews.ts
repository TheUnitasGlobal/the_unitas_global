import { classifyNews, clipText, normTitle, type HotNewsCategory, type HotNewsItem } from './hotNews';
import { stripControl } from '@/lib/uai/webSynthesisCore';

/**
 * Pure maths for the per-axis live wire (owner instruction 2026-09-04 round
 * 6: "클릭 시 16대 축에 해당하는 방대하고 다양한 글로벌 실시간 정보가
 * 끊임없이 호출"). Isomorphic + fetch-free so the route stays thin and this
 * folds under vitest. Two keyless, 0원 RSS wires, four legs:
 *
 * - Google News RSS: per-edition topic boards (localized by hl/gl/ceid) and
 *   keyword search for the locale's own edition, plus the en-US edition as
 *   the worldwide leg. Search pages past the first term cycle carry an
 *   `after:`/`before:` week window so the archive walk stays endless.
 * - Bing News RSS: the locale's market plus the en-US market -- no
 *   documented rate limit, direct article links, `News:Source` outlet.
 *
 * GDELT was removed on 2026-09-04 (owner instruction): its one-request-per-
 * 5s-per-IP limiter kept parking Vercel's shared egress in a penalty box, so
 * the leg mostly contributed a 5s pacing wait and nothing else -- a
 * Micro-Burn violation. Every remaining wire is stateless and parallel.
 *
 * Fail-open everywhere: a source that errors, times out or rejects a query
 * simply contributes nothing; the route still answers with what it got.
 */

export const AXIS_NEWS_MAX_PAGE = 13;
export const AXIS_NEWS_PAGE_CAP = 40;
const MAX_SUMMARY = 200;
const DAY_MS = 24 * 60 * 60 * 1000;
/** Width of one archive window (days) for search pages past the first cycle. */
export const AXIS_NEWS_WINDOW_DAYS = 7;
/** The first window starts this many days back so it barely overlaps the
 *  freshest (unwindowed) cycle. */
const AXIS_NEWS_WINDOW_LAG_DAYS = 3;

/** English keyword groups per axis -- one term per page is sent to every RSS
 *  wire (Google's non-English editions answer OR-groups with an empty feed,
 *  Bing ignores them), so the list length is the length of one paging
 *  cycle. Quotes are stripped before use. */
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

/** Bing News market (cc / setlang) per locale -- the second, independent
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

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Archive window for a search page. The first cycle through an axis's terms
 * (page < term count) is unwindowed -- the freshest coverage. Every later
 * cycle walks one AXIS_NEWS_WINDOW_DAYS-wide window further back, so the
 * same term on cycle 2 pulls a different week of the outlet universe than
 * it did on cycle 1. Null for the first cycle.
 */
export function axisWindow(axis: HotNewsCategory, page: number, now = new Date()): { after: string; before: string } | null {
  const cycle = Math.floor(page / AXIS_NEWS_QUERY[axis].length);
  if (cycle <= 0) return null;
  const before = new Date(now.getTime() - (AXIS_NEWS_WINDOW_LAG_DAYS + (cycle - 1) * AXIS_NEWS_WINDOW_DAYS) * DAY_MS);
  const after = new Date(before.getTime() - AXIS_NEWS_WINDOW_DAYS * DAY_MS);
  return { after: isoDay(after), before: isoDay(before) };
}

/** Google search query for a page: the rotated term plus, past the first
 *  cycle, Google News' `after:`/`before:` day operators. */
export function googleSearchQuery(axis: HotNewsCategory, page: number, now = new Date()): string {
  const term = axisTerm(axis, page);
  const window = axisWindow(axis, page, now);
  return window ? `${term} after:${window.after} before:${window.before}` : term;
}

/**
 * Google News feed for one page of one axis. Page 0 = the localized topic
 * board where one exists; otherwise a keyword search on the page's rotated
 * term (and archive window), so every page pulls a genuinely different
 * slice of the outlet universe -- the endless-paging guarantee.
 */
export function googleNewsUrl(axis: HotNewsCategory, locale: string, page = 0, now = new Date()): string {
  const edition = GOOGLE_NEWS_EDITION[locale] ?? GOOGLE_NEWS_EDITION.en;
  const ceid = `${edition.gl}:${edition.hl.split('-')[0]}`;
  const topic = GOOGLE_NEWS_TOPIC[axis];
  const params = new URLSearchParams({ hl: edition.hl, gl: edition.gl, ceid });
  if (page === 0 && topic) {
    return `https://news.google.com/rss/headlines/section/topic/${topic}?${params.toString()}`;
  }
  params.set('q', googleSearchQuery(axis, page, now));
  return `https://news.google.com/rss/search?${params.toString()}`;
}

/**
 * The worldwide (en-US edition) keyword search for the same axis/page --
 * fetched alongside the locale's own edition on every request. Verified
 * live 2026-09-04: from Vercel's US egress, a non-English edition answers
 * an English keyword search with an empty feed (locally, from a Korean IP,
 * the same URL returns 100 items), so without this leg every non-topic
 * axis would be blank for non-English visitors. Null when the locale's
 * edition already *is* en-US.
 */
export function googleNewsGlobalUrl(axis: HotNewsCategory, locale: string, page = 0, now = new Date()): string | null {
  const edition = GOOGLE_NEWS_EDITION[locale] ?? GOOGLE_NEWS_EDITION.en;
  if (edition.hl === GOOGLE_NEWS_EDITION.en.hl && edition.gl === GOOGLE_NEWS_EDITION.en.gl) return null;
  const params = new URLSearchParams({ hl: 'en-US', gl: 'US', ceid: 'US:en', q: googleSearchQuery(axis, page, now) });
  return `https://news.google.com/rss/search?${params.toString()}`;
}

/**
 * Bing News RSS keyword search -- keyless, no documented rate limit,
 * per-market localized, direct article links. Independent of Google so a
 * throttle on either wire (Google intermittently answers datacenter egress
 * with an empty search feed) never blanks an axis. `global` = the en-US
 * market for non-US locales.
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
 *  in the edge bundle; both feeds are machine-generated and regular). */
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
 * Interleave the wires round-robin in the order given (own-language legs
 * first, worldwide legs after) so no single source dominates the top of
 * the list; de-dupe by title; cap. Items whose text clearly belongs to a
 * sharper axis than the one requested are kept (they matched the axis
 * query) but nothing is re-labelled -- the chip the visitor tapped is the
 * truth of this list.
 */
export function mergeAxisWires(wires: HotNewsItem[][], cap = AXIS_NEWS_PAGE_CAP): HotNewsItem[] {
  const seen = new Set<string>();
  const out: HotNewsItem[] = [];
  const max = wires.reduce((m, list) => Math.max(m, list.length), 0);
  for (let i = 0; i < max && out.length < cap; i++) {
    for (const list of wires) {
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
