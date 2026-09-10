#!/usr/bin/env node
// REV-17 deterministic sigil geometry generator (SPEC.md §4.2).
//
// The Lock-in Network sigil ("Trefoil") is the only one of the four cluster
// sigils built from a sampled curve rather than fixed coordinates -- this
// script re-derives its SVG path data from the same closed-form trefoil
// parametrization the spec cites, so the literal embedded in
// web/lib/quantumWhite/clusterSigils.tsx can be regenerated and diffed
// instead of hand-edited.
//
// Usage: node scripts/gen-sigils.mjs
// Prints the <path d="..."> value (96 samples, 2 decimal places, centered
// at (32,32), scale 7.6) to stdout. Does not write any file -- paste the
// result into clusterSigils.tsx's TREFOIL_PATH constant by hand, so a
// change is always a reviewable diff, never a silent build-time mutation.

const SAMPLES = 96;
const SCALE = 7.6;
const CENTER = 32;

function trefoilPoint(t) {
  const x = Math.sin(t) + 2 * Math.sin(2 * t);
  const y = Math.cos(t) - 2 * Math.cos(2 * t);
  return [x, y];
}

function buildPath() {
  const commands = [];
  for (let i = 0; i < SAMPLES; i += 1) {
    const t = (i / SAMPLES) * 2 * Math.PI;
    const [rawX, rawY] = trefoilPoint(t);
    const x = (CENTER + rawX * SCALE).toFixed(2);
    const y = (CENTER + rawY * SCALE).toFixed(2);
    commands.push(`${i === 0 ? 'M' : 'L'}${x} ${y}`);
  }
  return `${commands.join(' ')} Z`;
}

console.log(buildPath());
