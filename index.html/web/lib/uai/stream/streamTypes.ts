/**
 * REV-21 §5C / SPEC §12.7 -- the infinity stream's card contract. A page
 * is a list of cards; every card names its kind (27 content kinds: the 24
 * of the design plus timeline, number and earthEvents -- stage 1 shipped 16
 * in M8, stage 2 the remaining 11 in M10, D-37), its scope (worldwide / your country),
 * the REAL source it came from and, where the visitor can act, the
 * follow-up it offers. Pure types + the page recipe table.
 */
import type { SourceId } from '../sourceRegistry';
import type { ConstitutionAxis } from '../types';
import type { CogsCard } from './cogsMatrix';

/** Stage 1 (M8, D-37): 16 content kinds + 4 status kinds. Stage 2 (M10)
 *  adds the remaining 11: visual · graph · papers · backlinks · extracts ·
 *  global · siblings · shelf · art · number · earthEvents (§12.7). */
export type StreamCardKind =
  | 'essence'
  | 'axisSpectrum'
  | 'sources'
  | 'chain'
  | 'deepGate'
  | 'identity'
  | 'redesign'
  | 'deeper'
  | 'concepts'
  | 'sites'
  | 'news'
  | 'cogs'
  | 'derived'
  | 'attention'
  | 'community'
  | 'timeline'
  // stage 2 (M10)
  | 'visual'
  | 'graph'
  | 'papers'
  | 'backlinks'
  | 'extracts'
  | 'global'
  | 'siblings'
  | 'shelf'
  | 'art'
  | 'number'
  | 'earthEvents'
  // status kinds
  | 'disambiguation'
  | 'retry'
  | 'teaser'
  | 'end';

export const STAGE1_KINDS: readonly StreamCardKind[] = [
  'essence',
  'axisSpectrum',
  'sources',
  'chain',
  'deepGate',
  'identity',
  'redesign',
  'deeper',
  'concepts',
  'sites',
  'news',
  'cogs',
  'derived',
  'attention',
  'community',
  'timeline',
];

/** Stage 2 (M10): the remaining content kinds of §12.7. */
export const STAGE2_KINDS: readonly StreamCardKind[] = [
  'visual',
  'graph',
  'papers',
  'backlinks',
  'extracts',
  'global',
  'siblings',
  'shelf',
  'art',
  'number',
  'earthEvents',
];

/** Every content kind the stream can render (status kinds excluded). */
export const CONTENT_KINDS: readonly StreamCardKind[] = [...STAGE1_KINDS, ...STAGE2_KINDS];

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

/** One picture a card may show. Commons and Open Library both carry the
 *  license / author line the display needs (§12.4 attribution). */
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
  /** Free-text body (essence summary, disambiguation hint, ...). */
  text?: string;
  facts?: StreamFact[];
  items?: StreamItem[];
  series?: { points: number[]; dates?: string[]; unit?: string };
  images?: StreamImage[];
  axes?: Array<{ axis: ConstitutionAxis; score: number }>;
  cogs?: CogsCard;
  /** Which kinds the next page will bring (teaser card). */
  next?: StreamCardKind[];
  /** Rare (D-28): deterministic, free, cosmetic. */
  rare?: boolean;
}

export interface StreamPage {
  page: number;
  cards: StreamCard[];
  /** True when every network leg of the page came back empty. */
  thin: boolean;
  fetchedAt: number;
}

/**
 * How many Wikimedia-family requests each kind costs (§12.7: "Wikimedia
 * 패밀리 합산 ≤2/페이지"). The family is wikipedia / wikidata / commons /
 * wmcloud pageviews / query.wikidata -- `deeperFetch` serializes them at
 * `WIKIMEDIA_SPACING_MS`, so this is a latency budget, not a politeness one.
 * `visual` and `siblings` cost two because each is a two-step leg
 * (media-list -> imageinfo, categories -> categorymembers).
 */
