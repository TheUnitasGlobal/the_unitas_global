import { NextResponse } from 'next/server';
import { routing } from '@/i18n/routing';
import { WIKI_LANG } from '@/lib/uai/webSynthesisCore';
import { foldFeed, ymd, type FeaturedFeed, type HotNewsItem, type HotNewsResponse } from '@/lib/live/hotNews';

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

/**
 * GET /api/live/hot-news?locale=ko
 *
 * Category-wise real-time hot-issue news with 1–2 line summaries for the
 * search bar's 핫이슈 tab (owner instruction 2026-09-03). Source: the
 * Wikimedia Foundation's keyless "featured feed" -- the day's "In the news"
 * stories (each already a one-paragraph neutral summary with links to the
 * subject articles) plus the most-read articles as a trending list -- in the
 * visitor's own language, falling back to English when the local wiki runs
 * no ITN board. No API key, no provider contract, 0원; CDN-cached 15 min so
 * the upstream sees at most a handful of requests an hour per locale.
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
    // Today's board on the local wiki; if it has no ITN stories, yesterday's;
    // then the English board (many wikis run no "In the news" section at all).
    const attempts: Array<[string, Date]> = [
      [lang, today],
      [lang, yesterday],
      ...(lang !== 'en' ? ([['en', today], ['en', yesterday]] as Array<[string, Date]>) : []),
    ];
    for (const [tryLang, tryDate] of attempts) {
      const feed = await fetchFeed(tryLang, tryDate, controller.signal);
      if (!feed) continue;
      const folded = foldFeed(feed, tryLang);
      const hasNews = folded.some((i) => i.source === 'itn');
      if (hasNews || (tryLang === 'en' && folded.length > 0)) {
        items = folded;
        usedLang = tryLang;
        usedDate = ymd(tryDate).iso;
        break;
      }
      // Keep a trending-only local board as a floor while we look for news.
      if (items.length === 0 && folded.length > 0) {
        items = folded;
        usedLang = tryLang;
        usedDate = ymd(tryDate).iso;
      }
    }
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
