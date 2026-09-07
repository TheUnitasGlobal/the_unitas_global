import { describe, expect, it } from 'vitest';
import { PWA_CAPTURE_BOOTSTRAP } from '../../lib/pwa/installPrompt';
import { CINEMA_PHASE_STORAGE_KEY, SPLASH_ACTIVE_STORAGE_KEY } from '../../lib/splash/splashTimeline';
import { CONSOLE_TRIGGER_STORAGE_KEY } from '../../lib/sovereign/consoleTrigger';

// Pre-hydration PWA / splash-gate bootstrap (lib/pwa/installPrompt.ts):
// parse guard + the console-isolation branch (owner instruction 2026-09-07,
// master audit item 2). Fixtures are local to this file (see CLAUDE.md
// "Module-level test isolation").

type Store = Record<string, string>;

/** Minimal host: `window`, `document`, `navigator`, `location`,
 *  `performance`, `sessionStorage`, `CustomEvent`. Returns the stamped
 *  `<html>` attributes and the storage as it stands after the script ran. */
function runBootstrap(opts: { search: string; navigationType?: string; storage?: Store }) {
  const attrs: Record<string, string> = {};
  const storage: Store = { ...(opts.storage ?? {}) };
  const sessionStorage = {
    getItem: (k: string) => (k in storage ? storage[k] : null),
    setItem: (k: string, v: string) => {
      storage[k] = v;
    },
    removeItem: (k: string) => {
      delete storage[k];
    },
    clear: () => {
      for (const k of Object.keys(storage)) delete storage[k];
    },
  };
  const location = { search: opts.search, reload: () => {} };
  const win = {
    addEventListener: () => {},
    dispatchEvent: () => true,
    location,
    sessionStorage,
  };
  const doc = {
    documentElement: {
      setAttribute: (k: string, v: string) => {
        attrs[k] = v;
      },
    },
  };
  const perf = {
    getEntriesByType: () => [{ type: opts.navigationType ?? 'navigate' }],
  };
  new Function(
    'window',
    'document',
    'navigator',
    'location',
    'performance',
    'sessionStorage',
    'CustomEvent',
    PWA_CAPTURE_BOOTSTRAP,
  )(win, doc, {}, location, perf, sessionStorage, class {});
  return { attrs, storage };
}

describe('PWA_CAPTURE_BOOTSTRAP', () => {
  it('is dependency-free ES5 that parses and never throws on a bare host', () => {
    expect(() => new Function(PWA_CAPTURE_BOOTSTRAP)).not.toThrow();
    expect(PWA_CAPTURE_BOOTSTRAP).not.toContain('=>');
    expect(PWA_CAPTURE_BOOTSTRAP).not.toMatch(/\b(let|const)\b/);
    expect(() =>
      new Function('window', 'document', 'navigator', 'location', 'performance', 'sessionStorage', PWA_CAPTURE_BOOTSTRAP)(
        {},
        {},
        {},
        {},
        {},
        {},
      ),
    ).not.toThrow();
  });

  it('keeps the logo page on a visitor cold entry and hides it on an in-place refresh of a persisted page', () => {
    expect(runBootstrap({ search: '' }).attrs['data-splash']).toBeUndefined();
    expect(runBootstrap({ search: '?splash=0' }).attrs['data-splash']).toBe('off');
    const refreshed = runBootstrap({
      search: '',
      navigationType: 'reload',
      storage: { [CINEMA_PHASE_STORAGE_KEY]: 'sealed' },
    });
    expect(refreshed.attrs['data-splash']).toBe('off');
    // A refresh DURING the logo page replays it.
    const midSplash = runBootstrap({
      search: '',
      navigationType: 'reload',
      storage: { [CINEMA_PHASE_STORAGE_KEY]: 'gate', [SPLASH_ACTIVE_STORAGE_KEY]: '1' },
    });
    expect(midSplash.attrs['data-splash']).toBeUndefined();
  });

  it('re-entry reset: a non-reload navigation wipes the tab session; a reload keeps it', () => {
    const nav = runBootstrap({ search: '', storage: { [CINEMA_PHASE_STORAGE_KEY]: 'released' } });
    expect(nav.storage[CINEMA_PHASE_STORAGE_KEY]).toBeUndefined();
    const reload = runBootstrap({
      search: '',
      navigationType: 'reload',
      storage: { [CINEMA_PHASE_STORAGE_KEY]: 'released' },
    });
    expect(reload.storage[CINEMA_PHASE_STORAGE_KEY]).toBe('released');
  });

  it('SOVEREIGN CONSOLE ISOLATION: a console load stamps the logo page off before paint -- URL form and storage-carried revoke reload alike', () => {
    for (const search of ['?dev=skip', '?dev=replay', '?dev=off', '?sovereign_auth=abc&dev=skip']) {
      expect(runBootstrap({ search }).attrs['data-splash']).toBe('off');
    }
    const revoke = runBootstrap({
      search: '',
      navigationType: 'reload',
      storage: { [CONSOLE_TRIGGER_STORAGE_KEY]: 'revoke' },
    });
    expect(revoke.attrs['data-splash']).toBe('off');
    // A stale storage flag cannot survive a real re-entry (the wipe runs
    // first), so a later visitor entry keeps its logo page.
    const stale = runBootstrap({ search: '', storage: { [CONSOLE_TRIGGER_STORAGE_KEY]: 'revoke' } });
    expect(stale.attrs['data-splash']).toBeUndefined();
    expect(stale.storage[CONSOLE_TRIGGER_STORAGE_KEY]).toBeUndefined();
  });
});
