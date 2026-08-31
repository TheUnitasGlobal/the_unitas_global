/**
 * U-AI omni search engine -- shared type contract for the surface (Phase 1,
 * client heuristic) and deep (Phase 2-4, Claude + Genesis Memory) reports.
 *
 * The dashboard renders these as modular components (progress bars, gauges,
 * checklists, a Chronos timeline) -- never as flat prose (owner instruction
 * 2026-08-30).
 */

/** U-COIN burned on every deep-insight request -- the "Micro-Burn" margin. */
export const UAI_DEEP_INSIGHT_COST = 3;

/** spend_coins() / coin_ledger / module_access_grants whitelist entry. */
export const UAI_MODULE = 'u-ai' as const;

export type LensKey = 'tech' | 'economy' | 'opinion';
export type Band = 'low' | 'mid' | 'high';
export type ShieldVerdict = 'clear' | 'caution' | 'biased';
export type Directionality = 'divergent' | 'convergent';
export type QueryArchetype = 'explore' | 'decide' | 'analyze';

/**
 * The 100-doctrine Hyper-Constitution Codex collapsed to 6 load-bearing axes --
 * the lens the free Phase-1 search uses to *deconstruct and redesign* whatever
 * it collected (big-tech-grade web digest + query) rather than merely restate
 * it. Deterministic per query, so the same question always decomposes the same
 * way. Axis keys stay stable; the 2026-08-30 expansion widened each axis's
 * keyword surface (law/risk, science/cosmos, payment/stock/bitcoin,
 * hacker/cyber/forensic) rather than renaming the axes.
 */
export type ConstitutionAxis =
  | 'logic'
  | 'future'
  | 'economy'
  | 'security'
  | 'sovereign'
  | 'art';

export interface LensScore {
  key: LensKey;
  /** 0-100. */
  score: number;
  band: Band;
}

export interface ConstitutionScore {
  axis: ConstitutionAxis;
  /** 0-100. */
  score: number;
  band: Band;
}

/** One real online reference folded into the free-tier synthesis. */
export interface WebSource {
  title: string;
  url: string;
  snippet: string;
}

/**
 * Result of the zero-cost "live web synthesis" pass -- keyless, CORS-only
 * Wikipedia/Wikimedia REST calls made client-side behind
 * NEXT_PUBLIC_UAI_WEB_SYNTHESIS, cached in localStorage. `sourced: false`
 * means the call was disabled, timed out or failed and Phase 1 fell back to
 * pure local heuristics -- never an error to the user.
 */
export interface WebSynthesis {
  sourced: boolean;
  sources: WebSource[];
  /** concatenated, control-stripped excerpt text fed into the heuristics. */
  digest: string;
  lang: string | null;
  fetchedAt: number;
}

/**
 * One axis of the 6-axis "Sovereign Redesign" — the free-tier assetized report
 * forged by the LLM once a query crosses the search threshold (TREND_THRESHOLD)
 * or when a paid deep-insight primes it. `reading` = how the subject currently
 * sits on that doctrine axis; `redesign` = the sovereign move that axis demands.
 */
export interface ConstitutionAxisRedesign {
  axis: ConstitutionAxis;
  reading: string;
  redesign: string;
}

/**
 * The free, permanently-cached "UNITAS Insight Report". Generated exactly once
 * per (locale, normalized query) — at the 3rd cumulative search or the first
 * paid burn — then served from Genesis Memory forever at engine cost 0원
 * (the "초절대마진 / 초영속에코시스템" pipeline, owner instruction 2026-08-31).
 */
export interface ConstitutionRedesignReport {
  query: string;
  /** exactly 6, in ConstitutionAxis order. */
  axes: ConstitutionAxisRedesign[];
  /** one paragraph fusing all 6 axes into a single sovereign thesis. */
  synthesis: string;
  /** the single blind-spot directive the redesign is anchored on. */
  vector: string;
  model: string;
  /** true when served from Genesis Memory rather than a fresh LLM call. */
  cached: boolean;
  /** cumulative search count for this query at the moment it was forged. */
  hits: number;
}

/** POST /api/u-ai/trend response — the threshold assetization channel. */
export interface TrendApiResponse {
  ok: boolean;
  /** cumulative search count for this (locale, query) after this call. */
  hits: number;
  /** the forged/cached 6-axis report, or null while still below threshold. */
  report: ConstitutionRedesignReport | null;
  /** true when a report exists but is still being forged / capped for today. */
  pending?: boolean;
  /** true when `report` came straight from Genesis Memory (0원). */
  cached?: boolean;
  /** true when `report` was forged by this very request. */
  fresh?: boolean;
}

export interface SwarmScore {
  key: string;
  messageKey: string;
  color: string;
  /** 0-100, normalised against the top match. */
  score: number;
}

export interface SurfaceReport {
  query: string;
  directionality: Directionality;
  archetype: QueryArchetype;
  /** Phase 1 -- 3-second triple lens (tech / economy / public opinion). */
  lenses: LensScore[];
  /** Phase 1 -- commercial-bias shield gauge. Higher = more commercial pull. */
  shield: { score: number; verdict: ShieldVerdict };
  /** Phase 1 -- 3-step action checklist, as translation-key suffixes under
   *  `UAI.checklist.<archetype>.<0|1|2>`. */
  checklistArchetype: QueryArchetype;
  /** Phase 1 -- the 100-doctrine deconstruction: every axis scored. */
  constitution: ConstitutionScore[];
  /** highest-scoring axis -- the frame the subject already leans into. */
  topConstitutionAxis: ConstitutionAxis;
  /** lowest-scoring axis -- the blind spot the redesign vector attacks. */
  redesignAxis: ConstitutionAxis;
  /** Phase 1 -- live web synthesis provenance (or the local-fallback flag). */
  web: WebSynthesis;
  /** All 11 ecosystems scored at once. */
  swarm: SwarmScore[];
  topEcosystemKey: string | null;
}

export interface ChronosPoint {
  /** translation-key suffix: `y1` | `y2` | `y3`. */
  horizon: 'y1' | 'y2' | 'y3';
  text: string;
}

export interface BinaryVerdict {
  optionA: string;
  optionB: string;
  /** which option the math favours. */
  pick: 'A' | 'B';
  rationale: string;
  /** 0-100. */
  confidence: number;
}

export interface DeepReport {
  /** Phase 2 -- 1/2/3-year forward trajectory. */
  chronos: ChronosPoint[];
  /** Phase 2 -- quantified either/or decision. */
  binary: BinaryVerdict;
  /** Phase 3 -- red-pen decode of the commercial/hidden intent behind the query. */
  redPen: string[];
  /** Phase 3 -- The VOID: the cinematic negative-space insight (one paragraph). */
  voidInsight: string;
  /** Phase 4 -- the highest-efficiency path that breaks the user's stated constraints. */
  efficiencyPath: string[];
  model: string;
  /** true when served from Genesis Memory rather than a fresh Claude call. */
  cached: boolean;
}

export type DeepInsightError =
  | 'burn_required'
  | 'insufficient'
  | 'phone'
  | 'deep_unavailable'
  | 'unauthenticated'
  | 'bad_request'
  | 'generation_failed';

export type DeepInsightApiResponse =
  | ({ ok: true } & DeepReport)
  | { ok: false; error: DeepInsightError };
