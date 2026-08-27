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
