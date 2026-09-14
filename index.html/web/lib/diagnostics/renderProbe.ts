/**
 * REV-26 MISSION 1 -- the real-device render probe.
 *
 * WHY THIS EXISTS. REV-25 measured the released home on headless WebKit and
 * found a median 363ms between animation frames, against 16ms on `about:blank`
 * in the same browser, with the main thread free and the app scheduling zero
 * frames. The cost was rasterising the page -- in a headless WebKit that has no
 * GPU at all. That harness therefore cannot answer the only question that
 * matters for Safari users: what does a REAL device, with a REAL GPU, do?
 *
 * No headless browser on this machine can answer it. A real device can, and
 * this is what it runs.
 *
 * THE DESIGN RULE: NO ABSOLUTE BUDGETS. A number copied from a desktop run is
 * not evidence about a phone, and a five-year-old Android is not a defect. So
 * every verdict here is either
 *   - portable by construction (an idle page must schedule ZERO frames -- true
 *     on any device, at any speed), or
 *   - relative to a CONTROL measured on the same device in the same second
 *     (the page's own cadence against the cadence with the page hidden).
 * The one exception is the main-thread latency ceiling, which is generous and
 * stated as such.
 *
 * Pure and isomorphic: no DOM, no timers, no React. The browser-side collector
 * lives in `components/system/RenderDiagnostics.tsx`; everything that DECIDES
 * anything is here, and is unit-tested.
 */

export interface CadenceStats {
  count: number;
  min: number;
  median: number;
  p95: number;
  max: number;
}

/** Frame-to-frame gaps, in milliseconds, summarised. */
export function summarizeGaps(gaps: readonly number[]): CadenceStats {
  const clean = gaps.filter((g) => Number.isFinite(g) && g >= 0).slice().sort((a, b) => a - b);
  if (clean.length === 0) return { count: 0, min: 0, median: 0, p95: 0, max: 0 };
  const at = (q: number) => clean[Math.min(clean.length - 1, Math.max(0, Math.floor(clean.length * q)))];
  // Rounded: a frame clock produces values like 16.700000000000728, and this
  // report is read by a human on a phone.
  const round = (n: number) => Number(n.toFixed(2));
  return {
    count: clean.length,
    min: round(clean[0]),
    median: round(at(0.5)),
    p95: round(at(0.95)),
    max: round(clean[clean.length - 1]),
  };
}

/* ------------------------------------------------------------------ */
/* GPU identification                                                   */
/* ------------------------------------------------------------------ */

export type GpuTier = 'hardware' | 'software' | 'unknown';

/**
 * Renderer strings that mean "there is no GPU here" -- the CPU is drawing.
 * A headless Chromium reports SwiftShader; a headless WebKit on Windows and a
 * VM with no graphics driver report one of the others.
 */
const SOFTWARE_RENDERERS = [
  'swiftshader',
  'llvmpipe',
  'softpipe',
  'software rasterizer',
  'microsoft basic render',
  'mesa offscreen',
  'google swiftshader',
];

/**
 * WHAT THIS CANNOT DO (measured 2026-09-14). A renderer string is a CLAIM, and
 * some browsers make one they cannot back. Playwright's WebKit on Windows
 * reports `Apple GPU` -- on a machine with no Apple GPU and no GPU path at
 * all -- so this classifier calls that harness `hardware` and the verdict
 * lands on `raster-bound` (page 555ms against a 16ms floor, 34.7x). That
 * reading is CORRECT about the page being expensive to draw there and WRONG
 * about why. On a real iPhone `Apple GPU` means what it says, which is the
 * device this instrument is for; the caveat only bites in the harness, and it
 * is recorded rather than papered over with a Windows-specific special case
 * that would then be wrong on a real Mac.
 */
export function classifyGpu(renderer: string | null | undefined): GpuTier {
  if (!renderer || typeof renderer !== 'string') return 'unknown';
  const value = renderer.trim().toLowerCase();
  if (!value) return 'unknown';
  if (SOFTWARE_RENDERERS.some((needle) => value.includes(needle))) return 'software';
  return 'hardware';
}

/* ------------------------------------------------------------------ */
/* The reading                                                          */
/* ------------------------------------------------------------------ */

export interface RenderReading {
  /** Frame gaps while the released page is on screen and untouched. */
  page: CadenceStats;
  /**
   * The SAME measurement with the page's own content hidden. This is the
   * device's own floor: it separates "this engine paces frames slowly" from
   * "this page is expensive to draw", which is the distinction REV-25's
   * WebKit number could not make on its own.
   */
  control: CadenceStats;
  /** Animation frames the APPLICATION asked for while idle. Portable: 0. */
  framesScheduledWhileIdle: number;
  /** Median `setTimeout(0)` latency -- is the main thread free? */
  mainThreadLatencyMs: number;
  /**
   * Main-thread latency measured WHILE a transform/opacity animation runs.
   * A compositor-driven animation does not touch the main thread, so this
   * should look like the idle figure. If it spikes, the animation is being
   * driven on the main thread and the acceleration pipeline is not intact.
   */
  mainThreadLatencyDuringCompositorAnimationMs: number | null;
  gpuRenderer: string | null;
  gpuVendor: string | null;
  webgl: 'webgl2' | 'webgl' | 'none';
}

export type PipelineStatus = 'accelerated' | 'raster-bound' | 'software' | 'main-thread-bound' | 'unknown';

