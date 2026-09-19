/**
 * REV-42 D-3 (founder directive 2026-09-18) -- the pixel-grid moon phase.
 *
 * The weather card's moon is not a raster and not a pair of arcs: it is a
 * disc of integer cells (24 across by default) in one SVG, every cell
 * classified lit or dark by which side of the terminator its centre lies
 * on, then emitted as TWO path strings of unit squares (`M x y h1 v1 h-1 z`)
 * so the component draws exactly two <path> elements with
 * `shape-rendering: crispEdges` -- a crisp, 1-pixel-honest disc at any size.
 *
 * Geometry (unit disc, x to the right, y down, the visitor in the northern
 * hemisphere so a waxing Moon is lit on its RIGHT):
 *   p  = phase angle in degrees, 0 = new, 90 = first quarter, 180 = full,
 *        270 = last quarter (elongation of the Moon from the Sun).
 *   k  = (1 - cos p) / 2 is the illuminated fraction of the disc.
 *   For a row at normalised height y the limb half-width is w = sqrt(1 - y²)
 *   and the terminator (the sunlit edge projected onto the disc) is the
 *   ellipse x_t = w · cos p -- the limb itself at new and full, the vertical
 *   diameter at the quarters.
 *   Waxing lights x >= x_t. Cardinal check: p = 0 -> x_t = +w, no centre
 *   satisfies x >= w inside the disc -> all dark; p = 90 -> x_t = 0 -> the
 *   right half; p = 180 -> x_t = -w -> every cell -> all lit. (The sign
 *   with -w · cos p would light everything at new: it is the mirror rule.)
 *   Waning mirrors it: lights x <= -x_t = -w · cos p. p = 270 -> the left
 *   half; p = 360 -> x <= -w -> all dark. Because cos p = cos(360 - p), a
 *   waning Moon of the same illumination is the exact left-right mirror of
 *   the waxing one, which the tests assert cell by cell.
 *
 * Pure: no clock, no dice, no DOM.
 */

export interface MoonPixelCell {
  x: number;
  y: number;
}

export interface MoonPixelCells {
  lit: MoonPixelCell[];
  dark: MoonPixelCell[];
}

export interface MoonPixelGrid {
  /** SVG path data of the lit cells (may be empty at new moon). */
  lit: string;
  /** SVG path data of the dark cells (may be empty at full moon). */
  dark: string;
}

export const MOON_PIXEL_SIZE = 24;

function normalizePhase(phaseAngleDeg: number): number {
  const p = Number.isFinite(phaseAngleDeg) ? phaseAngleDeg % 360 : 0;
  return p < 0 ? p + 360 : p;
}

/** The illuminated fraction of the disc for a phase angle, 0 at new, 1 at
 *  full -- the same k the terminator ellipse is derived from. */
export function illuminatedFraction(phaseAngleDeg: number): number {
  const p = (normalizePhase(phaseAngleDeg) * Math.PI) / 180;
  return (1 - Math.cos(p)) / 2;
}

/** Every cell whose centre lies inside the disc, split lit / dark by the
 *  terminator rule in the file comment. Cells are integer grid coordinates
 *  (0..size-1); the disc is centred on the grid with radius size / 2. */
export function moonPixelCells(phaseAngleDeg: number, waxing: boolean, size = MOON_PIXEL_SIZE): MoonPixelCells {
  const lit: MoonPixelCell[] = [];
  const dark: MoonPixelCell[] = [];
  const n = Math.max(2, Math.floor(size));
  const r = n / 2;
  const cosP = Math.cos((normalizePhase(phaseAngleDeg) * Math.PI) / 180);
  for (let j = 0; j < n; j++) {
    const y = (j + 0.5 - r) / r;
    const y2 = y * y;
    if (y2 >= 1) continue;
    const w = Math.sqrt(1 - y2);
    const xt = w * cosP;
    for (let i = 0; i < n; i++) {
      const x = (i + 0.5 - r) / r;
      if (x * x + y2 >= 1) continue;
      const isLit = waxing ? x >= xt : x <= -xt;
      (isLit ? lit : dark).push({ x: i, y: j });
    }
  }
  return { lit, dark };
}

function cellsToPath(cells: readonly MoonPixelCell[]): string {
  return cells.map((c) => `M${c.x} ${c.y} h1 v1 h-1 z`).join(' ');
}

/** The two path strings the component draws: lit cells and dark cells. */
export function buildMoonPixelGrid(phaseAngleDeg: number, waxing: boolean, size = MOON_PIXEL_SIZE): MoonPixelGrid {
  const cells = moonPixelCells(phaseAngleDeg, waxing, size);
  return { lit: cellsToPath(cells.lit), dark: cellsToPath(cells.dark) };
}
