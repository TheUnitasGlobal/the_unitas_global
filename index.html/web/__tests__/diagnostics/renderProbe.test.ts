import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PIPELINE_THRESHOLDS,
  buildReport,
  classifyGpu,
  classifyPipeline,
  headline,
  summarizeGaps,
  type RenderReading,
} from '@/lib/diagnostics/renderProbe';

/**
 * REV-26 MISSION 1 -- the render probe's judgement.
 *
 * The readings themselves come from a real device; what is testable here is
 * whether the probe DECIDES correctly given a reading. The cases below are
 * built from numbers this session actually measured, so a regression shows up
 * as "we would now call the headless WebKit run healthy", which is precisely
 * the mistake this file exists to prevent.
 */

/** Headless WebKit on Windows, REV-25 measurements. */
const HEADLESS_WEBKIT: RenderReading = {
  page: { count: 90, min: 227, median: 363, p95: 425, max: 541 },
  control: { count: 90, min: 14, median: 15, p95: 17, max: 23 },
  framesScheduledWhileIdle: 0,
  mainThreadLatencyMs: 15,
  mainThreadLatencyDuringCompositorAnimationMs: 16,
  gpuRenderer: 'Google SwiftShader',
  gpuVendor: 'Google Inc.',
  webgl: 'webgl2',
};

/** Chromium on this machine, same session. */
const HEALTHY: RenderReading = {
  page: { count: 90, min: 12.8, median: 16.7, p95: 33.4, max: 50.1 },
  control: { count: 90, min: 16.6, median: 16.7, p95: 16.8, max: 16.9 },
  framesScheduledWhileIdle: 0,
  mainThreadLatencyMs: 4.6,
  mainThreadLatencyDuringCompositorAnimationMs: 5.1,
  gpuRenderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Direct3D11 vs_5_0 ps_5_0, D3D11)',
  gpuVendor: 'Google Inc. (NVIDIA)',
  webgl: 'webgl2',
};

describe('summarizeGaps', () => {
  it('summarises an ordinary sample', () => {
    const s = summarizeGaps([16.7, 16.7, 33.4, 16.6, 50.1]);
    expect(s.count).toBe(5);
    expect(s.min).toBe(16.6);
    expect(s.median).toBe(16.7);
    expect(s.max).toBe(50.1);
  });

  it('drops the negative and non-finite gaps a browser clock can produce', () => {
    // Measured: chromium reported min -11.6ms on about:blank. A negative gap
    // is a clock artefact, not a frame.
    // Three of these five are not frames: a negative gap, a NaN, and an
    // Infinity -- `Number.isFinite` rejects the last two, the `>= 0` guard the
    // first. Two real gaps survive.
    const s = summarizeGaps([16.7, -11.6, Number.NaN, Infinity, 16.8]);
    expect(s.count).toBe(2);
    expect(s.min).toBe(16.7);
    expect(s.max).toBe(16.8);
  });

  it('is empty-safe', () => {
    expect(summarizeGaps([])).toEqual({ count: 0, min: 0, median: 0, p95: 0, max: 0 });
    expect(summarizeGaps([Number.NaN])).toEqual({ count: 0, min: 0, median: 0, p95: 0, max: 0 });
  });
});

describe('classifyGpu', () => {
  it('names the CPU rasterisers for what they are', () => {
    for (const renderer of [
      'Google SwiftShader',
      'SwiftShader',
      'llvmpipe (LLVM 15.0.7, 256 bits)',
      'Microsoft Basic Render Driver',
      'Mesa OffScreen',
      'Software Rasterizer',
    ]) {
      expect(classifyGpu(renderer), renderer).toBe('software');
    }
  });

  it('accepts a real GPU, including the ones a phone reports', () => {
    for (const renderer of [
      'Apple GPU',
      'Apple A17 Pro GPU',
      'ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Direct3D11 vs_5_0 ps_5_0, D3D11)',
      'Mali-G715',
      'Adreno (TM) 740',
    ]) {
      expect(classifyGpu(renderer), renderer).toBe('hardware');
    }
  });

  it('says unknown rather than guessing when the string is withheld', () => {
    // WEBGL_debug_renderer_info is not exposed everywhere, and Safari has
    // restricted it before. Absent evidence is not evidence of software.
    expect(classifyGpu(null)).toBe('unknown');
    expect(classifyGpu('')).toBe('unknown');
    expect(classifyGpu('   ')).toBe('unknown');
    expect(classifyGpu(undefined)).toBe('unknown');
  });
});

