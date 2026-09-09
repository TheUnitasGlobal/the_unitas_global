import { describe, expect, it } from 'vitest';
import {
  classifySpendError,
  planInvestment,
  reduceOneClick,
  UPAY_OPEN_KINDS,
  type OneClickEvent,
  type OneClickState,
} from '../../lib/upay/oneClick';
import { UPAY_UNIVERSAL_ACCESS, UPAY_UNIVERSAL_COSTS } from '../../lib/upay/universal';
import type { ClusterModule } from '../../lib/quantumWhite/clusters';

// One file per concern, no fixtures shared with other __tests__/** files
// (CLAUDE.md "Module-level test isolation"). Pure-function coverage for the
// REV-13 U-Pay 1-click state machine + decision helpers -- no React, no
// Supabase, no DOM. `ClusterModule` is a TYPE-only import (see
// lib/upay/oneClick.ts's own doc comment on why), so these literals are
// built by hand rather than pulled from the real Singularity Core catalog.

function makeModule(
  overrides: Pick<ClusterModule, 'kind' | 'accessName' | 'coinCost'> & Partial<ClusterModule>,
): ClusterModule {
  return {
    id: `${overrides.kind}:test`,
    key: 'test',
    href: '/test',
    hasRoute: true,
    color: '#0b5cff',
    i18n: { titleKey: 'Test.title', descriptionKey: 'Test.description' },
    ...overrides,
  };
}

describe('reduceOneClick', () => {
  const idle: OneClickState = { status: 'idle' };

  it('arm -> arming', () => {
    expect(reduceOneClick(idle, { type: 'arm' })).toEqual({ status: 'arming' });
  });

  it('disarm -> idle', () => {
    expect(reduceOneClick({ status: 'arming' }, { type: 'disarm' })).toEqual({ status: 'idle' });
  });

  it('execute -> executing', () => {
    expect(reduceOneClick({ status: 'arming' }, { type: 'execute' })).toEqual({ status: 'executing' });
  });

  it('succeed -> success, carrying balanceAfter and reused', () => {
    expect(
      reduceOneClick({ status: 'executing' }, { type: 'succeed', balanceAfter: 42, reused: false }),
    ).toEqual({ status: 'success', balanceAfter: 42, reused: false });
  });

  it('succeed with a null balance (RPC returned a non-numeric result)', () => {
    expect(
      reduceOneClick({ status: 'executing' }, { type: 'succeed', balanceAfter: null, reused: true }),
    ).toEqual({ status: 'success', balanceAfter: null, reused: true });
  });

  it('succeed without an explicit reused flag leaves it undefined', () => {
    const next = reduceOneClick({ status: 'executing' }, { type: 'succeed', balanceAfter: 10 });
    expect(next).toEqual({ status: 'success', balanceAfter: 10, reused: undefined });
  });

  it('block -> blocked, carrying the reason', () => {
    for (const reason of ['signin', 'guest', 'insufficient', 'shield', 'unlisted', 'phone'] as const) {
      expect(reduceOneClick({ status: 'executing' }, { type: 'block', reason })).toEqual({
        status: 'blocked',
        reason,
      });
    }
  });

  it('fail -> failed, carrying the message', () => {
    expect(reduceOneClick({ status: 'executing' }, { type: 'fail', message: 'boom' })).toEqual({
      status: 'failed',
      message: 'boom',
    });
  });

  it('reset -> idle from any state', () => {
    const states: OneClickState[] = [
      { status: 'idle' },
      { status: 'arming' },
      { status: 'executing' },
      { status: 'success', balanceAfter: 5, reused: false },
      { status: 'blocked', reason: 'insufficient' },
      { status: 'failed', message: 'x' },
    ];
    for (const state of states) {
      expect(reduceOneClick(state, { type: 'reset' })).toEqual({ status: 'idle' });
    }
  });

  it('is a pure function of the event alone (same event, different prior state, same result)', () => {
    const event: OneClickEvent = { type: 'block', reason: 'shield' };
    const fromIdle = reduceOneClick({ status: 'idle' }, event);
    const fromExecuting = reduceOneClick({ status: 'executing' }, event);
    expect(fromIdle).toEqual(fromExecuting);
  });
});

