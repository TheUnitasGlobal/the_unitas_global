import { describe, expect, it } from 'vitest';
import {
  CAPTURE_BLUR_WINDOW_MS,
  DEVTOOLS_DOCK_PX,
  SELECTION_HARVEST_CHARS,
  blurIsCapture,
  classifyContextTarget,
  classifyKeyGesture,
  devtoolsDocked,
  isImageTarget,
  selectionIsHarvest,
  withOwnershipTrailer,
} from '../../lib/quantumWhite/antiPiracy';

// REV-19 SPEC.md §6 (+ follow-up multi-layer defence) -- the pure
// anti-piracy classifiers behind SovereignWatermark's reveal. No DOM.

describe('classifyKeyGesture', () => {
  it('recognises the screenshot chords of every platform', () => {
    expect(classifyKeyGesture({ key: 'PrintScreen' })).toBe('capture');
    expect(classifyKeyGesture({ key: 'Unidentified', code: 'PrintScreen' })).toBe('capture');
    expect(classifyKeyGesture({ key: '4', metaKey: true, shiftKey: true })).toBe('capture'); // macOS
    expect(classifyKeyGesture({ key: '5', code: 'Digit5', metaKey: true, shiftKey: true })).toBe('capture');
    expect(classifyKeyGesture({ key: 's', metaKey: true, shiftKey: true })).toBe('capture'); // Win+Shift+S
    expect(classifyKeyGesture({ key: 'S', ctrlKey: true, shiftKey: true })).toBe('capture');
    expect(classifyKeyGesture({ key: 's', ctrlKey: true })).toBe('capture'); // save page as
  });
  it('recognises print and ignores ordinary typing', () => {
    expect(classifyKeyGesture({ key: 'p', ctrlKey: true })).toBe('print');
    expect(classifyKeyGesture({ key: 'p', metaKey: true })).toBe('print');
    expect(classifyKeyGesture({ key: 'p' })).toBeNull();
    expect(classifyKeyGesture({ key: 'p', ctrlKey: true, shiftKey: true })).toBeNull();
    expect(classifyKeyGesture({ key: '4', shiftKey: true })).toBeNull();
    expect(classifyKeyGesture({ key: 'i' })).toBeNull();
    expect(classifyKeyGesture({ key: 'i', shiftKey: true })).toBeNull();
  });
  it('recognises the developer-tools chords of every platform and view-source', () => {
    expect(classifyKeyGesture({ key: 'F12' })).toBe('devtools');
    expect(classifyKeyGesture({ key: 'Unidentified', code: 'F12' })).toBe('devtools');
    expect(classifyKeyGesture({ key: 'I', ctrlKey: true, shiftKey: true })).toBe('devtools');
    expect(classifyKeyGesture({ key: 'J', ctrlKey: true, shiftKey: true })).toBe('devtools');
    expect(classifyKeyGesture({ key: 'C', code: 'KeyC', ctrlKey: true, shiftKey: true })).toBe('devtools');
    expect(classifyKeyGesture({ key: 'ı', code: 'KeyI', metaKey: true, altKey: true })).toBe('devtools'); // macOS Opt layer
    expect(classifyKeyGesture({ key: 'u', ctrlKey: true })).toBe('devtools');
    expect(classifyKeyGesture({ key: 'u', metaKey: true, altKey: true })).toBe('devtools');
  });
  it('recognises select-all as a harvest gesture', () => {
    expect(classifyKeyGesture({ key: 'a', ctrlKey: true })).toBe('select');
    expect(classifyKeyGesture({ key: 'a', metaKey: true })).toBe('select');
    expect(classifyKeyGesture({ key: 'a' })).toBeNull();
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

describe('isImageTarget / classifyContextTarget', () => {
  it('flags media elements and background images only', () => {
    expect(isImageTarget('IMG')).toBe(true);
    expect(isImageTarget('svg')).toBe(true);
    expect(isImageTarget('div')).toBe(false);
    expect(isImageTarget('div', true)).toBe(true);
    expect(isImageTarget(null)).toBe(false);
  });
  it('every context menu reveals: image targets as `image`, the rest as `context`', () => {
    expect(classifyContextTarget('IMG')).toBe('image');
    expect(classifyContextTarget('P')).toBe('context');
    expect(classifyContextTarget('INPUT')).toBe('context');
    expect(classifyContextTarget(null)).toBe('context');
  });
});

describe('selectionIsHarvest', () => {
  it('ignores click-sized selections and flags a real run of text', () => {
    expect(selectionIsHarvest(0)).toBe(false);
    expect(selectionIsHarvest(SELECTION_HARVEST_CHARS - 1)).toBe(false);
    expect(selectionIsHarvest(SELECTION_HARVEST_CHARS)).toBe(true);
    expect(selectionIsHarvest(3, 3)).toBe(true);
  });
});

describe('devtoolsDocked', () => {
  it('reads a viewport shrunk inside the window as a docked panel and never trusts zero sizes', () => {
    expect(devtoolsDocked(1366, 1366, 768, 700)).toBe(false); // ordinary chrome
    expect(devtoolsDocked(1366, 1366 - DEVTOOLS_DOCK_PX, 768, 700)).toBe(true); // right dock
    expect(devtoolsDocked(1366, 1366, 768, 768 - DEVTOOLS_DOCK_PX)).toBe(true); // bottom dock
    expect(devtoolsDocked(0, 0, 0, 0)).toBe(false); // PWA / webview without outer sizes
    expect(devtoolsDocked(1366, 1366, 768, 0)).toBe(false);
  });
});
