'use client';

// REV-17 visit ledger WRITER (SPEC.md §3.2) -- the DOM-touching counterpart
// to the pure `lib/entry/visitLedger.ts`. Kept as a tiny, dependency-free
// module-level store (not a React hook) so any component -- the curtain,
// the Quantum White cluster grid -- can call `writeVisitLedger()` without
// wiring a provider, mirroring how `lib/uiGate.ts` and
// `components/audio/SpatialAudioProvider.ts`'s module singletons work in
// this codebase.
//
// Every write is a MERGE onto the last known record (never a blind
// replace), because the phase-persist effect, the segment effect and the
// Quantum White surface-state effect all call this independently and none
// of them knows the others' current field values.

import { VISIT_LEDGER_STORAGE_KEY, VISIT_LEDGER_VERSION, type VisitLedger } from './visitLedger';

let lastLedger: VisitLedger | null = null;

function readExisting(): VisitLedger | null {
  if (lastLedger) return lastLedger;
  try {
    const raw = window.localStorage.getItem(VISIT_LEDGER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<VisitLedger>;
    if (parsed && parsed.v === VISIT_LEDGER_VERSION && typeof parsed.phase === 'string') {
      return parsed as VisitLedger;
    }
  } catch {
    // storage unavailable or corrupt -- start fresh.
  }
  return null;
}

/**
 * Merge `partial` onto the last known ledger (or a fresh one) and persist
 * it, always stamping the current time. Silently no-ops if `localStorage`
 * is unavailable (private browsing, quota exceeded) -- the ledger is a
 * restore convenience, never a requirement for correctness (the server
 * still re-verifies `released` regardless of what this record says).
 */
export function writeVisitLedger(partial: Partial<Omit<VisitLedger, 'v' | 'at'>>): void {
  try {
    const base = readExisting();
    const next: VisitLedger = {
      v: VISIT_LEDGER_VERSION,
      at: Date.now(),
      phase: partial.phase ?? base?.phase ?? 'gate',
      segment: partial.segment ?? base?.segment,
      surface: 'surface' in partial ? partial.surface : base?.surface,
      locale: partial.locale ?? base?.locale,
    };
    lastLedger = next;
    window.localStorage.setItem(VISIT_LEDGER_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // non-fatal -- see above.
  }
}

/** Re-stamps `at` on the existing ledger without changing any field -- the heartbeat call. */
export function touchVisitLedger(): void {
  const base = readExisting();
  if (!base) return;
  writeVisitLedger(base);
}

/** Removes the ledger entirely (called on a genuine app termination -- lib/exit/appExit.ts). */
export function clearVisitLedger(): void {
  lastLedger = null;
  try {
    window.localStorage.removeItem(VISIT_LEDGER_STORAGE_KEY);
  } catch {
    // non-fatal.
  }
}

/** Test-only escape hatch to reset the in-memory cache between cases. */
export function __resetVisitLedgerCacheForTests(): void {
  lastLedger = null;
}
