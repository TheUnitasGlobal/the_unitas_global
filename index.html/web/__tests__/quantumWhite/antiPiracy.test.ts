import { describe, expect, it } from 'vitest';
import {
  CAPTURE_BLUR_WINDOW_MS,
  blurIsCapture,
  classifyKeyGesture,
  isImageTarget,
  withOwnershipTrailer,
} from '../../lib/quantumWhite/antiPiracy';

// REV-19 SPEC.md §6 -- the pure anti-piracy classifiers behind
// SovereignWatermark's reveal. No DOM.

describe('classifyKeyGesture', () => {
  it('recognises the screenshot chords of every platform', () => {
    expect(classifyKeyGesture({ key: 'PrintScreen' })).toBe('capture');
    expect(classifyKeyGesture({ key: 'Unidentified', code: 'PrintScreen' })).toBe('capture');
    expect(classifyKeyGesture({ key: '4', metaKey: true, shiftKey: true })).toBe('capture'); // macOS
    expect(classifyKeyGesture({ key: '5', code: 'Digit5', metaKey: true, shiftKey: true })).toBe('capture');
    expect(classifyKeyGesture({ key: 's', metaKey: true, shiftKey: true })).toBe('capture'); // Win+Shift+S
    expect(classifyKeyGesture({ key: 'S', ctrlKey: true, shiftKey: true })).toBe('capture');
  });
  it('recognises print and ignores ordinary typing', () => {
    expect(classifyKeyGesture({ key: 'p', ctrlKey: true })).toBe('print');
    expect(classifyKeyGesture({ key: 'p', metaKey: true })).toBe('print');
    expect(classifyKeyGesture({ key: 'p' })).toBeNull();
    expect(classifyKeyGesture({ key: 'p', ctrlKey: true, shiftKey: true })).toBeNull();
    expect(classifyKeyGesture({ key: 'a', ctrlKey: true })).toBeNull();
    expect(classifyKeyGesture({ key: '4', shiftKey: true })).toBeNull();
  });
});

describe('blurIsCapture', () => {
  it('counts a focus loss only inside the window after a capture key', () => {
    expect(blurIsCapture(null, 1000)).toBe(false);
    expect(blurIsCapture(1000, 1000 + CAPTURE_BLUR_WINDOW_MS)).toBe(true);
    expect(blurIsCapture(1000, 1000 + CAPTURE_BLUR_WINDOW_MS + 1)).toBe(false);
    expect(blurIsCapture(1000, 900)).toBe(false);
  });
});

describe('withOwnershipTrailer', () => {
  it('appends the trailer to a real selection and leaves empty copies empty', () => {
    expect(withOwnershipTrailer('UNITAS  \n', '© OWNER')).toBe('UNITAS\n\n© OWNER');
    expect(withOwnershipTrailer('   ', '© OWNER')).toBe('');
  });
});

describe('isImageTarget', () => {
  it('flags media elements and background images only', () => {
    expect(isImageTarget('IMG')).toBe(true);
    expect(isImageTarget('svg')).toBe(true);
    expect(isImageTarget('div')).toBe(false);
    expect(isImageTarget('div', true)).toBe(true);
    expect(isImageTarget(null)).toBe(false);
  });
});