export interface PipelineVerdict {
  status: PipelineStatus;
  gpu: GpuTier;
  /** How much of the frame interval the PAGE adds over this device's floor. */
  pageCostMs: number;
  /** page median / control median -- 1.0 means the page costs nothing extra. */
  pageCostRatio: number;
  findings: string[];
}

export interface PipelineThresholds {
  /** An idle page may schedule at most this many frames (React settling). */
  maxIdleFrames: number;
  /** Generous, and deliberately absolute: a free main thread answers fast. */
  maxMainThreadLatencyMs: number;
  /** The page may not cost more than this multiple of the device's own floor. */
  maxPageCostRatio: number;
  /** ...and not more than one frame of absolute overhead beyond it. */
  maxPageCostMs: number;
  /** A compositor animation may not add more than this to main-thread latency. */
  maxCompositorLatencyDeltaMs: number;
}

export const DEFAULT_PIPELINE_THRESHOLDS: PipelineThresholds = {
  maxIdleFrames: 2,
  maxMainThreadLatencyMs: 50,
  maxPageCostRatio: 2,
  maxPageCostMs: 16.7,
  maxCompositorLatencyDeltaMs: 30,
};

/**
 * Turn a reading into a verdict. Order matters: a software rasteriser explains
 * everything downstream of it, so it is reported first rather than being
 * re-described as three separate failures.
 */
export function classifyPipeline(reading: RenderReading, thresholds: PipelineThresholds = DEFAULT_PIPELINE_THRESHOLDS): PipelineVerdict {
  const gpu = classifyGpu(reading.gpuRenderer);
  const controlMedian = reading.control.median;
  const pageMedian = reading.page.median;
  const pageCostMs = Number((pageMedian - controlMedian).toFixed(2));
  const pageCostRatio = controlMedian > 0 ? Number((pageMedian / controlMedian).toFixed(2)) : 0;
  const findings: string[] = [];

  if (reading.page.count === 0 || reading.control.count === 0) {
    return { status: 'unknown', gpu, pageCostMs, pageCostRatio, findings: ['the probe collected no frames'] };
  }

  if (reading.framesScheduledWhileIdle > thresholds.maxIdleFrames) {
    findings.push(`the app scheduled ${reading.framesScheduledWhileIdle} animation frames while idle`);
  }
  if (reading.mainThreadLatencyMs > thresholds.maxMainThreadLatencyMs) {
    findings.push(`the main thread answered a zero-delay task in ${reading.mainThreadLatencyMs}ms`);
  }
  const compositorDelta =
    reading.mainThreadLatencyDuringCompositorAnimationMs === null
      ? null
      : Number((reading.mainThreadLatencyDuringCompositorAnimationMs - reading.mainThreadLatencyMs).toFixed(2));
  if (compositorDelta !== null && compositorDelta > thresholds.maxCompositorLatencyDeltaMs) {
    findings.push(`a transform animation added ${compositorDelta}ms of main-thread latency -- it is not running on the compositor`);
  }
  const rasterBound = pageCostRatio > thresholds.maxPageCostRatio && pageCostMs > thresholds.maxPageCostMs;
  if (rasterBound) {
    findings.push(`drawing the page costs ${pageCostMs}ms per frame over this device's own floor (${pageCostRatio}x)`);
  }

  if (gpu === 'software') {
    findings.unshift('this browser is rasterising on the CPU -- there is no GPU path here');
    return { status: 'software', gpu, pageCostMs, pageCostRatio, findings };
  }
  if (reading.mainThreadLatencyMs > thresholds.maxMainThreadLatencyMs) {
    return { status: 'main-thread-bound', gpu, pageCostMs, pageCostRatio, findings };
  }
  if (rasterBound) {
    return { status: 'raster-bound', gpu, pageCostMs, pageCostRatio, findings };
  }
  return { status: 'accelerated', gpu, pageCostMs, pageCostRatio, findings };
}

/* ------------------------------------------------------------------ */
/* Report shape                                                         */
/* ------------------------------------------------------------------ */

export interface DeviceFacts {
  userAgent: string;
  viewport: { width: number; height: number };
  devicePixelRatio: number;
  hardwareConcurrency: number | null;
  deviceMemoryGb: number | null;
  reducedMotion: boolean;
  coarsePointer: boolean;
}

export interface RenderReport {
  schema: 'unitas.render-probe.v1';
  capturedAt: string;
  url: string;
  device: DeviceFacts;
  reading: RenderReading;
  verdict: PipelineVerdict;
}

export function buildReport(input: { capturedAt: string; url: string; device: DeviceFacts; reading: RenderReading }, thresholds?: PipelineThresholds): RenderReport {
  return {
    schema: 'unitas.render-probe.v1',
    capturedAt: input.capturedAt,
    url: input.url,
    device: input.device,
    reading: input.reading,
    verdict: classifyPipeline(input.reading, thresholds),
  };
}

/** One line a human can read out loud over the phone. */
export function headline(report: RenderReport): string {
  const { verdict, reading } = report;
  const gpu = report.reading.gpuRenderer ?? 'unidentified renderer';
  return `${verdict.status.toUpperCase()} · ${gpu} · page ${reading.page.median}ms vs floor ${reading.control.median}ms (${verdict.pageCostRatio}x) · idle frames ${reading.framesScheduledWhileIdle} · main thread ${reading.mainThreadLatencyMs}ms`;
}
