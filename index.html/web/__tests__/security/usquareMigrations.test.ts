import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  EXPECTED_FUNCTIONS,
  EXPECTED_TABLE,
  USQUARE_MIGRATIONS,
  isScopedCountsSignature,
  verdictFor,
} from '../../../scripts/apply-usquare-migrations.mjs';

// The live U-Square schema was reported as applied for three revisions while
// none of it existed. These cases pin the two things that made that possible:
// the wrong filename (nothing is sent, and the error looks unrelated) and the
// wrong order (the retired one-argument overload comes back to life).

// The runner resolves every manifest entry against the repo root
// (scripts/apply-usquare-migrations.mjs: `path.resolve(here, '..')`), which is
// index.html/ -- two levels above this file's package.
const REPO_ROOT = join(__dirname, '../../..');

const table = [EXPECTED_TABLE];
const fn = (proname: string, args: string) => ({ proname, args });
const allFunctions = [
  fn('hub_market_pulse', ''),
  fn('hub_shorts_counts', 'p_kind text, p_targets text[]'),
  fn('hub_shorts_sync', 'p_kind text'),
  fn('hub_shorts_toggle', 'p_kind text, p_target text'),
];

describe('U-Square migration manifest', () => {
  it('names files that exist, in dependency order', () => {
    expect(USQUARE_MIGRATIONS).toEqual([
      'supabase/migrations/20260917000000_hub_shorts_reactions_and_market_pulse.sql',
      'supabase/migrations/20260918000000_hub_shorts_counts_scope.sql',
    ]);
  });

  // The whole point of the manifest is that the runner never dies on ENOENT
  // again, so the "exist" half of the case above has to touch the disk. A
  // rename, a move or a deletion must fail here, not at 2am against the live
  // database, and an empty file is just as useless as a missing one.
  it('names files that are really on disk, and are not empty', () => {
    for (const file of USQUARE_MIGRATIONS) {
      const abs = join(REPO_ROOT, file);
      expect(existsSync(abs), `${file} is not on disk at ${abs}`).toBe(true);
      expect(statSync(abs).isFile(), `${file} is not a file`).toBe(true);
      expect(statSync(abs).size, `${file} is empty`).toBeGreaterThan(0);
    }
  });

  it('never names the file the founder-facing docs got wrong', () => {
    // 20260917000000_hub_exchange_and_rooms.sql is the name of 20260916000000.
    // Passing it to the runner throws ENOENT before anything is sent.
    for (const file of USQUARE_MIGRATIONS) {
      expect(file).not.toContain('hub_exchange_and_rooms');
    }
  });
});

describe('isScopedCountsSignature', () => {
  it('accepts only the two-argument form 20260918 installs', () => {
    expect(isScopedCountsSignature('p_kind text, p_targets text[]')).toBe(true);
  });

  it('rejects the retired one-argument form', () => {
    expect(isScopedCountsSignature('p_targets text[]')).toBe(false);
  });

  it('rejects a kind-only signature', () => {
    expect(isScopedCountsSignature('p_kind text')).toBe(false);
  });
});

describe('verdictFor', () => {
  it('passes when the table and all four functions are present and scoped', () => {
    const v = verdictFor(table, allFunctions);
    expect(v.ok).toBe(true);
    expect(v.reasons).toEqual([]);
  });

  it('fails on the live state that three audits kept rediscovering: nothing applied', () => {
    const v = verdictFor([], []);
    expect(v.ok).toBe(false);
    expect(v.reasons.join(' ')).toContain(EXPECTED_TABLE);
    for (const name of EXPECTED_FUNCTIONS) {
      expect(v.reasons.join(' ')).toContain(name);
    }
  });

  it('fails when the table exists but a function is missing', () => {
    const v = verdictFor(table, allFunctions.filter((f) => f.proname !== 'hub_market_pulse'));
    expect(v.ok).toBe(false);
    expect(v.reasons.join(' ')).toContain('hub_market_pulse');
  });

  it('detects the wrong order: two hub_shorts_counts overloads survive', () => {
    const v = verdictFor(table, [...allFunctions, fn('hub_shorts_counts', 'p_targets text[]')]);
    expect(v.ok).toBe(false);
    expect(v.reasons.join(' ')).toContain('20260917 was applied after 20260918');
  });

  it('detects a half-run: only 20260917 landed', () => {
    const v = verdictFor(table, [
      fn('hub_market_pulse', ''),
      fn('hub_shorts_counts', 'p_targets text[]'),
      fn('hub_shorts_sync', 'p_kind text'),
      fn('hub_shorts_toggle', 'p_kind text, p_target text'),
    ]);
    expect(v.ok).toBe(false);
    expect(v.reasons.join(' ')).toContain('retired one-argument form');
  });

  it('treats a missing signature string as unscoped rather than throwing', () => {
    const v = verdictFor(table, [
      fn('hub_market_pulse', ''),
      { proname: 'hub_shorts_counts' } as { proname: string; args?: string },
      fn('hub_shorts_sync', 'p_kind text'),
      fn('hub_shorts_toggle', 'p_kind text, p_target text'),
    ]);
    expect(v.ok).toBe(false);
  });
});
