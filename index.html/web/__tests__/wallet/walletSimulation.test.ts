import { describe, expect, it } from 'vitest';
import {
  CHARGE_PACKAGES,
  DEFAULT_WALLET_PREFS,
  SPENDABLE_MODULES,
  clampWalletPrefs,
  packageTotalCoins,
  pricePerCoin,
  simulateSpend,
  verifyLedger,
  type LedgerEntry,
} from '../../lib/walletSimulation';

// Pure helpers only -- no Supabase, no localStorage, no other module's state.
describe('simulateSpend', () => {
  it('returns an empty result for no selections', () => {
    const r = simulateSpend({}, 100);
    expect(r.totalCost).toBe(0);
    expect(r.lines).toHaveLength(0);
    expect(r.remaining).toBe(100);
    expect(r.sufficient).toBe(true);
  });

  it('sums quantity * unit cost across modules and subtracts from balance', () => {
    const first = SPENDABLE_MODULES[0];
    const r = simulateSpend({ [first.key]: 3 }, 100);
    expect(r.totalCost).toBe(first.coinCost * 3);
    expect(r.remaining).toBe(100 - first.coinCost * 3);
    expect(r.lines[0]).toMatchObject({ key: first.key, quantity: 3, lineCost: first.coinCost * 3 });
  });

  it('flags an over-budget mix as insufficient', () => {
    const priciest = [...SPENDABLE_MODULES].sort((a, b) => b.coinCost - a.coinCost)[0];
    const r = simulateSpend({ [priciest.key]: 5 }, 1);
    expect(r.sufficient).toBe(false);
    expect(r.remaining).toBeLessThan(0);
  });

  it('treats an unknown balance as non-blocking', () => {
    const r = simulateSpend({ [SPENDABLE_MODULES[0].key]: 1 }, null);
    expect(r.remaining).toBeNull();
    expect(r.sufficient).toBe(true);
  });

  it('ignores zero / negative / fractional quantities', () => {
    const [a, b] = SPENDABLE_MODULES;
    const r = simulateSpend({ [a.key]: 0, [b.key]: -2 }, 50);
    expect(r.totalCost).toBe(0);
  });
});

describe('verifyLedger', () => {
  const chain: LedgerEntry[] = [
    { amount: -3, kind: 'module_access', module: 'Arche', balance_after: 7, created_at: '2026-01-03' },
    { amount: -2, kind: 'module_access', module: 'Score', balance_after: 10, created_at: '2026-01-02' },
    { amount: 12, kind: 'purchase', module: null, balance_after: 12, created_at: '2026-01-01' },
  ];

  it('passes a well-formed chain that matches the live balance', () => {
    const v = verifyLedger(chain, 7);
    expect(v.ok).toBe(true);
    expect(v.breaks).toBe(0);
    expect(v.headMismatch).toBe(false);
    expect(v.checked).toBe(3);
  });

  it('detects a broken link in the running balance', () => {
    const broken = [...chain];
    broken[1] = { ...broken[1], balance_after: 999 };
    const v = verifyLedger(broken, 7);
    expect(v.ok).toBe(false);
    expect(v.breaks).toBeGreaterThan(0);
  });

  it('detects a head that disagrees with the live wallet balance', () => {
    const v = verifyLedger(chain, 999);
    expect(v.ok).toBe(false);
    expect(v.headMismatch).toBe(true);
  });

  it('is vacuously ok for an empty ledger', () => {
    expect(verifyLedger([], 0).ok).toBe(true);
  });
});

describe('charge packages', () => {
  it('every package total = base + bonus and per-coin price is positive', () => {
    for (const pkg of CHARGE_PACKAGES) {
      expect(packageTotalCoins(pkg)).toBe(pkg.coins + pkg.bonusCoins);
      expect(pricePerCoin(pkg)).toBeGreaterThan(0);
    }
  });

  it('higher tiers are better value per coin', () => {
    const [starter, pro, sovereign] = CHARGE_PACKAGES;
    expect(pricePerCoin(pro)).toBeLessThan(pricePerCoin(starter));
    expect(pricePerCoin(sovereign)).toBeLessThan(pricePerCoin(pro));
  });
});

describe('clampWalletPrefs', () => {
  it('fills defaults and coerces out-of-range / invalid values', () => {
    const p = clampWalletPrefs({
      autoSpendLimit: -5,
      autoSpendWindow: 'century' as never,
      autoRefillThreshold: 99999,
      autoRefillPackage: 'gold' as never,
    });
    expect(p.autoSpendLimit).toBe(1);
    expect(p.autoSpendWindow).toBe(DEFAULT_WALLET_PREFS.autoSpendWindow);
    expect(p.autoRefillThreshold).toBe(1000);
    expect(p.autoRefillPackage).toBe(DEFAULT_WALLET_PREFS.autoRefillPackage);
  });

  it('passes through a valid object unchanged', () => {
    const valid = {
      autoSpendEnabled: true,
      autoSpendLimit: 25,
      autoSpendWindow: 'week' as const,
      autoRefillEnabled: true,
      autoRefillThreshold: 8,
      autoRefillPackage: 'sovereign' as const,
    };
    expect(clampWalletPrefs(valid)).toEqual(valid);
  });
});
