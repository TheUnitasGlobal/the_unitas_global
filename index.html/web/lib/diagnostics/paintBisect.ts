/**
 * REV-28 MISSION 1 -- the bottleneck collection adapter.
 *
 * WHY. REV-26's probe can say a device is `raster-bound` -- the page costs more
 * per frame than that device's own floor -- but "the page is expensive" is not
 * something anyone can act on. When the founder's iPhone comes back
 * raster-bound, the next question is immediate: EXPENSIVE WHERE?
 *
 * REV-26 answered that question once, by hand, on headless WebKit: hide the
 * rings, then the nav, then the hero, then the search bar, measuring after
 * each. It found the cost was diffuse (375 -> 292ms across four regions, and
 * only hiding everything reached 15ms). That hand procedure is what this
 * module turns into an instrument.
 *
 * HOW IT READS. Each region is hidden in turn, the cadence re-measured, and
 * the RECOVERY recorded -- how much of the frame interval comes back. Recovery
 * is then stated as a share of the page's total cost over the device floor, so
 * the founder gets "the hub is 46% of what this page costs to draw" rather than
 * a bare millisecond figure that means nothing without context.
 *
 * WHAT IT IS NOT. It is not a profiler and does not pretend to be: regions
 * overlap, compositing is not additive, and shares will not sum to 100. It
 * ranks suspects. `rankRecovery` therefore never normalises the shares to make
 * them add up, because that would invent precision the method does not have.
 *
 * Pure: no DOM, no timers. The collector lives in
 * `components/system/RenderDiagnostics.tsx`.
 */

export interface BisectRegion {
  key: string;
  /** Untranslated technical label -- this is instrument output, not prose. */
  label: string;
  /** Hidden with `display:none` during that region's pass. */
  selector: string;
}

/**
 * The released home, in the order a frame pays for it. `everything` is the
 * control-of-the-control: hiding all page content should recover essentially
 * the whole page cost, and if it does NOT, the cost is not in the page at all
 * (a browser-level or compositor-level floor) -- which is itself the answer.
 */
export const PAINT_REGIONS: readonly BisectRegion[] = [
  { key: 'rings', label: 'void rings', selector: '.qw-void-ring' },
  { key: 'nav', label: 'nav bar', selector: '#unitas-nav' },
  { key: 'hero', label: 'hero wordmark', selector: '.qw-hero-wrap' },
  { key: 'search', label: 'search bar', selector: '#omni-synapse-search' },
  { key: 'hub', label: 'discovery hub', selector: '[data-live-hub]' },
  { key: 'footer', label: 'footer', selector: '#site-footer' },
  { key: 'canvas', label: 'webgl canvas', selector: 'canvas' },
  { key: 'everything', label: 'all page content', selector: 'body > *:not(script)' },
];

export interface RegionSample {
  key: string;
  /** Cadence median measured with this region hidden. */
  medianWithout: number;
  /** How many elements the selector actually matched. */
  matched: number;
}

export interface RegionRecovery {
  key: string;
  label: string;
  matched: number;
  /** Milliseconds of frame interval returned by hiding this region. */
  recoveredMs: number;
  /** That recovery as a share of the page's total cost over the floor. */
  sharePct: number;
}

export interface BisectReport {
  baselineMedian: number;
  floorMedian: number;
  /** The whole page's cost over this device's floor. */
  pageCostMs: number;
  regions: RegionRecovery[];
  notes: string[];
}

const round = (n: number) => Number(n.toFixed(2));

/**
 * Rank the suspects. Regions that matched nothing are reported with a zero
 * recovery rather than dropped -- "this page has no canvas" is information,
 * and silently omitting it would read as "the canvas was free".
 */
