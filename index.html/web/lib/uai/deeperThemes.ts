/**
 * REV-21 §3 / SPEC §3.3 + §12.5 -- the "더 깊이 탐색" (Explore Deeper) theme
 * registry: fourteen multi-dimensional lenses on ONE anchored entity, place
 * or country (twelve from the PHASE 1 review + the two omni-tech themes of
 * the founder's v2 directive, Codex ch.22). Every theme:
 *  - takes an anchor, never a search string (§3.1);
 *  - names its real sources from the omni-tech registry (§12.4);
 *  - pages forever through an opaque cursor, global scope before the
 *    selected country (§2A);
 *  - costs 0원: keyless public APIs only, cached on the device.
 *
 * Pure: the adapters live in lib/uai/deeperAdapters/*, the hook in
 * useDeeperPage.ts, the UI in components/home/ExploreDeeper.tsx.
 */
import {
  Atom,
  BookOpenText,
  Boxes,
  Clock3,
  Compass,
  Globe2,
  Image as ImageIcon,
  Landmark,
  Network,
  Newspaper,
  Radar,
  Rocket,
  Waves,
  Workflow,
  type LucideIcon,
} from 'lucide-react';
import type { DeeperAnchor, DeeperAnchorKind } from './deeperAnchor';
import type { SourceId } from './sourceRegistry';
import type { ConstitutionAxis, SurfaceReport } from './types';

export type DeeperThemeKey =
  | 'dataTwin'
  | 'causalHack'
  | 'valueCycle'
  | 'omniWave'
  | 'zeroPoint'
  | 'hologramField'
  | 'evolutionArc'
  | 'ventureSignal'
  | 'marketMoat'
  | 'timeFlux'
  | 'fractalDim'
  | 'chronosGate'
  | 'omniPress'
  | 'terraPulse';

/** SPEC §12.2 host registry -- which surface the block is placed on. */
export type DeeperHost =
  | 'weather'
  | 'hubNews'
  | 'feed'
  | 'rankingDeep'
  | 'globalRankingDetail'
  | 'unitasProfile'
  | 'keywordTier'
  | 'tower'
  | 'uaiPage'
  | 'newsRail';

export interface DeeperTheme {
  key: DeeperThemeKey;
  icon: LucideIcon;
  color: string;
  /** What the anchor must carry for the theme to run at all. */
  needs: DeeperAnchorKind;
  /** Real sources the theme reads (registry ids, in display order). */
  sources: readonly SourceId[];
  /** Device cache TTL. */
  ttlMs: number;
  /** Codex §2 super-constitution numbers the theme is grounded on. */
  constitution: readonly number[];
  /** The 6-axis scores that promote this theme when high (§3.3 reorder:
   *  economy↑ ventureSignal / marketMoat, future↑ evolutionArc / timeFlux,
   *  logic↑ causalHack / dataTwin, art↑ hologramField, sovereign↑
   *  valueCycle, security↑ marketMoat). */
  axes?: readonly ConstitutionAxis[];
  /** Hosts the page for the theme in the visitor's own language only. */
  ownLanguageOnly?: boolean;
}

const H = 60 * 60 * 1000;

