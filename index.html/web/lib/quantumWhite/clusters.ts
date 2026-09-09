import type { LucideIcon } from 'lucide-react';
import { ECOSYSTEMS } from '@/lib/ecosystems';
import { B2C_MODULES, B2B_PROTOCOLS } from '@/lib/modules';
import { LOCK_IN_MODULES } from '@/lib/lockInModules';
import { LIFE_OS_MODULES, lifeOsHref } from '@/lib/lifeOs/registry';
import { moduleAccessName } from '@/lib/module-registry';
import { UPAY_UNIVERSAL_ACCESS, UPAY_UNIVERSAL_COSTS } from '@/lib/upay/universal';

/**
 * REV-13 "Singularity Core" catalog: the four cluster cores the Quantum
 * White home renders instead of the old four separate section grids.
 *
 * This file is a pure, additive AGGREGATION over the existing typed catalogs
 * (ecosystems / modules / lockInModules / lifeOs registry). None of those
 * sources are modified -- the prebuild registry validator regex-parses two
 * of them and the DB whitelist depends on their exact keys -- so every
 * derived field (href, access name, cost, colour, i18n key) is computed here
 * from the source arrays at module-evaluation time.
 *
 * Why ids are tier-qualified (`kind:key`): the key `oracle` exists in BOTH
 * the ecosystem catalog and the lock-in catalog. A flat key would collide in
 * the precache Set / detail Map and, worse, in the spend name sent to
 * `spend_coins`. Access names for lock-in / b2b / life-os therefore come from
 * `UPAY_UNIVERSAL_ACCESS` keyed by the qualified id (e.g. 'lockin:oracle' ->
 * 'oracle-lockin'), never from the bare key.
 */

export type ClusterKey = 'cognitive' | 'live' | 'lockin' | 'enterprise';

export type ModuleKind = 'ecosystem' | 'b2c' | 'lockin' | 'b2b' | 'lifeos';

export interface ClusterModule {
  /** Globally unique: `${kind}:${key}`. */
  id: string;
  kind: ModuleKind;
  /** Key in the source catalog array. */
  key: string;
  /**
   * Locale-agnostic path ('/echo', '/u-pay', '/sovereign/second-brain').
   * Lock-in modules are device-local activations with no route -> ''.
   */
  href: string;
  hasRoute: boolean;
  /**
   * Exact spend name recorded in `coin_ledger.module` /
   * `module_access_grants.module`. null only when the module is truly
   * non-purchasable (no entry in either the registry or the universal map).
   */
  accessName: string | null;
  /** U-COIN cost; ecosystem/b2c from the catalog, other kinds from UPAY_UNIVERSAL_COSTS. */
  coinCost: number;
  /** Brand hex used for orbit dots, tile accents and the popup accent strip. */
  color: string;
  icon?: LucideIcon;
  /**
   * FULL next-intl keys ('Ecosystems.echo.title'). Lock-in titles are
   * owner-named brand marks rendered verbatim in every locale, so their
   * `titleKey` is '' and `literalTitle` carries the mark instead.
   */
  i18n: { titleKey: string; descriptionKey: string };
  /** Untranslated brand mark; only set when `i18n.titleKey` is ''. */
  literalTitle?: string;
}

export interface SingularityCluster {
  key: ClusterKey;
  /** 'QuantumWhite.clusters.<key>.title' */
  titleKey: string;
  /** 'QuantumWhite.clusters.<key>.tagline' */
  taglineKey: string;
  /** Cluster accent hex (Quantum White palette). */
  accent: string;
  modules: ClusterModule[];
}

/** Rendering order of the four cores on the home (fixed by the spec). */
export const CLUSTER_ORDER: readonly ClusterKey[] = ['cognitive', 'live', 'lockin', 'enterprise'];

/** Quantum White brand hexes for kinds whose source catalog carries no colour. */
const B2B_COLOR = '#0b5cff';
const LIFE_OS_COLOR = '#b8962e';

const CLUSTER_ACCENTS: Readonly<Record<ClusterKey, string>> = {
  cognitive: '#0b5cff',
  live: '#14b8a6',
  lockin: '#b8962e',
  enterprise: '#2a2c33',
};

function moduleId(kind: ModuleKind, key: string): string {
  return `${kind}:${key}`;
}

/**
 * Cost resolution: UPAY_UNIVERSAL_COSTS uses 0 as "defer to the catalog's own
 * coinCost" (ecosystem / b2c carry their own 1-5 pricing); any positive value
 * is the flat universal price for that kind (lock-in 2, b2b 5, life-os 3).
 */
function isUniversalCostKind(kind: ModuleKind): kind is 'lockin' | 'b2b' | 'lifeos' {
  return kind === 'lockin' || kind === 'b2b' || kind === 'lifeos';
}

function resolveCost(kind: ModuleKind, catalogCost: number | undefined): number {
  // UPAY_UNIVERSAL_COSTS is only keyed for the three universal tiers (PAY
  // agent's lib/upay/universal.ts) -- narrow before indexing so this stays
  // a real type guard instead of a cast.
  const universal = isUniversalCostKind(kind) ? UPAY_UNIVERSAL_COSTS[kind] : undefined;
  if (typeof universal === 'number' && universal > 0) return universal;
  return catalogCost ?? 0;
}

