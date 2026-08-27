import { describe, expect, it } from 'vitest';
import { acquireGate, IDLE_GATE, isGateBlocked, releaseGate } from '../../lib/uiGate';

// One file per concern, no fixtures shared with other __tests__/** files
// (see CLAUDE.md "Module-level test isolation"). This only exercises the
// pure gate transitions used by the site-wide mutual-exclusion lock; it
// never touches React, the DOM, or any other surface's runtime.
describe('uiGate', () => {
  it('acquires the gate from idle', () => {
    const next = acquireGate(IDLE_GATE, 'nav:auth');
    expect(next.activeId).toBe('nav:auth');
    expect(next.scrollLocked).toBe(false);
  });

  it('carries the scroll-lock flag for modal surfaces', () => {
    expect(acquireGate(IDLE_GATE, 'home:ecosystem', true).scrollLocked).toBe(true);
  });

  it('blocks a second surface while one is held, without mutating state', () => {
    const held = acquireGate(IDLE_GATE, 'home:search');
    const attempt = acquireGate(held, 'nav:auth');
    expect(attempt).toBe(held); // same reference => caller sees the block
    expect(isGateBlocked(held, 'nav:auth')).toBe(true);
    expect(isGateBlocked(held, 'home:search')).toBe(false);
  });

  it('lets the current holder re-acquire and update its scroll lock', () => {
    const held = acquireGate(IDLE_GATE, 'home:search');
    const relocked = acquireGate(held, 'home:search', true);
    expect(relocked.activeId).toBe('home:search');
    expect(relocked.scrollLocked).toBe(true);
  });

  it('releases only when the holder asks', () => {
    const held = acquireGate(IDLE_GATE, 'nav:language');
    expect(releaseGate(held, 'nav:auth')).toBe(held); // wrong id: no-op
    expect(releaseGate(held, 'nav:language')).toBe(IDLE_GATE);
  });

  it('is idle again after a full acquire/release cycle', () => {
    let state = acquireGate(IDLE_GATE, 'home:module', true);
    state = releaseGate(state, 'home:module');
    expect(state.activeId).toBeNull();
    expect(isGateBlocked(state, 'anything')).toBe(false);
    expect(acquireGate(state, 'nav:charge').activeId).toBe('nav:charge');
  });
});
