import { describe, expect, it } from 'vitest';
import { PWA_CAPTURE_BOOTSTRAP } from '../../lib/pwa/installPrompt';
import {
  CINEMA_PHASE_STORAGE_KEY,
  CINEMA_SEGMENT_STORAGE_KEY,
  HANDOFF_STORAGE_KEY,
  LEAVE_STAMP_STORAGE_KEY,
  SPLASH_ACTIVE_STORAGE_KEY,
} from '../../lib/splash/splashTimeline';
import { CONSOLE_TRIGGER_STORAGE_KEY } from '../../lib/sovereign/consoleTrigger';
import { VISIT_LEDGER_STORAGE_KEY, VISIT_LEDGER_VERSION, serializeLedger, type VisitLedger } from '../../lib/entry/visitLedger';
import { VISIT_LEDGER_TTL_MS } from '../../lib/entry/loadClass';
import { SURFACE_MIRROR_KEY } from '../../lib/quantumWhite/surfaceState';

// Pre-hydration PWA / splash-gate / re-entry-classifier bootstrap
// (lib/pwa/installPrompt.ts): parse guard, the console-isolation branch
// (owner instruction 2026-09-07, master audit item 2), and REV-17's
// three-way document-load classifier (SPEC.md §3.1) it replaced the old
// binary reload-check with. Fixtures are local to this file (see CLAUDE.md
// "Module-level test isolation").

type Store = Record<string, string>;

/** Minimal host: `window`, `document`, `navigator`, `location`,
 *  `performance`, `sessionStorage`, `CustomEvent`. Returns the stamped
 *  `<html>` attributes and both storages as they stand after the script ran. */
function runBootstrap(opts: {
  search: string;
  navigationType?: string;
  storage?: Store;
  localStorage?: Store;
  wasDiscarded?: boolean;
  standalone?: boolean;
}) {
  const attrs: Record<string, string> = {};
  const storage: Store = { ...(opts.storage ?? {}) };
  const localStore: Store = { ...(opts.localStorage ?? {}) };
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
  const localStorage = {
    getItem: (k: string) => (k in localStore ? localStore[k] : null),
    setItem: (k: string, v: string) => {
      localStore[k] = v;
    },
    removeItem: (k: string) => {
      delete localStore[k];
    },
  };
  const location = { search: opts.search, reload: () => {} };
  const win = {
    addEventListener: () => {},
    dispatchEvent: () => true,
    location,
    sessionStorage,
    localStorage,
    matchMedia: (query: string) => ({
      matches: Boolean(opts.standalone) && query.indexOf('standalone') !== -1,
    }),
  };
  const doc = {
    wasDiscarded: Boolean(opts.wasDiscarded),
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
  return { attrs, storage, localStore };
}

function ledgerRecord(overrides: Partial<VisitLedger> = {}): string {
  return serializeLedger({ v: VISIT_LEDGER_VERSION, at: Date.now(), phase: 'released', ...overrides });
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
      storage: { [CINEMA_PHASE_STORAGE_KEY]: 'sealed', [LEAVE_STAMP_STORAGE_KEY]: '1' },
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

  it('REV-17 (SPEC.md §3.1): a genuine entry (previous document exited normally) wipes the tab session; reload and an undead session (no leave stamp) restore it', () => {
    // A genuine entry: the phase record is live AND the previous document
    // fired pagehide (leave stamp present) -- e.g. the visitor typed a URL
    // or followed an external link back onto the site.
    const entry = runBootstrap({
      search: '',
      storage: { [CINEMA_PHASE_STORAGE_KEY]: 'released', [LEAVE_STAMP_STORAGE_KEY]: '1' },
    });
    expect(entry.storage[CINEMA_PHASE_STORAGE_KEY]).toBeUndefined();

    const reload = runBootstrap({
      search: '',
      navigationType: 'reload',
      storage: { [CINEMA_PHASE_STORAGE_KEY]: 'released' },
    });
    expect(reload.storage[CINEMA_PHASE_STORAGE_KEY]).toBe('released');

    // R2: a live phase record with NO leave stamp -- the document died
    // without a normal exit (purge/crash/kill) -- restores in place.
    const undead = runBootstrap({
      search: '',
      storage: { [CINEMA_PHASE_STORAGE_KEY]: 'released' },
    });
    expect(undead.storage[CINEMA_PHASE_STORAGE_KEY]).toBe('released');
  });

  it('R1: a Chromium tab discarded for memory and restored keeps its phase in place', () => {
    const restored = runBootstrap({
      search: '',
      navigationType: 'back_forward',
      wasDiscarded: true,
      storage: { [CINEMA_PHASE_STORAGE_KEY]: 'sealed', [LEAVE_STAMP_STORAGE_KEY]: '1' },
    });
    expect(restored.storage[CINEMA_PHASE_STORAGE_KEY]).toBe('sealed');
  });

  it('R0: a same-tab hand-off (unitas_handoff) is a continuation -- consumed on read', () => {
    const handed = runBootstrap({
      search: '',
      storage: { [CINEMA_PHASE_STORAGE_KEY]: 'released', [HANDOFF_STORAGE_KEY]: '1' },
    });
    expect(handed.storage[CINEMA_PHASE_STORAGE_KEY]).toBe('released');
    expect(handed.storage[HANDOFF_STORAGE_KEY]).toBeUndefined();
  });

  it('R3: an installed App cold relaunch (no phase, standalone, fresh ledger) restores phase/segment/surface from the ledger', () => {
    const restored = runBootstrap({
      search: '',
      standalone: true,
      localStorage: {
        [VISIT_LEDGER_STORAGE_KEY]: ledgerRecord({ segment: '3', surface: 'core/cognitive/ecosystem:echo' }),
      },
    });
    expect(restored.storage[CINEMA_PHASE_STORAGE_KEY]).toBe('released');
    expect(restored.storage[CINEMA_SEGMENT_STORAGE_KEY]).toBe('3');
    expect(restored.storage[SURFACE_MIRROR_KEY]).toBe('core/cognitive/ecosystem:echo');
  });

  it('R3 does not fire outside standalone, and a genuine entry clears a stale ledger', () => {
    const online = runBootstrap({
      search: '',
      standalone: false,
      localStorage: { [VISIT_LEDGER_STORAGE_KEY]: ledgerRecord() },
    });
    expect(online.storage[CINEMA_PHASE_STORAGE_KEY]).toBeUndefined();

    const stale = runBootstrap({
      search: '',
      standalone: true,
      localStorage: { [VISIT_LEDGER_STORAGE_KEY]: ledgerRecord({ at: Date.now() - VISIT_LEDGER_TTL_MS - 1000 }) },
    });
    expect(stale.storage[CINEMA_PHASE_STORAGE_KEY]).toBeUndefined();
    expect(stale.localStore[VISIT_LEDGER_STORAGE_KEY]).toBeUndefined();
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
