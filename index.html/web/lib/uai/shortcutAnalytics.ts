'use client';

import { analyzeSurface } from './heuristics';
import { synthesizeWeb } from './webSynthesis';
import type { ConstitutionAxis, LensKey, SurfaceReport, WebSynthesis } from './types';

/**
 * UNITAS shortcut analytics engine -- the fully-automated, self-refreshing
 * analysis behind every tile of the multi-dimensional shortcut matrix
 * (governance / hot issues / finance / real estate / dating / career and every
 * keyword nested beneath them in the infinite knowledge ladder).
 *
 * One call = one tier of the ladder. It fuses:
 *  1. the FREE live web synthesis (webSynthesis.ts: DuckDuckGo + Wikipedia +
 *     Wikidata, keyless/CORS-only, 24h localStorage cache, fail-open) -> the
 *     "real-time trend feed" (real titles + URLs, in the visitor's language)
 *  2. the deterministic 100-doctrine surface analysis (heuristics.ts) -> top
 *     constitution axis, blind-spot redesign axis, shield verdict, lenses
 *  3. a keyword expansion derived from BOTH -> the clickable chips that let
 *     the visitor nest the next tier, forever (each chip is a new query, so
 *     the ladder never dead-ends: every tier yields fresh chips)
 *  4. a "global pulse" gauge folding the Postgres search_trends hit count
 *     (read by useShortcutFeed via /api/u-ai/trend) into a 0-100 momentum
 *     with a rising / stable / cooling trend against the previous reading
 *
 * Zero coin burn, zero LLM call, zero server storage on this path: the only
 * server round-trip is the shared threshold-assetization channel, which is
 * what eventually hands back the LLM-forged 6-axis "UNITAS deep analysis"
 * at engine cost 0원 once a keyword crosses the global threshold.
 */

export type KeywordChipKind = 'entity' | 'constitution' | 'lens';

export interface KeywordChip {
  /** the visible label. */
  label: string;
  /** the query the next tier is seeded with when this chip is tapped. */
  query: string;
  kind: KeywordChipKind;
}

export type PulseTrend = 'rising' | 'stable' | 'cooling';

export interface ShortcutPulse {
  /** 0-100 composite of live-source density, doctrine intensity and global hits. */
  momentum: number;
  trend: PulseTrend;
}

export interface ShortcutAnalysis {
  query: string;
  report: SurfaceReport;
  web: WebSynthesis;
  keywords: KeywordChip[];
  pulse: ShortcutPulse;
  generatedAt: number;
}

/** Label resolvers the engine needs for locale-native chips -- passed in
 *  from the component so this module stays free of next-intl. */
export interface AnalyticsLabels {
  ecosystems: (key: string) => string;
  constitution: (axis: ConstitutionAxis) => string;
  lens: (key: LensKey) => string;
}

/** Auto-refresh cadence of the live feed while a popup is open + visible. */
export const FEED_REFRESH_MS = 60_000;

const MAX_ENTITY_CHIPS = 4;
const MAX_CHIPS = 7;
const PULSE_KEY = 'unitas.uai.shortcut.pulse.v1';
const PULSE_MAX = 60;

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Constitution labels are "Logic · Design" style pairs; the first half is
 *  the searchable head noun for the nested query. */
function headNoun(label: string): string {
  return label.split('·')[0].trim();
}

/**
 * The keyword expansion. Entities first (they are REAL page titles from the
 * live feed, so the ladder follows the open knowledge graph), then the two
 * strongest doctrine axes plus the blind-spot axis (so every tier also bends
 * toward a sovereign re-reading), then the dominant lens. Deduped against the
 * tier's own query so a chip never re-opens the same tier.
 */
export function deriveKeywords(
  query: string,
  report: SurfaceReport,
  web: WebSynthesis,
  labels: AnalyticsLabels,
): KeywordChip[] {
  const seen = new Set<string>([normalize(query)]);
  const chips: KeywordChip[] = [];

  function push(chip: KeywordChip) {
    const id = normalize(chip.query);
    if (!id || seen.has(id) || chips.length >= MAX_CHIPS) return;
    seen.add(id);
    chips.push(chip);
  }

  web.sources.slice(0, MAX_ENTITY_CHIPS + 2).forEach((source) => {
    if (chips.length >= MAX_ENTITY_CHIPS) return;
    const label = source.title.replace(/\s*\(.*?\)\s*$/, '').trim().slice(0, 48);
    if (label.length < 2) return;
    push({ label, query: label, kind: 'entity' });
  });

  const axes: ConstitutionAxis[] = [
    report.constitution[0]?.axis,
    report.constitution[1]?.axis,
    report.redesignAxis,
  ].filter((axis, i, arr): axis is ConstitutionAxis => Boolean(axis) && arr.indexOf(axis) === i);
  axes.forEach((axis) => {
    const label = labels.constitution(axis);
    push({ label, query: `${query} ${headNoun(label)}`, kind: 'constitution' });
  });

  const topLens = report.lenses.slice().sort((a, b) => b.score - a.score)[0];
  if (topLens) {
    const label = labels.lens(topLens.key);
    push({ label, query: `${query} ${headNoun(label)}`, kind: 'lens' });
  }

  return chips;
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
 * strength of the dominant doctrine axis, and the global search_trends hit
 * count. Trend compares against the last reading this browser stored for the
 * same query, so an auto-refresh that surfaces new hits/sources reads as
 * "rising" rather than a flat number.
 */
export function derivePulse(query: string, report: SurfaceReport, web: WebSynthesis, hits: number): ShortcutPulse {
  const sourceDensity = web.sourced ? 24 + Math.min(web.sources.length, 8) * 4 : 0;
  const doctrine = (report.constitution[0]?.score ?? 0) * 0.28;
  const global = Math.min(hits, 12) * 3;
  const momentum = clamp(8 + sourceDensity + doctrine + global);

  const ledger = readPulseLedger();
  const id = normalize(query);
  const previous = ledger[id];
  let trend: PulseTrend = 'stable';
  if (previous && typeof window !== 'undefined') {
    if (momentum > previous.momentum + 2) trend = 'rising';
    else if (momentum < previous.momentum - 2) trend = 'cooling';
  } else if (momentum >= 55) {
    trend = 'rising';
  }
  if (typeof window !== 'undefined') writePulseLedger({ ...ledger, [id]: { momentum, ts: Date.now() } });

  return { momentum, trend };
}

/**
 * One full engine pass for one ladder tier. Never throws: a failed or
 * disabled live feed degrades to the offline doctrine analysis with the
 * identical output shape (`web.sourced === false`).
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
  };
}
