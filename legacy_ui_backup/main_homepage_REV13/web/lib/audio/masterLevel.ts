// Sovereign omni-channel master level doctrine (owner instruction 2026-09-05,
// round 10, item 2): EVERY Web Audio master gain node in the app -- the
// intro-splash score, the site-wide SpatialAudioProvider SFX/ambient bus and
// the Coming-Soon cinema soundtrack -- is attenuated to exactly 50% of its
// baseline, uniformly across every channel and device: online (browser tab)
// and App (installed PWA / native container) alike, on PC, mobile, tablet and
// anything else. No per-device carve-outs remain (the previous PC-only extra
// cuts on the splash vocal are retired in favour of this one global rule).
//
// Pure constants -- no DOM, no React -- so any master bus can import this
// without pulling a provider in, and a single edit here re-levels the whole
// ecosystem.

/** Multiplier applied to every master gain baseline. 0.5 == "정확히 50%". */
export const GLOBAL_MASTER_ATTENUATION = 0.5;

/** Baseline -> shipped master level under the global 50% doctrine. */
export function attenuateMaster(baseline: number): number {
  return baseline * GLOBAL_MASTER_ATTENUATION;
}
