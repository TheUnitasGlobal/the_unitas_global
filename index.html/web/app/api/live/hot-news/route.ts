import { NextResponse } from 'next/server';
import { routing } from '@/i18n/routing';
import { WIKI_LANG } from '@/lib/uai/webSynthesisCore';
import { foldFeed, mergeNewsFeeds, ymd, type FeaturedFeed, type HotNewsItem, type HotNewsResponse } from '@/lib/live/hotNews';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 15;

const LOCALES = new Set<string>(routing.locales);
const UA = 'UNITAS-HotNews/1.0 (https://www.theunitas.global; ceo@theunitas.global)';
const CDN_CACHE = 'public, s-maxage=900, stale-while-revalidate=3600';
const UPSTREAM_TIMEOUT_MS = 6000;

async function fetchFeed(lang: string, date: Date, signal: AbortSignal): Promise<FeaturedFeed | null> {
  const { y, m, d } = ymd(date);
  const url = `https://api.wikimedia.org/feed/v1/wikipedia/${lang}/featured/${y}/${m}/${d}`;
  try {
    const res = await fetch(url, {
      signal,
      headers: { accept: 'application/json', 'user-agent': UA, 'Api-User-Agent': UA },
      next: { revalidate: 900 },
    });
    if (!res.ok) return null;
    return (await res.json()) as FeaturedFeed;
  } catch {
    return null;
  }
}

/** First non-null feed across a set of candidate dates, newest first. */
async function fetchFirstAvailable(
  lang: string,
  dates: Date[],
  signal: AbortSignal,
): Promise<{ feed: FeaturedFeed; date: string } | null> {
  for (const date of dates) {
    const feed = await fetchFeed(lang, date, signal);
    if (feed) return { feed, date: ymd(date).iso };
  }
  return null;
}

/**
 * GET /api/live/hot-news?locale=ko
 *
 * Category-wise real-time hot-issue news with 1–2 line summaries for the
 * search bar's 핫이슈 tab (owner instruction 2026-09-03). Source: the
 * Wikimedia Foundation's keyless "featured feed" -- the day's "In the news"
 * stories (each already a one-paragraph neutral summary with links to the
 * subject articles) plus the most-read articles as a trending list.
 *
 * Worldwide coverage (owner instruction 2026-09-04): a locale's own-language
 * ITN board tends to skew toward that country's domestic stories, so every
 * non-English locale ALWAYS merges its local board with the English board's
 * global picks (mergeNewsFeeds, interleaved + de-duped) rather than only
 * falling back to English when the local board is empty -- this is what
 * keeps a Korean, Thai, or Estonian visitor seeing broad international
 * coverage, not just locally-curated news. No API key, no provider contract,
 * 0원; CDN-cached 15 min so the upstream sees at most a handful of requests
 * an hour per locale.
 */

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const localeParam = searchParams.get('locale') ?? routing.defaultLocale;
  const locale = LOCALES.has(localeParam) ? localeParam : routing.defaultLocale;
  const lang = WIKI_LANG[locale] ?? 'en';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  const today = new Date();
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

  let items: HotNewsItem[] = [];
  let usedLang = lang;
  let usedDate = ymd(today).iso;
  try {
    const [localFeed, globalFeed] = await Promise.all([
      fetchFirstAvailable(lang, [today, yesterday], controller.signal),
      lang === 'en' ? Promise.resolve(null) : fetchFirstAvailable('en', [today, yesterday], controller.signal),
    ]);
    const localItems = localFeed ? foldFeed(localFeed.feed, lang) : [];
    const globalItems = globalFeed ? foldFeed(globalFeed.feed, 'en') : [];
    items = lang === 'en' ? localItems : mergeNewsFeeds(localItems, globalItems);

    if (localFeed) usedDate = localFeed.date;
    else if (globalFeed) usedDate = globalFeed.date;
    if (localItems.length === 0 && globalItems.length > 0) usedLang = 'en';
  } finally {
    clearTimeout(timer);
  }

  const body: HotNewsResponse = {
    ok: items.length > 0,
    locale,
    lang: usedLang,
    date: usedDate,
    items,
    fetchedAt: Date.now(),
  };
  return NextResponse.json(body, {
    headers: { 'cache-control': items.length > 0 ? CDN_CACHE : 'no-store' },
  });
}
