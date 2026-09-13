/**
 * REV-21 §5C / SPEC §12.7 -- the infinity stream's card contract. A page
 * is a list of cards; every card names its kind (one of 24 in the full
 * design, 16 in stage 1 -- D-37), its scope (worldwide / your country),
 * the REAL source it came from and, where the visitor can act, the
 * follow-up it offers. Pure types + the page recipe table.
 */
import type { SourceId } from '../sourceRegistry';
import type { ConstitutionAxis } from '../types';
import type { CogsCard } from './cogsMatrix';

/** Stage 1 (D-37): 16 content kinds + 4 status kinds. Stage 2 (M10) adds
 *  visual · graph · papers · backlinks · extracts · global · siblings ·
 *  shelf · art · number · earthEvents (the 24 of §12.7). */
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
  if (page === 1) return ['identity', 'redesign', 'deeper', 'cogs'];
  if (page === 2) return ['concepts', 'sites', 'news', 'cogs'];
  if (page === 3) return ['derived', 'attention', 'community', 'cogs'];
  if (page === 4) return ['timeline', 'news', 'concepts', 'cogs'];
  const cycle: StreamCardKind[][] = [
    ['sites', 'derived'],
    ['news', 'attention'],
    ['community', 'timeline'],
    ['concepts', 'identity'],
  ];
  const kinds: StreamCardKind[] = [...cycle[(page - 5) % cycle.length], 'cogs'];
  if (page % STREAM_CHAIN_EVERY === 0) kinds.push('chain');
  if (page % STREAM_DEEPER_EVERY === 0) kinds.push('deeper');
  return kinds;
}

/** Which kinds are network-free (rendered from the surface report). */
export const LOCAL_KINDS = new Set<StreamCardKind>(['essence', 'axisSpectrum', 'sources', 'chain', 'deepGate', 'redesign', 'deeper', 'cogs', 'teaser', 'end', 'retry', 'disambiguation']);
