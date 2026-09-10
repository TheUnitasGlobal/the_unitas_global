/**
 * REV-19 §6 -- anti-piracy watermark triggers (pure).
 *
 * The bottom-right ownership mark rests almost invisible (opacity .07) and
 * flares to full visibility -- together with the full-page diagonal mark
 * -- only while the page is being captured, copied or taken apart. The web
 * platform cannot observe a screenshot directly, so the reveal is driven by
 * the gestures that precede one plus the acts a page CAN see, layered so
 * that no single missed signal leaves the page bare:
 *
 *   - `print`    -- Ctrl/Cmd+P, the browser's print dialog (`beforeprint`
 *                   fires too; @media print in quantum-white-rev19.css
 *                   paints the diagonal mark regardless).
 *   - `capture`  -- PrintScreen (Windows / Linux), Win+Shift+S (Snipping
 *                   Tool), Cmd+Shift+3/4/5/6 (macOS screenshots / screen
 *                   recording), Ctrl/Cmd+S (save page), and a focus loss
 *                   within CAPTURE_BLUR_WINDOW_MS of a capture key (the OS
 *                   snipping overlay stealing focus).
 *   - `copy`     -- copy / cut of page content (the clipboard also receives
 *                   the ownership trailer, see `withOwnershipTrailer`).
 *   - `image`    -- a context menu opened on an image (save-image-as).
 *   - `context`  -- any other right-click / long-press context menu (the
 *                   menu itself is never suppressed -- ExitGuard relies on
 *                   the gesture, and hiding it is hostile).
 *   - `select`   -- a drag-selection of a meaningful run of text, or
 *                   Ctrl/Cmd+A (select all).
 *   - `drag`     -- text or an image dragged out of the page (the drag
 *                   payload also carries the ownership trailer).
 *   - `devtools` -- F12, Ctrl+Shift+I/J/C, Cmd+Opt+I/J/C/U, Ctrl/Cmd+U
 *                   (view source), a docked developer panel (viewport
 *                   shrinking inside the window by DEVTOOLS_DOCK_PX or
 *                   more), or the console formatting the probe element.
 *
 * Nothing here blocks the visitor -- the marks become visible, that is all.
 */

export type CaptureKind = 'print' | 'capture' | 'copy' | 'image' | 'context' | 'select' | 'drag' | 'devtools';

export interface KeyGesture {
  key: string;
  code?: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
}

/** How long the marks stay revealed after a trigger (ms). Every new
 *  trigger restarts the window. */
export const REVEAL_MS = 2800;
/** A blur this soon after a capture key counts as the OS capture overlay. */
export const CAPTURE_BLUR_WINDOW_MS = 300;
/** A selection at least this long (characters) is a harvest, not a click. */
export const SELECTION_HARVEST_CHARS = 48;
/** Viewport shrink (window outer - inner, px) that reads as a docked
 *  developer panel. Ordinary browser chrome stays well under it. */
export const DEVTOOLS_DOCK_PX = 170;
/** Cadence of the docked-panel size probe (ms). */
export const DEVTOOLS_POLL_MS = 1000;

const MAC_SHOT_DIGITS = new Set(['3', '4', '5', '6']);
const DEVTOOLS_LETTERS = new Set(['i', 'j', 'c']);

/** Pure: which capture act a keyboard gesture announces, if any. */
export function classifyKeyGesture(g: KeyGesture): CaptureKind | null {
  const key = (g.key ?? '').toLowerCase();
  const code = (g.code ?? '').toLowerCase();
  const letter = code.startsWith('key') ? code.slice(3) : key;
  if (key === 'printscreen' || code === 'printscreen') return 'capture';
  if (key === 'f12' || code === 'f12') return 'devtools';
  const primary = Boolean(g.ctrlKey || g.metaKey);
  // developer tools: Ctrl+Shift+I/J/C (Windows / Linux), Cmd+Opt+I/J/C (macOS)
  if (g.ctrlKey && g.shiftKey && !g.altKey && DEVTOOLS_LETTERS.has(letter)) return 'devtools';
  if (g.metaKey && g.altKey && DEVTOOLS_LETTERS.has(letter)) return 'devtools';
  // view source
  if (primary && !g.shiftKey && letter === 'u') return 'devtools';
  if (g.metaKey && g.altKey && letter === 'u') return 'devtools';
  if (primary && !g.shiftKey && !g.altKey && letter === 'p') return 'print';
  if (primary && !g.shiftKey && !g.altKey && letter === 's') return 'capture'; // save page as
  if (primary && !g.shiftKey && !g.altKey && letter === 'a') return 'select'; // select all
  if (g.metaKey && g.shiftKey && (MAC_SHOT_DIGITS.has(key) || MAC_SHOT_DIGITS.has(code.replace('digit', '')))) return 'capture';
  if (g.metaKey && g.shiftKey && letter === 's') return 'capture'; // Win+Shift+S
  if (primary && g.shiftKey && letter === 's') return 'capture';
  return null;
}

/** Pure: a `blur` at `now` counts as a capture continuation only inside
 *  the window after the last capture key (`lastCaptureKeyAt`, ms). */
export function blurIsCapture(lastCaptureKeyAt: number | null, now: number, windowMs = CAPTURE_BLUR_WINDOW_MS): boolean {
  if (lastCaptureKeyAt === null) return false;
  return now - lastCaptureKeyAt >= 0 && now - lastCaptureKeyAt <= windowMs;
}

/** Pure: the clipboard / drag text a copy gesture hands over -- the
 *  selection plus a visible ownership trailer. Empty selections stay empty
 *  (never inject the trailer into an empty copy of, say, a form field). */
export function withOwnershipTrailer(selection: string, trailer: string): string {
  const text = selection.replace(/\s+$/, '');
  if (!text) return '';
  return `${text}\n\n${trailer}`;
}

/** Pure: `contextmenu` on an image (or a background-image-only element
 *  flagged by the caller) is a save-image intent. */
export function isImageTarget(tagName: string | null | undefined, hasBackgroundImage = false): boolean {
  const tag = (tagName ?? '').toLowerCase();
  return tag === 'img' || tag === 'picture' || tag === 'svg' || tag === 'canvas' || tag === 'video' || hasBackgroundImage;
}

/** Pure: does a selection of `chars` characters count as a text harvest? */
export function selectionIsHarvest(chars: number, minChars = SELECTION_HARVEST_CHARS): boolean {
  return chars >= minChars;
}

/** Pure: does the window geometry read as a docked developer panel? The
 *  panel takes its space from INSIDE the window, so the viewport shrinks
 *  while the outer size does not. Zero / missing outer sizes (PWAs, some
 *  webviews) never count. */
export function devtoolsDocked(
  outerWidth: number,
  innerWidth: number,
  outerHeight: number,
  innerHeight: number,
  threshold = DEVTOOLS_DOCK_PX,
): boolean {
  if (!outerWidth || !outerHeight || !innerWidth || !innerHeight) return false;
  return outerWidth - innerWidth >= threshold || outerHeight - innerHeight >= threshold;
}

/** Pure: a context-menu gesture is `image` on image-like targets and
 *  `context` everywhere else (form fields included -- the mark is passive). */
export function classifyContextTarget(tagName: string | null | undefined, hasBackgroundImage = false): CaptureKind {
  return isImageTarget(tagName, hasBackgroundImage) ? 'image' : 'context';
}
