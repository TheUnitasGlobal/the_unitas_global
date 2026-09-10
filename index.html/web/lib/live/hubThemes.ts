/**
 * REV-19 §8 -- the LIVE HUB's nine rotating discovery themes (game, sports,
 * movie, bestseller, shopping, stock, webtoon, fashion, food) that ride
 * beneath the real-time weather panel, plus the pure helpers the hub, its
 * deep modals and the search-suggestion discovery widgets share:
 *
 *  - `hubThemeTerm(theme, locale)` -- the ONE plain keyword each RSS wire is
 *    asked for (the axis-news lesson holds: Google's non-English editions
 *    answer OR-groups with an empty feed and Bing ignores them), localized
 *    for the locales whose news editions answer own-language terms, English
 *    for the rest.
 *  - `discoveryLinks(subject, locale)` -- keyless outbound "explore more"
 *    links (Wikipedia, Google News, YouTube, Google) any card can expand
 *    into. No API, no cost, new tab.
 *  - `rotateIndex(now, count, periodMs)` -- the deterministic auto-rotation
 *    slot so SSR and CSR agree on the first frame.
 *
 * Icons are lucide components; colours are the theme's accent on both the
 * dark towers and the Quantum White glass.
 */
import {
  BookMarked,
  Clapperboard,
  Gamepad2,
  Shirt,
  ShoppingBag,
  Sticker,
  TrendingUp,
  Trophy,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react';

export type HubThemeKey =
  | 'game'
  | 'sports'
  | 'movie'
  | 'bestseller'
  | 'shopping'
  | 'stock'
  | 'webtoon'
  | 'fashion'
  | 'food';

export interface HubTheme {
  key: HubThemeKey;
  icon: LucideIcon;
  color: string;
  /** Own-language single-term news queries; `en` is the fallback. */
  terms: Record<string, string>;
}

/** Auto-rotation cadence of the theme strip (ms). */
export const HUB_ROTATE_MS = 7000;
/** Refresh cadence of an open deep modal (ms). */
export const HUB_MODAL_REFRESH_MS = 60_000;
/** Headlines shown on the inline theme card. */
export const HUB_CARD_ITEMS = 4;
/** Headlines shown in the deep modal. */
export const HUB_MODAL_ITEMS = 12;

export const HUB_THEMES: readonly HubTheme[] = [
  {
    key: 'game',
    icon: Gamepad2,
    color: '#7c5cff',
    terms: { en: 'video game', ko: '게임', ja: 'ゲーム', zh: '游戏', es: 'videojuego', fr: 'jeu vidéo', de: 'Videospiel', pt: 'videogame', ru: 'видеоигра', it: 'videogioco', tr: 'video oyunu', th: 'เกม', vi: 'trò chơi điện tử', id: 'gim', pl: 'gra wideo', nl: 'videogame', hi: 'वीडियो गेम' },
  },
  {
    key: 'sports',
    icon: Trophy,
    color: '#ff8a3d',
    terms: { en: 'sports', ko: '스포츠', ja: 'スポーツ', zh: '体育', es: 'deportes', fr: 'sport', de: 'Sport', pt: 'esportes', ru: 'спорт', it: 'sport', tr: 'spor', th: 'กีฬา', vi: 'thể thao', id: 'olahraga', pl: 'sport', nl: 'sport', hi: 'खेल' },
  },
  {
    key: 'movie',
    icon: Clapperboard,
    color: '#e0435f',
    terms: { en: 'movie', ko: '영화', ja: '映画', zh: '电影', es: 'película', fr: 'film', de: 'Film', pt: 'filme', ru: 'фильм', it: 'film', tr: 'film', th: 'ภาพยนตร์', vi: 'phim', id: 'film', pl: 'film', nl: 'film', hi: 'फ़िल्म' },
  },
  {
    key: 'bestseller',
    icon: BookMarked,
    color: '#b8962e',
    terms: { en: 'bestseller book', ko: '베스트셀러', ja: 'ベストセラー', zh: '畅销书', es: 'bestseller libro', fr: 'best-seller livre', de: 'Bestseller Buch', pt: 'best-seller livro', ru: 'бестселлер', it: 'bestseller libro', tr: 'çok satan kitap', th: 'หนังสือขายดี', vi: 'sách bán chạy', id: 'buku terlaris', pl: 'bestseller', nl: 'bestseller', hi: 'बेस्टसेलर' },
  },
  {
    key: 'shopping',
    icon: ShoppingBag,
    color: '#00a884',
    terms: { en: 'shopping', ko: '쇼핑', ja: 'ショッピング', zh: '购物', es: 'compras', fr: 'shopping', de: 'Shopping', pt: 'compras', ru: 'шопинг', it: 'shopping', tr: 'alışveriş', th: 'ช้อปปิ้ง', vi: 'mua sắm', id: 'belanja', pl: 'zakupy', nl: 'winkelen', hi: 'शॉपिंग' },
  },
  {
    key: 'stock',
    icon: TrendingUp,
    color: '#0b5cff',
    terms: { en: 'stock market', ko: '주식', ja: '株式', zh: '股市', es: 'bolsa', fr: 'bourse', de: 'Aktien', pt: 'bolsa de valores', ru: 'акции', it: 'borsa', tr: 'borsa', th: 'ตลาดหุ้น', vi: 'chứng khoán', id: 'saham', pl: 'giełda', nl: 'aandelen', hi: 'शेयर बाजार' },
  },
  {
    key: 'webtoon',
    icon: Sticker,
    color: '#19b2c8',
    terms: { en: 'webtoon', ko: '웹툰', ja: 'ウェブトゥーン', zh: '网络漫画', es: 'webtoon', fr: 'webtoon', de: 'Webtoon', pt: 'webtoon', ru: 'вебтун', it: 'webtoon', tr: 'webtoon', th: 'เว็บตูน', vi: 'webtoon', id: 'webtoon', pl: 'webtoon', nl: 'webtoon', hi: 'वेबटून' },
  },
  {
    key: 'fashion',
    icon: Shirt,
    color: '#c94fbf',
    terms: { en: 'fashion', ko: '패션', ja: 'ファッション', zh: '时尚', es: 'moda', fr: 'mode', de: 'Mode', pt: 'moda', ru: 'мода', it: 'moda', tr: 'moda', th: 'แฟชั่น', vi: 'thời trang', id: 'mode', pl: 'moda', nl: 'mode', hi: 'फ़ैशन' },
  },
  {
    key: 'food',
    icon: UtensilsCrossed,
    color: '#e0a33a',
    terms: { en: 'food', ko: '맛집', ja: 'グルメ', zh: '美食', es: 'gastronomía', fr: 'gastronomie', de: 'Essen', pt: 'gastronomia', ru: 'еда', it: 'cibo', tr: 'yemek', th: 'อาหาร', vi: 'ẩm thực', id: 'kuliner', pl: 'jedzenie', nl: 'eten', hi: 'भोजन' },
  },
];

export const HUB_THEME_KEYS: readonly HubThemeKey[] = HUB_THEMES.map((t) => t.key);

export function isHubThemeKey(value: string | null | undefined): value is HubThemeKey {
  return typeof value === 'string' && (HUB_THEME_KEYS as readonly string[]).includes(value);
}

export function findHubTheme(key: HubThemeKey): HubTheme {
  return HUB_THEMES.find((t) => t.key === key) ?? HUB_THEMES[0];
}

/** The single plain news term for a theme in a locale (English fallback). */
export function hubThemeTerm(theme: HubThemeKey, locale: string): string {
  const t = findHubTheme(theme);
  return t.terms[locale] ?? t.terms.en;
}

/** Deterministic auto-rotation slot: the same `now` yields the same index
 *  on server and client, so hydration never disagrees about the first
 *  theme shown. */
export function rotateIndex(now: number, count: number, periodMs = HUB_ROTATE_MS): number {
  if (count <= 0) return 0;
  const slot = Math.floor(Math.max(0, now) / Math.max(1, periodMs));
  return slot % count;
}

export type DiscoveryLinkKind = 'wikipedia' | 'news' | 'youtube' | 'search';

export interface DiscoveryLink {
  kind: DiscoveryLinkKind;
  href: string;
}

/** Wikipedia language subdomain per site locale (`tl` -> Tagalog wiki). */
const WIKI_LANG: Record<string, string> = {
  en: 'en', ko: 'ko', et: 'et', ja: 'ja', zh: 'zh', es: 'es', km: 'km', fr: 'fr', de: 'de', pt: 'pt', vi: 'vi',
  id: 'id', ru: 'ru', hi: 'hi', it: 'it', tr: 'tr', th: 'th', pl: 'pl', nl: 'nl', tl: 'tl',
};

/** Keyless outbound exploration links for any subject (ranking entry,
 *  headline, theme). Every link opens in a new tab; nothing is fetched. */
export function discoveryLinks(subject: string, locale: string): DiscoveryLink[] {
  const q = subject.trim();
  if (!q) return [];
  const lang = WIKI_LANG[locale] ?? 'en';
  const enc = encodeURIComponent(q);
  return [
    { kind: 'wikipedia', href: `https://${lang}.wikipedia.org/w/index.php?search=${enc}` },
    { kind: 'news', href: `https://news.google.com/search?q=${enc}&hl=${encodeURIComponent(lang)}` },
    { kind: 'youtube', href: `https://www.youtube.com/results?search_query=${enc}` },
    { kind: 'search', href: `https://www.google.com/search?q=${enc}&hl=${encodeURIComponent(lang)}` },
  ];
}
