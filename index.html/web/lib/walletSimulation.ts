/**
 * Pure client-side helpers behind the U-COIN / Charge Coins panels.
 *
 * IMPORTANT (see CLAUDE.md "U-Coin ledger audit compliance"): nothing here
 * moves real balance. `spend_coins()` / `credit_coins()` on Supabase remain the
 * only source of truth. These functions produce *estimates* and store *local
 * preferences* only -- every consumer surfaces them as "simulation" /
 * "local setting, pending gateway", never as a completed transaction.
 */

import { ECOSYSTEMS } from './ecosystems';
import { B2C_MODULES } from './modules';
import { COIN_TO_EUR_RATE } from './currency';

// ---------------------------------------------------------------------------
// Module spend simulator
// ---------------------------------------------------------------------------

export interface SpendableModule {
  key: string;
  /** i18n message key under the `Modules` / `Ecosystems` namespace. */
  messageKey: string;
  tier: 'ecosystem' | 'b2c';
  coinCost: number;
}

/** Every coin-gated module a balance can be spent on, cheapest first. */
export const SPENDABLE_MODULES: SpendableModule[] = [
  ...ECOSYSTEMS.map((e) => ({
    key: e.key,
    messageKey: e.messageKey,
    tier: 'ecosystem' as const,
    coinCost: e.coinCost,
  })),
  ...B2C_MODULES.map((m) => ({
    key: m.key,
    messageKey: m.messageKey,
    tier: 'b2c' as const,
    coinCost: m.coinCost,
  })),
].sort((a, b) => a.coinCost - b.coinCost);

export interface SpendSimulationLine {
  key: string;
  messageKey: string;
  tier: 'ecosystem' | 'b2c';
  quantity: number;
  unitCost: number;
  lineCost: number;
}

export interface SpendSimulationResult {
  lines: SpendSimulationLine[];
  totalCost: number;
  /** null when the balance is unknown (signed out / not loaded). */
  remaining: number | null;
  sufficient: boolean;
  eurValue: number;
}

/**
 * @param selections map of module key -> quantity (0 / missing = not selected)
 * @param balance    current live balance, or null if unknown
 */
export function simulateSpend(
  selections: Record<string, number>,
  balance: number | null,
): SpendSimulationResult {
  const lines: SpendSimulationLine[] = [];
  let totalCost = 0;

  for (const mod of SPENDABLE_MODULES) {
    const quantity = Math.max(0, Math.floor(selections[mod.key] ?? 0));
    if (quantity === 0) continue;
    const lineCost = quantity * mod.coinCost;
    totalCost += lineCost;
    lines.push({
      key: mod.key,
      messageKey: mod.messageKey,
      tier: mod.tier,
      quantity,
      unitCost: mod.coinCost,
      lineCost,
    });
  }

  const remaining = balance === null ? null : balance - totalCost;
  return {
    lines,
    totalCost,
    remaining,
    sufficient: remaining === null ? true : remaining >= 0,
    eurValue: totalCost * COIN_TO_EUR_RATE,
  };
}

// ---------------------------------------------------------------------------
// Ledger integrity check ("transaction history real-time verification")
// ---------------------------------------------------------------------------

export interface LedgerEntry {
  amount: number;
  kind: 'purchase' | 'module_access' | 'admin_grant' | 'refund';
  module: string | null;
  balance_after: number;
  created_at: string;
}

export interface LedgerVerification {
  ok: boolean;
  checked: number;
  /** Number of rows whose running balance does not chain to the next row. */
  breaks: number;
  /** True when the newest ledger row disagrees with the live wallet balance. */
  headMismatch: boolean;
}

/**
 * Given ledger rows in newest-first order (as `coin_ledger` returns them) and
 * the current live wallet balance, re-derive the running balance and flag any
 * link that does not chain: `row[i].balance_after` must equal
 * `row[i + 1].balance_after + row[i].amount`.
 */
export function verifyLedger(
  entriesNewestFirst: LedgerEntry[],
  liveBalance: number | null,
): LedgerVerification {
  let breaks = 0;
  for (let i = 0; i < entriesNewestFirst.length - 1; i += 1) {
    const newer = entriesNewestFirst[i];
    const older = entriesNewestFirst[i + 1];
    if (newer.balance_after !== older.balance_after + newer.amount) breaks += 1;
  }

  const headMismatch =
    liveBalance !== null &&
    entriesNewestFirst.length > 0 &&
    entriesNewestFirst[0].balance_after !== liveBalance;

  return {
    ok: breaks === 0 && !headMismatch,
    checked: entriesNewestFirst.length,
    breaks,
    headMismatch,
  };
}

