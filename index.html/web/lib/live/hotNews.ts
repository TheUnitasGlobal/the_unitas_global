import { stripControl } from '@/lib/uai/webSynthesisCore';

/**
 * Pure shape + fold maths for the 실시간 뉴스 live list -- shared by the
 * /api/live/hot-news + /api/live/axis-news routes (server) and
 * HotIssueNewsList (client) so the client never imports a route module.
 */

/**
 * The news filter axes (owner instruction 2026-09-04 round 6): the original
 * 9 world categories fused with the founder's 16 "지성 문명 및 사회 거버넌스"
 * management axes (CLAUDE.md §3.3: 언어·문화·사회·구조·예술·표현·실용·경제·
 * 공학·기술·법·제도·교육·복지·안보·전략). Overlapping meanings were absorbed
 * rather than duplicated: `culture`/`economy` already existed, `health`
 * folded into `welfare` (복지·보건) and `conflict` into `security` (안보·분쟁).
 * Order here is the carousel order under the pinned "전체" chip.
 */
export type HotNewsCategory =
  | 'world'
  | 'politics'
  | 'economy'
  | 'science'
  | 'technology'
  | 'engineering'
  | 'sports'
  | 'culture'
  | 'art'
  | 'expression'
  | 'language'
  | 'society'
  | 'structure'
  | 'pragma'
  | 'law'
  | 'institution'
  | 'education'
  | 'welfare'
  | 'security'
  | 'strategy'
  | 'disaster';

export interface HotNewsItem {
  id: string;
  title: string;
  /** 1–2 line neutral summary (≤ 220 chars); may be empty for live wire items. */
  summary: string;
  url: string;
  category: HotNewsCategory;
  /** 'itn' = In the news story, 'trending' = most-read article,
   *  'live' = a live worldwide wire hit (Google News / Bing News RSS)
   *  fetched on demand for one axis. */
  source: 'itn' | 'trending' | 'live';
  thumbnail?: string;
  views?: number;
  /** Publisher domain for live wire items (e.g. "reuters.com"). */
  domain?: string;
  /** ISO timestamp the wire first saw the story (live items only). */
  publishedAt?: string;
  /** Source language label as reported by the wire (live items only). */
  lang?: string;
}

export interface HotNewsResponse {
  ok: boolean;
  locale: string;
  lang: string;
  date: string;
  items: HotNewsItem[];
  fetchedAt: number;
}

/** GET /api/live/axis-news response -- one page of one axis's live wire. */
export interface AxisNewsResponse {
  ok: boolean;
  locale: string;
  axis: HotNewsCategory;
  page: number;
  items: HotNewsItem[];
  /** False once the paging window is exhausted (AXIS_NEWS_MAX_PAGE). */
  hasMore: boolean;
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
  'technology',
  'engineering',
  'sports',
  'culture',
  'art',
  'expression',
  'language',
  'society',
  'structure',
  'pragma',
  'law',
  'institution',
  'education',
  'welfare',
  'security',
  'strategy',
  'disaster',
];

export function isHotNewsCategory(value: string): value is HotNewsCategory {
  return (HOT_NEWS_CATEGORIES as string[]).includes(value);
}

const MAX_SUMMARY = 220;
const MAX_ITN = 12;
const MAX_TRENDING = 8;

/** Keyword classifier -- deliberately multilingual-light: English stems
 *  cover the en fallback and most loanwords; the CJK/ko/ja/zh/ru/es/fr/de
 *  stems catch the local boards. Rule order matters (first match wins), so
 *  the sharper axes come first and the broad ones (society/pragma/world)
 *  last. Anything unmatched is 'world'. */
