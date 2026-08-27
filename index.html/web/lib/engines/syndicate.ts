// Deterministic coalition-network generator for the Syndicate ecosystem
// (Ecosystems.syndicate.rules: "Access requires a named target entity;
// results are network graphs, not verdicts."). Generic relationship
// archetypes (not fabricated proper names) seeded from the target string,
// so results are reproducible and don't imply real intelligence-gathering.

function hashSeed(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) {
    h = (h * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(h) || 1;
}

export const SYNDICATE_ARCHETYPES = [
  'shellEntity',
  'advisoryPartner',
  'historicalContact',
  'financialBacker',
  'contractualVendor',
  'silentStakeholder',
] as const;
export type SyndicateArchetype = (typeof SYNDICATE_ARCHETYPES)[number];

export interface SyndicateNode {
  id: string;
  /** Translation key, e.g. "syndicateShellEntity". */
  archetypeKey: string;
  influence: number;
  /** Angle in radians for a radial layout around the target node. */
  angle: number;
}

export interface SyndicateNetwork {
  target: string;
  nodes: SyndicateNode[];
}

export function buildSyndicateNetwork(target: string): SyndicateNetwork {
  const seed = hashSeed(target.trim().toLowerCase() || 'entity');
  let s = seed;
  const next = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };

  const count = 4 + (seed % 3); // 4-6 nodes

  // Seeded Fisher-Yates -- deterministic regardless of engine, unlike
  // sorting with a random comparator (which isn't guaranteed to call the
  // comparator the same number of times across JS engines).
  const shuffled = [...SYNDICATE_ARCHETYPES];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(next() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const nodes: SyndicateNode[] = shuffled.slice(0, count).map((archetype, i) => ({
    id: `${archetype}-${i}`,
    archetypeKey: `syndicate${archetype.charAt(0).toUpperCase()}${archetype.slice(1)}`,
    influence: Math.round(20 + next() * 80),
    angle: (i / count) * Math.PI * 2,
  }));

  return { target, nodes };
}
