// REV-17 visit ledger (SPEC.md §3.2) -- pure serialize/parse for the
// `localStorage['unitas_visit_ledger']` record an installed App uses to
// restore its position after a cold relaunch (see loadClass.ts's R3
// branch). Deliberately holds only what's needed to recover PLACE, never
// identity or entitlement -- `released` is always re-verified against the
// server regardless of what this record says (see ComingSoonCinema.tsx's
// existing sovereign verification flow, unchanged by this file).

export const VISIT_LEDGER_STORAGE_KEY = 'unitas_visit_ledger';
export const VISIT_LEDGER_VERSION = 1;

export interface VisitLedger {
  v: 1;
  /** `Date.now()` at the moment this record was last written. */
  at: number;
  /** The curtain phase at write time ('gate' | 'cinema' | 'sealed' | 'released'). */
  phase: string;
  /** Cinema segment id (1-5), only meaningful while `phase === 'cinema'`. */
  segment?: string;
  /** Encoded Quantum White surface state (see quantumWhite/surfaceState.ts), only meaningful while `phase === 'released'`. */
  surface?: string;
  /** Active locale at write time, for a faithful restore. */
  locale?: string;
}

export function serializeLedger(ledger: VisitLedger): string {
  return JSON.stringify(ledger);
}

/**
 * Pure parse + TTL check. Returns `null` for anything malformed, wrong
 * version, or older than `ttlMs`, so a caller never has to re-validate the
 * shape itself.
 */
export function parseLedger(
  raw: string | null | undefined,
  now: number,
  ttlMs: number = VISIT_LEDGER_TTL_MS_DEFAULT,
): VisitLedger | null {
  if (!raw) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object') return null;
  const record = data as Record<string, unknown>;
  if (record.v !== VISIT_LEDGER_VERSION) return null;
  if (typeof record.at !== 'number' || !Number.isFinite(record.at)) return null;
  if (typeof record.phase !== 'string' || record.phase.length === 0) return null;
  if (now - record.at > ttlMs || now - record.at < 0) return null;
  const ledger: VisitLedger = { v: 1, at: record.at, phase: record.phase };
  if (typeof record.segment === 'string') ledger.segment = record.segment;
  if (typeof record.surface === 'string') ledger.surface = record.surface;
  if (typeof record.locale === 'string') ledger.locale = record.locale;
  return ledger;
}

/** Re-exported so callers don't need a second import from loadClass.ts just for this constant. */
const VISIT_LEDGER_TTL_MS_DEFAULT = 30 * 60 * 1000;
