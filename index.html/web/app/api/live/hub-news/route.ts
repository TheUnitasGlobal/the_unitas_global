import { NextResponse } from 'next/server';
import { routing } from '@/i18n/routing';
import type { HotNewsItem } from '@/lib/live/hotNews';
import { foldGoogleNews, mergeAxisWires, parseRss } from '@/lib/live/axisNews';
import { HUB_THEME_AXIS, hubWireUrls, type HubNewsResponse } from '@/lib/live/hubNews';
import { HUB_MODAL_ITEMS, hubThemeTerm, isHubThemeKey } from '@/lib/live/hubThemes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 10;

const LOCALES = new Set<string>(routing.locales);
const UA = 'UNITAS-LiveHub/1.0 (https://www.theunitas.global; ceo@theunitas.global)';
/** 10 min at the edge per (locale, theme): one visitor per window reaches
 *  the wires, everyone else in it is served the cached page (0원). */
const CDN_CACHE = 'public, s-maxage=600, stale-while-revalidate=1800';
const UPSTREAM_TIMEOUT_MS = 8000;

async function fetchRss(url: string | null, signal: AbortSignal): Promise<string> {
  if (!url) return '';
  try {
    const res = await fetch(url, {
      signal,
      headers: { accept: 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8', 'user-agent': UA },
      cache: 'no-store',
    });
    if (!res.ok) return '';
    return await res.text();
  } catch {
    return '';
  }
}

/**
 * GET /api/live/hub-news?locale=ko&theme=game
 *
 * REV-19 §8: the live hub's theme wire -- one plain own-language term per
 * theme on four keyless RSS legs (locale Google News, en-US Google News,
 * locale Bing News, en-US Bing News) racing under one 8s budget, merged
 * round-robin so the visitor's language leads but never monopolises, capped
 * to the deep modal's list length. Same fail-open posture as axis-news: a
 * leg that errors or times out contributes nothing, and an empty answer is
 * `ok:false` with an empty list rather than an error page.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const localeParam = searchParams.get('locale') ?? routing.defaultLocale;
  const locale = LOCALES.has(localeParam) ? localeParam : routing.defaultLocale;
  const themeParam = searchParams.get('theme');

  if (!isHubThemeKey(themeParam)) {
    const bad: HubNewsResponse = { ok: false, locale, theme: 'game', term: '', items: [], fetchedAt: Date.now() };
    return NextResponse.json(bad, { status: 400, headers: { 'cache-control': 'no-store' } });
  }
  const theme = themeParam;
  const axis = HUB_THEME_AXIS[theme];
  const urls = hubWireUrls(theme, locale);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  let items: HotNewsItem[] = [];
  try {
    const [googleXml, globalXml, bingXml, bingGlobalXml] = await Promise.all([
      fetchRss(urls.google, controller.signal),
      fetchRss(urls.googleGlobal, controller.signal),
      fetchRss(urls.bing, controller.signal),
      fetchRss(urls.bingGlobal, controller.signal),
    ]);
    const own = googleXml ? foldGoogleNews(parseRss(googleXml), axis, locale) : [];
    const worldwide = globalXml ? foldGoogleNews(parseRss(globalXml), axis, 'en') : [];
    const bing = bingXml ? foldGoogleNews(parseRss(bingXml), axis, locale, 'bing') : [];
    const bingGlobal = bingGlobalXml ? foldGoogleNews(parseRss(bingGlobalXml), axis, 'en', 'bing') : [];
    items = mergeAxisWires([own, bing, worldwide, bingGlobal], HUB_MODAL_ITEMS);
  } finally {
    clearTimeout(timer);
  }

  const body: HubNewsResponse = {
    ok: items.length > 0,
    locale,
    theme,
    term: hubThemeTerm(theme, locale),
    items,
    fetchedAt: Date.now(),
  };
  return NextResponse.json(body, {
    headers: { 'cache-control': items.length > 0 ? CDN_CACHE : 'no-store' },
  });
}
