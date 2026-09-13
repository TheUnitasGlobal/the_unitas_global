/**
 * The infinity stream's card contract. A page is a list of cards; every card
 * names its kind, its scope (worldwide / your country), the REAL source it
 * came from and, where the visitor can act, the follow-up it offers. Pure
 * types + the page recipe table.
 *
 * REV-23 M2.2 -- THE DIET (founder directive 2026-09-13). REV-21 grew this
 * to 27 content kinds. The founder's verdict: the result popup had become a
 * dashboard nobody reads. Eleven kinds survive, and they are the eleven the
 * founder named:
 *
 *   sources    웹 실시간 종합      concepts   연결된 개념
 *   deeper     다른 곳에서 탐색     sites      관련 사이트
 *   derived    파생 저작           attention  관심의 파동
 *   community  커뮤니티            graph      관계망
 *   global     세계 각 판          news       뉴스
 *   extracts   본문 발췌
 *
 * Deleted outright, code and copy: essence (the free/paid reporter switch,
 * the 3-second dimensional lens, the commercial-bias shield, the 3-step
 * action checklist and swarm cross-reasoning all lived on that one card),
 * axisSpectrum, chain, deepGate (deep insight / The VOID), identity,
 * redesign, cogs, timeline, visual, papers, backlinks, siblings, shelf, art,
 * number, earthEvents. Their adapters, their i18n keys and the props that
 * carried them are gone with them -- not orphaned behind a flag.
 */
import type { SourceId } from '../sourceRegistry';

/** The eleven content kinds (§M2.2) plus the four status kinds. */
export type StreamCardKind =
  | 'sources'
  | 'deeper'
  | 'concepts'
  | 'sites'
  | 'news'
  | 'derived'
  | 'attention'
  | 'community'
  | 'graph'
  | 'global'
  | 'extracts'
  // status kinds
  | 'disambiguation'
  | 'retry'
  | 'teaser'
  | 'end';

/** Every content kind the stream can render (status kinds excluded). */
export const CONTENT_KINDS: readonly StreamCardKind[] = [
  'sources',
  'deeper',
  'concepts',
  'sites',
  'news',
  'derived',
  'attention',
  'community',
  'graph',
  'global',
  'extracts',
];

export type StreamScope = 'global' | 'country';

export interface StreamItem {
  id: string;
  title: string;
  meta?: string;
  url?: string;
  /** Follow-up: re-run the stream on this term (with its entity). */
  query?: string;
  qid?: string;
  sourceId?: SourceId;
  date?: string;
}

export interface StreamFact {
  /** `Rev21.stream.fields.<key>` or a literal (label already localized). */
  label: string;
  literal?: boolean;
  value: string;
  unit?: string;
  emphasis?: boolean;
}

/** One picture a card may show. Kept on the contract because `global` and
 *  `sites` can both carry a thumbnail with its attribution line. */
export interface StreamImage {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  license?: string;
  author?: string;
  pageUrl?: string;
}

export interface StreamCard {
  id: string;
  kind: StreamCardKind;
  page: number;
  scope: StreamScope;
  sourceId?: SourceId;
  sourceUrl?: string;
  /** Free-text body (extract passage, disambiguation hint, ...). */
  text?: string;
  facts?: StreamFact[];
  items?: StreamItem[];
  series?: { points: number[]; dates?: string[]; unit?: string };
  images?: StreamImage[];
  /** Which kinds the next page will bring (teaser card). */
  next?: StreamCardKind[];
}

export interface StreamPage {
  page: number;
  cards: StreamCard[];
  /** True when every network leg of the page came back empty. */
  thin: boolean;
  fetchedAt: number;
}

/**
 * How many Wikimedia-family requests each kind costs. The family is
 * wikipedia / wikidata / commons / wmcloud pageviews / query.wikidata --
 * `deeperFetch` serializes them at `WIKIMEDIA_SPACING_MS`, so this is a
 * latency budget, not a politeness one.
 */
export const WIKIMEDIA_LEG_COST: Partial<Record<StreamCardKind, number>> = {
  concepts: 1,
  sites: 1,
  attention: 1,
  graph: 1,
  extracts: 1,
  global: 1,
};

/** Sum of the Wikimedia-family cost of a recipe. */
export function wikimediaCost(kinds: readonly StreamCardKind[]): number {
  return kinds.reduce((sum, k) => sum + (WIKIMEDIA_LEG_COST[k] ?? 0), 0);
}

/** The per-page ceiling that `wikimediaCost` must never exceed. */
export const WIKIMEDIA_PAGE_BUDGET = 2;

/** Hard cap on pages per query. */
export const STREAM_PAGE_CAP = 60;
/** Soft pause every N pages -- '계속 탐색' must be tapped. */
export const STREAM_SOFT_PAUSE_EVERY = 10;
/** The Explore Deeper card is re-injected every N pages. */
export const STREAM_DEEPER_EVERY = 6;
/** DOM budget: pages kept mounted (older pages become ghost placeholders). */
export const STREAM_DOM_PAGES = 12;

/**
 * The kinds page N carries before the Explore Deeper cadence is applied.
 * Every pair is chosen so `wikimediaCost` stays within
 * `WIKIMEDIA_PAGE_BUDGET` -- see the unit test, which asserts it for every
 * page up to the cap rather than trusting this table by eye.
 */
const PAGE_CYCLE: readonly (readonly StreamCardKind[])[] = [
  ['sites', 'derived'],
  ['news', 'attention'],
  ['community', 'concepts'],
  ['extracts', 'graph'],
  ['global', 'news'],
  ['derived', 'community'],
  ['sites', 'attention'],
  ['news', 'extracts'],
  ['concepts', 'global'],
  ['community', 'derived'],
];

function basePageKinds(page: number): StreamCardKind[] {
  if (page === 1) return ['concepts', 'sites'];
  if (page === 2) return ['news', 'derived'];
  if (page === 3) return ['attention', 'community'];
  if (page === 4) return ['graph', 'extracts'];
  if (page === 5) return ['global', 'news'];
  return [...PAGE_CYCLE[(page - 6) % PAGE_CYCLE.length]];
}

/**
 * Which content kinds page N carries. Page 0 costs no network at all: it is
 * the web synthesis ("웹 실시간 종합") rendered straight from the surface
 * report, and nothing else -- the four cards that used to crowd in beside it
 * are deleted (§M2.2).
 */
export function streamRecipe(page: number): StreamCardKind[] {
  if (page === 0) return ['sources'];
  const kinds = basePageKinds(page);
  if (page % STREAM_DEEPER_EVERY === 0 && !kinds.includes('deeper')) kinds.push('deeper');
  // Page 1 always carries the Explore Deeper block: it is the founder's
  // "다른 곳에서 탐색", now the single outbound surface in the whole result.
  if (page === 1) kinds.push('deeper');
  return kinds;
}

/** Which kinds are network-free (rendered from the surface report). */
export const LOCAL_KINDS = new Set<StreamCardKind>([
  'sources',
  'deeper',
  'teaser',
  'end',
  'retry',
  'disambiguation',
]);
