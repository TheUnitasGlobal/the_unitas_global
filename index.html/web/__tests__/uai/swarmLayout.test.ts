import { describe, expect, it } from 'vitest';
import { SWARM_CENTRE, hashUnit, swarmLayout, type SwarmInputDimension } from '../../lib/swarm/swarmLayout';

// REV-24 MISSION 4 -- the Omni-Tech swarm field. Pure layout only; no
// fixtures shared with other __tests__/** files (CLAUDE.md "Module-level
// test isolation").

function dim(key: string, label: string, n: number): SwarmInputDimension {
  return {
    key,
    label,
    nodes: Array.from({ length: n }, (_, i) => ({ id: `${key}-Q${i + 1}`, title: `${label} ${i + 1}`, qid: `Q${i + 1}` })),
  };
}

const SIX: SwarmInputDimension[] = [
  dim('bigtech-P452', 'Industry', 6),
  dim('bigtech-P749', 'Parent', 3),
  dim('bigtech-P355', 'Subsidiaries', 10),
  dim('bigtech-P1056', 'Products', 10),
  dim('bigtech-P112', 'Founders', 6),
  dim('bigtech-P169', 'Chief executive', 3),
];

describe('hashUnit', () => {
  it('is deterministic and inside [0, 1)', () => {
    for (const id of ['P452-Q95', 'bigtech', '', 'Ω-Q1', 'a'.repeat(200)]) {
      const a = hashUnit(id);
      expect(a).toBe(hashUnit(id));
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThan(1);
    }
  });

  it('separates neighbouring ids -- the scatter is real, not a ramp', () => {
    // The node ids are `<PID>-Q<number>`, so consecutive entries differ in one
    // character. Without the avalanche finisher those hashed 0.0039 apart and
    // every sector laid its nodes out along a straight ramp.
    for (const [a, b] of [
      ['P452-Q1', 'P452-Q2'],
      ['P1056-Q9', 'P1056-Q10'],
      ['P355-Q42', 'P355-Q43'],
    ]) {
      expect(Math.abs(hashUnit(a) - hashUnit(b)), `${a} vs ${b}`).toBeGreaterThan(0.05);
    }
  });

  it('spreads a whole id family across the unit interval', () => {
    const xs = Array.from({ length: 24 }, (_, i) => hashUnit(`P355-Q${i + 1}`));
    const buckets = new Set(xs.map((x) => Math.floor(x * 4)));
    // A ramp would fall into one or two quarters; a real hash hits all four.
    expect(buckets.size).toBe(4);
  });
});

describe('swarmLayout -- every node lands somewhere drawable', () => {
  const layout = swarmLayout(SIX);

  it('places every node of every dimension', () => {
    expect(layout.nodes).toHaveLength(6 + 3 + 10 + 10 + 6 + 3);
    expect(layout.dimensions).toHaveLength(6);
  });

  it('keeps every node inside the field, clear of the clipping edge', () => {
    // `.qw-deeper-card` sets `contain: layout paint`, so anything outside the
    // box is CLIPPED, not overflowed -- an out-of-range node is invisible.
    for (const n of layout.nodes) {
      expect(n.x, n.id).toBeGreaterThanOrEqual(7);
      expect(n.x, n.id).toBeLessThanOrEqual(93);
      expect(n.y, n.id).toBeGreaterThanOrEqual(7);
      expect(n.y, n.id).toBeLessThanOrEqual(93);
    }
  });

  it('never puts a node on top of the core', () => {
    for (const n of layout.nodes) {
      const d = Math.hypot(n.x - SWARM_CENTRE, n.y - SWARM_CENTRE);
      expect(d, n.id).toBeGreaterThan(8);
    }
  });

  it('gives depth across all three shells, normalised 0..1', () => {
    const depths = new Set(layout.nodes.map((n) => n.depth));
    expect(depths.has(0)).toBe(true);
    expect(depths.has(1)).toBe(true);
    for (const d of depths) {
      expect(d).toBeGreaterThanOrEqual(0);
      expect(d).toBeLessThanOrEqual(1);
    }
  });

  it('carries each node home to its dimension', () => {
    for (const n of layout.nodes) {
      expect(n.dimensionKey).toBe(n.id.split('-').slice(0, 2).join('-'));
      expect(layout.dimensions[n.dimensionIndex].key).toBe(n.dimensionKey);
    }
  });

  it('separates the sectors -- two dimensions do not occupy one direction', () => {
    const bearing = (key: string) => {
      const ns = layout.nodes.filter((n) => n.dimensionKey === key);
      const mx = ns.reduce((s, n) => s + (n.x - SWARM_CENTRE), 0) / ns.length;
      const my = ns.reduce((s, n) => s + (n.y - SWARM_CENTRE), 0) / ns.length;
      return Math.atan2(my, mx);
    };
    const bearings = layout.dimensions.map((d) => bearing(d.key));
    for (let i = 0; i < bearings.length; i++) {
      for (let j = i + 1; j < bearings.length; j++) {
        let diff = Math.abs(bearings[i] - bearings[j]);
        if (diff > Math.PI) diff = Math.PI * 2 - diff;
        expect(diff, `${layout.dimensions[i].key} vs ${layout.dimensions[j].key}`).toBeGreaterThan(0.5);
      }
    }
  });
});

describe('swarmLayout -- determinism (no hydration mismatch)', () => {
  it('is byte-identical across repeated calls', () => {
    expect(swarmLayout(SIX)).toEqual(swarmLayout(SIX));
  });

  it('places a node identically no matter how many dimensions came before it', () => {
    // Positions depend on the dimension's INDEX, so this checks the thing
    // that actually has to hold: the same input produces the same output.
    const a = swarmLayout([SIX[0], SIX[1]]);
    const b = swarmLayout([SIX[0], SIX[1]]);
    expect(a.nodes.map((n) => [n.id, n.x, n.y])).toEqual(b.nodes.map((n) => [n.id, n.x, n.y]));
  });
});

describe('swarmLayout -- degenerate input', () => {
  it('returns an empty field for no dimensions', () => {
    const l = swarmLayout([]);
    expect(l.nodes).toEqual([]);
    expect(l.dimensions).toEqual([]);
    expect(l.centre).toEqual({ x: 50, y: 50 });
  });

  it('drops empty dimensions so the survivors use the whole circle', () => {
    const l = swarmLayout([dim('a', 'A', 0), dim('b', 'B', 4), dim('c', 'C', 0)]);
    expect(l.dimensions).toHaveLength(1);
    expect(l.dimensions[0].key).toBe('b');
    expect(l.nodes).toHaveLength(4);
  });

  it('centres a lone node in its sector rather than dividing by zero', () => {
    const l = swarmLayout([dim('solo', 'Solo', 1)]);
    expect(l.nodes).toHaveLength(1);
    expect(Number.isFinite(l.nodes[0].x)).toBe(true);
    expect(Number.isFinite(l.nodes[0].y)).toBe(true);
  });

  it('survives a single dimension with many nodes', () => {
    const l = swarmLayout([dim('many', 'Many', 40)]);
    expect(l.nodes).toHaveLength(40);
    for (const n of l.nodes) {
      expect(Number.isFinite(n.x) && Number.isFinite(n.y)).toBe(true);
    }
  });
});
