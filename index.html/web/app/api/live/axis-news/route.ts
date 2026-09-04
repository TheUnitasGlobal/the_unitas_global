import { NextResponse } from 'next/server';
import { routing } from '@/i18n/routing';
import { isHotNewsCategory, type AxisNewsResponse, type HotNewsItem } from '@/lib/live/hotNews';
import {
  AXIS_NEWS_MAX_PAGE,
  GDELT_MIN_INTERVAL_MS,
  foldGdelt,
  foldGoogleNews,
  gdeltPlan,
  gdeltUrl,
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
 *  the remaining budget is generous because the Google leg runs in parallel
 *  and the whole page is edge-cached afterwards. */
let lastGdeltAt = 0;
let gdeltPenaltyUntil = 0;

async function fetchGdelt(url: string, signal: AbortSignal): Promise<GdeltArticle[]> {
  const now = Date.now();
  if (now < gdeltPenaltyUntil) return [];
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
    // GDELT answers query-grammar problems AND rate-limit violations with a
    // plain text body, so a JSON parse failure is just "no articles". A
    // rate-limit hit also parks this instance for a minute so it stops
    // hammering a limiter that is already refusing it.
    const text = await res.text();
    if (isGdeltRateLimited(res.status, text)) {
      gdeltPenaltyUntil = Date.now() + 60_000;
      return [];
    }
    if (!res.ok) return [];
    try {
      const data = JSON.parse(text) as { articles?: GdeltArticle[] };
      return Array.isArray(data.articles) ? data.articles : [];
    } catch {
      return [];
    }
  } catch {
    return [];
  }
}

async function fetchGoogleNews(url: string, signal: AbortSignal): Promise<string> {
  try {
    const res = await fetch(url, {
      signal,
      headers: { accept: 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8', 'user-agent': UA },
      next: { revalidate: 600 },
    });
    if (!res.ok) return '';
    return await res.text();
  } catch {
    return '';
  }
}

/**
 * GET /api/live/axis-news?locale=ko&axis=economy&page=0
 *
 * One page of the worldwide live wire for one of the 21 news axes (the 16
 * founder management axes fused with the world categories -- see
 * lib/live/hotNews.ts). Two keyless sources, both 0원, race under one 12s
 * budget: a single GDELT DOC 2.0 pass (own-language on even pages,
 * worldwide on odd pages, each walking back one 24h window every two pages
 * -- gdeltPlan) and a Google News board/keyword search that pulls a
 * different slice of the outlet universe on every page. Merged round-robin
 * so the visitor's own language leads but never monopolises the list.
 * CDN-cached 10 min per (locale, axis, page). Fail-open: any source that
 * errors, rate-limits or times out contributes nothing.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const localeParam = searchParams.get('locale') ?? routing.defaultLocale;
  const locale = LOCALES.has(localeParam) ? localeParam : routing.defaultLocale;
  const axisParam = searchParams.get('axis') ?? '';
  const pageRaw = Number(searchParams.get('page') ?? '0');
  const page = Number.isInteger(pageRaw) && pageRaw >= 0 ? Math.min(pageRaw, AXIS_NEWS_MAX_PAGE) : 0;

  if (!isHotNewsCategory(axisParam)) {
    const bad: AxisNewsResponse = { ok: false, locale, axis: 'world', page, items: [], hasMore: false, fetchedAt: Date.now() };
    return NextResponse.json(bad, { status: 400, headers: { 'cache-control': 'no-store' } });
  }
  const axis = axisParam;
  const plan = gdeltPlan(locale, page);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  const now = new Date();

  let items: HotNewsItem[] = [];
  try {
    const [articles, boardXml] = await Promise.all([
      fetchGdelt(gdeltUrl(axis, plan.sourceLang, plan.window, now), controller.signal),
      fetchGoogleNews(googleNewsUrl(axis, locale, page), controller.signal),
    ]);
    const wire = foldGdelt(articles, axis);
    const board = boardXml ? foldGoogleNews(parseRss(boardXml), axis, locale) : [];
    items = plan.sourceLang ? mergeAxisWires(wire, [], board) : mergeAxisWires([], wire, board);
  } finally {
    clearTimeout(timer);
  }

  const body: AxisNewsResponse = {
    ok: items.length > 0,
    locale,
    axis,
    page,
    items,
    hasMore: page < AXIS_NEWS_MAX_PAGE,
    fetchedAt: Date.now(),
  };
  return NextResponse.json(body, {
    headers: { 'cache-control': items.length > 0 ? CDN_CACHE : 'no-store' },
  });
}
