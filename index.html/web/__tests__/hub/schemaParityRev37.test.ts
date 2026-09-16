import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * REV-37 MISSION 1 -- hub_shorts_counts is now KIND-SCOPED. This gate proves
 * the new two-argument signature exists, the un-scoped one-argument form is
 * retired, the aggregate filters on `kind`, it stays least-privilege, it is
 * non-destructive to data, and the client seam calls it with p_kind.
 */

const MIGRATION = readFileSync(
  join(__dirname, '../../../supabase/migrations/20260918000000_hub_shorts_counts_scope.sql'),
  'utf8',
);
const HUBLEDGER = readFileSync(join(__dirname, '../../lib/hub/hubLedger.ts'), 'utf8');

describe('REV-37 hub_shorts_counts kind-scope parity', () => {
  it('retires the un-scoped single-argument form', () => {
    expect(MIGRATION).toContain('drop function if exists public.hub_shorts_counts(text[])');
  });

  it('creates the kind-scoped two-argument form with security definer + search_path', () => {
    expect(MIGRATION).toContain('create or replace function public.hub_shorts_counts(p_kind text, p_targets text[])');
    expect(MIGRATION).toContain('security definer');
    expect(MIGRATION).toContain('set search_path = public');
  });

  it('the aggregate is scoped by kind (and active)', () => {
    expect(MIGRATION).toMatch(/where active[\s\S]*?and kind = p_kind[\s\S]*?and target = any/);
  });

  it('stays least-privilege on the new signature', () => {
    expect(MIGRATION).toMatch(/revoke execute on function public\.hub_shorts_counts\(text, text\[\]\)\s+from public, anon/);
    expect(MIGRATION).toMatch(/grant execute on function public\.hub_shorts_counts\(text, text\[\]\)\s+to authenticated/);
  });

  it('is non-destructive to data (only a read-only function is replaced)', () => {
    expect(MIGRATION.toLowerCase()).not.toMatch(/drop\s+table/);
    expect(MIGRATION.toLowerCase()).not.toMatch(/truncate\s+table/);
    expect(MIGRATION.toLowerCase()).not.toMatch(/drop\s+column/);
    // No row-removal; the toggle's active-flip model still holds.
    expect(MIGRATION.toLowerCase()).not.toMatch(/delete\s+from/);
  });

  it('the client seam calls hub_shorts_counts with a kind argument', () => {
    expect(HUBLEDGER).toMatch(/rpc\('hub_shorts_counts', \{ p_kind: kind, p_targets:/);
    expect(HUBLEDGER).toMatch(/hubShortsCounts\(kind: 'like' \| 'follow', targets: string\[\]\)/);
  });
});
