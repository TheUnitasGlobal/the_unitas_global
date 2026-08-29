import { B2C_MODULES, B2B_PROTOCOLS } from './modules';
import { ECOSYSTEMS } from './ecosystems';

/**
 * Governance tier: which catalog a module was sourced from.
 * - ecosystem: the 11 OMNI-SYNAPSE "Live Ecosystems" (lib/ecosystems.ts)
 * - b2c: the 5 original "Live Consumer Services" (lib/modules.ts)
 * - b2b: the 3 B2B protocols (lib/modules.ts)
 */
export type ModuleTier = 'ecosystem' | 'b2c' | 'b2b';

export type ModuleStatus = 'live' | 'beta' | 'planned';

export interface ModuleRegistryEntry {
  key: string;
  route: string;
  messageKey: string;
  tier: ModuleTier;
  status: ModuleStatus;
  coinGated: boolean;
}

/**
 * Single source of truth for "which modules exist" across the sovereign
 * ecosystem, aggregating the two pre-existing typed catalogs (ecosystems.ts,
 * modules.ts) additively -- neither is replaced or restructured. New future
 * modules (the "19+ alpha" and beyond) get added here as one more entry; the
 * paired scripts/validate-module-registry.mjs (wired as `prebuild`) fails
 * the build closed if this list and the actual app/[locale]/* route folders
 * ever drift apart in either direction.
 */
export const MODULE_REGISTRY: ModuleRegistryEntry[] = [
  ...ECOSYSTEMS.map((m): ModuleRegistryEntry => ({
    key: m.key,
    route: m.route,
    messageKey: m.messageKey,
    tier: 'ecosystem',
    status: 'live',
    coinGated: true,
  })),
  ...B2C_MODULES.map((m): ModuleRegistryEntry => ({
    key: m.key,
    route: m.route,
    messageKey: m.messageKey,
    tier: 'b2c',
    status: 'live',
    coinGated: true,
  })),
  ...B2B_PROTOCOLS.map((m): ModuleRegistryEntry => ({
    key: m.key,
    route: m.route,
    messageKey: m.messageKey,
    tier: 'b2b',
    status: 'live',
    coinGated: false,
  })),
];

const REGISTRY_BY_ROUTE = new Map(MODULE_REGISTRY.map((m) => [m.route, m]));
const REGISTRY_BY_KEY = new Map(MODULE_REGISTRY.map((m) => [m.key, m]));

/**
 * The exact string a spend is recorded under in `coin_ledger.module` /
 * `module_access_grants.module`. The two client entry modals historically
 * derived this ad-hoc and INCONSISTENTLY -- ModuleQuestModal capitalised the
 * b2c messageKey ('Arche'), EcosystemEntryModal passed the raw ecosystem key
 * ('echo'). Both conventions match their half of the DB whitelist, so this
 * helper preserves them exactly, in one place, so the entry modals and the
 * page-level gate (app/[locale]/(gated)/layout.tsx) always agree.
 *
 * Returns null for an unknown route/key or a non-coin-gated (b2b) module.
 */
export function moduleAccessName(routeOrKey: string): string | null {
  const entry = REGISTRY_BY_ROUTE.get(routeOrKey) ?? REGISTRY_BY_KEY.get(routeOrKey);
  if (!entry || !entry.coinGated) return null;
  if (entry.tier === 'b2c') {
    return entry.messageKey.charAt(0).toUpperCase() + entry.messageKey.slice(1);
  }
  return entry.key;
}

/** Registry entry for a route segment, or null if it isn't a known module route. */
export function moduleForRoute(route: string): ModuleRegistryEntry | null {
  return REGISTRY_BY_ROUTE.get(route) ?? null;
}
