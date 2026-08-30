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

export interface LensScore {
  key: LensKey;
  /** 0-100. */
  score: number;
  band: Band;
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
