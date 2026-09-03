import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { routing } from '@/i18n/routing';
import { HOT_SHORTCUT_MATRIX, type ShortcutGroup } from '@/lib/hotIssues';
import { normalizeQuery } from './deepInsight';
import { analyzeSurface } from './heuristics';
import {
  SHORTCUT_CACHE_TTL_MS,
  SHORTCUT_CACHE_VERSION,
  deriveKeywords,
  isViableShortcutQuery,
  type AnalyticsLabels,
  type ShortcutSnapshot,
  type ShortcutTier,
} from './shortcutCore';
import type { ConstitutionAxis, LensKey } from './types';
import { WIKI_LANG, collectWebSynthesis } from './webSynthesisCore';

/**
 * 24h SOVEREIGN CACHING ENGINE -- server half (owner directive 2026-09-02,
 * "24시간 초지능 캐싱 및 무자본 비용 제로 자동화").
 *
 * Every tier of the shortcut matrix (civic + hot issue + finance +
 * real estate + dating + career seeds, in all 20 locales) and every keyword
 * tier visitors nest beneath them is synthesized ONCE per 24h by the nightly
 * batch (app/api/u-ai/shortcut-cache/refresh, Vercel cron) and parked in
 * `public.shortcut_cache`. A visitor opening a popup is served that parked
 * snapshot (plus the Genesis-Memory deep report) through GET
 * /api/u-ai/shortcut-cache, which the Vercel CDN then holds for an hour --
 * so the per-visit server compute + external API cost is exactly 0원.
 *
 * Server-only by convention (node:crypto). Never imported by client code --
 * the browser talks to the route.
 */

export const SHORTCUT_CACHE_TABLE = 'shortcut_cache';

/** Hard abort for one server-side synthesis pass (a touch longer than the
 *  browser's 3s: the batch runs in the background, nobody is waiting). */
export const SERVER_SYNTH_ABORT_MS = 4500;

/** Stable row key -- same normalization as the trend/redesign hashes so one
 *  query string maps to one row per locale regardless of casing/whitespace. */
export function shortcutCacheKey(locale: string, query: string): string {
  return createHash('sha256')
    .update(`${SHORTCUT_CACHE_VERSION}::${locale}::${normalizeQuery(query)}`)
    .digest('hex');
}

type Messages = Record<string, unknown>;

const messageCache = new Map<string, Promise<Messages>>();

/** messages/<locale>.json, loaded once per lambda lifetime. */
export function loadMessages(locale: string): Promise<Messages> {
  const safe = (routing.locales as readonly string[]).includes(locale) ? locale : routing.defaultLocale;
  let pending = messageCache.get(safe);
  if (!pending) {
    pending = import(`../../messages/${safe}.json`).then((mod: { default?: Messages }) => mod.default ?? mod);
    messageCache.set(safe, pending);
  }
  return pending;
}

function pick(messages: Messages, path: string): string {
  const value = path.split('.').reduce<unknown>((node, part) => {
    if (node && typeof node === 'object') return (node as Record<string, unknown>)[part];
    return undefined;
  }, messages);
  return typeof value === 'string' ? value : path;
}

/** The label resolvers next-intl would hand the browser engine, resolved
 *  straight from the locale's message tree so server and client chips match. */
export function labelsFor(messages: Messages): AnalyticsLabels {
  return {
    ecosystems: (key: string) => pick(messages, `Ecosystems.${key}`),
    constitution: (axis: ConstitutionAxis) => pick(messages, `UAI.constitution.${axis}`),
    lens: (key: LensKey) => pick(messages, `UAI.lens.${key}`),
  };
}

const GROUP_NAMESPACE: Record<ShortcutGroup, string> = {
  civic: 'Civic',
  hotIssue: 'HotIssue',
  finance: 'Finance',
  realEstate: 'RealEstate',
  dating: 'Dating',
  career: 'Career',
};

export interface SeedQuery {
  group: ShortcutGroup;
  key: string;
  query: string;
}

/** The 30 seed tiers of the matrix in one locale -- the localized axis
 *  titles are exactly the queries HotShortcutResultModal opens with. */
