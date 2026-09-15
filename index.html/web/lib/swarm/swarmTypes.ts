/**
 * REV-32 M1 (founder directive 2026-09-15) -- the omni-tech swarm's OWN
 * contract.
 *
 * The swarm used to be a passenger. Its data arrived as a `DeeperPage` from
 * the generic REV-21 lens framework (`deeperThemes.ts` -> `deeperAdapters` ->
 * `useDeeperPage` -> `DeeperThemePage`), and it was reachable by exactly one
 * path: clicking a `bigTechPulse` tile inside the "더 깊이 탐색" block. When
 * REV-31 deleted that block the swarm did not break -- it became unreachable,
 * which is worse, because nothing failed loudly.
 *
 * So the dependency is inverted here. These are the four shapes the Wikidata
 * source actually produces and the field actually consumes, owned by the
 * swarm itself, imported from nothing. The decomposition logic in
 * `omniTechSource.ts` and the field geometry in `swarmLayout.ts` are the
 * REV-23/REV-24 originals, unchanged; only the ceiling above them is new.
 */
import type { SourceId } from '@/lib/uai/sourceRegistry';

/** Opaque continuation the source understands on its own next call;
 *  `null` = no further page. Serializable. */
export type SwarmCursor = Record<string, string | number | boolean> | null;

/** One headline number about the organisation (employees, revenue). */
export interface SwarmFact {
  /** `Rev32.swarm.fields.<label>` suffix, or a literal when `literal`. */
  label: string;
  literal?: boolean;
  value: string;
  /** The `point in time` qualifier -- so "221,000 employees" says WHEN. */
  unit?: string;
  emphasis?: boolean;
}

/** One entity inside a dimension. Every one of them is itself an anchor. */
export interface SwarmItem {
  id: string;
  title: string;
  meta?: string;
  url?: string;
  /** Re-anchor target: activating this node absorbs that entity in place. */
  qid?: string;
  lang?: string;
  sourceId?: SourceId;
}

export type SwarmCardKind = 'chips' | 'facts';

/** `chips` = one Wikidata dimension (becomes a sector of the field);
 *  `facts` = the scale header (employees, revenue). */
export interface SwarmCard {
  id: string;
  kind: SwarmCardKind;
  /** Field suffix (f1..f6) for the dimension heading. */
  field?: string;
  facts?: SwarmFact[];
  items?: SwarmItem[];
  sourceId: SourceId;
  /** Where the visitor can verify this card (outbound, real name). */
  sourceUrl?: string;
}

export interface SwarmPage {
  cards: SwarmCard[];
  cursor: SwarmCursor;
  fetchedAt: number;
  /** Real sources this page actually read. */
  sources: SourceId[];
  /** Set when the upstream answered but had nothing for this anchor. */
  empty?: boolean;
}

export interface SwarmContext {
  locale: string;
  /** Wikipedia language subdomain for the locale. */
  lang: string;
  signal?: AbortSignal;
}

/** The subject the field is built around. Only the QID is load-bearing. */
export interface SwarmAnchor {
  qid?: string;
  term: string;
  lang?: string;
}

export interface SwarmSource {
  key: string;
  load(anchor: SwarmAnchor, ctx: SwarmContext, cursor?: SwarmCursor): Promise<SwarmPage>;
}

export const EMPTY_SWARM_PAGE = (sources: SourceId[] = []): SwarmPage => ({
  cards: [],
  cursor: null,
  fetchedAt: Date.now(),
  sources,
  empty: true,
});
