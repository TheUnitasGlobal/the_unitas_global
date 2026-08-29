import { describe, expect, it } from 'vitest';
import { moduleForPathname } from '../../lib/moduleAccess';
import { moduleAccessName } from '../../lib/module-registry';

// One file per concern, no fixtures shared with other __tests__/** files --
// see CLAUDE.md "Module-level test isolation". Pure-function coverage for the
// page-level coin gate's route -> module resolution; touches no Supabase,
// coin balance, or React runtime.

// Must stay in sync with the CHECK constraint in
// supabase/migrations/20260902000000_module_access_grants.sql and
// 20260830000000_ecosystem_coin_gating.sql's spend_coins() whitelist.
const DB_MODULE_WHITELIST = new Set([
  'Arche', 'Arena', 'Score', 'Fate', 'Codex22',
  'echo', 'void', 'mirror', 'oracle', 'pulse', 'apex',
  'genesis', 'syndicate', 'aura', 'paradox', 'chronos',
]);

describe('moduleForPathname', () => {
  it('resolves a locale-prefixed module path', () => {
    expect(moduleForPathname('/ko/arche')?.route).toBe('arche');
  });

  it('resolves an un-prefixed (default-locale) module path', () => {
    expect(moduleForPathname('/arche')?.route).toBe('arche');
  });

  it('resolves a module path with a trailing sub-segment', () => {
    expect(moduleForPathname('/ja/echo/results')?.route).toBe('echo');
  });

  it('returns null for infra routes', () => {
    expect(moduleForPathname('/ko/company')).toBeNull();
    expect(moduleForPathname('/en/legal')).toBeNull();
  });

  it('returns null for the bare locale root and "/"', () => {
    expect(moduleForPathname('/ko')).toBeNull();
    expect(moduleForPathname('/')).toBeNull();
    expect(moduleForPathname('')).toBeNull();
  });

  it('resolves b2b protocol routes (they are registered, just not coin-gated)', () => {
    expect(moduleForPathname('/ko/u-key')?.tier).toBe('b2b');
  });
});

describe('moduleAccessName', () => {
  it('capitalises b2c module keys to match the ledger convention', () => {
    expect(moduleAccessName('arche')).toBe('Arche');
    expect(moduleAccessName('codex22')).toBe('Codex22');
  });

  it('leaves ecosystem keys lowercase to match the ledger convention', () => {
    expect(moduleAccessName('echo')).toBe('echo');
    expect(moduleAccessName('chronos')).toBe('chronos');
  });

  it('returns null for non-coin-gated (b2b) and unknown routes', () => {
    expect(moduleAccessName('u-key')).toBeNull();
    expect(moduleAccessName('does-not-exist')).toBeNull();
  });

  it('every coin-gated module maps to a name in the DB whitelist', () => {
    for (const route of [
      'arche', 'score', 'arena', 'fate', 'codex22',
      'echo', 'void', 'mirror', 'oracle', 'pulse', 'apex',
      'genesis', 'syndicate', 'aura', 'paradox', 'chronos',
    ]) {
      const name = moduleAccessName(route);
      expect(name, route).not.toBeNull();
      expect(DB_MODULE_WHITELIST.has(name as string), `${route} -> ${name}`).toBe(true);
    }
  });
});
