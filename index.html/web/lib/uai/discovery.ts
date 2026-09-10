/**
 * REV-19 §13 -- discovery widgets inside the U-AI suggestion popup:
 * "rising now" seeds from the local index, deterministic curiosity-card
 * rotation, and the visitor's recent queries (localStorage, this device
 * only). Pure helpers + a thin storage layer; no network.
 */
import type { LiveIndexEntry, LiveResult } from '@/lib/uai/liveSearchIndex';

export const RECENT_QUERIES_KEY = 'unitas.search.recent.v1';
export const RECENT_QUERIES_MAX = 6;
/** Number of curiosity questions authored per locale (Rev19.search.cards.c1..cN). */
export const CURIOSITY_CARD_POOL = 12;
export const CURIOSITY_CARDS_SHOWN = 3;
/** Cards rotate once per this many ms (deterministic on the clock). */
export const CURIOSITY_ROTATE_MS = 6 * 60 * 60 * 1000;

/** Pure: the curiosity-card indices (1-based, `c1`..`cN`) for a moment. */
export function pickCuriosityCards(now: number, pool = CURIOSITY_CARD_POOL, shown = CURIOSITY_CARDS_SHOWN, periodMs = CURIOSITY_ROTATE_MS): number[] {
  const slot = Math.floor(Math.max(0, now) / Math.max(1, periodMs));
  const out: number[] = [];
  for (let i = 0; i < Math.min(shown, pool); i++) out.push(((slot * shown + i) % pool) + 1);
  return out;
}

/** Pure: the "rising now" seeds -- axis entries of the local corpus,
 *  rotated by the clock so the row changes across visits without any
 *  network (the corpus is the 30-axis shortcut matrix + app launchers). */
export function risingSeeds(index: readonly LiveIndexEntry[], now: number, take = 8, periodMs = CURIOSITY_ROTATE_MS): LiveResult[] {
  const axes = index.filter((e) => e.kind === 'axis');
  if (axes.length === 0) return [];
  const offset = Math.floor(Math.max(0, now) / Math.max(1, periodMs)) % axes.length;
  const out: LiveResult[] = [];
  for (let i = 0; i < Math.min(take, axes.length); i++) {
    const entry = axes[(offset + i) % axes.length];
    out.push({
      kind: entry.kind,
      id: entry.id,
      title: entry.title,
      description: entry.description,
      category: entry.category,
      icon: entry.icon,
      color: entry.color,
      axis: entry.axis,
      url: entry.url,
      range: null,
    });
  }
  return out;
}

/** Pure: fold a new query into the recent list (newest first, de-duped,
 *  capped). Blank queries are ignored. */
export function pushRecent(list: readonly string[], query: string, max = RECENT_QUERIES_MAX): string[] {
  const q = query.trim();
  if (!q) return [...list];
  const rest = list.filter((x) => x.toLowerCase() !== q.toLowerCase());
  return [q, ...rest].slice(0, max);
}

export function readRecentQueries(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(RECENT_QUERIES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string').slice(0, RECENT_QUERIES_MAX) : [];
  } catch {
    return [];
  }
}

export function writeRecentQueries(list: readonly string[]): void {
  if (typeof window === 'undefined') return;
  try {
    if (list.length === 0) window.localStorage.removeItem(RECENT_QUERIES_KEY);
    else window.localStorage.setItem(RECENT_QUERIES_KEY, JSON.stringify(list.slice(0, RECENT_QUERIES_MAX)));
  } catch {
    // private mode / quota -- recents are a convenience only.
  }
}
