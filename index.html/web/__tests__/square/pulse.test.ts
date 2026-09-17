import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DAY_MS,
  PULSE_EPOCH_MS,
  PULSE_HANDLES,
  PULSE_SLOT_MS,
  dayIndexOf,
  intIn,
  mulberry32,
  pickHandle,
  pickHandleUnlike,
  pickOne,
  pulseSlot,
  seedHash,
} from '@/lib/square/pulse';

// REV-40 (MISSION 4) -- REV-36 shipped FOUR modules under lib/square: the
// shared deterministic core (pulse.ts) plus three simulation engines
// (talkPulse.ts, shortsPulse.ts, exchangePulse.ts) that invented chat
// messages, view/watcher counters and market trades out of a seeded PRNG.
// The three engines are DECOMMISSIONED: the hub panels now render the real
// ledger or an honest loading/empty state, never fiction. pulse.ts survives
// because it is still the house's pure-determinism toolkit (the 5-minute
// slot cadence that drives the panels' refresh interval, the seed hash, and
// the PULSE_HANDLES identity pool that lib/live/shortsSeed.ts draws from).
//
// This file therefore covers ONLY pulse.ts's own contract. The 13 cases that
// asserted behaviour of the three deleted engines are gone with them; the
// seed-catalogue invariants they carried (44 clips, >=2 per axis, handles
// drawn from the shared pool) moved to __tests__/live/shortsSeed.test.ts.
// The structural proof that the simulation has not crept back into the UI
// lives in __tests__/square/failOpenRegression.test.ts.
//
// The contract pulse.ts must keep: it never reads the clock and never calls
// Math.random, so the server render and the first client frame agree byte
// for byte (Codex ch.8 -- offline / in-app WebView determinism). Callers
// pass `now`; every draw is a pure function of the seed.

const NOW = 1_790_000_000_000; // a fixed instant well after the pulse epoch (2026-09-16)
const SQUARE_DIR = join(__dirname, '../../lib/square');

