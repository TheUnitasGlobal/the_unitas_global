/**
 * REV-19 §13 -- discovery widgets inside the U-AI suggestion popup:
 * "rising now" seeds from the local index and deterministic curiosity-card
 * rotation. Pure helpers; no network.
 *
 * REV-21 §5.2: the visitor's "recent queries" trail (이어서 탐색) is gone for
 * good (founder directive). Only `purgeLegacyRecentQueries` survives so a
 * device that still carries the old localStorage list wipes it on the next
 * visit -- the key string is kept here, in one place, for exactly that.
 */
import type { LiveIndexEntry, LiveResult } from '@/lib/uai/liveSearchIndex';

/** Storage key of the retired recent-queries trail (REV-19 §13 → REV-21 §5.2). */
export const LEGACY_RECENT_QUERIES_KEY = 'unitas.search.recent.v1';
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

/** One-shot privacy cleanup: remove the retired recent-queries list from
 *  this device. Safe to call on every mount; no-op on the server. */
export function purgeLegacyRecentQueries(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(LEGACY_RECENT_QUERIES_KEY);
  } catch {
    // private mode / quota -- nothing to purge.
  }
}
