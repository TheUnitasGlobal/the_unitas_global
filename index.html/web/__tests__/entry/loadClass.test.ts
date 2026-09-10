import { describe, expect, it } from 'vitest';
import { VISIT_LEDGER_TTL_MS, classifyDocumentLoad, type LoadSignals } from '../../lib/entry/loadClass';

// Module-level test isolation (CLAUDE.md) -- pure decision-table assertions
// only, no DOM, no fixtures shared with other __tests__/** files. See
// SPEC.md §3.1 for the case table this mirrors.

const BASE: LoadSignals = {
  navigationType: 'navigate',
  wasDiscarded: false,
  hasPhaseRecord: false,
  leaveStampPresent: false,
  standalone: false,
  ledgerAgeMs: null,
  qaKeepState: false,
  handoff: false,
};

function signals(overrides: Partial<LoadSignals>): LoadSignals {
  return { ...BASE, ...overrides };
}

describe('classifyDocumentLoad (SPEC.md §3.1)', () => {
  it('QA opt-out (?splash=0) always keeps state, whatever else is true', () => {
    expect(classifyDocumentLoad(signals({ qaKeepState: true }))).toBe('refresh');
    expect(classifyDocumentLoad(signals({ qaKeepState: true, hasPhaseRecord: true, leaveStampPresent: true }))).toBe(
      'refresh',
    );
  });

  it('R0: a same-tab hand-off (e.g. the standalone locale redirect) is a continuation', () => {
    expect(classifyDocumentLoad(signals({ handoff: true, navigationType: 'navigate' }))).toBe('refresh');
  });

  it('a genuine reload keeps state regardless of every other signal', () => {
    expect(classifyDocumentLoad(signals({ navigationType: 'reload' }))).toBe('refresh');
    expect(
      classifyDocumentLoad(
        signals({ navigationType: 'RELOAD', hasPhaseRecord: false, leaveStampPresent: true, wasDiscarded: false }),
      ),
    ).toBe('refresh');
  });

  it('R1: a Chromium tab discarded for memory and restored, with a live phase record, restores in place', () => {
    expect(classifyDocumentLoad(signals({ wasDiscarded: true, hasPhaseRecord: true, navigationType: 'back_forward' }))).toBe(
      'restore',
    );
  });

  it('R1 requires a live phase record -- a discard flag alone (no phase) is a genuine entry', () => {
    expect(classifyDocumentLoad(signals({ wasDiscarded: true, hasPhaseRecord: false }))).toBe('entry');
  });

  it('R2: a live phase record with no leave stamp (document died without a normal exit) restores in place', () => {
    expect(classifyDocumentLoad(signals({ hasPhaseRecord: true, leaveStampPresent: false, navigationType: 'navigate' }))).toBe(
      'restore',
    );
  });

  it('a live phase record WITH a leave stamp present is a genuine entry (the previous document exited normally)', () => {
    expect(classifyDocumentLoad(signals({ hasPhaseRecord: true, leaveStampPresent: true, navigationType: 'navigate' }))).toBe(
      'entry',
    );
    expect(
      classifyDocumentLoad(signals({ hasPhaseRecord: true, leaveStampPresent: true, navigationType: 'back_forward' })),
    ).toBe('entry');
  });

  it('R3: an installed App cold-relaunching within the visit ledger TTL restores from the ledger', () => {
    expect(
      classifyDocumentLoad(
        signals({ standalone: true, hasPhaseRecord: false, ledgerAgeMs: VISIT_LEDGER_TTL_MS - 1, navigationType: 'navigate' }),
      ),
    ).toBe('restore');
    expect(classifyDocumentLoad(signals({ standalone: true, hasPhaseRecord: false, ledgerAgeMs: 0 }))).toBe('restore');
  });

  it('R3 does not fire past the TTL, outside standalone, or when a ledger record is entirely absent', () => {
    expect(classifyDocumentLoad(signals({ standalone: true, ledgerAgeMs: VISIT_LEDGER_TTL_MS }))).toBe('entry');
    expect(classifyDocumentLoad(signals({ standalone: true, ledgerAgeMs: VISIT_LEDGER_TTL_MS + 1 }))).toBe('entry');
    expect(classifyDocumentLoad(signals({ standalone: false, ledgerAgeMs: 100 }))).toBe('entry');
    expect(classifyDocumentLoad(signals({ standalone: true, ledgerAgeMs: null }))).toBe('entry');
  });

  it('a plain fresh entry (new tab, typed URL, external link) with no signals at all is `entry`', () => {
    expect(classifyDocumentLoad(BASE)).toBe('entry');
  });

  it('a bare `navigate`/`back_forward`/`prerender` with nothing else set is always `entry`', () => {
    for (const navigationType of ['navigate', 'back_forward', 'prerender', null, undefined]) {
      expect(classifyDocumentLoad(signals({ navigationType })), String(navigationType)).toBe('entry');
    }
  });
});
