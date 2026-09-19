import { describe, expect, it } from 'vitest';
import { MOON_PIXEL_SIZE, buildMoonPixelGrid, illuminatedFraction, moonPixelCells } from '@/lib/live/moonPixel';

const SIZE = MOON_PIXEL_SIZE;
const HALF = SIZE / 2;

function discCellCount(size = SIZE): number {
  const cells = moonPixelCells(180, true, size);
  return cells.lit.length + cells.dark.length;
}

function pathCount(d: string): number {
  return d === '' ? 0 : d.split(' M').length;
}

describe('moonPixel · illuminatedFraction', () => {
  it('is 0 at new, 1/2 at the quarters, 1 at full, and wraps the angle', () => {
    expect(illuminatedFraction(0)).toBeCloseTo(0, 9);
    expect(illuminatedFraction(90)).toBeCloseTo(0.5, 9);
    expect(illuminatedFraction(180)).toBeCloseTo(1, 9);
    expect(illuminatedFraction(270)).toBeCloseTo(0.5, 9);
    expect(illuminatedFraction(360)).toBeCloseTo(0, 9);
    expect(illuminatedFraction(-90)).toBeCloseTo(0.5, 9);
    expect(illuminatedFraction(Number.NaN)).toBe(0);
  });
});

describe('moonPixel · the four cardinal phases', () => {
  const total = discCellCount();

  it('covers a disc of cells whose centres lie inside the circle (about pi r^2)', () => {
    expect(total).toBeGreaterThan(Math.PI * HALF * HALF * 0.9);
    expect(total).toBeLessThan(Math.PI * HALF * HALF * 1.1);
    for (const cell of moonPixelCells(180, true).lit) {
      const x = (cell.x + 0.5 - HALF) / HALF;
      const y = (cell.y + 0.5 - HALF) / HALF;
      expect(x * x + y * y).toBeLessThan(1);
    }
  });

  it('new moon (0) is all dark', () => {
    const cells = moonPixelCells(0, true);
    expect(cells.lit).toHaveLength(0);
    expect(cells.dark).toHaveLength(total);
  });

  it('first quarter (90, waxing) lights exactly the right half', () => {
    const cells = moonPixelCells(90, true);
    expect(cells.lit).toHaveLength(total / 2);
    expect(cells.dark).toHaveLength(total / 2);
    expect(cells.lit.every((c) => c.x >= HALF)).toBe(true);
    expect(cells.dark.every((c) => c.x < HALF)).toBe(true);
  });

  it('full moon (180) is all lit', () => {
    const cells = moonPixelCells(180, true);
    expect(cells.lit).toHaveLength(total);
    expect(cells.dark).toHaveLength(0);
  });

  it('last quarter (270, waning) lights exactly the left half', () => {
    const cells = moonPixelCells(270, false);
    expect(cells.lit).toHaveLength(total / 2);
    expect(cells.dark).toHaveLength(total / 2);
    expect(cells.lit.every((c) => c.x < HALF)).toBe(true);
    expect(cells.dark.every((c) => c.x >= HALF)).toBe(true);
  });
});

describe('moonPixel · monotonic growth and waxing / waning symmetry', () => {
  it('the lit count never decreases from 0 to 180 while waxing, and tracks the illuminated fraction', () => {
    let previous = -1;
    for (let p = 0; p <= 180; p += 5) {
      const count = moonPixelCells(p, true).lit.length;
      expect(count).toBeGreaterThanOrEqual(previous);
      previous = count;
      const expected = illuminatedFraction(p) * discCellCount();
      expect(Math.abs(count - expected)).toBeLessThanOrEqual(discCellCount() * 0.05);
    }
  });

  it('a waning moon at equal illumination is the exact left-right mirror of the waxing one', () => {
    for (const p of [30, 60, 90, 120, 150]) {
      const waxing = moonPixelCells(p, true);
      const waning = moonPixelCells(360 - p, false);
      expect(waning.lit).toHaveLength(waxing.lit.length);
      const mirrored = new Set(waxing.lit.map((c) => `${SIZE - 1 - c.x},${c.y}`));
      expect(waning.lit.every((c) => mirrored.has(`${c.x},${c.y}`))).toBe(true);
    }
  });

  it('crescents keep the lit cells against the limb, gibbous phases against the far limb', () => {
    const crescent = moonPixelCells(45, true);
    const gibbous = moonPixelCells(135, true);
    expect(crescent.lit.every((c) => c.x >= HALF)).toBe(true);
    expect(gibbous.dark.every((c) => c.x < HALF)).toBe(true);
    expect(crescent.lit.length).toBeLessThan(gibbous.lit.length);
  });
});

describe('moonPixel · buildMoonPixelGrid', () => {
  it('emits one unit square per cell in each path, in the M x y h1 v1 h-1 z form', () => {
    const grid = buildMoonPixelGrid(90, true);
    const cells = moonPixelCells(90, true);
    expect(pathCount(grid.lit)).toBe(cells.lit.length);
    expect(pathCount(grid.dark)).toBe(cells.dark.length);
    expect(grid.lit).toMatch(/^M\d+ \d+ h1 v1 h-1 z( M\d+ \d+ h1 v1 h-1 z)*$/);
    expect(buildMoonPixelGrid(0, true).lit).toBe('');
    expect(buildMoonPixelGrid(180, true).dark).toBe('');
  });

  it('honours a custom size and never puts a cell outside the grid', () => {
    const grid = moonPixelCells(120, true, 8);
    const all = [...grid.lit, ...grid.dark];
    expect(all.length).toBeGreaterThan(0);
    expect(all.every((c) => c.x >= 0 && c.x < 8 && c.y >= 0 && c.y < 8)).toBe(true);
  });
});