export const WIKIMEDIA_LEG_COST: Partial<Record<StreamCardKind, number>> = {
  identity: 1,
  concepts: 1,
  sites: 1,
  attention: 1,
  timeline: 1,
  visual: 2,
  graph: 1,
  backlinks: 1,
  extracts: 1,
  global: 1,
  siblings: 2,
  number: 1,
};

/** Sum of the Wikimedia-family cost of a recipe. */
export function wikimediaCost(kinds: readonly StreamCardKind[]): number {
  return kinds.reduce((sum, k) => sum + (WIKIMEDIA_LEG_COST[k] ?? 0), 0);
}

/** The per-page ceiling that `wikimediaCost` must never exceed (§12.7). */
export const WIKIMEDIA_PAGE_BUDGET = 2;

/** Hard cap on pages per query (§12.7). */
export const STREAM_PAGE_CAP = 60;
/** Soft pause every N pages -- '계속 탐색' must be tapped (D-29). */
export const STREAM_SOFT_PAUSE_EVERY = 10;
/** The Explore Deeper card is re-injected every N pages (§12.2 tower row). */
export const STREAM_DEEPER_EVERY = 6;
/** The question chain is re-injected every N pages. */
export const STREAM_CHAIN_EVERY = 4;
/** DOM budget: pages kept mounted (older pages become ghost placeholders). */
export const STREAM_DOM_PAGES = 12;

/**
 * Which content kinds page N carries (SPEC §12.7): p0 costs no network,
 * p1 the identity legs, p2-p3 the discovery legs, then a round-robin of
 * the paged kinds with the COGS card on every page and the chain / deeper
 * cards re-injected on their cadence.
 */
export function streamRecipe(page: number): StreamCardKind[] {
  if (page === 0) return ['essence', 'axisSpectrum', 'sources', 'chain', 'deepGate'];
  const kinds = basePageKinds(page);
  // §12.7 cadence, applied uniformly so no explicitly-composed page can
  // silently skip a re-injection: the chain returns every 4 pages, the
  // Explore Deeper card every 6.
  if (page % STREAM_CHAIN_EVERY === 0 && !kinds.includes('chain')) kinds.push('chain');
  if (page % STREAM_DEEPER_EVERY === 0 && !kinds.includes('deeper')) kinds.push('deeper');
  return kinds;
}

/** The kinds page N carries before the chain / deeper cadence is applied. */
function basePageKinds(page: number): StreamCardKind[] {
  if (page === 1) return ['identity', 'redesign', 'deeper', 'cogs'];
  if (page === 2) return ['concepts', 'sites', 'news', 'cogs'];
  if (page === 3) return ['derived', 'attention', 'community', 'cogs'];
  // Stage 2 (M10). SPEC §12.7 groups p4 visual·graph·papers, p5
  // backlinks·extracts·global, p6 siblings·art·shelf -- but visual and
  // siblings are two-step Wikimedia legs, so those groupings would ask for
  // three or four family requests on one page and blow the §12.7 budget.
  // The kinds are therefore paired so that every page costs at most two.
  if (page === 4) return ['visual', 'papers', 'cogs'];
  if (page === 5) return ['backlinks', 'extracts', 'cogs', 'chain'];
  if (page === 6) return ['siblings', 'art', 'cogs'];
  if (page === 7) return ['graph', 'shelf', 'number', 'cogs'];
  if (page === 8) return ['global', 'earthEvents', 'cogs'];
  const cycle: StreamCardKind[][] = [
    ['sites', 'derived'],
    ['news', 'attention'],
    ['community', 'timeline'],
    ['concepts', 'identity'],
    ['visual', 'papers'],
    ['backlinks', 'shelf'],
    ['extracts', 'graph'],
    ['siblings', 'art'],
    ['global', 'number'],
    ['news', 'earthEvents'],
  ];
  return [...cycle[(page - 9) % cycle.length], 'cogs'];
}

/** Which kinds are network-free (rendered from the surface report). */
export const LOCAL_KINDS = new Set<StreamCardKind>(['essence', 'axisSpectrum', 'sources', 'chain', 'deepGate', 'redesign', 'deeper', 'cogs', 'teaser', 'end', 'retry', 'disambiguation']);
