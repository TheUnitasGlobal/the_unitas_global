import { describe, expect, it } from 'vitest';
import { SINGULARITY_CLUSTERS } from '../../lib/quantumWhite/clusters';
import {
  SURFACE_MIRROR_KEY,
  SURFACE_TOMBSTONE,
  encodeSurface,
  parseSurface,
  resolveInitialSurface,
  stripRouterKeys,
  surfaceHref,
} from '../../lib/quantumWhite/surfaceState';

// Module-level test isolation (CLAUDE.md) -- pure encode/parse/validate
// assertions against the REAL cluster registry (mirrors clusters.test.ts's
// own approach), no DOM, no history/sessionStorage mocking needed since
// none of these functions touch either directly.

describe('encodeSurface / parseSurface (SPEC.md §3.3)', () => {
  it('encodes a closed surface to an empty string', () => {
    expect(encodeSurface(null)).toBe('');
  });

  it('encodes an open cluster (no module) to core/<cluster>', () => {
    expect(encodeSurface({ cluster: 'cognitive' })).toBe('core/cognitive');
  });

  it('encodes an open module to core/<cluster>/<moduleId>', () => {
    expect(encodeSurface({ cluster: 'cognitive', moduleId: 'ecosystem:echo' })).toBe('core/cognitive/ecosystem:echo');
  });

  it('round-trips a cluster-only surface through the real registry', () => {
    const encoded = encodeSurface({ cluster: 'live' });
    expect(parseSurface(encoded, SINGULARITY_CLUSTERS)).toEqual({ cluster: 'live' });
  });

  it('round-trips a module surface through the real registry, and accepts a leading #', () => {
    const encoded = encodeSurface({ cluster: 'lockin', moduleId: 'lockin:oracle' });
    expect(parseSurface(encoded, SINGULARITY_CLUSTERS)).toEqual({ cluster: 'lockin', moduleId: 'lockin:oracle' });
    expect(parseSurface(`#${encoded}`, SINGULARITY_CLUSTERS)).toEqual({ cluster: 'lockin', moduleId: 'lockin:oracle' });
  });

  it('rejects an unknown cluster key', () => {
    expect(parseSurface('core/does-not-exist', SINGULARITY_CLUSTERS)).toBeNull();
  });

  it("rejects a module id that exists but isn't a member of the named cluster", () => {
    // 'ecosystem:oracle' is a cognitive-cluster id, not a lockin one.
    expect(parseSurface('core/lockin/ecosystem:oracle', SINGULARITY_CLUSTERS)).toBeNull();
  });

  it('rejects an unknown module id inside a real cluster', () => {
    expect(parseSurface('core/cognitive/ecosystem:not-a-module', SINGULARITY_CLUSTERS)).toBeNull();
  });

  it('rejects the empty string, the bare tombstone, and a malformed path', () => {
    expect(parseSurface('', SINGULARITY_CLUSTERS)).toBeNull();
    expect(parseSurface(SURFACE_TOMBSTONE, SINGULARITY_CLUSTERS)).toBeNull();
    expect(parseSurface('cognitive', SINGULARITY_CLUSTERS)).toBeNull(); // missing the 'core' prefix segment
  });
});

describe('resolveInitialSurface (SPEC.md §3.3 priority rule)', () => {
  it('prefers the mirror over the URL hash when both are present', () => {
    const resolved = resolveInitialSurface(
      { hash: '#core/live', mirror: 'core/cognitive' },
      SINGULARITY_CLUSTERS,
    );
    expect(resolved).toEqual({ cluster: 'cognitive' });
  });

  it('a tombstoned mirror wins over a stale URL hash -- explicit close beats history-sentinel leftovers', () => {
    const resolved = resolveInitialSurface({ hash: '#core/live', mirror: SURFACE_TOMBSTONE }, SINGULARITY_CLUSTERS);
    expect(resolved).toBeNull();
  });

  it('falls back to the URL hash ONLY when there is no mirror at all (a genuine deep link)', () => {
    const resolved = resolveInitialSurface({ hash: '#core/enterprise', mirror: null }, SINGULARITY_CLUSTERS);
    expect(resolved).toEqual({ cluster: 'enterprise' });
  });

  it('resolves to null when neither source names a valid surface', () => {
    expect(resolveInitialSurface({ hash: '', mirror: null }, SINGULARITY_CLUSTERS)).toBeNull();
    expect(resolveInitialSurface({ hash: '#not-a-surface', mirror: null }, SINGULARITY_CLUSTERS)).toBeNull();
  });
});

describe('stripRouterKeys (SPEC.md §3.3)', () => {
  it('removes __NA / _N / the router tree key, preserving everything else', () => {
    const state = {
      __NA: true,
      __PRIVATE_NEXTJS_INTERNALS_TREE: ['whatever'],
      _N: true,
      unitasExitGuard: true,
      unitasExitDepth: 12,
    };
    expect(stripRouterKeys(state)).toEqual({ unitasExitGuard: true, unitasExitDepth: 12 });
  });

  it('returns an empty object for null/non-object input', () => {
    expect(stripRouterKeys(null)).toEqual({});
    expect(stripRouterKeys(undefined)).toEqual({});
    expect(stripRouterKeys('x')).toEqual({});
  });

  it('is a no-op on a state that already carries no router keys', () => {
    expect(stripRouterKeys({ foo: 1 })).toEqual({ foo: 1 });
  });
});

describe('surfaceHref (SPEC.md §3.3)', () => {
  it('replaces only the hash, preserving pathname and search', () => {
    const location = { pathname: '/ko', search: '?splash=0' };
    expect(surfaceHref(location, { cluster: 'cognitive' })).toBe('/ko?splash=0#core/cognitive');
    expect(surfaceHref(location, null)).toBe('/ko?splash=0');
  });

  it('reflects SURFACE_MIRROR_KEY as the documented storage key', () => {
    expect(SURFACE_MIRROR_KEY).toBe('unitas.qw.surface.v1');
  });
});