describe('pulse core determinism', () => {
  it('pulse.ts never reads the clock or Math.random', () => {
    // Only the modules that are actually part of the determinism contract are
    // scanned. themes.ts / uRankings.ts legitimately call Date.now() at their
    // own call sites, and the three REV-36 simulation engines no longer exist
    // -- the old hard-coded four-name list turned their removal into an
    // ENOENT crash rather than a readable failure, so the list is asserted to
    // exist before it is read.
    for (const mod of ['pulse.ts']) {
      const path = join(SQUARE_DIR, mod);
      expect(existsSync(path), `${mod} is missing from lib/square`).toBe(true);
      // The actual call forms (with the open paren), so the word appearing in
      // a "no Math.random" comment does not trip the scan.
      const src = readFileSync(path, 'utf8');
      expect(src.includes('Math.random('), `${mod} uses Math.random`).toBe(false);
      expect(src.includes('Date.now('), `${mod} uses Date.now`).toBe(false);
    }
  });

  it('pulse.ts does not import the decommissioned simulation engines', () => {
    // Code only. The file header names all three on purpose -- it documents why
    // they were removed, which is exactly the prose a future reader needs. An
    // assertion over the raw text would forbid explaining the decision.
    const src = readFileSync(join(SQUARE_DIR, 'pulse.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/^[ \t]*\/\/.*$/gm, ' ');
    for (const gone of ['talkPulse', 'shortsPulse', 'exchangePulse']) {
      expect(src.includes(gone), `pulse.ts still references ${gone}`).toBe(false);
    }
  });

  it('pulseSlot is a monotonic, epoch-anchored 5-minute counter', () => {
    // Slot 0 starts at the epoch and nothing before it may go negative.
    expect(pulseSlot(PULSE_EPOCH_MS)).toBe(0);
    expect(pulseSlot(PULSE_EPOCH_MS - 1)).toBe(0);
    expect(pulseSlot(PULSE_EPOCH_MS - 10 * DAY_MS)).toBe(0);

    // The cadence is exactly PULSE_SLOT_MS, measured from a slot-aligned instant.
    const aligned = PULSE_EPOCH_MS + 1000 * PULSE_SLOT_MS;
    expect(pulseSlot(aligned)).toBe(1000);
    expect(pulseSlot(aligned + PULSE_SLOT_MS - 1)).toBe(1000);
    expect(pulseSlot(aligned + PULSE_SLOT_MS)).toBe(1001);
  });

  it('pulseSlot / dayIndexOf are monotonic non-decreasing in now', () => {
    let prevSlot = -1;
    let prevDay = -1;
    for (let t = NOW; t < NOW + 3 * 86_400_000; t += 3_600_000) {
      expect(pulseSlot(t)).toBeGreaterThanOrEqual(prevSlot);
      expect(dayIndexOf(t)).toBeGreaterThanOrEqual(prevDay);
      prevSlot = pulseSlot(t);
      prevDay = dayIndexOf(t);
    }
  });

  it('dayIndexOf advances exactly once per UTC day', () => {
    // True at any instant: a day later is exactly one day index later.
    expect(dayIndexOf(NOW + DAY_MS)).toBe(dayIndexOf(NOW) + 1);

    // The boundary itself only holds from UTC midnight -- NOW is a mid-day
    // instant, so `NOW + DAY_MS - 1` correctly lands on the NEXT index.
    const midnight = dayIndexOf(NOW) * DAY_MS;
    expect(dayIndexOf(midnight)).toBe(dayIndexOf(NOW));
    expect(dayIndexOf(midnight + DAY_MS - 1)).toBe(dayIndexOf(NOW));
    expect(dayIndexOf(midnight + DAY_MS)).toBe(dayIndexOf(NOW) + 1);

    // The ignition epoch is UTC midnight by construction.
    expect(PULSE_EPOCH_MS % DAY_MS).toBe(0);
    expect(dayIndexOf(PULSE_EPOCH_MS)).toBe(dayIndexOf(PULSE_EPOCH_MS + DAY_MS - 1));
  });

  it('seedHash is pure, uint32, and spreads neighbouring seeds far apart', () => {
    expect(seedHash('x::1')).not.toBe(seedHash('x::2'));
    expect(seedHash('x::1')).toBe(seedHash('x::1'));

    // The fmix32 finisher is what stops consecutive seeds drifting in
    // lock-step, so 500 neighbours must all land on distinct uint32 values.
    // The inputs are fixed, so this is a deterministic proof, not a sample.
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) {
      const h = seedHash(`x::${i}`);
      expect(Number.isInteger(h)).toBe(true);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThanOrEqual(0xffffffff);
      seen.add(h);
    }
    expect(seen.size).toBe(500);
  });

  it('mulberry32 is a reproducible stream in [0, 1) with no shared state', () => {
    const a = mulberry32(seedHash('room::economy'));
    const b = mulberry32(seedHash('room::economy'));
    const first = Array.from({ length: 24 }, () => a());
    const second = Array.from({ length: 24 }, () => b());
    expect(second).toEqual(first);
    for (const v of first) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
    // A different seed must not replay the same stream, and a generator that
    // has already been drawn from must not be rewound by a sibling.
    expect(Array.from({ length: 24 }, () => mulberry32(seedHash('room::politics'))())).not.toEqual(first);
    expect(a()).not.toBe(first[0]);
  });

  it('intIn and pickOne are driven only by the supplied rand', () => {
    expect(intIn(() => 0, 5, 9)).toBe(5);
    expect(intIn(() => 0.999999, 5, 9)).toBe(9);
    expect(intIn(() => 0.5, 0, 0)).toBe(0);
    const list = ['a', 'b', 'c'] as const;
    expect(pickOne(() => 0, list)).toBe('a');
    expect(pickOne(() => 0.999999, list)).toBe('c');
    // A rand that saturates at 1 must still index inside the list.
    expect(list).toContain(pickOne(() => 1, list));
  });

  it('PULSE_HANDLES is a unique pool of RPC-safe handles', () => {
    expect(PULSE_HANDLES.length).toBeGreaterThanOrEqual(13);
    expect(new Set(PULSE_HANDLES).size).toBe(PULSE_HANDLES.length);
    // The chat, exchange and reaction RPCs all validate this shape.
    for (const h of PULSE_HANDLES) expect(h, h).toMatch(/^[a-z0-9.]+$/);
    // The first thirteen are the REV-29 seed creators, so the same people
    // appear across the catalogues (lib/live/shortsSeed.ts references this).
    expect(PULSE_HANDLES.slice(0, 13)).toEqual([
      'nomad.kai',
      'pitch.side',
      'frame.zero',
      'ink.and.echo',
      'cart.mind',
      'quiet.ledger',
      'lineweight',
      'hem.line',
      'steam.rising',
      'bench.notes',
      'ward.seven',
      'proof.sketch',
      'span.wire',
    ]);
  });

  it('pickHandle / pickHandleUnlike always return a pool member, never `avoid`', () => {
    const pool = new Set(PULSE_HANDLES);
    for (let i = 0; i < 64; i++) {
      const rand = mulberry32(seedHash(`handle::${i}`));
      const h = pickHandle(rand);
      expect(pool.has(h), h).toBe(true);
      expect(pool.has(pickHandleUnlike(rand, h)), 'unlike stayed in the pool').toBe(true);
    }
    // A saturated draw that lands on `avoid` must step to the next handle.
    expect(pickHandleUnlike(() => 0, PULSE_HANDLES[0])).toBe(PULSE_HANDLES[1]);
    expect(pickHandleUnlike(() => 0, 'not-in-the-pool')).toBe(PULSE_HANDLES[0]);
  });
});
