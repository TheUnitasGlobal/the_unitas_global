import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { UNITAS_MAIL_DOMAIN, normalizeHandle, validateHandle, type HandleAvailability } from '@/lib/auth/unitasHandle';

// Server-only by convention (node:crypto) -- import from Route Handlers.

/**
 * REV-19 follow-up -- the `@theunitas.global` handle UNIQUENESS ledger.
 *
 * Zero schema change: reservations are rows of the existing service-role-
 * only `genesis_memory` table (RLS force-enabled, no policy -- see
 * supabase/migrations/20260908000000_u_ai_genesis_memory.sql) under the
 * disjoint `mh-v1::` hash namespace, the same way ranking detail (`rd-v1`)
 * and the 6-axis redesign (`cr-v1`) already share it. `query_hash` is the
 * PRIMARY KEY, so a plain INSERT is the atomic claim: two accounts racing
 * for one handle can never both succeed -- Postgres keeps exactly one and
 * answers the other with 23505. The payload records who holds it.
 *
 * Fail-open where honesty allows: with no service role / no Supabase the
 * availability probe answers `unchecked` (the form still submits, the
 * claim re-runs at the next sign-in) and the claim answers `error`
 * (nothing is bound, nothing is promised).
 */

export const MAIL_HANDLE_NAMESPACE = 'mh-v1';
const TABLE = 'genesis_memory';
const LEDGER_LOCALE = 'global';
const LEDGER_MODEL = 'mail-handle-reservation';

export interface HandleLedgerRow {
  kind: 'mail-handle';
  handle: string;
  user_id: string;
  claimed_at: string;
}

export function mailHandleHash(handle: string): string {
  const h = normalizeHandle(handle);
  return `${MAIL_HANDLE_NAMESPACE}::${createHash('sha256').update(`${MAIL_HANDLE_NAMESPACE}::${h}`).digest('hex')}`;
}

export function mailHandleAddress(handle: string): string {
  return `${normalizeHandle(handle)}@${UNITAS_MAIL_DOMAIN}`;
}

function rowOf(payload: unknown): HandleLedgerRow | null {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as Partial<HandleLedgerRow>;
  if (p.kind !== 'mail-handle' || typeof p.handle !== 'string' || typeof p.user_id !== 'string') return null;
  return { kind: 'mail-handle', handle: p.handle, user_id: p.user_id, claimed_at: typeof p.claimed_at === 'string' ? p.claimed_at : '' };
}

/** Who holds `handle` (null = nobody). Throws on transport errors so the
 *  caller can answer `unchecked` instead of a false `available`. */
export async function lookupHandleOwner(admin: SupabaseClient, handle: string): Promise<HandleLedgerRow | null> {
  const { data, error } = await admin.from(TABLE).select('payload').eq('query_hash', mailHandleHash(handle)).maybeSingle();
  if (error) throw error;
  return rowOf((data as { payload?: unknown } | null)?.payload);
}

/** Availability of a syntactically VALID handle. */
export async function handleAvailability(admin: SupabaseClient | null, handle: string): Promise<HandleAvailability> {
  if (!admin) return 'unchecked';
  try {
    const owner = await lookupHandleOwner(admin, handle);
    return owner ? 'taken' : 'available';
  } catch {
    return 'unchecked';
  }
}

export type ClaimOutcome = 'claimed' | 'already-owner' | 'taken' | 'error';

/** Atomically bind `handle` to `userId`. Idempotent for the same owner. */
export async function claimHandle(admin: SupabaseClient, handle: string, userId: string): Promise<ClaimOutcome> {
  if (validateHandle(handle) !== 'ok') return 'error';
  const h = normalizeHandle(handle);
  const row: HandleLedgerRow = { kind: 'mail-handle', handle: h, user_id: userId, claimed_at: new Date().toISOString() };
  const { error } = await admin
    .from(TABLE)
    .insert({ query_hash: mailHandleHash(h), locale: LEDGER_LOCALE, payload: row, model: LEDGER_MODEL });
  if (!error) return 'claimed';
  const code = (error as { code?: string }).code;
  if (code === '23505') {
    try {
      const owner = await lookupHandleOwner(admin, h);
      if (owner && owner.user_id === userId) return 'already-owner';
      return 'taken';
    } catch {
      return 'error';
    }
  }
  return 'error';
}

/** Release every handle `userId` holds (account deletion). Best-effort. */
export async function releaseHandlesOf(admin: SupabaseClient, userId: string): Promise<void> {
  try {
    await admin
      .from(TABLE)
      .delete()
      .like('query_hash', `${MAIL_HANDLE_NAMESPACE}::%`)
      .eq('payload->>user_id', userId);
  } catch {
    // the ledger row outliving a deleted account only over-protects the handle.
  }
}

/** Tiny per-instance token bucket for the public availability probe. */
const buckets = new Map<string, { tokens: number; at: number }>();
export const PROBE_BURST = 30;
export const PROBE_REFILL_PER_SEC = 0.5;

export function probeAllowed(key: string, now = Date.now()): boolean {
  const b = buckets.get(key) ?? { tokens: PROBE_BURST, at: now };
  const refill = ((now - b.at) / 1000) * PROBE_REFILL_PER_SEC;
  b.tokens = Math.min(PROBE_BURST, b.tokens + refill);
  b.at = now;
  if (b.tokens < 1) {
    buckets.set(key, b);
    return false;
  }
  b.tokens -= 1;
  buckets.set(key, b);
  if (buckets.size > 5000) buckets.clear();
  return true;
}
