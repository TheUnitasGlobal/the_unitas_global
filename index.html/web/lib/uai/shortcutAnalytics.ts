'use client';

import { analyzeSurface } from './heuristics';
import { synthesizeWeb } from './webSynthesis';
import { deriveKeywords, normalizeShortcutQuery, type AnalyticsLabels, type KeywordChip } from './shortcutCore';
import type { ConstitutionRedesignReport, SurfaceReport, WebSynthesis } from './types';

export {
  deriveKeywords,
  SHORTCUT_CACHE_TTL_MS,
  SHORTCUT_CACHE_VERSION,
  SHORTCUT_MANUAL_REFRESH_MIN_AGE_MS,
} from './shortcutCore';
export type {
  AnalyticsLabels,
  KeywordChip,
  KeywordChipKind,
  ShortcutCacheApiResponse,
  ShortcutCacheSource,
  ShortcutSnapshot,
  ShortcutTier,
} from './shortcutCore';

/**
 * UNITAS shortcut analytics engine -- the BROWSER edge of the fully-automated
 * analysis behind every tile of the multi-dimensional shortcut matrix
 * (governance / hot issues / finance / real estate / dating / career and every
 * keyword nested beneath them in the infinite knowledge ladder).
 *
 * Since the 24h sovereign caching engine (lib/uai/shortcutCache.ts + GET
 * /api/u-ai/shortcut-cache) the NORMAL path never runs this engine at all: a
 * visitor is served the snapshot the nightly batch parked in Postgres (and the
 * Vercel CDN in front of it) -- 0초, 0원, zero external calls. `analyzeShortcut`
 * below is the fail-open fallback (cache route unreachable / offline) and the
 * historical reference implementation of one ladder tier. It fuses:
 *  1. the FREE live web synthesis (webSynthesis.ts: DuckDuckGo + Wikipedia +
 *     Wikidata, keyless/CORS-only, 24h localStorage cache, fail-open)
 *  2. the deterministic 100-doctrine surface analysis (heuristics.ts)
 *  3. the keyword expansion (shortcutCore.ts, shared with the server batch)
 *  4. a "global pulse" gauge folding the global hit count into a 0-100
 *     momentum with a rising / stable / cooling trend against the previous
 *     reading this browser stored
 */

export type PulseTrend = 'rising' | 'stable' | 'cooling';

export interface ShortcutPulse {
  /** 0-100 composite of live-source density, doctrine intensity and global hits. */
  momentum: number;
  trend: PulseTrend;
}

/** Where a tier's analysis came from -- the cache route's `source`, or
 *  `local` when the browser engine had to compute it itself (fail-open). */
export type ShortcutAnalysisSource = 'cache' | 'fresh' | 'cooldown' | 'local';

export interface ShortcutAnalysis {
  query: string;
  report: SurfaceReport;
  web: WebSynthesis;
  keywords: KeywordChip[];
  pulse: ShortcutPulse;
  generatedAt: number;
  /** the LLM-forged 6-axis UNITAS deep analysis parked for this tier (0원). */
  deep: ConstitutionRedesignReport | null;
  hits: number;
  /** when the served snapshot was synthesized (null for a local pass). */
  synthesizedAt: number | null;
  source: ShortcutAnalysisSource;
}

/** Legacy 60s polling cadence -- kept exported for callers/tests; the cache
 *  engine's cadence is SHORTCUT_CACHE_TTL_MS (24h). */
export const FEED_REFRESH_MS = 60_000;

const PULSE_KEY = 'unitas.uai.shortcut.pulse.v1';
const PULSE_MAX = 60;

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}

type PulseLedger = Record<string, { momentum: number; ts: number }>;

function readPulseLedger(): PulseLedger {
  try {
    const raw = window.localStorage.getItem(PULSE_KEY);
    const parsed = raw ? (JSON.parse(raw) as PulseLedger) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writePulseLedger(next: PulseLedger): void {
  try {
    const entries = Object.entries(next).sort((a, b) => b[1].ts - a[1].ts).slice(0, PULSE_MAX);
    window.localStorage.setItem(PULSE_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    /* private mode / quota -- the pulse is best-effort */
  }
}

/**
 * Global pulse: live-source density (the feed actually found material), the
 * strength of the dominant doctrine axis, and the global hit count. Trend
 * compares against the last reading this browser stored for the same query,
 * so a re-open that surfaces new hits/sources reads as "rising" rather than
 * a flat number.
 */
export function derivePulse(query: string, report: SurfaceReport, web: WebSynthesis, hits: number): ShortcutPulse {
  const sourceDensity = web.sourced ? 24 + Math.min(web.sources.length, 8) * 4 : 0;
  const doctrine = (report.constitution[0]?.score ?? 0) * 0.28;
  const global = Math.min(hits, 12) * 3;
  const momentum = clamp(8 + sourceDensity + doctrine + global);

  const hasWindow = typeof window !== 'undefined';
  const ledger = hasWindow ? readPulseLedger() : {};
  const id = normalizeShortcutQuery(query);
  const previous = ledger[id];
  let trend: PulseTrend = 'stable';
  if (previous) {
    if (momentum > previous.momentum + 2) trend = 'rising';
    else if (momentum < previous.momentum - 2) trend = 'cooling';
  } else if (momentum >= 55) {
    trend = 'rising';
  }
  if (hasWindow) writePulseLedger({ ...ledger, [id]: { momentum, ts: Date.now() } });

  return { momentum, trend };
}

/**
 * One full LOCAL engine pass for one ladder tier (fail-open fallback). Never
 * throws: a failed or disabled live feed degrades to the offline doctrine
 * analysis with the identical output shape (`web.sourced === false`).
 */
export async function analyzeShortcut(
  query: string,
  locale: string,
  labels: AnalyticsLabels,
  hits = 0,
): Promise<ShortcutAnalysis> {
  const trimmed = query.trim();
  let web: WebSynthesis;
  try {
    web = await synthesizeWeb(trimmed, locale);
  } catch {
    web = { sourced: false, sources: [], digest: '', lang: null, fetchedAt: Date.now() };
  }
  const report = analyzeSurface(trimmed, labels.ecosystems, '', web);
  return {
    query: trimmed,
    report,
    web,
    keywords: deriveKeywords(trimmed, report, web, labels),
    pulse: derivePulse(trimmed, report, web, hits),
    generatedAt: Date.now(),
    deep: null,
    hits,
    synthesizedAt: null,
    source: 'local',
  };
}