export const DEEPER_THEMES: readonly DeeperTheme[] = [
  { key: 'ventureSignal', icon: Rocket, color: '#f97316', needs: 'entity', sources: ['hackerNews'], ttlMs: 1 * H, constitution: [162, 243, 369, 438, 578], axes: ['economy'] },
  { key: 'omniPress', icon: Newspaper, color: '#0ea5e9', needs: 'entity', sources: ['googleNews', 'bingNews'], ttlMs: 15 * 60 * 1000, constitution: [94, 95, 461] },
  { key: 'causalHack', icon: Workflow, color: '#a855f7', needs: 'entity', sources: ['wikidataQuery', 'wikidata'], ttlMs: 24 * H, constitution: [104, 203, 539], axes: ['logic'] },
  { key: 'dataTwin', icon: Boxes, color: '#2563eb', needs: 'entity', sources: ['wikidata'], ttlMs: 24 * H, constitution: [68, 208, 557], axes: ['logic'] },
  { key: 'valueCycle', icon: Network, color: '#10b981', needs: 'entity', sources: ['wikipedia'], ttlMs: 24 * H, constitution: [121, 561, 659], axes: ['sovereign'] },
  { key: 'omniWave', icon: Radar, color: '#06b6d4', needs: 'entity', sources: ['wikimediaPageviews'], ttlMs: 6 * H, constitution: [112, 463, 567] },
  { key: 'evolutionArc', icon: Atom, color: '#8b5cf6', needs: 'entity', sources: ['openAlex', 'crossref'], ttlMs: 24 * H, constitution: [20, 230, 551], axes: ['future'] },
  { key: 'marketMoat', icon: Landmark, color: '#d97706', needs: 'entity', sources: ['wikidataQuery', 'worldBank'], ttlMs: 24 * H, constitution: [129, 162, 315, 435], axes: ['economy', 'security'] },
  { key: 'hologramField', icon: ImageIcon, color: '#ec4899', needs: 'entity', sources: ['wikimediaCommons', 'wikipedia'], ttlMs: 24 * H, constitution: [18, 132, 564], axes: ['art'] },
  { key: 'zeroPoint', icon: BookOpenText, color: '#64748b', needs: 'entity', sources: ['wikidata', 'wiktionary'], ttlMs: 24 * H, constitution: [50, 212, 215, 560] },
  { key: 'fractalDim', icon: Compass, color: '#14b8a6', needs: 'entity', sources: ['wikipedia'], ttlMs: 24 * H, constitution: [131, 533, 726] },
  { key: 'chronosGate', icon: Clock3, color: '#eab308', needs: 'entity', sources: ['wikipedia'], ttlMs: 6 * H, constitution: [84, 136, 241] },
  { key: 'timeFlux', icon: Waves, color: '#3b82f6', needs: 'place', sources: ['openMeteo'], ttlMs: 24 * H, constitution: [4, 66, 136, 227], axes: ['future'] },
  { key: 'terraPulse', icon: Globe2, color: '#ef4444', needs: 'place', sources: ['nasaEonet', 'usgs', 'openMeteo', 'noaaNws'], ttlMs: 10 * 60 * 1000, constitution: [213] },
];

const BY_KEY = new Map<DeeperThemeKey, DeeperTheme>(DEEPER_THEMES.map((t) => [t.key, t]));

export function deeperTheme(key: DeeperThemeKey): DeeperTheme {
  return BY_KEY.get(key)!;
}

export function isDeeperThemeKey(value: unknown): value is DeeperThemeKey {
  return typeof value === 'string' && BY_KEY.has(value as DeeperThemeKey);
}

/** SPEC §12.5 host default orders. Place hosts lead with the place themes;
 *  entity hosts lead with the market / press signals. */
const ENTITY_ORDER: readonly DeeperThemeKey[] = [
  'ventureSignal',
  'omniPress',
  'causalHack',
  'dataTwin',
  'valueCycle',
  'omniWave',
  'evolutionArc',
  'marketMoat',
  'hologramField',
  'zeroPoint',
  'fractalDim',
  'chronosGate',
];
const PLACE_ORDER: readonly DeeperThemeKey[] = [
  'timeFlux',
  'terraPulse',
  'omniWave',
  'hologramField',
  'marketMoat',
  'dataTwin',
  'valueCycle',
  'evolutionArc',
  'omniPress',
  'causalHack',
  'zeroPoint',
  'fractalDim',
  'chronosGate',
  'ventureSignal',
];

/** D-16: how many theme tiles a host shows before the '+N' chip. */
export const DEEPER_MAX_THEMES_DESKTOP = 8;
export const DEEPER_MAX_THEMES_MOBILE = 6;
export const DEEPER_MAX_THEMES_COMPACT = 4;

function anchorHas(anchor: DeeperAnchor, need: DeeperAnchorKind): boolean {
  if (need === 'entity') return Boolean(anchor.qid);
  if (need === 'place') return Boolean(anchor.coord);
  if (need === 'country') return Boolean(anchor.countryCode);
  return true;
}

/**
 * The themes a host offers for an anchor, in display order: the host's
 * default order, filtered to what the anchor can feed, then re-ranked by
 * the visitor's 6-axis surface report when one is at hand (economy↑ lifts
 * ventureSignal / marketMoat, future↑ evolutionArc / timeFlux, ...). A
 * disambiguated or anchor-less subject offers no themes (sources only).
 */