describe('classifyPipeline', () => {
  it('calls a real GPU with a cheap page ACCELERATED', () => {
    const v = classifyPipeline(HEALTHY);
    expect(v.status).toBe('accelerated');
    expect(v.gpu).toBe('hardware');
    expect(v.findings).toEqual([]);
    expect(v.pageCostRatio).toBe(1);
  });

  it('calls the headless WebKit run SOFTWARE, and says so first', () => {
    // The REV-25 trap in one assertion: this reading LOOKS like a disaster
    // (363ms frames) but the app is innocent -- zero idle frames, free main
    // thread. The verdict must name the CPU rasteriser as the cause.
    const v = classifyPipeline(HEADLESS_WEBKIT);
    expect(v.status).toBe('software');
    expect(v.findings[0]).toContain('rasterising on the CPU');
    expect(v.pageCostMs).toBe(348);
    expect(v.pageCostRatio).toBe(24.2);
  });

  it('calls a real GPU with an expensive page RASTER-BOUND', () => {
    const v = classifyPipeline({ ...HEADLESS_WEBKIT, gpuRenderer: 'Apple GPU' });
    expect(v.status).toBe('raster-bound');
    expect(v.gpu).toBe('hardware');
    expect(v.findings.join(' ')).toContain("over this device's own floor");
  });

  it('catches a runaway animation loop on any device, with no budget at all', () => {
    const v = classifyPipeline({ ...HEALTHY, framesScheduledWhileIdle: 61 });
    expect(v.findings.join(' ')).toContain('61 animation frames while idle');
  });

  it('calls a blocked main thread MAIN-THREAD-BOUND, ahead of raster', () => {
    const v = classifyPipeline({ ...HEALTHY, mainThreadLatencyMs: 220 });
    expect(v.status).toBe('main-thread-bound');
    expect(v.findings.join(' ')).toContain('zero-delay task in 220ms');
  });

  it('catches an animation that is NOT on the compositor', () => {
    const v = classifyPipeline({ ...HEALTHY, mainThreadLatencyDuringCompositorAnimationMs: 180 });
    expect(v.findings.join(' ')).toContain('not running on the compositor');
  });

  it('does not accuse the compositor when the animation could not be measured', () => {
    const v = classifyPipeline({ ...HEALTHY, mainThreadLatencyDuringCompositorAnimationMs: null });
    expect(v.status).toBe('accelerated');
    expect(v.findings).toEqual([]);
  });

  it('a slow device with a proportionate page still passes -- no absolute budget', () => {
    // An old phone pacing at 50ms with a page that costs nothing extra is
    // SLOW, not BROKEN. A budget copied from a desktop would fail it.
    const slowButHonest: RenderReading = {
      ...HEALTHY,
      page: { count: 90, min: 48, median: 52, p95: 66, max: 80 },
      control: { count: 90, min: 46, median: 50, p95: 60, max: 70 },
      gpuRenderer: 'Mali-G52',
      mainThreadLatencyMs: 18,
      mainThreadLatencyDuringCompositorAnimationMs: 21,
    };
    expect(classifyPipeline(slowButHonest).status).toBe('accelerated');
  });

  it('reports UNKNOWN rather than inventing a verdict from no frames', () => {
    const v = classifyPipeline({ ...HEALTHY, page: { count: 0, min: 0, median: 0, p95: 0, max: 0 } });
    expect(v.status).toBe('unknown');
    expect(v.findings).toEqual(['the probe collected no frames']);
  });

  it('honours injected thresholds, so a future revision can tighten without a rewrite', () => {
    const strict = { ...DEFAULT_PIPELINE_THRESHOLDS, maxPageCostRatio: 1.1, maxPageCostMs: 1 };
    const v = classifyPipeline({ ...HEALTHY, page: { count: 90, min: 16, median: 25, p95: 30, max: 40 } }, strict);
    expect(v.status).toBe('raster-bound');
  });
});

describe('buildReport / headline', () => {
  const report = buildReport({
    capturedAt: '2026-09-14T09:00:00.000Z',
    url: 'https://www.theunitas.global/ko',
    device: {
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',
      viewport: { width: 390, height: 844 },
      devicePixelRatio: 3,
      hardwareConcurrency: 6,
      deviceMemoryGb: null,
      reducedMotion: false,
      coarsePointer: true,
    },
    reading: HEALTHY,
  });

  it('stamps a schema so a stored report is still readable later', () => {
    expect(report.schema).toBe('unitas.render-probe.v1');
    expect(report.verdict.status).toBe('accelerated');
  });

  it('produces a line a human can read out over the phone', () => {
    const line = headline(report);
    expect(line).toContain('ACCELERATED');
    expect(line).toContain('RTX 4070');
    expect(line).toContain('idle frames 0');
  });
});
