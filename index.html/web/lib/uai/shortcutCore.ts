import type { ConstitutionAxis, ConstitutionRedesignReport, LensKey, SurfaceReport, WebSynthesis } from './types';

/**
 * Isomorphic contract of the shortcut analytics engine -- shared by the
 * browser engine (shortcutAnalytics.ts, 'use client') and the 24h sovereign
 * caching engine on the server (shortcutCache.ts + /api/u-ai/shortcut-cache).
 * No React, no `window`, no Node built-ins: pure types, constants and the
 * keyword-expansion maths, so a snapshot forged in the nightly batch and one
 * produced live in a browser are byte-for-byte the same shape.
 */

export type KeywordChipKind = 'entity' | 'constitution' | 'lens';

export interface KeywordChip {
  /** the visible label. */
  label: string;
  /** the query the next tier is seeded with when this chip is tapped. */
  query: string;
  kind: KeywordChipKind;
}

/** Label resolvers the engine needs for locale-native chips -- passed in
 *  from the component (next-intl) or resolved from messages/<locale>.json on
 *  the server, so this module stays free of both. */
export interface AnalyticsLabels {
  ecosystems: (key: string) => string;
  constitution: (axis: ConstitutionAxis) => string;
  lens: (key: LensKey) => string;
}

/** Bump when the snapshot shape / synthesis maths change so a stale row is
 *  re-synthesized instead of re-served. */
export const SHORTCUT_CACHE_VERSION = 'sc-v1';

/** The sovereign caching cadence: one background synthesis per tier per
 *  24h. Visitors are served the parked snapshot for the whole window. */
export const SHORTCUT_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/** The manual "갱신 런처" only re-synthesizes a tier older than this; a
 *  younger one is served from cache (cooldown) so a click storm can never
 *  turn into an external-fetch storm. */
export const SHORTCUT_MANUAL_REFRESH_MIN_AGE_MS = 10 * 60 * 1000;

export type ShortcutTier = 'seed' | 'ladder';

/** One CJK ideograph / hangul syllable is a whole word (ko "법", ja "法" --
 *  the localized `law` tier), so those get in at one character; every other
 *  script needs the engine-wide two-character minimum. */
const CJK_WORD = /[\p{Script=Han}\p{Script=Hangul}\p{Script=Hiragana}\p{Script=Katakana}]/u;

/** True when `query` is long enough for the engine to work with -- the one
 *  rule the seed matrix, the cache route and the popup feed all share. */
export function isViableShortcutQuery(query: string): boolean {
  const trimmed = query.trim();
  return trimmed.length >= 2 || (trimmed.length === 1 && CJK_WORD.test(trimmed));
}

/**
 * One parked tier of the infinite knowledge ladder -- everything the popup
 * needs to render a tier instantly (0초) without a single external call:
 * the live-web synthesis, the deterministic 100-doctrine surface report and
 * the keyword chips that seed the next tier.
 */
export interface ShortcutSnapshot {
  version: string;
  query: string;
  locale: string;
  tier: ShortcutTier;
  report: SurfaceReport;
  web: WebSynthesis;
  keywords: KeywordChip[];
  synthesizedAt: number;
}

export type ShortcutCacheSource = 'cache' | 'fresh' | 'cooldown';

/** GET /api/u-ai/shortcut-cache response. */
export interface ShortcutCacheApiResponse {
  ok: boolean;
  snapshot: ShortcutSnapshot | null;
  /** the LLM-forged 6-axis UNITAS deep analysis, once the nightly batch has
   *  forged it for this tier (served from Genesis Memory at 0원). */
  deep: ConstitutionRedesignReport | null;
  /** sampled global open count for this tier (drives the pulse gauge and the
   *  nightly forge priority). */
  hits: number;
  synthesizedAt: number | null;
  /** when the next background synthesis of this tier is due. */
  nextRefreshAt: number | null;
  source: ShortcutCacheSource;
  /** true when no deep analysis exists yet -- it is queued for the batch. */
  deepQueued: boolean;
}

const MAX_ENTITY_CHIPS = 4;
const MAX_CHIPS = 7;

export function normalizeShortcutQuery(s: string): string {
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
  const seen = new Set<string>([normalizeShortcutQuery(query)]);
  const chips: KeywordChip[] = [];

  function push(chip: KeywordChip) {
    const id = normalizeShortcutQuery(chip.query);
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