export function themesFor(host: DeeperHost, anchor: DeeperAnchor | null, report?: Pick<SurfaceReport, 'constitution'> | null): DeeperTheme[] {
  if (!anchor || anchor.disambiguation) return [];
  const order = anchor.kind === 'place' || host === 'weather' ? PLACE_ORDER : ENTITY_ORDER;
  const list = order.map((k) => deeperTheme(k)).filter((t) => anchorHas(anchor, t.needs));
  if (!report || report.constitution.length === 0) return list;
  const top = report.constitution.slice().sort((a, b) => b.score - a.score)[0];
  if (!top || top.score < 60) return list;
  // Stable partition: themes on the leading axis float up, order preserved.
  const lifted = list.filter((t) => t.axes?.includes(top.axis));
  const rest = list.filter((t) => !lifted.includes(t));
  return [...lifted, ...rest];
}

/* ------------------------------------------------------------------ */
/* Page contract (the adapters' output, DiscoverySlot-shaped)           */
/* ------------------------------------------------------------------ */

export type DeeperScope = 'global' | 'country';

/** Opaque continuation an adapter understands on its own next call;
 *  `null` = no further page. Serializable (localStorage). */
export type DeeperCursor = Record<string, string | number | boolean> | null;

export interface DeeperFact {
  /** `Rev21.deeper.themes.<key>.<field>` suffix (f1..f6) OR a literal when
   *  `literal` is true (property labels already come localized). */
  label: string;
  literal?: boolean;
  value: string;
  unit?: string;
  emphasis?: boolean;
}

export interface DeeperItem {
  id: string;
  title: string;
  meta?: string;
  url?: string;
  /** Re-anchor chip (§12.2 rule ③): tapping explores this entity in place. */
  qid?: string;
  lang?: string;
  date?: string;
  sourceId?: SourceId;
}

export interface DeeperImage {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  license?: string;
  author?: string;
  pageUrl: string;
}

export interface DeeperSeries {
  /** Field suffix for the series label. */
  label: string;
  points: number[];
  dates?: string[];
  unit?: string;
}

export type DeeperCardKind = 'facts' | 'list' | 'image' | 'spark' | 'text' | 'chips';

export interface DeeperCard {
  id: string;
  kind: DeeperCardKind;
  scope: DeeperScope;
  /** Field suffix (f1..f6) for the card heading; absent = no heading. */
  field?: string;
  facts?: DeeperFact[];
  items?: DeeperItem[];
  image?: DeeperImage;
  series?: DeeperSeries;
  text?: string;
  sourceId: SourceId;
  /** Where the visitor can verify this card (outbound, real name). */
  sourceUrl?: string;
}

export interface DeeperPage {
  cards: DeeperCard[];
  cursor: DeeperCursor;
  fetchedAt: number;
  /** Real sources this page actually read (subset of the theme's). */
  sources: SourceId[];
  /** Set when the upstream answered but had nothing for this anchor. */
  empty?: boolean;
}

export interface DeeperContext {
  locale: string;
  /** Wikipedia language subdomain for the locale. */
  lang: string;
  /** Selected country (ISO 3166-1 alpha-2), REV-21 §2.1. */
  country: string;
  signal?: AbortSignal;
}

export interface DeeperAdapter {
  key: DeeperThemeKey;
  load(anchor: DeeperAnchor, ctx: DeeperContext, cursor?: DeeperCursor): Promise<DeeperPage>;
}

export const EMPTY_DEEPER_PAGE = (sources: SourceId[] = []): DeeperPage => ({ cards: [], cursor: null, fetchedAt: Date.now(), sources, empty: true });

/** Stable cache key for one page of one theme on one anchor. */
export function deeperPageKey(theme: DeeperThemeKey, anchorKey: string, ctx: Pick<DeeperContext, 'locale' | 'country'>, cursor: DeeperCursor): string {
  const c = cursor ? JSON.stringify(cursor, Object.keys(cursor).sort()) : '0';
  return `${theme}|${anchorKey}|${ctx.locale}|${ctx.country}|${c}`;
}
