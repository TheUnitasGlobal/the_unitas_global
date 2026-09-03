import { stripControl } from '@/lib/uai/webSynthesisCore';

/**
 * Pure shape + fold maths for the 핫이슈 live news list -- shared by the
 * /api/live/hot-news route (server) and HotIssueNewsList (client) so the
 * client never imports a route module.
 */

export type HotNewsCategory =
  | 'politics'
  | 'economy'
  | 'science'
  | 'sports'
  | 'culture'
  | 'disaster'
  | 'conflict'
  | 'health'
  | 'world';

export interface HotNewsItem {
  id: string;
  title: string;
  /** 1–2 line neutral summary (≤ 220 chars). */
  summary: string;
  url: string;
  category: HotNewsCategory;
  /** 'itn' = In the news story, 'trending' = most-read article. */
  source: 'itn' | 'trending';
  thumbnail?: string;
  views?: number;
}

export interface HotNewsResponse {
  ok: boolean;
  locale: string;
  lang: string;
  date: string;
  items: HotNewsItem[];
  fetchedAt: number;
}

export interface FeedArticle {
  title?: string;
  normalizedtitle?: string;
  displaytitle?: string;
  description?: string;
  extract?: string;
  views?: number;
  thumbnail?: { source?: string };
  content_urls?: { desktop?: { page?: string } };
}

/** The Wikimedia featured-feed shape (only the parts folded here). */
export interface FeaturedFeed {
  news?: Array<{ story?: string; links?: FeedArticle[] }>;
  mostread?: { articles?: FeedArticle[] };
}

export const HOT_NEWS_CATEGORIES: HotNewsCategory[] = [
  'world',
  'politics',
  'economy',
  'science',
  'sports',
  'culture',
  'disaster',
  'conflict',
  'health',
];

const MAX_SUMMARY = 220;
const MAX_ITN = 12;
const MAX_TRENDING = 8;

/** Keyword classifier -- deliberately multilingual-light: English stems
 *  cover the en fallback and most loanwords; the CJK/ko/ja/zh/ru/es/fr/de
 *  stems catch the local boards. Anything unmatched is 'world'. */
const CATEGORY_RULES: Array<[HotNewsCategory, RegExp]> = [
  ['sports', /\b(olympic|world cup|championship|tournament|league|grand prix|final|match|football|soccer|tennis|golf|basketball|baseball|cricket|rugby|marathon|medal|f1|nba|nfl|mlb|uefa|fifa)\b|올림픽|월드컵|선수권|리그|축구|야구|농구|테니스|골프|경기|대회|우승|オリンピック|サッカー|野球|選手権|奥运|世界杯|联赛|足球|fútbol|campeonato|championnat|meisterschaft|чемпионат/i],
  ['conflict', /\b(war|missile|strike|troops|military|attack|invasion|ceasefire|offensive|killed|bombing|airstrike|army|rebels|hostage)\b|전쟁|미사일|공습|군|휴전|공격|침공|戦争|攻撃|军事|战争|袭击|guerra|ataque|guerre|attaque|krieg|angriff|война|удар/i],
  ['disaster', /\b(earthquake|hurricane|typhoon|cyclone|flood|wildfire|tsunami|volcano|eruption|landslide|storm|tornado|heatwave|drought|crash|derail|collapse)\b|지진|태풍|홍수|산불|쓰나미|화산|폭우|폭염|추락|붕괴|地震|台風|洪水|噴火|地震|台风|洪水|terremoto|huracán|inundaci|séisme|inondation|erdbeben|землетрясение|наводнение/i],
  ['health', /\b(outbreak|virus|vaccine|pandemic|epidemic|who\b|disease|cholera|ebola|measles|covid|hospital|health)\b|감염|바이러스|백신|질병|보건|의료|ウイルス|ワクチン|感染|病毒|疫苗|疫情|virus|vacuna|vaccin|impfstoff|вирус|вакцин/i],
  ['politics', /\b(election|president|prime minister|parliament|senate|congress|minister|vote|referendum|coalition|cabinet|governor|impeach|legislat|party|chancellor|king|queen|coronation|sworn in|inaugurat)\b|선거|대통령|총리|국회|의회|장관|투표|정당|탄핵|국왕|즉위|왕위|選挙|大統領|首相|国会|議会|国王|即位|选举|总统|首相|议会|国王|即位|elección|presidente|parlamento|élection|président|parlement|wahl|präsident|kanzler|выборы|президент|парламент/i],
  ['economy', /\b(economy|economic|market|stocks?|shares|inflation|interest rate|central bank|fed\b|tariff|trade|gdp|bank|bankrupt|merger|acquisition|ipo|bitcoin|crypto|currency|oil price|recession)\b|경제|증시|주가|금리|물가|중앙은행|관세|무역|은행|파산|인수|합병|비트코인|経済|株価|金利|関税|经济|股市|利率|关税|economía|mercado|inflación|économie|marché|inflation|wirtschaft|börse|экономик|рынок|инфляц/i],
  ['science', /\b(nasa|esa\b|spacex|rocket|launch|orbit|satellite|telescope|asteroid|comet|probe|lander|mars|moon|lunar|discover|physics|nobel|astronom|climate|fusion|quantum|ai\b|artificial intelligence|research|scientists?)\b|우주|발사|로켓|위성|망원경|화성|달 탐사|노벨|과학|기후|양자|인공지능|宇宙|打ち上げ|ロケット|衛星|ノーベル|科学|火箭|卫星|发射|诺贝尔|科学|cohete|satélite|ciencia|fusée|satellite|science|rakete|wissenschaft|ракет|спутник|наук/i],
  ['culture', /\b(film|movie|album|singer|actor|actress|oscar|grammy|emmy|festival|award|box office|novel|author|museum|concert|tour|series|premiere|dies|died|death|funeral)\b|영화|앨범|가수|배우|시상식|축제|소설|작가|박물관|콘서트|별세|사망|映画|アルバム|歌手|俳優|受賞|死去|电影|专辑|歌手|演员|去世|película|cantante|actor|premio|fallece|film|chanteur|acteur|décès|sänger|schauspieler|stirbt|фильм|певец|актёр|умер/i],
];

