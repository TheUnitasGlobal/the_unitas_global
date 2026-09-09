import { describe, expect, it } from 'vitest';
import {
  CHRONO_LUM_PCT_PROP,
  CHRONO_LUM_PROP,
  CHRONO_WARM_PROP,
  applyChrono,
  chronoLabelForHour,
  chronoLuminance,
  clearChrono,
} from '../../lib/quantumWhite/chrono';

// Module-level test isolation (CLAUDE.md). Pure band-boundary coverage --
// bands are half-open on the local hour: [5,9) dawn, [9,17) day, [17,21)
// dusk, everything else (21..24, 0..5) night.

function hourDate(hour: number): Date {
  return new Date(2026, 5, 15, hour, 0, 0);
}

/** Minimal stand-in for an HTMLElement's style/dataset surface. */
function makeMockRoot() {
  const props = new Map<string, string>();
  const dataset: Record<string, string | undefined> = {};
  const root = {
    style: {
      setProperty: (name: string, value: string) => {
        props.set(name, value);
      },
      removeProperty: (name: string) => {
        props.delete(name);
      },
    },
    dataset,
  };
  return { root: root as unknown as HTMLElement, props, dataset };
}

describe('chronoLabelForHour boundaries', () => {
  it('is night just before dawn (hour 4) and dawn exactly at 5', () => {
    expect(chronoLabelForHour(4)).toBe('night');
    expect(chronoLabelForHour(5)).toBe('dawn');
  });

  it('is dawn up to 8 and day exactly at 9', () => {
    expect(chronoLabelForHour(8)).toBe('dawn');
    expect(chronoLabelForHour(9)).toBe('day');
  });

  it('is day up to 16 and dusk exactly at 17', () => {
    expect(chronoLabelForHour(16)).toBe('day');
    expect(chronoLabelForHour(17)).toBe('dusk');
  });

  it('is dusk up to 20 and night exactly at 21', () => {
    expect(chronoLabelForHour(20)).toBe('dusk');
    expect(chronoLabelForHour(21)).toBe('night');
  });

  it('is night through midnight wraparound (23, 0)', () => {
    expect(chronoLabelForHour(23)).toBe('night');
    expect(chronoLabelForHour(0)).toBe('night');
  });

  it('normalises hours outside 0..23 (negative and >=24) via modulo', () => {
    expect(chronoLabelForHour(-1)).toBe(chronoLabelForHour(23));
    expect(chronoLabelForHour(24)).toBe(chronoLabelForHour(0));
    expect(chronoLabelForHour(29)).toBe(chronoLabelForHour(5));
  });

  it('falls back to day for a non-finite hour rather than throwing', () => {
    expect(chronoLabelForHour(NaN)).toBe('day');
    expect(chronoLabelForHour(Infinity)).toBe('day');
  });
});

describe('chronoLuminance', () => {
  it('returns the exact dawn band values', () => {
    expect(chronoLuminance(hourDate(6))).toEqual({ lum: 0.96, warm: 0.15, label: 'dawn' });
  });

  it('returns the exact day band values (full luminance, no warmth)', () => {
    expect(chronoLuminance(hourDate(12))).toEqual({ lum: 1, warm: 0, label: 'day' });
  });

  it('returns the exact dusk band values', () => {
    expect(chronoLuminance(hourDate(18))).toEqual({ lum: 0.95, warm: 0.55, label: 'dusk' });
  });

  it('returns the exact night band values', () => {
    expect(chronoLuminance(hourDate(23))).toEqual({ lum: 0.92, warm: 0.35, label: 'night' });
  });

  it('keeps lum within the documented 0.92..1.0 range across every band', () => {
    for (let h = 0; h < 24; h += 1) {
      const { lum } = chronoLuminance(hourDate(h));
      expect(lum).toBeGreaterThanOrEqual(0.92);
      expect(lum).toBeLessThanOrEqual(1);
    }
  });

  it('returns a fresh object each call (callers cannot mutate the shared band table)', () => {
    const a = chronoLuminance(hourDate(12));
    const b = chronoLuminance(hourDate(12));
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});

describe('applyChrono / clearChrono', () => {
  it('writes --qw-lum / --qw-warm and a data-qw-chrono label onto the root', () => {
    const { root, props, dataset } = makeMockRoot();

    const chrono = applyChrono(root, hourDate(18));

    expect(props.get(CHRONO_LUM_PROP)).toBe('0.95');
    expect(props.get(CHRONO_WARM_PROP)).toBe('0.55');
    expect(props.get(CHRONO_LUM_PCT_PROP)).toBe('95%');
    expect(dataset.qwChrono).toBe('dusk');
    expect(chrono.label).toBe('dusk');
  });

  it('REV-15 (SPEC.md §1.4): writes --qw-lum-pct as a ready percentage string, no calc()', () => {
    const { root, props } = makeMockRoot();
    applyChrono(root, hourDate(2));
    expect(props.get(CHRONO_LUM_PCT_PROP)).toBe('92%');
  });

  it('defaults to the current time when no date is passed', () => {
    const { root, props } = makeMockRoot();
    applyChrono(root);
    expect(props.has(CHRONO_LUM_PROP)).toBe(true);
    expect(props.has(CHRONO_WARM_PROP)).toBe(true);
  });

  it('clearChrono removes exactly what applyChrono wrote', () => {
    const { root, props, dataset } = makeMockRoot();
    applyChrono(root, hourDate(6));

    clearChrono(root);

    expect(props.has(CHRONO_LUM_PROP)).toBe(false);
    expect(props.has(CHRONO_WARM_PROP)).toBe(false);
    expect(props.has(CHRONO_LUM_PCT_PROP)).toBe(false);
    expect(dataset.qwChrono).toBeUndefined();
  });

  it('never throws on a root whose style declaration throws (frozen / detached element)', () => {
    const hostileRoot = {
      style: {
        setProperty: () => {
          throw new Error('frozen style');
        },
        removeProperty: () => {
          throw new Error('frozen style');
        },
      },
      dataset: {},
    } as unknown as HTMLElement;

    expect(() => applyChrono(hostileRoot, hourDate(12))).not.toThrow();
    expect(() => clearChrono(hostileRoot)).not.toThrow();
  });
});