describe('classifySpendError', () => {
  it('maps "Insufficient balance" -> insufficient', () => {
    expect(classifySpendError('Insufficient balance')).toBe('insufficient');
  });

  it('maps "Unknown module: %" -> unlisted', () => {
    expect(classifySpendError('Unknown module: lockin:nexus')).toBe('unlisted');
  });

  it('maps "Phone verification required before spending coins" -> phone', () => {
    expect(classifySpendError('Phone verification required before spending coins')).toBe('phone');
  });

  it('maps "Not authenticated" -> auth', () => {
    expect(classifySpendError('Not authenticated')).toBe('auth');
  });

  it('is case-insensitive', () => {
    expect(classifySpendError('INSUFFICIENT BALANCE')).toBe('insufficient');
  });

  it('maps anything else -> unknown', () => {
    expect(classifySpendError('Wallet not found')).toBe('unknown');
    expect(classifySpendError('')).toBe('unknown');
    expect(classifySpendError('a totally unrelated message')).toBe('unknown');
  });
});

describe('planInvestment', () => {
  it('ecosystem: executable, plans the exact access name and amount', () => {
    const plan = planInvestment(makeModule({ kind: 'ecosystem', accessName: 'echo', coinCost: 2 }));
    expect(plan).toEqual({ accessName: 'echo', amount: 2, executable: true });
  });

  it('b2c: executable, plans the capitalised ledger name', () => {
    const plan = planInvestment(makeModule({ kind: 'b2c', accessName: 'Arche', coinCost: 3 }));
    expect(plan).toEqual({ accessName: 'Arche', amount: 3, executable: true });
  });

  it('lockin: executable at the universal lock-in cost', () => {
    const plan = planInvestment(
      makeModule({ kind: 'lockin', accessName: 'nexus', coinCost: UPAY_UNIVERSAL_COSTS.lockin }),
    );
    expect(plan).toEqual({ accessName: 'nexus', amount: 2, executable: true });
  });

  it('b2b: executable unconditionally -- its Coming-Soon route is always reachable', () => {
    const plan = planInvestment(
      makeModule({ kind: 'b2b', accessName: 'u-signature', coinCost: UPAY_UNIVERSAL_COSTS.b2b }),
    );
    expect(plan).toEqual({ accessName: 'u-signature', amount: 5, executable: true });
  });

  it('lifeos: not executable for the public -- reason "unlisted" -- even with an access name', () => {
    const plan = planInvestment(
      makeModule({ kind: 'lifeos', accessName: 'second-brain', coinCost: UPAY_UNIVERSAL_COSTS.lifeos }),
    );
    expect(plan).toEqual({ accessName: 'second-brain', amount: 3, executable: false, reason: 'unlisted' });
  });

  it('lifeos: executable for a verified founder', () => {
    const plan = planInvestment(
      makeModule({ kind: 'lifeos', accessName: 'second-brain', coinCost: UPAY_UNIVERSAL_COSTS.lifeos }),
      { founder: true },
    );
    expect(plan).toEqual({ accessName: 'second-brain', amount: 3, executable: true });
  });

  it('lifeos: a founder flag never opens any other kind further (no-op for ecosystem)', () => {
    const plan = planInvestment(
      makeModule({ kind: 'ecosystem', accessName: 'echo', coinCost: 2 }),
      { founder: true },
    );
    expect(plan).toEqual({ accessName: 'echo', amount: 2, executable: true });
  });

  it('no access name at all -> not executable, reason "unlisted"', () => {
    const plan = planInvestment(makeModule({ kind: 'ecosystem', accessName: null, coinCost: 2 }));
    expect(plan).toEqual({ accessName: '', amount: 2, executable: false, reason: 'unlisted' });
  });

  it('zero cost on an otherwise-open kind -> not executable, reason "free"', () => {
    const plan = planInvestment(makeModule({ kind: 'ecosystem', accessName: 'echo', coinCost: 0 }));
    expect(plan).toEqual({ accessName: 'echo', amount: 0, executable: false, reason: 'free' });
  });

  it('UPAY_OPEN_KINDS is exactly ecosystem / b2c / lockin / b2b (lifeos is founder-gated separately)', () => {
    expect(UPAY_OPEN_KINDS.has('ecosystem')).toBe(true);
    expect(UPAY_OPEN_KINDS.has('b2c')).toBe(true);
    expect(UPAY_OPEN_KINDS.has('lockin')).toBe(true);
    expect(UPAY_OPEN_KINDS.has('b2b')).toBe(true);
    expect(UPAY_OPEN_KINDS.has('lifeos')).toBe(false);
  });
});

describe('UPAY_UNIVERSAL_ACCESS', () => {
  it('has exactly 16 entries (8 lock-in + 3 enterprise + 5 life-os)', () => {
    expect(Object.keys(UPAY_UNIVERSAL_ACCESS)).toHaveLength(16);
  });

  it('disambiguates the lock-in oracle from the ecosystem oracle', () => {
    expect(UPAY_UNIVERSAL_ACCESS['lockin:oracle']).toBe('oracle-lockin');
  });
});
