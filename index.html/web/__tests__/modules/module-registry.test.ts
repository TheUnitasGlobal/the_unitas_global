import { describe, expect, it } from 'vitest';
import { MODULE_REGISTRY } from '../../lib/module-registry';

// One file per catalog concern, no fixtures shared with other __tests__/**
// files -- see CLAUDE.md "Module-level test isolation". This file only
// asserts on the aggregated MODULE_REGISTRY data shape; it does not touch
// Supabase, coin balances, or any other module's runtime behavior.
describe('MODULE_REGISTRY', () => {
  it('has no duplicate keys', () => {
    const keys = MODULE_REGISTRY.map((m) => m.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('has no duplicate routes', () => {
    const routes = MODULE_REGISTRY.map((m) => m.route);
    expect(new Set(routes).size).toBe(routes.length);
  });

  it('gates ecosystem and b2c tiers behind coins, leaves b2b ungated', () => {
    for (const entry of MODULE_REGISTRY) {
      const expected = entry.tier !== 'b2b';
      expect(entry.coinGated, `${entry.key} (${entry.tier})`).toBe(expected);
    }
  });
});
