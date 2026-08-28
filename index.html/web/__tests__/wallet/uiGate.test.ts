import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __resetGateForTests,
  acquireGate,
  forceGate,
  getGateOwner,
  isGateBlockedFor,
  releaseGate,
  subscribeGate,
} from '../../lib/uiGate';

// No fixtures shared with other __tests__/** files -- see CLAUDE.md
// "Module-level test isolation". This file only exercises the pure gate store.
describe('uiGate', () => {
  beforeEach(() => __resetGateForTests());
  afterEach(() => __resetGateForTests());

  it('starts with no owner', () => {
    expect(getGateOwner()).toBeNull();
  });

  it('grants the gate to the first acquirer and blocks everyone else', () => {
    expect(acquireGate('nav:charge')).toBe(true);
    expect(getGateOwner()).toBe('nav:charge');
    expect(acquireGate('nav:balance')).toBe(false);
    expect(isGateBlockedFor('nav:balance')).toBe(true);
    expect(isGateBlockedFor('nav:charge')).toBe(false);
  });

  it('acquire is idempotent for the current owner', () => {
    acquireGate('nav:charge');
    expect(acquireGate('nav:charge')).toBe(true);
    expect(getGateOwner()).toBe('nav:charge');
  });

  it('only the owner can release', () => {
    acquireGate('nav:charge');
    releaseGate('nav:balance');
    expect(getGateOwner()).toBe('nav:charge');
    releaseGate('nav:charge');
    expect(getGateOwner()).toBeNull();
  });

  it('forceGate evicts the current owner (deliberate hand-off)', () => {
    acquireGate('home:search');
    forceGate('home:module');
    expect(getGateOwner()).toBe('home:module');
  });

  it('notifies subscribers on every owner change and stops after unsubscribe', () => {
    const spy = vi.fn();
    const unsub = subscribeGate(spy);
    acquireGate('nav:charge');
    releaseGate('nav:charge');
    expect(spy).toHaveBeenCalledTimes(2);
    unsub();
    acquireGate('nav:balance');
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('a no-op acquire does not notify subscribers', () => {
    acquireGate('nav:charge');
    const spy = vi.fn();
    subscribeGate(spy);
    expect(acquireGate('nav:balance')).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });
});
