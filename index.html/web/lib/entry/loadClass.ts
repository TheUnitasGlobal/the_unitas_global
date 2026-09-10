// REV-17 document-load classifier (SPEC.md §3.1) -- pure, framework-agnostic.
//
// The re-entry reset doctrine (owner instruction 2026-09-05, round 11, item
// 3 -- `lib/splash/splashTimeline.ts`'s `shouldResetEntrySession`) only ever
// distinguished `reload` from "everything else". That binary missed three
// real document loads that are not a genuine re-entry either: a browser tab
// discarded for memory and restored, a WebKit process purge/restore, and an
// installed App's cold relaunch shortly after being backgrounded. All three
// carry a `navigationType` other than `reload` (`back_forward` or
// `navigate`), so the old rule wiped the visitor's session and replayed the
// entry gate + ad cinema even though the visitor never left the tab.
//
// `classifyDocumentLoad` widens the binary into three classes -- `refresh`
// (treat like reload: keep everything), `restore` (recover state from a
// secondary signal), `entry` (the visitor is arriving fresh -- wipe and show
// the logo page). Every branch is total and ordered by signal strength so
// there is no unreachable case.

export type DocumentLoadClass = 'refresh' | 'restore' | 'entry';

export interface LoadSignals {
  /** `PerformanceNavigationTiming.type` (or the legacy `performance.navigation.type` mapped to the same strings). */
  navigationType: string | null;
  /** `document.wasDiscarded === true` (Chromium tab-discard restore signal). */
  wasDiscarded: boolean;
  /** `sessionStorage[CINEMA_PHASE_STORAGE_KEY]` exists (the curtain had already reached a real phase). */
  hasPhaseRecord: boolean;
  /** `sessionStorage['unitas_leave_at']` exists -- the previous document fired `pagehide` and exited cleanly (a genuine navigation away). Its ABSENCE alongside a live phase record means the document died without warning (purge/crash/kill), not that the visitor left. */
  leaveStampPresent: boolean;
  /** `display-mode: standalone|minimal-ui|window-controls-overlay` or `navigator.standalone === true`. */
  standalone: boolean;
  /** Age (ms) of the persisted visit ledger, or `null` if there is none / it is unreadable. */
  ledgerAgeMs: number | null;
  /** `?splash=0|off|false` -- the QA/E2E opt-out that always keeps state. */
  qaKeepState: boolean;
  /** `sessionStorage['unitas_handoff']` exists -- this document load is a same-tab, self-initiated document REPLACEMENT (e.g. the standalone locale prefetch redirect), not an arrival from elsewhere. */
  handoff: boolean;
}

/** How long a standalone (installed App) visit ledger stays eligible for a cold-relaunch restore. */
export const VISIT_LEDGER_TTL_MS = 30 * 60 * 1000;

/**
 * Pure decision function -- see SPEC.md §3.1's table for the full case list
 * this was derived from. Order matters: earlier branches are stronger
 * signals and must be checked first.
 */
export function classifyDocumentLoad(signals: LoadSignals): DocumentLoadClass {
  if (signals.qaKeepState) return 'refresh';
  if (signals.handoff) return 'refresh'; // R0: a same-tab hand-off is a continuation, not an arrival.
  if ((signals.navigationType ?? '').trim().toLowerCase() === 'reload') return 'refresh';
  // R1: Chromium discarded this tab for memory and just restored it.
  if (signals.wasDiscarded && signals.hasPhaseRecord) return 'restore';
  // R2: the document had a live phase but never fired pagehide -- it died
  // without a normal navigation (WebKit purge, crash, OS process kill).
  if (signals.hasPhaseRecord && !signals.leaveStampPresent) return 'restore';
  // R3: an installed App cold-relaunching within the visit ledger's window.
  if (
    !signals.hasPhaseRecord &&
    signals.standalone &&
    signals.ledgerAgeMs !== null &&
    signals.ledgerAgeMs < VISIT_LEDGER_TTL_MS
  ) {
    return 'restore';
  }
  return 'entry';
}
