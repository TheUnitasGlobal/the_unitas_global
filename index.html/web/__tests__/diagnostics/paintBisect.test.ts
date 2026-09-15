import { describe, expect, it } from 'vitest';
import { PAINT_REGIONS, rankRecovery, summarizePaintInventory, type PaintInventory, type RegionSample } from '@/lib/diagnostics/paintBisect';

/**
 * REV-28 MISSION 1 -- the bottleneck adapter's judgement.
 *
 * The headline case is REV-26's own hand-measured WebKit bisect: hiding the
 * rings, the nav, the hero and the search bar took 375ms to 292ms, and only
 * hiding everything reached 15ms. The adapter must reach the same conclusion
 * that session reached by hand -- "the cost is diffuse" -- because the
 * temptation with a ranked list is to declare whatever sits on top the culprit.
 */

/** REV-26's measured WebKit bisect, as the adapter would receive it. */
const WEBKIT_DIFFUSE: RegionSample[] = [
  { key: 'rings', medianWithout: 367, matched: 4 },
  { key: 'nav', medianWithout: 358, matched: 1 },
  { key: 'hero', medianWithout: 288, matched: 1 },
  { key: 'search', medianWithout: 292, matched: 1 },
  { key: 'hub', medianWithout: 300, matched: 1 },
  { key: 'footer', medianWithout: 360, matched: 1 },
  { key: 'canvas', medianWithout: 375, matched: 0 },
  { key: 'everything', medianWithout: 15, matched: 9 },
];

describe('rankRecovery', () => {
  it('reproduces the REV-26 WebKit bisect and calls the cost DIFFUSE', () => {
    const report = rankRecovery(375, 16, WEBKIT_DIFFUSE);
    expect(report.pageCostMs).toBe(359);
    // Hiding everything recovers essentially all of it...
    const everything = report.regions.find((r) => r.key === 'everything')!;
    expect(everything.recoveredMs).toBe(360);
    // ...while the biggest NAMED region recovers well under half.
    const hero = report.regions.find((r) => r.key === 'hero')!;
    expect(hero.recoveredMs).toBe(87);
    expect(hero.sharePct).toBeLessThan(30);
    expect(report.notes.join(' ')).toContain('diffuse');
  });

  it('ranks by recovery, biggest first', () => {
    const report = rankRecovery(375, 16, WEBKIT_DIFFUSE);
    const recoveries = report.regions.map((r) => r.recoveredMs);
    expect(recoveries).toEqual([...recoveries].sort((a, b) => b - a));
  });

  it('names a dominant region when there actually is one', () => {
    const report = rankRecovery(200, 16, [
      { key: 'hub', medianWithout: 40, matched: 1 },
      { key: 'hero', medianWithout: 196, matched: 1 },
      { key: 'everything', medianWithout: 16, matched: 9 },
    ]);
    // `everything` always recovers the most by construction -- it is the
    // control, not a suspect -- so the leader is the top NAMED region.
    expect(report.regions[0].key).toBe('everything');
    const hub = report.regions.find((r) => r.key !== 'everything')!;
    expect(hub.key).toBe('hub');
    expect(hub.sharePct).toBeGreaterThanOrEqual(50);
    expect(report.notes.join(' ')).toContain('accounts for');
  });

  it('keeps a region that matched nothing, with a zero -- absence is information', () => {
    const report = rankRecovery(375, 16, WEBKIT_DIFFUSE);
    const canvas = report.regions.find((r) => r.key === 'canvas')!;
    expect(canvas.matched).toBe(0);
    expect(canvas.recoveredMs).toBe(0);
  });

  it('never reports a negative recovery when hiding something made it slower', () => {
    // Measurement noise can put a "without" sample above the baseline.
    const report = rankRecovery(100, 16, [{ key: 'nav', medianWithout: 120, matched: 1 }]);
    expect(report.regions.find((r) => r.key === 'nav')!.recoveredMs).toBe(0);
  });

  it('says so when the floor is below the page rather than in it', () => {
    // Hiding everything barely helps: the cost is not the page's content.
    const report = rankRecovery(300, 16, [
      { key: 'everything', medianWithout: 240, matched: 9 },
      { key: 'hero', medianWithout: 290, matched: 1 },
    ]);
    expect(report.notes.join(' ')).toContain('the floor is below the page');
  });

  it('declines to look for a bottleneck on a page that has none', () => {
    const report = rankRecovery(16.7, 16.7, [{ key: 'hero', medianWithout: 16.7, matched: 1 }]);
    expect(report.pageCostMs).toBe(0);
    expect(report.notes).toEqual(['this page costs nothing over the device floor -- there is no bottleneck to find']);
  });

  it('always warns that the shares do not partition the cost', () => {
    const report = rankRecovery(375, 16, WEBKIT_DIFFUSE);
    expect(report.notes.join(' ')).toContain('do not sum to 100%');
    // And it must NOT have normalised them into one.
    const total = report.regions.reduce((n, r) => n + r.sharePct, 0);
    expect(total).toBeGreaterThan(100);
  });

  it('covers every catalogued region even when a sample is missing entirely', () => {
    const report = rankRecovery(375, 16, [{ key: 'hero', medianWithout: 300, matched: 1 }]);
    expect(report.regions).toHaveLength(PAINT_REGIONS.length);
  });
});

describe('summarizePaintInventory', () => {
  const base: PaintInventory = {
    backdropFilter: 0,
    filter: 0,
    blurRadiusMax: 0,
    boxShadow: 0,
    gradient: 0,
    willChange: 0,
    canvas: 0,
    runningAnimations: 0,
    elements: 400,
  };

  it('puts backdrop-filter first -- it is the expensive one on a CPU', () => {
    const notes = summarizePaintInventory({ ...base, backdropFilter: 3, filter: 1 });
    expect(notes[0]).toContain('backdrop-filter');
  });

  it('flags a large blur radius, because cost grows with radius', () => {
    expect(summarizePaintInventory({ ...base, blurRadiusMax: 18 }).join(' ')).toContain('18px');
    expect(summarizePaintInventory({ ...base, blurRadiusMax: 4 }).join(' ')).not.toContain('blur radius');
  });

  it('says plainly when nothing expensive is present', () => {
    expect(summarizePaintInventory(base)).toEqual(['nothing on the expensive-property list is present']);
  });

  it('separates compositor-tier animations from paint-tier ones instead of condemning both', () => {
    const notes = summarizePaintInventory({ ...base, runningAnimations: 6 }).join(' ');
    expect(notes).toContain('compositor-tier ones are free');
  });
});