const CATEGORY_RULES: Array<[HotNewsCategory, RegExp]> = [
  ['sports', /\b(olympic|world cup|championship|tournament|league|grand prix|final|match|football|soccer|tennis|golf|basketball|baseball|cricket|rugby|marathon|medal|f1|nba|nfl|mlb|uefa|fifa)\b|올림픽|월드컵|선수권|리그|축구|야구|농구|테니스|골프|경기|대회|우승|オリンピック|サッカー|野球|選手権|奥运|世界杯|联赛|足球|fútbol|campeonato|championnat|meisterschaft|чемпионат/i],
  ['disaster', /\b(earthquake|hurricane|typhoon|cyclone|flood|wildfire|tsunami|volcano|eruption|landslide|storm|tornado|heatwave|drought|crash|derail|collapse)\b|지진|태풍|홍수|산불|쓰나미|화산|폭우|폭염|추락|붕괴|地震|台風|洪水|噴火|台风|terremoto|huracán|inundaci|séisme|inondation|erdbeben|землетрясение|наводнение/i],
  ['security', /\b(war|missile|strike|troops|military|attack|invasion|ceasefire|offensive|killed|bombing|airstrike|army|rebels|hostage|cyberattack|espionage|terror(ism|ist)?|sanctions|defen[cs]e ministry|nuclear weapon)\b|전쟁|미사일|공습|휴전|공격|침공|안보|국방|테러|사이버 공격|戦争|攻撃|安全保障|军事|战争|袭击|安全|guerra|ataque|guerre|attaque|krieg|angriff|война|удар|безопасност/i],
  ['welfare', /\b(outbreak|virus|vaccine|pandemic|epidemic|who\b|disease|cholera|ebola|measles|covid|hospital|health(care)?|pension|welfare|insurance|aging society|poverty|homeless)\b|감염|바이러스|백신|질병|보건|의료|복지|연금|빈곤|ウイルス|ワクチン|感染|福祉|年金|病毒|疫苗|疫情|福利|养老|vacuna|salud|bienestar|vaccin|santé|impfstoff|gesundheit|wohlfahrt|вирус|вакцин|здравоохранен/i],
  ['law', /\b(court|lawsuit|verdict|supreme court|ruling|prosecutor|trial|indict(ed|ment)?|sentenced|judge|appeal|convicted|acquitted|constitution(al)?|antitrust)\b|법원|재판|판결|소송|검찰|기소|대법원|헌법|裁判|判決|訴訟|検察|法院|判决|诉讼|检察|tribunal|sentencia|demanda|procès|verdict|gericht|urteil|суд|приговор/i],
  ['politics', /\b(election|president|prime minister|parliament|senate|congress|minister|vote|referendum|coalition|cabinet|governor|impeach|legislat|party|chancellor|king|queen|coronation|sworn in|inaugurat)\b|선거|대통령|총리|국회|의회|장관|투표|정당|탄핵|국왕|즉위|왕위|選挙|大統領|首相|国会|議会|国王|即位|选举|总统|议会|elección|presidente|parlamento|élection|président|parlement|wahl|präsident|kanzler|выборы|президент|парламент/i],
  ['economy', /\b(economy|economic|market|stocks?|shares|inflation|interest rate|central bank|fed\b|tariff|trade|gdp|bank|bankrupt|merger|acquisition|ipo|bitcoin|crypto|currency|oil price|recession)\b|경제|증시|주가|금리|물가|중앙은행|관세|무역|은행|파산|인수|합병|비트코인|経済|株価|金利|関税|经济|股市|利率|关税|economía|mercado|inflación|économie|marché|inflation|wirtschaft|börse|экономик|рынок|инфляц/i],
  ['technology', /\b(ai\b|artificial intelligence|chip|semiconductor|smartphone|software|app\b|robot|startup|5g|6g|quantum comput|data cent(er|re)|cloud|chatbot|nvidia|openai|apple|google|microsoft|samsung|tesla|cyber)\b|인공지능|반도체|스마트폰|소프트웨어|로봇|스타트업|양자컴퓨터|데이터센터|人工知能|半導体|ロボット|人工智能|半导体|机器人|inteligencia artificial|semiconductor|robot|intelligence artificielle|künstliche intelligenz|искусственн|робот/i],
  ['engineering', /\b(engineer(ing|s)?|reactor|nuclear plant|bridge|tunnel|dam\b|railway|high-speed rail|shipyard|shipbuilding|aircraft|jet|turbine|factory|manufactur|construction|rocket engine|spacecraft)\b|공학|원전|원자로|교량|터널|철도|고속철|조선소|항공기|제조|건설|工学|原発|原子炉|鉄道|造船|製造|工程|核电|铁路|造船|制造|ingeniería|reactor|ingénierie|ingenieur|инженер|реактор/i],
  ['science', /\b(nasa|esa\b|spacex|rocket|launch|orbit|satellite|telescope|asteroid|comet|probe|lander|mars|moon|lunar|discover|physics|nobel|astronom|climate|fusion|quantum|research|scientists?|fossil|species|genome)\b|우주|발사|로켓|위성|망원경|화성|달 탐사|노벨|과학|기후|양자|宇宙|打ち上げ|ロケット|衛星|ノーベル|科学|火箭|卫星|发射|诺贝尔|cohete|satélite|ciencia|fusée|science|rakete|wissenschaft|ракет|спутник|наук/i],
  ['education', /\b(university|universities|school|students?|teachers?|exam|scholarship|curriculum|tuition|campus|academic|literacy rate|kindergarten|phd)\b|대학|학교|학생|교사|수능|입시|교육|장학|大学|学校|学生|教育|入試|大学|学校|学生|教育|高考|universidad|escuela|estudiantes|université|école|étudiants|universität|schule|schüler|университет|школ|студент/i],
  ['art', /\b(museum|exhibition|painting|sculpture|gallery|auction|artist|opera|ballet|symphony|orchestra|theatre|theater|biennale|architecture|design award|louvre|banksy|picasso)\b|미술관|전시회|전시|회화|조각|갤러리|경매|화가|오페라|발레|교향악|건축|美術館|展覧会|絵画|彫刻|オペラ|美术馆|展览|绘画|雕塑|歌剧|museo|exposición|pintura|musée|exposition|peinture|museum|ausstellung|gemälde|музей|выставк|картин/i],
  ['expression', /\b(journalist|press freedom|censorship|social media|broadcaster|influencer|podcast|free speech|newspaper|tiktok|youtube|instagram|streaming|documentary|media (outlet|group)|reporters)\b|언론|기자|검열|표현의 자유|소셜미디어|방송사|인플루언서|팟캐스트|유튜브|틱톡|ジャーナリスト|報道|検閲|記者|新闻自由|审查|媒体|记者|periodista|censura|prensa|journaliste|censure|presse|journalist|zensur|журналист|цензур|сми/i],
  ['culture', /\b(film|movie|album|singer|actor|actress|oscar|grammy|emmy|festival|award|box office|novel|author|concert|tour|series|premiere|dies|died|death|funeral|heritage|tradition|religion|k-pop|anime)\b|영화|앨범|가수|배우|시상식|축제|소설|작가|콘서트|별세|사망|유산|전통|종교|映画|アルバム|歌手|俳優|受賞|死去|伝統|电影|专辑|歌手|演员|去世|传统|película|cantante|actor|premio|fallece|film|chanteur|acteur|décès|sänger|schauspieler|stirbt|фильм|певец|актёр|умер/i],
  ['language', /\b(language|languages|dialect|translation|translator|linguist(ic|s)?|alphabet|dictionary|word of the year|bilingual|multilingual|endangered language|sign language)\b|언어|방언|번역|사전|한글|어학|言語|方言|翻訳|辞書|语言|方言|翻译|词典|idioma|lengua|traducción|langue|traduction|sprache|übersetzung|язык|перевод/i],
  ['institution', /\b(united nations|un general assembly|security council|european union|eu commission|imf|world bank|oecd|nato|wto|regulator|commission|agency|ministry|reform|institution(al)?|bureaucracy|central committee)\b|유엔|국제연합|유럽연합|규제|위원회|기관|제도|개혁|国連|欧州連合|規制|委員会|制度|改革|联合国|欧盟|监管|委员会|制度|改革|naciones unidas|regulador|reforma|nations unies|régulateur|réforme|vereinte nationen|reform|оон|реформ|регулятор/i],
  ['structure', /\b(infrastructure|urban planning|metro|subway|transit|port\b|power grid|blackout|power outage|supply chain|water supply|housing (crisis|market)|skyscraper|highway|airport expansion|smart city)\b|인프라|도시계획|지하철|교통망|전력망|정전|공급망|상수도|주택|고속도로|공항|インフラ|都市計画|地下鉄|電力網|停電|基础设施|城市规划|地铁|电网|停电|供应链|infraestructura|urbanismo|infrastructure|urbanisme|infrastruktur|stromausfall|инфраструктур|метро|электросет/i],
  ['strategy', /\b(strateg(y|ic)|alliance|diplomacy|diplomatic|treaty|negotiation|geopolit|summit|bilateral|multilateral|détente|deterrence|grand bargain|peace talks)\b|전략|동맹|외교|조약|협상|지정학|정상회담|戦略|同盟|外交|条約|交渉|首脳会談|战略|同盟|外交|条约|谈判|峰会|estrategia|alianza|diplomacia|cumbre|stratégie|alliance|diplomatie|sommet|strategie|allianz|diplomatie|gipfel|стратег|альянс|дипломат|саммит/i],
  ['society', /\b(protest|strike|migration|migrants|refugees|population|census|crime|police|gender|marriage|birth rate|fertility|aging|community|inequality|demonstration|riot|unemployment|youth)\b|시위|파업|이민|난민|인구|범죄|경찰|성평등|결혼|출산율|고령화|공동체|불평등|실업|청년|デモ|移民|難民|人口|犯罪|警察|少子化|高齢化|抗议|移民|难民|人口|犯罪|警察|生育率|老龄化|protesta|huelga|migración|población|manifestation|grève|migration|population|protest|streik|migration|bevölkerung|протест|забастовк|миграц|населен/i],
  ['pragma', /\b(consumer|lifestyle|tourism|tourist|travel|shopping|product recall|recall|gadget|recipe|restaurant|food price|grocery|household|everyday|practical|diy|how to|hack)\b|소비자|라이프스타일|관광|여행|쇼핑|리콜|식품|음식|생활|실용|가전|消費者|観光|旅行|買い物|リコール|食品|生活|消费者|旅游|购物|召回|食品|生活|consumidor|turismo|viaje|consommateur|tourisme|voyage|verbraucher|tourismus|reise|потребител|туризм|путешеств/i],
];