/** Universal access name for kinds outside MODULE_REGISTRY (lock-in / b2b / life-os). */
function universalAccess(id: string): string | null {
  const name = UPAY_UNIVERSAL_ACCESS[id];
  return typeof name === 'string' && name.length > 0 ? name : null;
}

const ECOSYSTEM_MODULES: ClusterModule[] = ECOSYSTEMS.map((m): ClusterModule => ({
  id: moduleId('ecosystem', m.key),
  kind: 'ecosystem',
  key: m.key,
  href: `/${m.route}`,
  hasRoute: true,
  accessName: moduleAccessName(m.route) ?? m.key,
  coinCost: resolveCost('ecosystem', m.coinCost),
  color: m.color,
  i18n: {
    titleKey: `Ecosystems.${m.messageKey}.title`,
    descriptionKey: `Ecosystems.${m.messageKey}.description`,
  },
}));

const LIFE_OS_CLUSTER_MODULES: ClusterModule[] = LIFE_OS_MODULES.map((m): ClusterModule => {
  const id = moduleId('lifeos', m.key);
  return {
    id,
    kind: 'lifeos',
    key: m.key,
    href: lifeOsHref(m.path),
    hasRoute: true,
    accessName: universalAccess(id),
    coinCost: resolveCost('lifeos', undefined),
    color: LIFE_OS_COLOR,
    icon: m.icon,
    i18n: {
      titleKey: `LifeOs.${m.messageKey}.title`,
      descriptionKey: `LifeOs.${m.messageKey}.description`,
    },
  };
});

const B2C_CLUSTER_MODULES: ClusterModule[] = B2C_MODULES.map((m): ClusterModule => ({
  id: moduleId('b2c', m.key),
  kind: 'b2c',
  key: m.key,
  href: `/${m.route}`,
  hasRoute: true,
  // moduleAccessName capitalises the b2c messageKey ('Arche') -- the exact
  // spelling the DB whitelist expects; never send the raw key here.
  accessName: moduleAccessName(m.route),
  coinCost: resolveCost('b2c', m.coinCost),
  color: m.metal,
  icon: m.icon,
  i18n: {
    titleKey: `Modules.${m.messageKey}.title`,
    descriptionKey: `Modules.${m.messageKey}.description`,
  },
}));

const LOCK_IN_CLUSTER_MODULES: ClusterModule[] = LOCK_IN_MODULES.map((m): ClusterModule => {
  const id = moduleId('lockin', m.key);
  return {
    id,
    kind: 'lockin',
    key: m.key,
    href: '',
    hasRoute: false,
    accessName: universalAccess(id),
    coinCost: resolveCost('lockin', undefined),
    color: m.color,
    icon: m.icon,
    i18n: {
      titleKey: '',
      descriptionKey: `LockIn.modules.${m.key}.tagline`,
    },
    literalTitle: m.brand,
  };
});

const B2B_CLUSTER_MODULES: ClusterModule[] = B2B_PROTOCOLS.map((m): ClusterModule => {
  const id = moduleId('b2b', m.key);
  return {
    id,
    kind: 'b2b',
    key: m.key,
    href: `/${m.route}`,
    hasRoute: true,
    accessName: universalAccess(id),
    coinCost: resolveCost('b2b', undefined),
    color: B2B_COLOR,
    i18n: {
      titleKey: `Modules.${m.messageKey}.title`,
      descriptionKey: `Modules.${m.messageKey}.description`,
    },
  };
});

function cluster(key: ClusterKey, modules: ClusterModule[]): SingularityCluster {
  return {
    key,
    titleKey: `QuantumWhite.clusters.${key}.title`,
    taglineKey: `QuantumWhite.clusters.${key}.tagline`,
    accent: CLUSTER_ACCENTS[key],
    modules,
  };
}

/**
 * cognitive = 11 ecosystems + 5 Life-OS hubs (16), live = 5 consumer
 * services, lockin = 8 retention engines, enterprise = 3 B2B rails.
 */
export const SINGULARITY_CLUSTERS: SingularityCluster[] = [
  cluster('cognitive', [...ECOSYSTEM_MODULES, ...LIFE_OS_CLUSTER_MODULES]),
  cluster('live', B2C_CLUSTER_MODULES),
  cluster('lockin', LOCK_IN_CLUSTER_MODULES),
  cluster('enterprise', B2B_CLUSTER_MODULES),
];

/** All 32 modules in cluster order; ids are unique (tier-qualified). */
export const ALL_CLUSTER_MODULES: ClusterModule[] = SINGULARITY_CLUSTERS.flatMap((c) => c.modules);

const MODULES_BY_ID = new Map(ALL_CLUSTER_MODULES.map((m) => [m.id, m]));

export function findClusterModule(id: string): ClusterModule | undefined {
  return MODULES_BY_ID.get(id);
}

export function findCluster(key: ClusterKey): SingularityCluster {
  return SINGULARITY_CLUSTERS.find((c) => c.key === key) ?? SINGULARITY_CLUSTERS[0];
}