export function rankRecovery(baselineMedian: number, floorMedian: number, samples: readonly RegionSample[], regions: readonly BisectRegion[] = PAINT_REGIONS): BisectReport {
  const pageCostMs = round(Math.max(0, baselineMedian - floorMedian));
  const byKey = new Map(samples.map((s) => [s.key, s]));
  const rows: RegionRecovery[] = regions.map((region) => {
    const sample = byKey.get(region.key);
    const recoveredMs = sample ? round(Math.max(0, baselineMedian - sample.medianWithout)) : 0;
    return {
      key: region.key,
      label: region.label,
      matched: sample?.matched ?? 0,
      recoveredMs,
      sharePct: pageCostMs > 0 ? round((recoveredMs / pageCostMs) * 100) : 0,
    };
  });
  rows.sort((a, b) => b.recoveredMs - a.recoveredMs);

  const notes: string[] = [];
  if (pageCostMs <= 0) {
    notes.push('this page costs nothing over the device floor -- there is no bottleneck to find');
    return { baselineMedian: round(baselineMedian), floorMedian: round(floorMedian), pageCostMs, regions: rows, notes };
  }

  const everything = rows.find((r) => r.key === 'everything');
  const named = rows.filter((r) => r.key !== 'everything' && r.matched > 0);
  const leader = named[0];

  if (everything && everything.sharePct < 50) {
    notes.push('hiding ALL page content recovered less than half the cost -- the floor is below the page, not in it');
  }
  // The bands are calibrated against REV-26's hand bisect, which concluded
  // DIFFUSE from a page whose largest region was 24% of the cost. A first cut
  // of this code put the "largest single contributor" line at 20% and would
  // have promoted that 24% into a culprit -- naming a suspect the earlier
  // measurement had already acquitted. A quarter of the cost is one of several
  // contributors, not a bottleneck.
  if (!leader || leader.sharePct < 30) {
    notes.push('no single region dominates: the cost is diffuse across the page, as REV-26 measured on headless WebKit');
  } else if (leader.sharePct >= 50) {
    notes.push(`${leader.label} alone accounts for ${leader.sharePct}% of what this page costs to draw`);
  } else {
    notes.push(`${leader.label} is the largest single contributor at ${leader.sharePct}%, but it is not the whole story`);
  }
  // Shares overlap by construction; say so rather than let them be read as a
  // partition.
  notes.push('regions overlap and compositing is not additive -- these rank suspects, they do not sum to 100%');

  return { baselineMedian: round(baselineMedian), floorMedian: round(floorMedian), pageCostMs, regions: rows, notes };
}

/* ------------------------------------------------------------------ */
/* Static paint inventory                                               */
/* ------------------------------------------------------------------ */

export interface PaintInventory {
  backdropFilter: number;
  filter: number;
  blurRadiusMax: number;
  boxShadow: number;
  gradient: number;
  willChange: number;
  canvas: number;
  runningAnimations: number;
  elements: number;
}

/**
 * The properties a software rasteriser pays most for, counted. This is a
 * complement to the bisect, not a substitute: it says what the page ASKS the
 * compositor to do, while the bisect says what that actually costs here.
 */
export function summarizePaintInventory(inv: PaintInventory): string[] {
  const notes: string[] = [];
  if (inv.backdropFilter > 0) notes.push(`${inv.backdropFilter} backdrop-filter layer(s) -- the most expensive property on this list when rasterised on a CPU`);
  if (inv.blurRadiusMax >= 12) notes.push(`largest blur radius is ${inv.blurRadiusMax}px -- blur cost grows with radius, not with area alone`);
  if (inv.canvas > 0) notes.push(`${inv.canvas} canvas element(s) -- a lost or software WebGL context turns these into CPU work`);
  if (inv.runningAnimations > 0) notes.push(`${inv.runningAnimations} animation(s) running -- compositor-tier ones are free, paint-tier ones are not`);
  if (inv.filter > 0) notes.push(`${inv.filter} element(s) with a CSS filter`);
  if (notes.length === 0) notes.push('nothing on the expensive-property list is present');
  return notes;
}
