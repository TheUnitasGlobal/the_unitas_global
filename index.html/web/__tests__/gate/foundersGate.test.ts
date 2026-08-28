import { describe, expect, it } from 'vitest';
import {
  evaluateFounderBypass,
  FOUNDER_BYPASS_GRANT_VALUE,
  FOUNDER_BYPASS_SECRET,
} from '../../lib/foundersGate';

// Pure predicate only -- no fixtures shared with other __tests__/** files
// (see CLAUDE.md "Module-level test isolation").
describe('evaluateFounderBypass', () => {
  const base = { search: '', cookie: '', storage: null };

  it('fails closed with an empty environment', () => {
    expect(evaluateFounderBypass(base)).toBe(false);
  });

  it('honours a persisted grant', () => {
    expect(evaluateFounderBypass({ ...base, storage: FOUNDER_BYPASS_GRANT_VALUE })).toBe(true);
    expect(evaluateFounderBypass({ ...base, storage: 'nope' })).toBe(false);
  });

  it('accepts ?dev=true and ?dev=1 only', () => {
    expect(evaluateFounderBypass({ ...base, search: '?dev=true' })).toBe(true);
    expect(evaluateFounderBypass({ ...base, search: '?dev=1' })).toBe(true);
    expect(evaluateFounderBypass({ ...base, search: '?dev=false' })).toBe(false);
    expect(evaluateFounderBypass({ ...base, search: '?dev=off' })).toBe(false);
  });

  it('accepts the secret via ?key= or ?bypass=', () => {
    expect(evaluateFounderBypass({ ...base, search: `?key=${FOUNDER_BYPASS_SECRET}` })).toBe(true);
    expect(evaluateFounderBypass({ ...base, search: `?bypass=${FOUNDER_BYPASS_SECRET}` })).toBe(true);
    expect(evaluateFounderBypass({ ...base, search: '?key=wrong' })).toBe(false);
  });

  it('accepts the dev cookie (exact match only)', () => {
    expect(evaluateFounderBypass({ ...base, cookie: 'a=1; unitas_dev=1; b=2' })).toBe(true);
    expect(evaluateFounderBypass({ ...base, cookie: 'unitas_dev=true' })).toBe(true);
    expect(evaluateFounderBypass({ ...base, cookie: 'unitas_dev=1x' })).toBe(false);
    expect(evaluateFounderBypass({ ...base, cookie: 'not_unitas_dev=1' })).toBe(false);
  });

  it('does not throw on a malformed search string', () => {
    expect(() => evaluateFounderBypass({ ...base, search: '%%%' })).not.toThrow();
  });
});
