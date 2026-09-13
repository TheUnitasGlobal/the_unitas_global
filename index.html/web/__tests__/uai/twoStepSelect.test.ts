import { describe, expect, it } from 'vitest';
import { nextArmedId, nextSelectState } from '../../lib/uai/twoStepSelect';

// Pure helpers only -- no fixtures shared with other __tests__/** files
// (see CLAUDE.md "Module-level test isolation").

describe('nextSelectState', () => {
  it('first click arms without opening -- the whole point of M2.3', () => {
    expect(nextSelectState(false, 'click')).toEqual({ selected: true, open: false });
  });

  it('a second click on an armed title opens it', () => {
    expect(nextSelectState(true, 'click')).toEqual({ selected: true, open: true });
  });

  it('a double-click opens straight away from either state', () => {
    expect(nextSelectState(false, 'dblclick')).toEqual({ selected: true, open: true });
    expect(nextSelectState(true, 'dblclick')).toEqual({ selected: true, open: true });
  });

  it('never opens on the very first interaction with a cold title', () => {
    // The reported confusion: one stray click produced a popup.
    expect(nextSelectState(false, 'click').open).toBe(false);
  });

  it('is idempotent once armed -- repeated clicks keep opening, never disarm', () => {
    let s = nextSelectState(false, 'click');
    expect(s.open).toBe(false);
    s = nextSelectState(s.selected, 'click');
    expect(s).toEqual({ selected: true, open: true });
    s = nextSelectState(s.selected, 'click');
    expect(s).toEqual({ selected: true, open: true });
  });
});

describe('nextArmedId', () => {
  it('arming a cold title only moves the highlight', () => {
    expect(nextArmedId(null, 'a', 'click')).toEqual({ armed: 'a', open: false });
  });

  it('clicking the already-armed title opens it', () => {
    expect(nextArmedId('a', 'a', 'click')).toEqual({ armed: 'a', open: true });
  });

  it('moving to a DIFFERENT title re-arms instead of opening', () => {
    // Otherwise a visitor scanning down a list of sub-headings would trip a
    // popup on the second heading they touched.
    expect(nextArmedId('a', 'b', 'click')).toEqual({ armed: 'b', open: false });
  });

  it('a double-click on any title opens it regardless of what was armed', () => {
    expect(nextArmedId('a', 'b', 'dblclick')).toEqual({ armed: 'b', open: true });
    expect(nextArmedId(null, 'b', 'dblclick')).toEqual({ armed: 'b', open: true });
  });
});
