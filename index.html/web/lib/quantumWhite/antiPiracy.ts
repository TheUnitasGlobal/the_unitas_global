/**
 * REV-19 §6 -- anti-piracy watermark triggers (pure).
 *
 * The bottom-right ownership mark rests almost invisible (opacity .07) and
 * flares to full visibility only while the page is being captured or
 * copied. The web platform cannot observe a screenshot directly, so the
 * reveal is driven by the gestures that precede one plus the acts a page
 * CAN see:
 *
 *   - `print`  -- Ctrl/Cmd+P, the browser's print dialog (`beforeprint`
 *                 fires too; @media print in quantum-white-rev19.css paints
 *                 the full diagonal mark regardless).
 *   - `capture` -- PrintScreen (Windows / Linux), Win+Shift+S (Snipping
 *                 Tool), Cmd+Shift+3/4/5/6 (macOS screenshots / screen
 *                 recording), and a focus loss within CAPTURE_BLUR_WINDOW_MS
 *                 of a capture key (the OS snipping overlay stealing focus).
 *   - `copy`   -- copy / cut of page content (the clipboard also receives
 *                 the ownership trailer, see `withOwnershipTrailer`).
 *   - `image`  -- a context menu opened on an image (save-image-as).
 *
 * Nothing here blocks the visitor -- the mark becomes visible, that is all.
 */

export type CaptureKind = 'print' | 'capture' | 'copy' | 'image';

export interface KeyGesture {
  key: string;
  code?: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
}

/** How long the mark stays revealed after a trigger (ms). */
export const REVEAL_MS = 2800;
/** A blur this soon after a capture key counts as the OS capture overlay. */
export const CAPTURE_BLUR_WINDOW_MS = 300;

const MAC_SHOT_DIGITS = new Set(['3', '4', '5', '6']);

/** Pure: which capture act a keyboard gesture announces, if any. */
export function classifyKeyGesture(g: KeyGesture): CaptureKind | null {
  const key = (g.key ?? '').toLowerCase();
  const code = (g.code ?? '').toLowerCase();
  if (key === 'printscreen' || code === 'printscreen') return 'capture';
  const primary = Boolean(g.ctrlKey || g.metaKey);
  if (primary && !g.shiftKey && !g.altKey && (key === 'p' || code === 'keyp')) return 'print';
  if (g.metaKey && g.shiftKey && (MAC_SHOT_DIGITS.has(key) || MAC_SHOT_DIGITS.has(code.replace('digit', '')))) return 'capture';
  if (g.metaKey && g.shiftKey && (key === 's' || code === 'keys')) return 'capture'; // Win+Shift+S
  if (primary && g.shiftKey && (key === 's' || code === 'keys')) return 'capture';
  return null;
}

/** Pure: a `blur` at `now` counts as a capture continuation only inside
 *  the window after the last capture key (`lastCaptureKeyAt`, ms). */
export function blurIsCapture(lastCaptureKeyAt: number | null, now: number, windowMs = CAPTURE_BLUR_WINDOW_MS): boolean {
  if (lastCaptureKeyAt === null) return false;
  return now - lastCaptureKeyAt >= 0 && now - lastCaptureKeyAt <= windowMs;
}

/** Pure: the clipboard text a copy gesture hands over -- the selection plus
 *  a visible ownership trailer. Empty selections stay empty (never inject
 *  the trailer into an empty copy of, say, a form field). */
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
