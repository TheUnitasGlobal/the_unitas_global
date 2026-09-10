/**
 * REV-19 §8 -- server-side maths for `GET /api/live/hub-news` (the live hub
 * theme wire). Pure: URL builders + the theme -> news-axis label used when
 * folding RSS items into `HotNewsItem`s, so the route file itself stays a
 * thin fetch-race. Shares the locale editions, RSS parser and de-dupe of
 * lib/live/axisNews.ts -- the hub is the same four-leg stateless wire, just
 * keyed on a theme term instead of a news axis.
 */
import { BING_NEWS_MARKET, GOOGLE_NEWS_EDITION } from '@/lib/live/axisNews';
import type { HotNewsCategory, HotNewsItem } from '@/lib/live/hotNews';
import { hubThemeTerm, type HubThemeKey } from '@/lib/live/hubThemes';

/** Nominal news axis each theme's items are labelled with (the classifier
 *  vocabulary of lib/live/hotNews.ts; only used for the category chip). */
export const HUB_THEME_AXIS: Record<HubThemeKey, HotNewsCategory> = {
  game: 'culture',
  sports: 'sports',
  movie: 'culture',
  bestseller: 'culture',
  shopping: 'pragma',
  stock: 'economy',
  webtoon: 'culture',
  fashion: 'pragma',
  food: 'pragma',
};

export interface HubNewsResponse {
  ok: boolean;
  locale: string;
  theme: HubThemeKey;
  term: string;
  items: HotNewsItem[];
  fetchedAt: number;
}

export interface HubWireUrls {
  google: string;
  googleGlobal: string | null;
  bing: string;
  bingGlobal: string | null;
}

/** The four RSS legs for one theme in one locale. Own-language legs use the
 *  locale's term; the worldwide (en-US) legs always use the English term. */
export function hubWireUrls(theme: HubThemeKey, locale: string): HubWireUrls {
  const edition = GOOGLE_NEWS_EDITION[locale] ?? GOOGLE_NEWS_EDITION.en;
  const market = BING_NEWS_MARKET[locale] ?? BING_NEWS_MARKET.en;
  const term = hubThemeTerm(theme, locale);
  const enTerm = hubThemeTerm(theme, 'en');
  const isEn = edition.hl === GOOGLE_NEWS_EDITION.en.hl && edition.gl === GOOGLE_NEWS_EDITION.en.gl;

  const google = `https://news.google.com/rss/search?${new URLSearchParams({
    q: term,
    hl: edition.hl,
    gl: edition.gl,
    ceid: `${edition.gl}:${edition.hl.split('-')[0]}`,
  }).toString()}`;
  const googleGlobal = isEn
    ? null
    : `https://news.google.com/rss/search?${new URLSearchParams({ q: enTerm, hl: 'en-US', gl: 'US', ceid: 'US:en' }).toString()}`;
  const bing = `https://www.bing.com/news/search?${new URLSearchParams({
    q: term,
    format: 'rss',
    cc: market.cc,
    setlang: market.setlang,
    qft: 'sortbydate="1"',
  }).toString()}`;
  const bingGlobal =
    market.setlang === BING_NEWS_MARKET.en.setlang
      ? null
      : `https://www.bing.com/news/search?${new URLSearchParams({
          q: enTerm,
          format: 'rss',
          cc: BING_NEWS_MARKET.en.cc,
          setlang: BING_NEWS_MARKET.en.setlang,
          qft: 'sortbydate="1"',
        }).toString()}`;
  return { google, googleGlobal, bing, bingGlobal };
}
