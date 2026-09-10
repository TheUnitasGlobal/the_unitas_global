import { describe, expect, it } from 'vitest';
import { VISIT_LEDGER_VERSION, parseLedger, serializeLedger, type VisitLedger } from '../../lib/entry/visitLedger';

// Module-level test isolation (CLAUDE.md) -- pure serialize/parse/TTL
// assertions only, no DOM, no localStorage.

const NOW = 1_000_000_000;
const TTL = 30 * 60 * 1000;

function ledger(overrides: Partial<VisitLedger> = {}): VisitLedger {
  return { v: 1, at: NOW, phase: 'released', ...overrides };
}

describe('serializeLedger / parseLedger (SPEC.md §3.2)', () => {
  it('round-trips a full record', () => {
    const record = ledger({ segment: '3', surface: 'core/cognitive', locale: 'ko' });
    const parsed = parseLedger(serializeLedger(record), NOW, TTL);
    expect(parsed).toEqual(record);
  });

  it('round-trips a minimal record (phase only)', () => {
    const record = ledger();
    const parsed = parseLedger(serializeLedger(record), NOW, TTL);
    expect(parsed).toEqual(record);
  });

  it('returns null for missing, malformed, or empty input', () => {
    expect(parseLedger(null, NOW, TTL)).toBeNull();
    expect(parseLedger(undefined, NOW, TTL)).toBeNull();
    expect(parseLedger('', NOW, TTL)).toBeNull();
    expect(parseLedger('not json', NOW, TTL)).toBeNull();
    expect(parseLedger('42', NOW, TTL)).toBeNull();
    expect(parseLedger('null', NOW, TTL)).toBeNull();
  });

  it('rejects a record from the wrong schema version', () => {
    const raw = JSON.stringify({ ...ledger(), v: 2 });
    expect(parseLedger(raw, NOW, TTL)).toBeNull();
  });

  it('rejects a record missing a numeric `at` or a non-empty `phase`', () => {
    expect(parseLedger(JSON.stringify({ v: VISIT_LEDGER_VERSION, phase: 'gate' }), NOW, TTL)).toBeNull();
    expect(parseLedger(JSON.stringify({ v: VISIT_LEDGER_VERSION, at: NOW, phase: '' }), NOW, TTL)).toBeNull();
    expect(parseLedger(JSON.stringify({ v: VISIT_LEDGER_VERSION, at: 'x', phase: 'gate' }), NOW, TTL)).toBeNull();
  });

  it('expires a record older than the TTL, and rejects a record from the future', () => {
    expect(parseLedger(serializeLedger(ledger({ at: NOW - TTL - 1 })), NOW, TTL)).toBeNull();
    expect(parseLedger(serializeLedger(ledger({ at: NOW - TTL })), NOW, TTL)).not.toBeNull();
    expect(parseLedger(serializeLedger(ledger({ at: NOW + 1 })), NOW, TTL)).toBeNull();
  });

  it('drops optional fields that are the wrong type instead of throwing', () => {
    const raw = JSON.stringify({ v: 1, at: NOW, phase: 'gate', segment: 3, surface: null, locale: 7 });
    expect(parseLedger(raw, NOW, TTL)).toEqual({ v: 1, at: NOW, phase: 'gate' });
  });
});
