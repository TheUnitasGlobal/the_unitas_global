/**
 * U-AI omni search engine -- shared type contract for the surface report
 * (the instant, free, client-side heuristic) and the shortcut / trend
 * engines that read Genesis Memory.
 *
 * REV-23 M2.2 (founder directive 2026-09-13): the deep (Phase 2-4) tier is
 * deleted. `ChronosPoint`, `BinaryVerdict`, `DeepReport`, `DeepInsightError`,
 * `DeepInsightApiResponse` and the `UAI_DEEP_INSIGHT_COST` Micro-Burn
 * constant are gone with it. NOTE FOR THE FOUNDER: that removes the U-AI
 * search's only U-COIN burn surface -- the coin economy now runs entirely
 * through the page-level module access gate
 * (app/[locale]/(gated)/layout.tsx).
 */

/**
 * One image attached to a deep-insight request -- the multimodal input path.
 * `data` is raw base64 (no `data:` URL prefix); `mediaType` is validated
 * server-side against a strict allowlist before it ever reaches the LLM.
 * Vision analysis is currently wired for the Anthropic provider branch only
 * (see lib/uai/provider.ts) -- the OpenAI-compatible fallback branches
 * degrade gracefully to text-only rather than erroring.
 *
 * `kind` is a client-facing display hint only (which chip icon to render) --
 * a video attachment is really its one extracted representative frame, and a
 * canvas attachment is a PNG snapshot of a freehand sketch; both travel to
 * the server and the LLM as plain images, identically to `kind: 'image'`.
 */
export interface UaiImageAttachment {
  mediaType: string;
  data: string;
  kind?: 'image' | 'video-frame' | 'canvas';
}

/** Max simultaneous image-family attachments (image/video-frame/canvas) on
 *  one deep-insight request -- mirrors the text-attachment `.slice(-3)` cap. */
export const MAX_UAI_ATTACHMENTS = 3;

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

/** Which keyless engine a source came from (REV-21 §3.2 source attribution
 *  and §2.2 language gating). `wiki` = the visitor's own-language Wikipedia,
 *  `wiki-en` = the English Wikipedia reached through the entity anchor. */
export type WebSourceOrigin = 'wiki' | 'wiki-en' | 'wikidata' | 'ddg' | 'searx';

/** One real online reference folded into the free-tier synthesis. */
export interface WebSource {
  title: string;
  url: string;
  snippet: string;
  /** Language of the page (`ko`, `en`, ...). Optional for pre-REV-21 rows. */
  lang?: string;
  /** Wikidata item when known -- the entity, not the string. */
  qid?: string;
  origin?: WebSourceOrigin;
}

/** REV-21 §2.2: the resolved entity every cross-language leg was anchored
 *  on. Absent when the locale wiki had no hit (the pass then ran on the
 *  locale wiki only -- never on a raw-string English search). */
export interface WebAnchor {
  qid?: string;
  localeTitle: string;
  enTitle?: string;
  disambiguation: boolean;
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
  /** REV-21 §2.2: the entity-safe subset of `digest` -- own-language wiki
   *  summaries + the anchored English summary only. This is what the LLM
   *  grounding context and the English lexicon read; never DDG topics or
   *  same-label Wikidata strays. */
  grounding?: string;
  anchor?: WebAnchor;
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