export function seedQueries(messages: Messages): SeedQuery[] {
  return HOT_SHORTCUT_MATRIX.map((axis) => ({
    group: axis.group,
    key: axis.key,
    query: pick(messages, `${GROUP_NAMESPACE[axis.group]}.axes.${axis.messageKey}.title`),
  })).filter((seed) => isViableShortcutQuery(seed.query) && !seed.query.startsWith('[MISSING'));
}

/** True when `query` is one of this locale's seed titles. */
export function isSeedQuery(messages: Messages, query: string): boolean {
  const id = normalizeQuery(query);
  return seedQueries(messages).some((seed) => normalizeQuery(seed.query) === id);
}

/**
 * One full synthesis of one tier, server-side: live web pass (keyless
 * DuckDuckGo / Wikipedia / Wikidata, 0원) + deterministic 100-doctrine
 * surface analysis + keyword chips. Never throws.
 */
export async function buildSnapshot(
  query: string,
  locale: string,
  tier: ShortcutTier,
  messages: Messages,
): Promise<ShortcutSnapshot> {
  const trimmed = query.trim();
  const lang = WIKI_LANG[locale] ?? 'en';
  const web = await collectWebSynthesis(trimmed, lang, {
    abortMs: SERVER_SYNTH_ABORT_MS,
    searx: process.env.UAI_SEARXNG || process.env.NEXT_PUBLIC_UAI_SEARXNG || '',
  });
  const labels = labelsFor(messages);
  const report = analyzeSurface(trimmed, labels.ecosystems, '', web);
  return {
    version: SHORTCUT_CACHE_VERSION,
    query: trimmed,
    locale,
    tier,
    report,
    web,
    keywords: deriveKeywords(trimmed, report, web, labels),
    synthesizedAt: Date.now(),
  };
}

export interface ShortcutCacheRow {
  cache_key: string;
  locale: string;
  query: string;
  tier: ShortcutTier;
  payload: ShortcutSnapshot;
  hit_count: number;
  synthesized_at: string;
}

export function isFreshRow(row: Pick<ShortcutCacheRow, 'payload' | 'synthesized_at'>, now = Date.now()): boolean {
  if (row.payload?.version !== SHORTCUT_CACHE_VERSION) return false;
  const at = Date.parse(row.synthesized_at);
  return Number.isFinite(at) && now - at < SHORTCUT_CACHE_TTL_MS;
}

/** Write (or overwrite) one tier's snapshot. An existing `seed` tier keeps
 *  its tier on re-synthesis. Best-effort: returns false on any failure. */
export async function upsertSnapshot(
  admin: SupabaseClient,
  snapshot: ShortcutSnapshot,
  cacheKey = shortcutCacheKey(snapshot.locale, snapshot.query),
): Promise<boolean> {
  try {
    const { error } = await admin.from(SHORTCUT_CACHE_TABLE).upsert(
      {
        cache_key: cacheKey,
        locale: snapshot.locale,
        query: snapshot.query,
        tier: snapshot.tier,
        payload: snapshot,
        synthesized_at: new Date(snapshot.synthesizedAt).toISOString(),
      },
      { onConflict: 'cache_key' },
    );
    return !error;
  } catch {
    return false;
  }
}

/** Fire-and-forget hit counter (sampled by the caller so the CDN-shielded
 *  route does not turn every open into a Postgres write). */
export function bumpHit(admin: SupabaseClient, cacheKey: string, current: number): void {
  void admin
    .from(SHORTCUT_CACHE_TABLE)
    .update({ hit_count: current + 1, last_hit_at: new Date().toISOString() })
    .eq('cache_key', cacheKey)
    .then(
      () => undefined,
      () => undefined,
    );
}

/**
 * Bounded-concurrency map -- the batch fans out over hundreds of tiers but
 * must stay polite to the public endpoints and within one lambda's memory.
 */
export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
  shouldStop: () => boolean = () => false,
): Promise<R[]> {
  const out: R[] = [];
  let index = 0;
  async function worker() {
    while (index < items.length && !shouldStop()) {
      const item = items[index++];
      out.push(await fn(item));
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker));
  return out;
}