export function classifyNews(text: string): HotNewsCategory {
  for (const [category, re] of CATEGORY_RULES) {
    if (re.test(text)) return category;
  }
  return 'world';
}

export function clipText(s: string, max: number): string {
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
    const summary = clipText(stripControl(story.story ?? ''), MAX_SUMMARY);
    if (!summary) continue;
    const lead = story.links?.[0];
    const title = lead ? articleTitle(lead) : clipText(summary, 60);
    if (!title || seen.has(title)) continue;
    seen.add(title);
    items.push({
      id: `itn:${title}`,
      title,
      summary,
      url: lead ? articleUrl(lang, lead) : `https://${lang}.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(title)}`,
      category: classifyNews(`${title} ${summary} ${lead?.description ?? ''}`),
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
    const summary = clipText(stripControl(a.description ?? a.extract ?? ''), MAX_SUMMARY);
    items.push({
      id: `trend:${title}`,
      title,
      summary,
      url: articleUrl(lang, a),
      category: classifyNews(`${title} ${summary}`),
      source: 'trending',
      thumbnail: a.thumbnail?.source,
      views: a.views,
    });
    trending += 1;
    if (trending >= MAX_TRENDING) break;
  }

  return items;
}

/** Case/whitespace-insensitive identity for de-duping across feeds (same
 *  story picked up by two boards / two wires on a slow news day). */
export function normTitle(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Interleave two already-folded feeds (local-language + English) into one
 * diversified list, ITN stories first then trending, alternating source so
 * neither language dominates the top of the grid. De-dupes by title.
 *
 * This is the fix for single-language editorial bias (owner instruction
 * 2026-09-04: a locale's own-language "In the news" board tends to skew
 * toward that country's domestic stories -- merging in the English board's
 * global ITN picks broadens every locale toward genuinely worldwide
 * coverage, not just a same-language fallback used only when the local
 * board is empty).
 */
export function mergeNewsFeeds(local: HotNewsItem[], global: HotNewsItem[], capTotal = 24): HotNewsItem[] {
  const localItn = local.filter((i) => i.source === 'itn');
  const globalItn = global.filter((i) => i.source === 'itn');
  const localTrend = local.filter((i) => i.source === 'trending');
  const globalTrend = global.filter((i) => i.source === 'trending');

  function interleave(a: HotNewsItem[], b: HotNewsItem[]): HotNewsItem[] {
    const out: HotNewsItem[] = [];
    const max = Math.max(a.length, b.length);
    for (let i = 0; i < max; i++) {
      if (a[i]) out.push(a[i]);
      if (b[i]) out.push(b[i]);
    }
    return out;
  }

  const seen = new Set<string>();
  const merged: HotNewsItem[] = [];
  for (const item of [...interleave(localItn, globalItn), ...interleave(localTrend, globalTrend)]) {
    const key = normTitle(item.title);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
    if (merged.length >= capTotal) break;
  }
  return merged;
}