// ---------------------------------------------------------------------------
// Charge packages
// ---------------------------------------------------------------------------

export type ChargeTier = 'starter' | 'pro' | 'sovereign';

export interface ChargePackage {
  tier: ChargeTier;
  /** Base coins purchased. */
  coins: number;
  /** Extra coins granted on top (loyalty bonus). */
  bonusCoins: number;
  /** Charge price in EUR. */
  priceEur: number;
}

export const CHARGE_PACKAGES: ChargePackage[] = [
  { tier: 'starter', coins: 20, bonusCoins: 0, priceEur: 20 },
  { tier: 'pro', coins: 100, bonusCoins: 8, priceEur: 95 },
  { tier: 'sovereign', coins: 500, bonusCoins: 75, priceEur: 440 },
];

export function packageTotalCoins(pkg: ChargePackage): number {
  return pkg.coins + pkg.bonusCoins;
}

/** Effective price per coin in EUR, for the "best value" comparison. */
export function pricePerCoin(pkg: ChargePackage): number {
  return pkg.priceEur / packageTotalCoins(pkg);
}

// ---------------------------------------------------------------------------
// Local preferences (auto-spend limit + auto-refill threshold)
// ---------------------------------------------------------------------------

export type SpendWindow = 'day' | 'week' | 'month';

export interface WalletPrefs {
  autoSpendEnabled: boolean;
  /** Max coins auto-approved per window without a confirm step. */
  autoSpendLimit: number;
  autoSpendWindow: SpendWindow;
  autoRefillEnabled: boolean;
  /** Trigger a refill when balance drops to/below this. */
  autoRefillThreshold: number;
  autoRefillPackage: ChargeTier;
}

export const DEFAULT_WALLET_PREFS: WalletPrefs = {
  autoSpendEnabled: false,
  autoSpendLimit: 10,
  autoSpendWindow: 'day',
  autoRefillEnabled: false,
  autoRefillThreshold: 5,
  autoRefillPackage: 'pro',
};

const PREFS_STORAGE_KEY = 'unitas.wallet.prefs.v1';

export function clampWalletPrefs(input: Partial<WalletPrefs>): WalletPrefs {
  const merged = { ...DEFAULT_WALLET_PREFS, ...input };
  const windows: SpendWindow[] = ['day', 'week', 'month'];
  const tiers: ChargeTier[] = ['starter', 'pro', 'sovereign'];
  return {
    autoSpendEnabled: Boolean(merged.autoSpendEnabled),
    autoSpendLimit: clampInt(merged.autoSpendLimit, 1, 1000, DEFAULT_WALLET_PREFS.autoSpendLimit),
    autoSpendWindow: windows.includes(merged.autoSpendWindow)
      ? merged.autoSpendWindow
      : DEFAULT_WALLET_PREFS.autoSpendWindow,
    autoRefillEnabled: Boolean(merged.autoRefillEnabled),
    autoRefillThreshold: clampInt(
      merged.autoRefillThreshold,
      0,
      1000,
      DEFAULT_WALLET_PREFS.autoRefillThreshold,
    ),
    autoRefillPackage: tiers.includes(merged.autoRefillPackage)
      ? merged.autoRefillPackage
      : DEFAULT_WALLET_PREFS.autoRefillPackage,
  };
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

export function loadWalletPrefs(): WalletPrefs {
  if (typeof window === 'undefined') return { ...DEFAULT_WALLET_PREFS };
  try {
    const raw = window.localStorage.getItem(PREFS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_WALLET_PREFS };
    return clampWalletPrefs(JSON.parse(raw) as Partial<WalletPrefs>);
  } catch {
    return { ...DEFAULT_WALLET_PREFS };
  }
}

export function saveWalletPrefs(prefs: WalletPrefs): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(clampWalletPrefs(prefs)));
  } catch {
    // storage unavailable (private mode / blocked) -- preferences stay in-memory only
  }
}
