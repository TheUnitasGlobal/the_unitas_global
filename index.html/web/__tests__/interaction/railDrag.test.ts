import { describe, expect, it } from 'vitest';
import {
  CENTER_SUPPRESS_MS,
  CLICK_SUPPRESS_MS,
  DRAG_THRESHOLD_PX,
  SWIPE_THRESHOLD_PX,
  centeredScrollLeft,
  classifyGesture,
  dragScrollLeft,
  isClickSuppressed,
  stepForSwipe,
} from '@/lib/interaction/railDrag';

// REV-21 SPEC.md §1.2 -- the drag / swipe physics every home rail shares.

describe('rail drag physics', () => {
  it('classifies pointer travel', () => {
    expect(classifyGesture(0, 0)).toBe('none');
    expect(classifyGesture(DRAG_THRESHOLD_PX - 1, 2)).toBe('none');
    expect(classifyGesture(12, 3)).toBe('drag');
    expect(classifyGesture(-12, 3)).toBe('drag');
    expect(classifyGesture(8, 30)).toBe('vertical');
    expect(classifyGesture(-SWIPE_THRESHOLD_PX, 4)).toBe('swipe-left');
    expect(classifyGesture(SWIPE_THRESHOLD_PX + 20, -10)).toBe('swipe-right');
    // Equal travel is not a swipe -- vertical wins the tie so the page scrolls.
    expect(classifyGesture(50, 50)).toBe('drag');
    expect(classifyGesture(50, 51)).toBe('vertical');
  });

  it('a left swipe advances, a right swipe rewinds, anything else holds', () => {
    expect(stepForSwipe('swipe-left')).toBe(1);
    expect(stepForSwipe('swipe-right')).toBe(-1);
    expect(stepForSwipe('drag')).toBe(0);
    expect(stepForSwipe('vertical')).toBe(0);
    expect(stepForSwipe('none')).toBe(0);
  });

  it('keeps the grabbed point under the pointer and never scrolls negative', () => {
    expect(dragScrollLeft(100, 500, 480)).toBe(120);
    expect(dragScrollLeft(100, 500, 540)).toBe(60);
    expect(dragScrollLeft(10, 500, 700)).toBe(0);
  });

  it('centers an item inside the rail viewport, clamped at 0', () => {
    expect(centeredScrollLeft(400, 120, 600)).toBe(160);
    expect(centeredScrollLeft(0, 120, 600)).toBe(0);
    expect(centeredScrollLeft(100, 100, 300)).toBe(0);
  });

  it('suppresses the click that tails a drag, and only that one', () => {
    expect(isClickSuppressed(null, 1000)).toBe(false);
    expect(isClickSuppressed(1000, 1000 + CLICK_SUPPRESS_MS - 1)).toBe(true);
    expect(isClickSuppressed(1000, 1000 + CLICK_SUPPRESS_MS)).toBe(false);
    expect(CENTER_SUPPRESS_MS).toBeGreaterThan(CLICK_SUPPRESS_MS);
  });
});