function classify(text: string): HotNewsCategory {
  for (const [category, re] of CATEGORY_RULES) {
    if (re.test(text)) return category;
  }
  return 'world';
}

function clip(s: string, max: number): string {
  const chars = Array.from(s);
  return chars.length <= max ? s : `${chars.slice(0, max - 1).join('').trimEnd()}…`;
}

export function ymd(d: Date): { y: string; m: string; d: string; iso: string } {
  const y = String(d.getUTCFullYear());
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return { y, m, d: day, iso: `${y}-${m}-${day}` };
}

function articleUrl(lang: string, a: FeedArticle): string {
  const direct = a.content_urls?.desktop?.page;
  if (direct) return direct;
  const title = (a.title ?? a.normalizedtitle ?? '').replace(/ /g, '_');
  return `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title)}`;
}

function articleTitle(a: FeedArticle): string {
  return stripControl(a.normalizedtitle ?? a.displaytitle ?? a.title ?? '');
}

/** Fold one day's featured feed into the category-tagged news list. */
export function foldFeed(feed: FeaturedFeed, lang: string): HotNewsItem[] {
  const items: HotNewsItem[] = [];
  const seen = new Set<string>();

  for (const story of feed.news ?? []) {
    const summary = clip(stripControl(story.story ?? ''), MAX_SUMMARY);
    if (!summary) continue;
    const lead = story.links?.[0];
    const title = lead ? articleTitle(lead) : clip(summary, 60);
    if (!title || seen.has(title)) continue;
    seen.add(title);
    items.push({
      id: `itn:${title}`,
      title,
      summary,
      url: lead ? articleUrl(lang, lead) : `https://${lang}.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(title)}`,
      category: classify(`${title} ${summary} ${lead?.description ?? ''}`),
      source: 'itn',
      thumbnail: lead?.thumbnail?.source,
    });
    if (items.length >= MAX_ITN) break;
  }

  let trending = 0;
  for (const a of feed.mostread?.articles ?? []) {
    const title = articleTitle(a);
    if (!title || seen.has(title)) continue;
    // Housekeeping pages that always top the most-read board carry no news.
    if (/^(Main Page|Special:|Wikipedia:|위키백과:|メインページ|首页|Portada|Accueil|Hauptseite|Заглавная)/i.test(title)) continue;
    seen.add(title);
    const summary = clip(stripControl(a.description ?? a.extract ?? ''), MAX_SUMMARY);
    items.push({
      id: `trend:${title}`,
      title,
      summary,
      url: articleUrl(lang, a),
      category: classify(`${title} ${summary}`),
      source: 'trending',
      thumbnail: a.thumbnail?.source,
      views: a.views,
    });
    trending += 1;
    if (trending >= MAX_TRENDING) break;
  }

  return items;
}

