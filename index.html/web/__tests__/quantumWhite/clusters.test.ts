import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ALL_CLUSTER_MODULES,
  CLUSTER_ORDER,
  SINGULARITY_CLUSTERS,
  findCluster,
  findClusterModule,
  type ClusterKey,
} from '../../lib/quantumWhite/clusters';

// Module-level test isolation (CLAUDE.md) -- pure data-shape assertions only,
// no Supabase, no other module's fixtures. Loads the real en.json so a typo
// in any i18n key wired up in clusters.ts fails this suite immediately
// instead of silently rendering "[MISSING:en]" on the live home.
const MESSAGES: unknown = JSON.parse(readFileSync(join(__dirname, '../../messages/en.json'), 'utf8'));

/** Walks a dotted next-intl key ('Ecosystems.echo.title') through the JSON tree. */
function resolveKey(messages: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>((node, segment) => {
    if (node === undefined || node === null || typeof node !== 'object') return undefined;
    return (node as Record<string, unknown>)[segment];
  }, messages);
}

const EXPECTED_COUNTS: Readonly<Record<ClusterKey, number>> = {
  cognitive: 16,
  live: 5,
  lockin: 8,
  enterprise: 3,
};

describe('SINGULARITY_CLUSTERS', () => {
  it('renders in the fixed spec order: cognitive, live, lockin, enterprise', () => {
    expect(CLUSTER_ORDER).toEqual(['cognitive', 'live', 'lockin', 'enterprise']);
    expect(SINGULARITY_CLUSTERS.map((c) => c.key)).toEqual(CLUSTER_ORDER);
  });

  it('has the exact module count per cluster (16/5/8/3)', () => {
    for (const cluster of SINGULARITY_CLUSTERS) {
      expect(cluster.modules).toHaveLength(EXPECTED_COUNTS[cluster.key]);
    }
  });

  it('resolves every cluster titleKey/taglineKey/enigmaKey to a non-empty string in en.json', () => {
    for (const cluster of SINGULARITY_CLUSTERS) {
      expect(typeof resolveKey(MESSAGES, cluster.titleKey)).toBe('string');
      expect(resolveKey(MESSAGES, cluster.titleKey)).not.toBe('');
      expect(typeof resolveKey(MESSAGES, cluster.taglineKey)).toBe('string');
      expect(resolveKey(MESSAGES, cluster.taglineKey)).not.toBe('');
      expect(typeof resolveKey(MESSAGES, cluster.enigmaKey)).toBe('string');
      expect(resolveKey(MESSAGES, cluster.enigmaKey)).not.toBe('');
    }
  });

  it('REV-17 (SPEC.md §4.1): tagline/enigma never contain an Arabic numeral (no module-count leak)', () => {
    for (const cluster of SINGULARITY_CLUSTERS) {
      const tagline = resolveKey(MESSAGES, cluster.taglineKey) as string;
      const enigma = resolveKey(MESSAGES, cluster.enigmaKey) as string;
      expect(tagline, cluster.taglineKey).not.toMatch(/\d/);
      expect(enigma, cluster.enigmaKey).not.toMatch(/\d/);
    }
  });

  it('gives every cluster a hex accent colour', () => {
    for (const cluster of SINGULARITY_CLUSTERS) {
      expect(cluster.accent).toMatch(/^#[0-9a-fA-F]{3,6}$/);
    }
  });
});

describe('ALL_CLUSTER_MODULES', () => {
  it('totals 32 modules (16 + 5 + 8 + 3)', () => {
    expect(ALL_CLUSTER_MODULES).toHaveLength(32);
  });

  it('has a globally unique id per module (tier-qualified, e.g. ecosystem:oracle vs lockin:oracle)', () => {
    const ids = ALL_CLUSTER_MODULES.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('tier-qualifies every id as `${kind}:${key}`', () => {
    for (const m of ALL_CLUSTER_MODULES) {
      expect(m.id).toBe(`${m.kind}:${m.key}`);
    }
  });

  it('resolves every non-empty titleKey to a non-empty string in en.json', () => {
    for (const m of ALL_CLUSTER_MODULES) {
      if (m.i18n.titleKey === '') continue;
      const resolved = resolveKey(MESSAGES, m.i18n.titleKey);
      expect(typeof resolved).toBe('string');
      expect(resolved).not.toBe('');
    }
  });

  it('resolves every descriptionKey to a non-empty string in en.json', () => {
    for (const m of ALL_CLUSTER_MODULES) {
      const resolved = resolveKey(MESSAGES, m.i18n.descriptionKey);
      expect(typeof resolved).toBe('string');
      expect(resolved).not.toBe('');
    }
  });

  it('gives every module with an empty titleKey (lock-ins) a literalTitle instead', () => {
    for (const m of ALL_CLUSTER_MODULES) {
      if (m.i18n.titleKey !== '') continue;
      expect(m.kind).toBe('lockin');
      expect(typeof m.literalTitle).toBe('string');
      expect(m.literalTitle).not.toBe('');
    }
  });

  it('gives lock-in modules no route (device-local activation only)', () => {
    for (const m of ALL_CLUSTER_MODULES.filter((m) => m.kind === 'lockin')) {
      expect(m.hasRoute).toBe(false);
      expect(m.href).toBe('');
    }
  });

  it('gives every routed module a leading-slash href', () => {
    for (const m of ALL_CLUSTER_MODULES.filter((m) => m.hasRoute)) {
      expect(m.href.startsWith('/')).toBe(true);
    }
  });

  it('prices lock-in / enterprise / life-os at the flat universal cost (2 / 5 / 3)', () => {
    for (const m of ALL_CLUSTER_MODULES) {
      if (m.kind === 'lockin') expect(m.coinCost).toBe(2);
      if (m.kind === 'b2b') expect(m.coinCost).toBe(5);
      if (m.kind === 'lifeos') expect(m.coinCost).toBe(3);
    }
  });

  it('gives every ecosystem/b2c module a positive coin cost from its own catalog', () => {
    for (const m of ALL_CLUSTER_MODULES) {
      if (m.kind === 'ecosystem' || m.kind === 'b2c') {
        expect(m.coinCost).toBeGreaterThan(0);
      }
    }
  });

  it('gives every module a brand hex colour', () => {
    for (const m of ALL_CLUSTER_MODULES) {
      expect(m.color).toMatch(/^#[0-9a-fA-F]{3,6}$/);
    }
  });

  it('REV-15 (SPEC.md §4.3): gives every one of the 32 modules a LucideIcon component', () => {
    for (const m of ALL_CLUSTER_MODULES) {
      expect(m.icon, `${m.id} has no icon`).toBeTypeOf('object');
    }
  });

  it('REV-17 (SPEC.md §5.2): resolves every module riddleKey to a non-empty string in en.json (kind badges retired)', () => {
    for (const m of ALL_CLUSTER_MODULES) {
      const resolved = resolveKey(MESSAGES, m.i18n.riddleKey);
      expect(typeof resolved, m.i18n.riddleKey).toBe('string');
      expect(resolved).not.toBe('');
    }
  });

  it('REV-17 (SPEC.md §6.1): resolves every module scenarioKey to a non-empty string in en.json', () => {
    for (const m of ALL_CLUSTER_MODULES) {
      const resolved = resolveKey(MESSAGES, m.i18n.scenarioKey);
      expect(typeof resolved, m.i18n.scenarioKey).toBe('string');
      expect(resolved).not.toBe('');
    }
  });

  it('resolves the ecosystem "oracle" and the lock-in "oracle" to distinct ids and access names', () => {
    const ecosystemOracle = findClusterModule('ecosystem:oracle');
    const lockinOracle = findClusterModule('lockin:oracle');
    expect(ecosystemOracle).toBeDefined();
    expect(lockinOracle).toBeDefined();
    expect(ecosystemOracle?.id).not.toBe(lockinOracle?.id);
    expect(ecosystemOracle?.accessName).not.toBe(lockinOracle?.accessName);
  });
});

describe('findClusterModule', () => {
  it('finds a known module by its tier-qualified id', () => {
    expect(findClusterModule('ecosystem:echo')?.key).toBe('echo');
  });

  it('returns undefined for an unknown id', () => {
    expect(findClusterModule('does-not-exist')).toBeUndefined();
  });
});

describe('findCluster', () => {
  it('finds a known cluster by key', () => {
    expect(findCluster('lockin').modules).toHaveLength(8);
  });
});
