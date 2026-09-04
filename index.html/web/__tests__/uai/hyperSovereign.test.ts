import { describe, expect, it } from 'vitest';
import {
  CHRONO_OFFSETS,
  HYPER_ENGINES,
  IDEA_CHILDREN,
  buildHyperSkeleton,
  computeFate,
  forgeTimeline,
  forgeTwin,
  hyperItemCount,
  isValidHyperVariant,
  normalizeHyperSeed,
  replicateIdeas,
  simulateMargin,
} from '@/lib/hyperSovereign';

describe('hyperSovereign engines', () => {
  it('registers five engines with unique keys', () => {
    expect(HYPER_ENGINES).toHaveLength(5);
    expect(new Set(HYPER_ENGINES.map((e) => e.key)).size).toBe(5);
  });

  it('normalizes seeds (case, whitespace, cap)', () => {
    expect(normalizeHyperSeed('  Coffee   Shop ')).toBe('coffee shop');
    expect(normalizeHyperSeed('x'.repeat(200))).toHaveLength(80);
  });

  it('replicates ideas deterministically, three distinct axes per generation, zero capital', () => {
    const a = replicateIdeas('coffee', null, 0);
    const b = replicateIdeas('Coffee ', null, 0);
    expect(a).toEqual(b);
    expect(a).toHaveLength(IDEA_CHILDREN);
    expect(new Set(a.map((i) => i.axisKey)).size).toBe(IDEA_CHILDREN);
    for (const idea of a) {
      expect(idea.metrics.capital).toBe(0);
      expect(idea.metrics.launchDays).toBeGreaterThanOrEqual(1);
      expect(idea.metrics.automation).toBeLessThanOrEqual(99);
    }
    const children = replicateIdeas('coffee', a[0].id, 1);
    expect(children.every((c) => c.parentId === a[0].id && c.generation === 1)).toBe(true);
    expect(children.map((c) => c.id)).not.toEqual(a.map((c) => c.id));
  });

  it('computes fate with applied levers raising the probability', () => {
    const base = computeFate('launch an AI coin business', 3, []);
    expect(base.probability).toBeGreaterThanOrEqual(3);
    expect(base.probability).toBeLessThanOrEqual(97);
    expect(base.levers).toHaveLength(3);
    expect(base.trajectory.map((p) => p.year)).toEqual([1, 2, 3]);
    const hacked = computeFate('launch an AI coin business', 3, [base.levers[0].axis]);
    expect(hacked.probability).toBeGreaterThan(base.probability);
    expect(hacked.levers.find((l) => l.axis === base.levers[0].axis)?.applied).toBe(true);
    expect(computeFate('x', 10, []).trajectory).toHaveLength(6);
  });

  it('forges twins with a stable U-Signature per generation', () => {
    const t0 = forgeTwin('seoul', 0);
    const t0b = forgeTwin('Seoul', 0);
    const t1 = forgeTwin('seoul', 1);
    expect(t0.signature).toBe(t0b.signature);
    expect(t0.signature).not.toBe(t1.signature);
    expect(t0.signature).toMatch(/^U-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/);
    expect(t0.resonance).toHaveLength(5);
    expect(t0.elements).toHaveLength(5);
  });

  it('forges a five-milestone timeline in ascending years', () => {
    const tl = forgeTimeline('brand', 0, 2026);
    expect(tl.map((m) => m.offset)).toEqual([...CHRONO_OFFSETS]);
    expect(tl.map((m) => m.year)).toEqual([2027, 2028, 2029, 2031, 2036]);
    expect(tl[0].probability).toBeGreaterThan(tl[4].probability);
  });

  it('simulates margin and reports ∞ at full cache hit', () => {
    const partial = simulateMargin({ price: 3, burn: 0.4, cacheHit: 0.9, calls: 1000 });
    expect(partial.revenue).toBe(3000);
    expect(partial.cost).toBe(40);
    expect(partial.marginX).toBe(75);
    expect(partial.curve).toHaveLength(11);
    const infinite = simulateMargin({ price: 3, burn: 0.4, cacheHit: 1, calls: 1000 });
    expect(infinite.cost).toBe(0);
    expect(infinite.marginX).toBeNull();
    expect(infinite.marginPct).toBe(100);
  });

  it('builds skeletons only for valid variants', () => {
    expect(isValidHyperVariant('root:0')).toBe(true);
    expect(isValidHyperVariant('3:logic+art')).toBe(true);
    expect(isValidHyperVariant('bad variant!')).toBe(false);
    expect(buildHyperSkeleton('ideaReplicator', 'coffee', 'root:0')?.split('\n')).toHaveLength(hyperItemCount('ideaReplicator'));
    expect(buildHyperSkeleton('ideaReplicator', 'coffee', 'root:99')).toBeNull();
    expect(buildHyperSkeleton('fateEngine', 'goal', '3:none')).toContain('Goal probability within 3 year(s)');
    expect(buildHyperSkeleton('fateEngine', 'goal', '4:none')).toBeNull();
    expect(buildHyperSkeleton('omniTwin', 'me', '2')).toContain('U-Signature');
    expect(buildHyperSkeleton('chronoForge', 'me', '0:2026')?.split('\n')).toHaveLength(5);
    expect(buildHyperSkeleton('marginInfinity', 'me', '0')).toBeNull();
  });
});
