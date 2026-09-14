'use client';

import type { Session } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

/**
 * Brain-Grid -- the per-visitor "cognitive database" of every query and its
 * resolution trajectory. localStorage is the always-on primary store; when a
 * real session exists the same event is dual-written to public.brain_grid
 * (RLS select/insert-own -- see
 * supabase/migrations/20260908000000_u_ai_genesis_memory.sql).
 *
 * REV-24 M1: `depth` is now the single literal `'surface'`. The paid
 * deep-insight tier that used to write `'deep'` was deleted in REV-23, and
 * its server-side companion write went with it, so this client write is the
 * only producer. The FIELD stays -- the `brain_grid.depth` column and every
 * already-persisted localStorage entry still carry it -- but the type no
 * longer advertises a value nothing can create. The session argument is
 * Supabase AUTH, not the wallet: it decides whether the founder's search
 * history follows them across devices, and has never had anything to do with
 * coins.
 */

const STORAGE_KEY = 'unitas.uai.brain-grid.v1';
const MAX_ENTRIES = 60;

export interface BrainGridEntry {
  q: string;
  ts: number;
  /** shield gauge score 0-100 at the time of the query. */
  shield: number;
  depth: 'surface';
}

export function loadBrainGrid(): BrainGridEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as BrainGridEntry[]).slice(0, MAX_ENTRIES) : [];
  } catch {
    return [];
  }
}

export function recordBrainGrid(entry: BrainGridEntry, session: Session | null): BrainGridEntry[] {
  const next = [entry, ...loadBrainGrid().filter((e) => !(e.q === entry.q && e.depth === entry.depth))].slice(
    0,
    MAX_ENTRIES,
  );
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* private mode / quota -- history is best-effort */
  }

  if (session) {
    try {
      const supabase = getSupabaseBrowserClient();
      void supabase
        .from('brain_grid')
        .insert({ user_id: session.user.id, query: entry.q, depth: entry.depth, shield_score: entry.shield })
        .then(() => undefined, () => undefined);
    } catch {
      /* table not applied yet / offline -- localStorage still has it */
    }
  }
  return next;
}

export function clearBrainGrid(): BrainGridEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* noop */
  }
  return [];
}
