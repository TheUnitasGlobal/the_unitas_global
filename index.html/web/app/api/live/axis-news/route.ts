import { NextResponse } from 'next/server';
import { routing } from '@/i18n/routing';
import { isHotNewsCategory, type AxisNewsResponse, type HotNewsItem } from '@/lib/live/hotNews';
import {
  AXIS_NEWS_MAX_PAGE,
  GDELT_MIN_INTERVAL_MS,
  bingNewsUrl,
  foldGdelt,
  foldGoogleNews,
  gdeltPlan,
  gdeltUrl,
  googleNewsGlobalUrl,
  googleNewsUrl,
  isGdeltRateLimited,
  mergeAxisWires,
  parseRss,
  type GdeltArticle,
} from '@/lib/live/axisNews';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 15;

const LOCALES = new Set<string>(routing.locales);
const UA = 'UNITAS-AxisNews/1.0 (https://www.theunitas.global; ceo@theunitas.global)';
/** 10 min at the edge: one axis tap per locale per window reaches the
 *  wires; every other visitor in that window is served the cached page. */
const CDN_CACHE = 'public, s-maxage=600, stale-while-revalidate=1800';
const UPSTREAM_TIMEOUT_MS = 12000;

/** Per-function-instance pacing so this instance never violates GDELT's
 *  one-request-per-5s rule on its own (see lib/live/axisNews.ts banner). A
 *  call that would land inside the window waits out the remainder first;
 *  the remaining budget is generous because the other legs run in parallel
 *  and the whole page is edge-cached afterwards. */
let lastGdeltAt = 0;
let gdeltPenaltyUntil = 0;

interface LegStat {
  status: number;
  items: number;
  note?: string;
}

async function fetchGdelt(url: string, signal: AbortSignal, stat: LegStat): Promise<GdeltArticle[]> {
  const now = Date.now();
  if (now < gdeltPenaltyUntil) {
    stat.note = 'penalty';
    return [];
  }
  const wait = lastGdeltAt + GDELT_MIN_INTERVAL_MS - now;
  if (wait > 0) await new Promise<void>((resolve) => setTimeout(resolve, wait));
  if (signal.aborted) return [];
  lastGdeltAt = Date.now();
  try {
    const res = await fetch(url, {
      signal,
      headers: { accept: 'application/json', 'user-agent': UA },
      cache: 'no-store',
    });
    stat.status = res.status;
    // GDELT answers query-grammar problems AND rate-limit violations with a
    // plain text body, so a JSON parse failure is just "no articles". A
    // rate-limit hit also parks this instance for a minute so it stops
    // hammering a limiter that is already refusing it.
    const text = await res.text();
    if (isGdeltRateLimited(res.status, text)) {
      gdeltPenaltyUntil = Date.now() + 60_000;
      stat.note = 'rate-limited';
      return [];
    }
    if (!res.ok) return [];
    try {
      const data = JSON.parse(text) as { articles?: GdeltArticle[] };
      return Array.isArray(data.articles) ? data.articles : [];
    } catch {
      stat.note = 'non-json';
      return [];
    }
  } catch (err) {
    stat.note = describeFetchError(err);
    return [];
  }
}

/** "TypeError" alone hides whether the wire refused the connection, reset
 *  it or failed DNS -- surface undici's cause for the debug readout. */
function describeFetchError(err: unknown): string {
  if (!(err instanceof Error)) return 'error';
  const cause = (err as Error & { cause?: { code?: string; message?: string } }).cause;
  return cause?.code ? `${err.name}:${cause.code}` : cause?.message ? `${err.name}:${cause.message.slice(0, 60)}` : err.name;
}

