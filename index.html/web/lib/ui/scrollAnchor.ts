/**
 * REV-23 M3.3 -- scroll-jump elimination (founder directive 2026-09-13,
 * MISSION 3: "숏컷/뉴스가 자동 회전하거나 갱신될 때 화면이 저절로 위로 튀어
 * 오르는 버그를 완벽히 박멸하라").
 *
 * WHY THE PAGE JUMPS. Two independent mechanisms, and a fix that only
 * addresses one of them leaves the bug in place half the time:
 *
 *  1. HEIGHT. A rotating card swaps a 4-row payload for a 2-row one. Every
 *     pixel of that difference is removed from the document ABOVE whatever
 *     the visitor was reading, so the browser's own scroll anchoring tries
 *     to compensate -- and on a container that re-mounts its subtree
 *     (`key={activeKey}`) it has no stable anchor node to hold on to, so it
 *     gives up and the viewport lurches.
 *  2. FOCUS. An auto-advance that moves focus (or renders a fresh element
 *     where a focused one used to be) makes the browser scroll that element
 *     into view. That is the "튀어 오르는" jump proper, and no amount of
 *     `overflow-anchor` prevents it.
 *
 * THE FIX. `captureScroll()` snapshots the scroll position of the window and
 * of any scroll container on the path, and returns a restore function that
 * puts them back on the NEXT animation frame -- after React has committed
 * and the browser has laid out, which is the only moment at which a
 * corrective write is not immediately overwritten. Callers pair it with
 * `overflow-anchor: none` on the rotating container (globals.css) so the
 * browser's own heuristic stops fighting the explicit restore.
 *
 * Deliberately NOT a hook: rotation timers, refresh handlers and paging
 * callbacks all need it, and half of them are not in render scope. SSR-safe
 * (both functions no-op without a `window`), and every read is wrapped
 * because a detached node throws on `scrollTop` in some engines.
 */

export interface ScrollSnapshot {
  /** Puts every captured scroller back, on the next frame. */
  restore(): void;
  /** Puts them back synchronously -- for a caller already inside a layout effect. */
  restoreNow(): void;
}

const NOOP: ScrollSnapshot = { restore() {}, restoreNow() {} };

/** Every scrollable ancestor of `el`, plus the document scroller. */
function scrollParents(el: Element | null): Element[] {
  const out: Element[] = [];
  let node: Element | null = el;
  while (node && node !== document.documentElement) {
    try {
      const style = getComputedStyle(node);
      if (/(auto|scroll|overlay)/.test(`${style.overflowY} ${style.overflowX}`)) out.push(node);
    } catch {
      // detached or cross-document -- skip it rather than throwing.
    }
    node = node.parentElement;
  }
  return out;
}

/**
 * Snapshot the scroll position around a mutation that is about to change the
 * height of `el`'s subtree.
 *
 * ```ts
 * const snap = captureScroll(railRef.current);
 * setActiveIndex(next);   // React commits, the card's height changes
 * snap.restore();         // next frame: the viewport has not moved
 * ```
 */
export function captureScroll(el?: Element | null): ScrollSnapshot {
  if (typeof window === 'undefined' || typeof document === 'undefined') return NOOP;

  const windowY = window.scrollY;
  const windowX = window.scrollX;
  const containers = el ? scrollParents(el).map((node) => ({ node, top: node.scrollTop, left: node.scrollLeft })) : [];

  const apply = () => {
    for (const { node, top, left } of containers) {
      try {
        if (node.scrollTop !== top) node.scrollTop = top;
        if (node.scrollLeft !== left) node.scrollLeft = left;
      } catch {
        // the node went away between capture and restore -- nothing to fix.
      }
    }
    if (window.scrollY !== windowY || window.scrollX !== windowX) {
      window.scrollTo({ top: windowY, left: windowX, behavior: 'auto' });
    }
  };

  return {
    restore() {
      // One frame is enough: React has committed and layout has settled by
      // the time a rAF callback runs. A second, later write would be visible
      // as a flicker, so there deliberely is not one.
      window.requestAnimationFrame(apply);
    },
    restoreNow: apply,
  };
}

/**
 * Reserve a minimum height for a rotating container so a shorter payload
 * cannot shrink the document at all -- the cheapest possible version of
 * fix (1). `seen` is the tallest height observed so far; the caller keeps it
 * in a ref and feeds it back.
 *
 * Pure, so the growth rule is testable without a DOM: the reservation only
 * ever grows within a rotation session (a card that got shorter must not
 * release the space the previous one held, or the next tick jumps again),
 * and `null` until something has actually been measured.
 */
export function reserveHeight(seen: number | null, measured: number): number | null {
  if (!Number.isFinite(measured) || measured <= 0) return seen;
  if (seen === null) return measured;
  return Math.max(seen, measured);
}
