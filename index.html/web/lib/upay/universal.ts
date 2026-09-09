import type { ModuleKind } from '@/lib/quantumWhite/clusters';

/**
 * U-Pay universal access catalogue (REV-13 "Quantum White", spec §10.5/§10.6).
 *
 * The 16 non-routed / non-catalogued modules (8 lock-ins, 3 enterprise rails,
 * 5 Life-OS hubs) have no `moduleAccessName()` entry because they were never
 * part of MODULE_REGISTRY. This map gives each of them a stable spend name
 * for `spend_coins()` / `coin_ledger.module` / `module_access_grants.module`,
 * keyed by the tier-qualified cluster id (`${kind}:${key}`) because the bare
 * key `oracle` exists in BOTH the ecosystems and the lock-ins -- the DB names
 * therefore carry a `-lockin` suffix wherever they would otherwise collide.
 *
 * This file is deliberately tiny and imports `lib/quantumWhite/clusters`
 * TYPE-ONLY: `clusters.ts` imports these constants at runtime to build its
 * `ClusterModule.accessName` / `coinCost` fields, so a value import here
 * would create a circular module graph.
 *
 * Three places must stay in sync (CLAUDE.md "U-Coin ledger audit
 * compliance"): this map, `supabase/migrations/20260914000000_upay_
 * universal_allowlist.sql` (both CHECK constraints + the spend_coins()
 * whitelist), and `__tests__/gate/moduleAccess.test.ts` DB_MODULE_WHITELIST.
 */
export const UPAY_UNIVERSAL_ACCESS: Readonly<Record<string, string>> = Object.freeze({
  // Lock-in network (8)
  'lockin:nexus': 'nexus',
  'lockin:aegis': 'aegis',
  'lockin:uTwin': 'u-twin',
  'lockin:infinity': 'infinity',
  'lockin:panopticon': 'panopticon',
  'lockin:oracle': 'oracle-lockin',
  'lockin:syndicateX': 'syndicate-x',
  'lockin:fateMatrix': 'fate-matrix',
  // Enterprise rails (3)
  'b2b:u-signature': 'u-signature',
  'b2b:u-key': 'u-key',
  'b2b:u-pay': 'u-pay',
  // Life-OS hubs (5)
  'lifeos:life-dashboard': 'life-dashboard',
  'lifeos:second-brain': 'second-brain',
  'lifeos:review-agent': 'review-agent',
  'lifeos:brand-kit': 'brand-kit',
  'lifeos:life-library': 'life-library',
});

/** The three module kinds whose cost is NOT carried by a source catalogue. */
export type UPayUniversalKind = Extract<ModuleKind, 'lockin' | 'b2b' | 'lifeos'>;

/**
 * Flat per-kind U-COIN cost for the universal tiers (spec §10.6: lock-in 2,
 * enterprise 5, Life-OS 3). Ecosystem / B2C costs keep coming from
 * `lib/ecosystems.ts` / `lib/modules.ts` -- those catalogues are frozen by
 * the prebuild registry validator and must not learn about this file.
 */
export const UPAY_UNIVERSAL_COSTS: Readonly<Record<UPayUniversalKind, number>> = Object.freeze({
  lockin: 2,
  b2b: 5,
  lifeos: 3,
});
