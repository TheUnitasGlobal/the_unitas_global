import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * REV-36 MISSION 3 -- the shorts-reaction + market-pulse migration and its
 * client seam must not drift, and the migration must stay least-privilege and
 * non-destructive. Like schemaParity.test.ts, this reads the applied SQL file
 * as text (it is the file that was applied, it is in the repo, and a test that
 * needs a database is a test that gets skipped).
 */

const MIGRATION = readFileSync(
  join(__dirname, '../../../supabase/migrations/20260917000000_hub_shorts_reactions_and_market_pulse.sql'),
  'utf8',
);

const HUBLEDGER = readFileSync(join(__dirname, '../../lib/hub/hubLedger.ts'), 'utf8');

const RPCS = [
  { name: 'hub_shorts_sync', sig: 'hub_shorts_sync()' },
  { name: 'hub_shorts_toggle', sig: 'hub_shorts_toggle(p_kind text, p_target text)' },
  { name: 'hub_shorts_counts', sig: 'hub_shorts_counts(p_targets text[])' },
  { name: 'hub_market_pulse', sig: 'hub_market_pulse()' },
];

describe('REV-36 migration parity', () => {
  it('defines the reactions table with the kind whitelist and the target regex', () => {
    expect(MIGRATION).toContain('create table if not exists public.hub_shorts_reactions');
    expect(MIGRATION).toContain("kind in ('like', 'follow')");
    expect(MIGRATION).toContain("target ~ '^[a-z0-9.-]+$'");
    expect(MIGRATION).toContain('char_length(target) between 1 and 40');
  });

  it('enables and forces RLS and has only a select-own policy on the table', () => {
    expect(MIGRATION).toContain('alter table public.hub_shorts_reactions enable row level security');
    expect(MIGRATION).toContain('alter table public.hub_shorts_reactions force row level security');
    expect(MIGRATION).toContain('hub_shorts_reactions_select_own');
    // No client-writable policy: writes go through the SECURITY DEFINER RPC.
    // ([^;] already spans newlines, so no dotAll flag is needed.)
    expect(MIGRATION).not.toMatch(/create policy[^;]*for (insert|update|delete)[^;]*hub_shorts_reactions/i);
  });

  it('creates each RPC with its exact signature, security definer and search_path', () => {
    for (const rpc of RPCS) {
      expect(MIGRATION, rpc.name).toContain(`create or replace function public.${rpc.sig}`);
    }
    expect((MIGRATION.match(/security definer/g) ?? []).length).toBeGreaterThanOrEqual(RPCS.length);
    expect((MIGRATION.match(/set search_path = public/g) ?? []).length).toBeGreaterThanOrEqual(RPCS.length);
  });

  it('is least-privilege: every RPC revoked from public/anon and granted to authenticated', () => {
    for (const rpc of RPCS) {
      expect(MIGRATION, `${rpc.name} revoke`).toMatch(new RegExp(`revoke execute on function public\\.${rpc.name}\\([^)]*\\)\\s+from public, anon`));
      expect(MIGRATION, `${rpc.name} grant`).toMatch(new RegExp(`grant execute on function public\\.${rpc.name}\\([^)]*\\)\\s+to authenticated`));
    }
    expect(MIGRATION).toContain('revoke all on public.hub_shorts_reactions from anon');
    expect(MIGRATION).toContain('grant select on public.hub_shorts_reactions to authenticated');
  });

  it('never drops, truncates or drops a column', () => {
    // Match the destructive STATEMENT forms, so the header comment's prose
    // ("nothing ... drops, truncates or deletes anything") is not a false hit.
    expect(MIGRATION.toLowerCase()).not.toMatch(/drop\s+table/);
    expect(MIGRATION.toLowerCase()).not.toMatch(/truncate\s+table/);
    expect(MIGRATION.toLowerCase()).not.toMatch(/truncate\s+public\./);
    expect(MIGRATION.toLowerCase()).not.toMatch(/drop\s+column/);
  });

  it('enforces the 300 ms flood guard in the toggle RPC', () => {
    expect(MIGRATION).toContain("interval '300 milliseconds'");
    expect(MIGRATION).toContain("raise exception 'Too fast'");
  });

  it('the client seam calls exactly the RPC names the SQL defines', () => {
    for (const rpc of RPCS) {
      expect(HUBLEDGER, `hubLedger calls ${rpc.name}`).toContain(`rpc('${rpc.name}'`);
    }
  });
});