async function fetchRss(url: string | null, signal: AbortSignal, stat: LegStat): Promise<string> {
  if (!url) {
    stat.note = 'skipped';
    return '';
  }
  try {
    const res = await fetch(url, {
      signal,
      headers: { accept: 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8', 'user-agent': UA },
      cache: 'no-store',
    });
    stat.status = res.status;
    if (!res.ok) return '';
    const text = await res.text();
    if (!/<item[\s>]/i.test(text)) stat.note = `no-items:${(res.headers.get('content-type') ?? '').split(';')[0]}`;
    return text;
  } catch (err) {
    stat.note = describeFetchError(err);
    return '';
  }
}

/**
 * GET /api/live/axis-news?locale=ko&axis=economy&page=0[&debug=1]
 *
 * One page of the worldwide live wire for one of the 21 news axes (the 16
 * founder management axes fused with the world categories -- see
 * lib/live/hotNews.ts). Keyless, 0원 sources racing under one 12s budget:
 * a single GDELT DOC 2.0 pass (own-language on even pages, worldwide on
 * odd pages, each walking back one 24h window every two pages --
 * gdeltPlan), the locale's Google News board/keyword search, the en-US
 * Google keyword search, and Bing News for the locale's market plus the
 * en-US market. Every keyword wire pulls a different term per page, so
 * paging is endless and no single throttled upstream can blank an axis.
 * Merged round-robin so the visitor's own language leads but never
 * monopolises the list. CDN-cached 10 min per (locale, axis, page).
 * Fail-open: any leg that errors, rate-limits or times out contributes
 * nothing. `debug=1` appends per-leg status counts (no-store) for ops.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const localeParam = searchParams.get('locale') ?? routing.defaultLocale;
  const locale = LOCALES.has(localeParam) ? localeParam : routing.defaultLocale;
  const axisParam = searchParams.get('axis') ?? '';
  const pageRaw = Number(searchParams.get('page') ?? '0');
  const page = Number.isInteger(pageRaw) && pageRaw >= 0 ? Math.min(pageRaw, AXIS_NEWS_MAX_PAGE) : 0;
  const debug = searchParams.get('debug') === '1';

  if (!isHotNewsCategory(axisParam)) {
    const bad: AxisNewsResponse = { ok: false, locale, axis: 'world', page, items: [], hasMore: false, fetchedAt: Date.now() };
    return NextResponse.json(bad, { status: 400, headers: { 'cache-control': 'no-store' } });
  }
  const axis = axisParam;
  const plan = gdeltPlan(locale, page);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  const now = new Date();
  const stats: Record<string, LegStat> = {
    gdelt: { status: 0, items: 0 },
    google: { status: 0, items: 0 },
    googleGlobal: { status: 0, items: 0 },
    bing: { status: 0, items: 0 },
    bingGlobal: { status: 0, items: 0 },
  };

  let items: HotNewsItem[] = [];
  try {
    const [articles, boardXml, globalXml, bingXml, bingGlobalXml] = await Promise.all([
      fetchGdelt(gdeltUrl(axis, plan.sourceLang, plan.window, now), controller.signal, stats.gdelt),
      fetchRss(googleNewsUrl(axis, locale, page), controller.signal, stats.google),
      fetchRss(googleNewsGlobalUrl(axis, locale, page), controller.signal, stats.googleGlobal),
      fetchRss(bingNewsUrl(axis, locale, page), controller.signal, stats.bing),
      fetchRss(bingNewsUrl(axis, locale, page, true), controller.signal, stats.bingGlobal),
    ]);
    const wire = foldGdelt(articles, axis);
    const board = boardXml ? foldGoogleNews(parseRss(boardXml), axis, locale) : [];
    const worldwide = globalXml ? foldGoogleNews(parseRss(globalXml), axis, 'en') : [];
    const bing = bingXml ? foldGoogleNews(parseRss(bingXml), axis, locale, 'bing') : [];
    const bingGlobal = bingGlobalXml ? foldGoogleNews(parseRss(bingGlobalXml), axis, 'en', 'bing') : [];
    stats.gdelt.items = wire.length;
    stats.google.items = board.length;
    stats.googleGlobal.items = worldwide.length;
    stats.bing.items = bing.length;
    stats.bingGlobal.items = bingGlobal.length;
    // Own-language legs lead (GDELT sourcelang pass on even pages, the
    // locale's own Google edition and Bing market), the worldwide legs
    // follow.
    items = plan.sourceLang
      ? mergeAxisWires(wire, [...worldwide, ...bingGlobal], board, undefined, bing)
      : mergeAxisWires([], [...wire, ...worldwide, ...bingGlobal], board, undefined, bing);
  } finally {
    clearTimeout(timer);
  }

  const body: AxisNewsResponse & { legs?: Record<string, LegStat> } = {
    ok: items.length > 0,
    locale,
    axis,
    page,
    items,
    hasMore: page < AXIS_NEWS_MAX_PAGE,
    fetchedAt: Date.now(),
    ...(debug ? { legs: stats } : {}),
  };
  return NextResponse.json(body, {
    headers: { 'cache-control': items.length > 0 && !debug ? CDN_CACHE : 'no-store' },
  });
}
