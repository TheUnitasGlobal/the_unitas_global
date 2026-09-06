import { describe, expect, it, vi } from 'vitest';
import {
  APP_EXIT_EVENT,
  APP_TERMINATE_EVENT,
  BLANK_TERMINAL_URL,
  EXIT_GUARD_ACTIVATION_EVENTS,
  EXIT_GUARD_BOOTSTRAP,
  EXIT_GUARD_DEPTH_KEY,
  EXIT_GUARD_LIVE_FLAG,
  EXIT_GUARD_MARKER,
  EXIT_GUARD_SENTINEL_DEPTH,
  LEAVE_SETTLE_MS,
  NATIVE_EXIT_MESSAGE,
  NEXT_ROUTER_STATE_FLAG,
  NEXT_ROUTER_TREE_KEY,
  TERMINAL_MARK_HREF,
  TERMINAL_SHROUD_ATTR,
  TERMINATED_ATTR,
  findNativeExitBridge,
  isExternalReferrer,
  planExit,
  planStackCollapse,
  readHistoryStackView,
  readSentinelDepth,
  sealedHistoryState,
  sealedLaunchUrl,
  type ExitEnvironment,
} from '../../lib/exit/appExit';

// Pure planner maths only -- no DOM, no fixtures shared with other
// __tests__/** files (see CLAUDE.md "Module-level test isolation").
const ORIGIN = 'https://www.theunitas.global';

function env(overrides: Partial<ExitEnvironment> = {}): ExitEnvironment {
  return {
    standalone: false,
    historyLength: 1,
    sentinelDepth: 0,
    referrer: '',
    origin: ORIGIN,
    ...overrides,
  };
}

describe('sovereign omni-channel exit planner', () => {
  it('waits a bounded settle window before admitting the runtime refused', () => {
    expect(LEAVE_SETTLE_MS).toBeGreaterThan(0);
    expect(LEAVE_SETTLE_MS).toBeLessThan(1000);
  });

  it('announces every exit on one window event so audio engines can fall silent', () => {
    expect(APP_EXIT_EVENT).toMatch(/^unitas:/);
  });

  describe('APP channel (installed PWA / native container)', () => {
    it('DESKTOP app window: native shell first, then window.close, and if refused the round-19 black shroud -- never a restart, never about:blank', () => {
      const plan = planExit(env({ standalone: true, desktopAppWindow: true, historyLength: 1 }));
      expect(plan.channel).toBe('app');
      expect(plan.immediate).toEqual([{ kind: 'native-exit' }, { kind: 'close' }]);
      expect(plan.fallback).toEqual({ kind: 'terminate' });
      expect(JSON.stringify(plan)).not.toContain('about:blank');
      expect(JSON.stringify(plan)).not.toContain('navigate');
      expect(JSON.stringify(plan)).not.toContain('blank-terminate');
    });

    it('ignores the referrer entirely -- an app has no "previous page"', () => {
      const plan = planExit(
        env({
          standalone: true,
          desktopAppWindow: true,
          historyLength: 1,
          sentinelDepth: 0,
          referrer: 'https://www.google.com/search?q=unitas',
        }),
      );
      expect(plan.channel).toBe('app');
      expect(plan.immediate).toEqual([{ kind: 'native-exit' }, { kind: 'close' }]);
      expect(plan.fallback).toEqual({ kind: 'terminate' });
      expect(JSON.stringify(plan)).not.toContain('navigate');
    });

    it('round 20: a PHONE app with its back buffer parked and no shell overwrites with about:blank ON THE TAP -- no settle wait', () => {
      // Chromium / WebKit refuse window.close() on a multi-entry window
      // without exception, so waiting LEAVE_SETTLE_MS only shows a hang.
      const plan = planExit(env({ standalone: true, historyLength: 13, sentinelDepth: 12 }));
      expect(plan.channel).toBe('app');
      expect(plan.immediate).toEqual([{ kind: 'native-exit' }, { kind: 'close' }, { kind: 'blank-terminate' }]);
      expect(plan.fallback).toEqual({ kind: 'blank-terminate' });
      // Even a two-entry phone window (an app that opened a tower) is certain.
      expect(planExit(env({ standalone: true, historyLength: 2 })).immediate).toContainEqual({ kind: 'blank-terminate' });
    });

    it('round 20: a native shell is trusted to kill the process -- no in-place overwrite on the tap', () => {
      const plan = planExit(env({ standalone: true, historyLength: 13, sentinelDepth: 12, nativeBridge: true }));
      expect(plan.immediate).toEqual([{ kind: 'native-exit' }, { kind: 'close' }]);
      // The fallback is still the mobile blank overwrite should the bridge fail.
      expect(plan.fallback).toEqual({ kind: 'blank-terminate' });
    });

    it('round 16: a single-entry desktop app window keeps the genuine window.close() path (PC app unchanged)', () => {
      const plan = planExit(env({ standalone: true, desktopAppWindow: true, historyLength: 1 }));
      expect(plan.immediate).toEqual([{ kind: 'native-exit' }, { kind: 'close' }]);
      expect(plan.immediate).not.toContainEqual({ kind: 'terminate' });
      expect(plan.immediate).not.toContainEqual({ kind: 'blank-terminate' });
    });

    it('round 20: the mobile blank overwrite targets about:blank (never a URL the seal would keep)', () => {
      expect(BLANK_TERMINAL_URL).toBe('about:blank');
      // about:blank is exactly what the round-19 seal REFUSES, so the two
      // paths can never be confused for one another.
      expect(sealedLaunchUrl(BLANK_TERMINAL_URL)).toBeNull();
    });

    it('round 20: the terminal step splits by device -- desktop keeps the black shroud, mobile overwrites with about:blank', () => {
      const desktop = planExit(env({ standalone: true, desktopAppWindow: true, historyLength: 13, sentinelDepth: 12 }));
      expect(desktop.immediate).toContainEqual({ kind: 'terminate' });
      expect(desktop.immediate).not.toContainEqual({ kind: 'blank-terminate' });
      expect(desktop.fallback).toEqual({ kind: 'terminate' });

      const mobile = planExit(env({ standalone: true, desktopAppWindow: false, historyLength: 13, sentinelDepth: 12 }));
      expect(mobile.immediate).toContainEqual({ kind: 'blank-terminate' });
      expect(mobile.immediate).not.toContainEqual({ kind: 'terminate' });
      expect(mobile.fallback).toEqual({ kind: 'blank-terminate' });
    });
  });

  describe('history stack collapse on the confirmed tap (round 18, mobile-app black-screen patch)', () => {
    it('walks to the FIRST entry of the document in one hop when the Navigation API knows the index -- past sentinels AND in-app routes', () => {
      // [launch, /u-ai route, s1..s12] -> current index 13 -> one go(-13).
      expect(planStackCollapse({ sameDocumentIndex: 13, historyLength: 14, sentinelDepth: 12 })).toBe(-13);
      // Only the buffer above the launch entry: same answer as the sentinel depth.
      expect(planStackCollapse({ sameDocumentIndex: 12, historyLength: 13, sentinelDepth: 12 })).toBe(-12);
      // Already at the bottom: nothing to fire.
      expect(planStackCollapse({ sameDocumentIndex: 0, historyLength: 13, sentinelDepth: 0 })).toBe(0);
    });

    it('falls back to the sentinel depth without the Navigation API (WebKit < 26 / old Chromium)', () => {
      expect(planStackCollapse({ sameDocumentIndex: -1, historyLength: 13, sentinelDepth: 12 })).toBe(-12);
      expect(planStackCollapse({ sameDocumentIndex: -1, historyLength: 13, sentinelDepth: 9 })).toBe(-9);
      expect(planStackCollapse({ sameDocumentIndex: -1, historyLength: 1, sentinelDepth: 0 })).toBe(0);
    });

    it("never exceeds history.length - 1 -- the owner's literal go(-history.length) would be silently ignored by every engine", () => {
      // A delta past the first entry is out of range and a spec no-op; the
      // planner emits the maximal VALID traversal instead.
      expect(planStackCollapse({ sameDocumentIndex: 40, historyLength: 13, sentinelDepth: 12 })).toBe(-12);
      expect(planStackCollapse({ sameDocumentIndex: -1, historyLength: 5, sentinelDepth: 12 })).toBe(-4);
      expect(planStackCollapse({ sameDocumentIndex: -1, historyLength: 1, sentinelDepth: 12 })).toBe(0);
      // Malformed inputs clamp sanely rather than throwing or over-stepping.
      expect(planStackCollapse({ sameDocumentIndex: Number.NaN, historyLength: Number.NaN, sentinelDepth: -3 })).toBe(0);
      expect(planStackCollapse({ sameDocumentIndex: 2.9, historyLength: 13, sentinelDepth: 12 })).toBe(-2);
    });

    it('reads the live view defensively: Navigation API present, absent, or broken', () => {
      const MARKER = EXIT_GUARD_MARKER;
      const DEPTH = EXIT_GUARD_DEPTH_KEY;
      const parked = { [MARKER]: true, [DEPTH]: 12 };
      // Chromium 102+ / Android WebAPK: exact same-document index.
      expect(
        readHistoryStackView({
          history: { length: 14, state: parked },
          navigation: { currentEntry: { index: 13 } },
        }),
      ).toEqual({ sameDocumentIndex: 13, historyLength: 14, sentinelDepth: 12 });
      // No Navigation API: the sentinel depth carries the collapse.
      expect(readHistoryStackView({ history: { length: 13, state: parked } })).toEqual({
        sameDocumentIndex: -1,
        historyLength: 13,
        sentinelDepth: 12,
      });
      // A not-fully-active document reports index -1; junk never throws.
      expect(
        readHistoryStackView({ history: { length: 3, state: null }, navigation: { currentEntry: { index: -1 } } }),
      ).toEqual({ sameDocumentIndex: -1, historyLength: 3, sentinelDepth: 0 });
      expect(readHistoryStackView({ navigation: 'junk' })).toEqual({ sameDocumentIndex: -1, historyLength: 1, sentinelDepth: 0 });
      expect(readHistoryStackView(null)).toEqual({ sameDocumentIndex: -1, historyLength: 1, sentinelDepth: 0 });
      // The two compose: a phone app three routes deep collapses to launch in one hop.
      expect(
        planStackCollapse(
          readHistoryStackView({
            history: { length: 16, state: parked },
            navigation: { currentEntry: { index: 15 } },
          }),
        ),
      ).toBe(-15);
    });
  });

  describe('task-switcher card hygiene on termination (round 19)', () => {
    it('announces the DOM purge on its own window event, distinct from the exit announcement the online channel also fires', () => {
      expect(APP_TERMINATE_EVENT).toMatch(/^unitas:/);
      expect(APP_TERMINATE_EVENT).not.toBe(APP_EXIT_EVENT);
      expect(TERMINAL_SHROUD_ATTR).toMatch(/^data-unitas-/);
      expect(TERMINAL_SHROUD_ATTR).not.toBe(TERMINATED_ATTR);
    });

    it('paints the versioned master mark on the terminal frame (never a stale cached icon)', () => {
      expect(TERMINAL_MARK_HREF).toMatch(/^\/assets\/svg\/unitas-mark\.svg\?v=.+/);
    });

    it('seals the surviving entry to the clean LAUNCH URL: origin + locale root, no query, no hash, no deep route', () => {
      expect(sealedLaunchUrl(`${ORIGIN}/ko`)).toBe(`${ORIGIN}/ko`);
      expect(sealedLaunchUrl(`${ORIGIN}/ko/`)).toBe(`${ORIGIN}/ko`);
      expect(sealedLaunchUrl(`${ORIGIN}/en?splash=0`)).toBe(`${ORIGIN}/en`);
      expect(sealedLaunchUrl(`${ORIGIN}/ko/u-ai?dev=skip#panel`)).toBe(`${ORIGIN}/ko`);
      // The founder entry token is the one thing that must never linger.
      expect(sealedLaunchUrl(`${ORIGIN}/ko?sovereign_auth=unitas_master_dooyeong_2026_secure_key`)).toBe(`${ORIGIN}/ko`);
      // Region-qualified locales keep their whole segment.
      expect(sealedLaunchUrl(`${ORIGIN}/pt-BR/company/about`)).toBe(`${ORIGIN}/pt-BR`);
      expect(sealedLaunchUrl(`${ORIGIN}/zh-Hant?x=1`)).toBe(`${ORIGIN}/zh-Hant`);
      // No locale segment: the bare origin (middleware picks the locale on relaunch).
      expect(sealedLaunchUrl(`${ORIGIN}/`)).toBe(`${ORIGIN}/`);
      expect(sealedLaunchUrl(`${ORIGIN}/api/sovereign/verify`)).toBe(`${ORIGIN}/`);
      expect(sealedLaunchUrl(`${ORIGIN}/company/about`)).toBe(`${ORIGIN}/`);
      // Local dev origins are ordinary http origins.
      expect(sealedLaunchUrl('http://localhost:3000/en?splash=0')).toBe('http://localhost:3000/en');
    });

    it('refuses to seal to anything a browser could reject (non-http, junk)', () => {
      expect(sealedLaunchUrl('about:blank')).toBeNull();
      expect(sealedLaunchUrl('javascript:alert(1)')).toBeNull();
      expect(sealedLaunchUrl('not a url')).toBeNull();
      expect(sealedLaunchUrl('')).toBeNull();
    });

    it("keeps ONLY Next's router flag (+ its tree when present) on the sealed state -- no sentinel, no depth, nothing of the session", () => {
      expect(NEXT_ROUTER_STATE_FLAG).toBe('__NA');
      expect(NEXT_ROUTER_TREE_KEY).toBe('__PRIVATE_NEXTJS_INTERNALS_TREE');
      // The bootstrap stamps the very same flag on every sentinel it parks.
      expect(EXIT_GUARD_BOOTSTRAP).toContain(NEXT_ROUTER_STATE_FLAG);
      const tree = ['', { children: ['__PAGE__', {}] }];
      const parked = {
        __NA: true,
        __PRIVATE_NEXTJS_INTERNALS_TREE: tree,
        [EXIT_GUARD_MARKER]: true,
        [EXIT_GUARD_DEPTH_KEY]: 12,
        unitasDialogTower: true,
        custom: 1,
      };
      const sealed = sealedHistoryState(parked);
      expect(sealed).toEqual({ __NA: true, __PRIVATE_NEXTJS_INTERNALS_TREE: tree });
      expect(readSentinelDepth(sealed, EXIT_GUARD_MARKER, EXIT_GUARD_DEPTH_KEY)).toBe(0);
      expect(Object.keys(sealed).some((k) => k.startsWith('unitas'))).toBe(false);
      // No tree / no state at all: the flag alone (a popstate onto it restores, never reloads).
      expect(sealedHistoryState(null)).toEqual({ __NA: true });
      expect(sealedHistoryState(undefined)).toEqual({ __NA: true });
      expect(sealedHistoryState('junk')).toEqual({ __NA: true });
      expect(sealedHistoryState({ [EXIT_GUARD_MARKER]: true })).toEqual({ __NA: true });
      // Never mutates the state it reads.
      expect(parked[EXIT_GUARD_MARKER]).toBe(true);
    });
  });

  describe('pre-hydration back-guard bootstrap (round 16, item 1)', () => {
    type Listener = (e?: unknown) => void;

    /** Minimal browser stand-in: enough `window` / `history` / `document` for
     *  the ES5 bootstrap to run under Node. */
    function makeHost(opts: { standalone?: boolean; finePointer?: boolean; state?: unknown } = {}) {
      const listeners = new Map<string, Set<Listener>>();
      const entries: unknown[] = [opts.state ?? null];
      let index = 0;
      const history = {
        get state() {
          return entries[index];
        },
        get length() {
          return entries.length;
        },
        pushState(data: unknown) {
          entries.splice(index + 1);
          entries.push(data);
          index = entries.length - 1;
        },
      };
      const media = (q: string) => {
        if (q.includes('display-mode')) return { matches: q.includes('standalone') && opts.standalone === true };
        if (q.includes('pointer: fine')) return { matches: opts.finePointer === true };
        return { matches: false };
      };
      const documentElement = {
        attrs: new Set<string>(),
        hasAttribute(name: string) {
          return this.attrs.has(name);
        },
      };
      const window: Record<string, unknown> = {
        history,
        matchMedia: media,
        addEventListener(type: string, fn: Listener) {
          if (!listeners.has(type)) listeners.set(type, new Set());
          listeners.get(type)!.add(fn);
        },
        removeEventListener(type: string, fn: Listener) {
          listeners.get(type)?.delete(fn);
        },
      };
      const document = { documentElement };
      const navigator = { standalone: false };
      const fire = (type: string) => {
        for (const fn of Array.from(listeners.get(type) ?? [])) fn({ type });
      };
      const listenerCount = () => Array.from(listeners.values()).reduce((n, set) => n + set.size, 0);
      return { window, document, navigator, history, entries, fire, listenerCount, documentElement };
    }

    function run(host: ReturnType<typeof makeHost>) {
      // The bootstrap only touches these four globals.
      new Function('window', 'document', 'history', 'navigator', EXIT_GUARD_BOOTSTRAP)(
        host.window,
        host.document,
        host.history,
        host.navigator,
      );
    }

    it('is dependency-free ES5 that parses and never throws on a bare host', () => {
      expect(() => new Function(EXIT_GUARD_BOOTSTRAP)).not.toThrow();
      expect(() => new Function('window', 'document', 'history', 'navigator', EXIT_GUARD_BOOTSTRAP)({}, {}, {}, {})).not.toThrow();
      expect(EXIT_GUARD_BOOTSTRAP).not.toContain('=>');
      expect(EXIT_GUARD_BOOTSTRAP).not.toMatch(/\b(let|const)\b/);
    });

    it('parks nothing on load, then the full buffer on the FIRST activation gesture -- with ExitGuard\'s exact sentinel shape', () => {
      const host = makeHost();
      run(host);
      expect(host.history.length).toBe(1);
      expect(host.listenerCount()).toBe(EXIT_GUARD_ACTIVATION_EVENTS.length);

      host.fire('touchend');
      expect(host.history.length).toBe(1 + EXIT_GUARD_SENTINEL_DEPTH);
      host.entries.slice(1).forEach((state, i) => {
        expect(readSentinelDepth(state, EXIT_GUARD_MARKER, EXIT_GUARD_DEPTH_KEY)).toBe(i + 1);
      });
      // A later gesture tops up but never over-fills.
      host.fire('click');
      expect(host.history.length).toBe(1 + EXIT_GUARD_SENTINEL_DEPTH);
    });

    it('stamps every sentinel with Next.js app-router\'s `__NA` so a popstate onto it restores instead of reloading (Next 14.2 private flag)', () => {
      const host = makeHost();
      run(host);
      host.fire('pointerup');
      for (const state of host.entries.slice(1)) {
        expect((state as Record<string, unknown>).__NA).toBe(true);
      }
      // Existing state (the Next tree after hydration) is carried along.
      const seeded = makeHost({ state: { __NA: true, __PRIVATE_NEXTJS_INTERNALS_TREE: ['', {}], custom: 1 } });
      run(seeded);
      seeded.fire('mousedown');
      const top = seeded.entries[seeded.entries.length - 1] as Record<string, unknown>;
      expect(top.__PRIVATE_NEXTJS_INTERNALS_TREE).toEqual(['', {}]);
      expect(top.custom).toBe(1);
      expect(top[EXIT_GUARD_MARKER]).toBe(true);
      expect(top[EXIT_GUARD_DEPTH_KEY]).toBe(EXIT_GUARD_SENTINEL_DEPTH);
    });

    it('listens for exactly the activation-triggering events (no touchstart / pointerdown)', () => {
      expect([...EXIT_GUARD_ACTIVATION_EVENTS]).toEqual(['mousedown', 'pointerup', 'touchend', 'click', 'keydown']);
      for (const type of EXIT_GUARD_ACTIVATION_EVENTS) expect(EXIT_GUARD_BOOTSTRAP).toContain(`"${type}"`);
      expect(EXIT_GUARD_BOOTSTRAP).not.toContain('touchstart');
      expect(EXIT_GUARD_BOOTSTRAP).not.toContain('pointerdown');
      const host = makeHost();
      run(host);
      host.fire('touchstart');
      host.fire('pointerdown');
      expect(host.history.length).toBe(1);
    });

    it('never arms a DESKTOP app window (single entry keeps window.close() genuine), but does arm a phone / tablet app', () => {
      const desktop = makeHost({ standalone: true, finePointer: true });
      run(desktop);
      expect(desktop.listenerCount()).toBe(0);
      desktop.fire('mousedown');
      expect(desktop.history.length).toBe(1);

      const phone = makeHost({ standalone: true, finePointer: false });
      run(phone);
      phone.fire('touchend');
      expect(phone.history.length).toBe(1 + EXIT_GUARD_SENTINEL_DEPTH);
    });

    it('stands down once ExitGuard is live, never pushes over a foreign unitas* entry, never after termination', () => {
      const live = makeHost();
      run(live);
      (live.window as Record<string, unknown>)[EXIT_GUARD_LIVE_FLAG] = true;
      live.fire('click');
      expect(live.history.length).toBe(1);
      expect(live.listenerCount()).toBe(0);

      const tower = makeHost({ state: { unitasDialogTower: true } });
      run(tower);
      tower.fire('click');
      expect(tower.history.length).toBe(1);

      const dead = makeHost();
      run(dead);
      dead.documentElement.attrs.add(TERMINATED_ATTR);
      dead.fire('click');
      expect(dead.history.length).toBe(1);
    });

    it('resumes from a partly consumed buffer (back presses stepped down) without re-parking from scratch', () => {
      const host = makeHost({ state: { [EXIT_GUARD_MARKER]: true, [EXIT_GUARD_DEPTH_KEY]: 9 } });
      run(host);
      host.fire('keydown');
      // 9 -> 12: exactly three new entries above the current one.
      expect(host.history.length).toBe(1 + 3);
      expect(readSentinelDepth(host.history.state, EXIT_GUARD_MARKER, EXIT_GUARD_DEPTH_KEY)).toBe(EXIT_GUARD_SENTINEL_DEPTH);
    });
  });

  describe('native container exit bridges (round 15, item 1)', () => {
    it('finds nothing in a plain browser / PWA (no shell, no throw)', () => {
      expect(findNativeExitBridge({})).toBeNull();
      expect(findNativeExitBridge(null)).toBeNull();
      expect(findNativeExitBridge(undefined)).toBeNull();
      expect(findNativeExitBridge({ navigator: {}, webkit: {}, Capacitor: { Plugins: {} } })).toBeNull();
      // Present but not callable -> not a bridge.
      expect(findNativeExitBridge({ Android: { exitApp: 'nope' } })).toBeNull();
    });

    it('invokes Capacitor App.exitApp()', () => {
      const exitApp = vi.fn();
      const bridge = findNativeExitBridge({ Capacitor: { Plugins: { App: { exitApp } } } });
      expect(bridge?.name).toBe('Capacitor.Plugins.App.exitApp');
      bridge?.invoke();
      expect(exitApp).toHaveBeenCalledTimes(1);
    });

    it('invokes Cordova navigator.app.exitApp()', () => {
      const exitApp = vi.fn();
      const bridge = findNativeExitBridge({ navigator: { app: { exitApp } } });
      expect(bridge?.name).toBe('navigator.app.exitApp');
      bridge?.invoke();
      expect(exitApp).toHaveBeenCalledTimes(1);
    });

    it('invokes an Android WebView JavascriptInterface (exitApp, else finish) with the interface as `this`', () => {
      const calls: string[] = [];
      const Android = {
        finish() {
          calls.push(`finish:${this === Android}`);
        },
      };
      const bridge = findNativeExitBridge({ Android });
      expect(bridge?.name).toBe('Android.finish');
      bridge?.invoke();
      expect(calls).toEqual(['finish:true']);

      const exitApp = vi.fn();
      expect(findNativeExitBridge({ Android: { exitApp, finish: vi.fn() } })?.name).toBe('Android.exitApp');
    });

    it('posts the exit message to an iOS WKWebView handler and a React Native WebView', () => {
      const postMessage = vi.fn();
      const ios = findNativeExitBridge({ webkit: { messageHandlers: { unitasExit: { postMessage } } } });
      expect(ios?.name).toBe('webkit.messageHandlers.unitasExit');
      ios?.invoke();
      expect(postMessage).toHaveBeenCalledWith(NATIVE_EXIT_MESSAGE);

      const rnPost = vi.fn();
      const rn = findNativeExitBridge({ ReactNativeWebView: { postMessage: rnPost } });
      expect(rn?.name).toBe('ReactNativeWebView.postMessage');
      rn?.invoke();
      expect(rnPost).toHaveBeenCalledTimes(1);
      expect(JSON.parse(rnPost.mock.calls[0][0] as string)).toEqual({ type: NATIVE_EXIT_MESSAGE });
    });

    it('exits an Electron / Tauri / NW.js desktop shell', () => {
      const electron = vi.fn();
      expect(findNativeExitBridge({ electronAPI: { exitApp: electron } })?.name).toBe('electronAPI.exitApp');

      const tauriExit = vi.fn();
      const tauri = findNativeExitBridge({ __TAURI__: { process: { exit: tauriExit } } });
      expect(tauri?.name).toBe('__TAURI__.process.exit');
      tauri?.invoke();
      expect(tauriExit).toHaveBeenCalledWith(0);

      const close = vi.fn();
      const tauriWin = findNativeExitBridge({ __TAURI__: { window: { getCurrentWindow: () => ({ close }) } } });
      expect(tauriWin?.name).toBe('__TAURI__.window.getCurrent().close');
      tauriWin?.invoke();
      expect(close).toHaveBeenCalledTimes(1);

      const quit = vi.fn();
      expect(findNativeExitBridge({ nw: { App: { quit } } })?.name).toBe('nw.App.quit');
    });

    it("prefers UNITAS's own shell objects over every third-party bridge", () => {
      const own = vi.fn();
      const bridge = findNativeExitBridge({
        UnitasNative: { exitApp: own },
        Capacitor: { Plugins: { App: { exitApp: vi.fn() } } },
        Android: { exitApp: vi.fn() },
      });
      expect(bridge?.name).toBe('UnitasNative.exitApp');
      bridge?.invoke();
      expect(own).toHaveBeenCalledTimes(1);
    });
  });

  describe('ONLINE channel (browser tab)', () => {
    it('returns to the previous page: one step back when no sentinel is parked', () => {
      const plan = planExit(env({ historyLength: 3 }));
      expect(plan.channel).toBe('online');
      expect(plan.immediate).toEqual([{ kind: 'history-back', steps: 1 }]);
    });

    it("steps over ExitGuard's sentinel entry as well when it is on top", () => {
      const plan = planExit(env({ historyLength: 3, sentinelDepth: 1 }));
      expect(plan.immediate).toEqual([{ kind: 'history-back', steps: 2 }]);
    });

    it('steps over the whole deep sentinel buffer of the main home', () => {
      const plan = planExit(env({ historyLength: 14, sentinelDepth: 12 }));
      expect(plan.immediate).toEqual([{ kind: 'history-back', steps: 13 }]);
      // Malformed depths never over-step: negatives / fractions clamp sanely.
      expect(planExit(env({ historyLength: 4, sentinelDepth: -3 })).immediate).toEqual([
        { kind: 'history-back', steps: 1 },
      ]);
      expect(planExit(env({ historyLength: 4, sentinelDepth: 1.9 })).immediate).toEqual([
        { kind: 'history-back', steps: 2 },
      ]);
    });

    it('closes a fresh tab outright when nothing sits behind our own entries', () => {
      expect(planExit(env({ historyLength: 1 })).immediate).toEqual([{ kind: 'close' }]);
      expect(planExit(env({ historyLength: 2, sentinelDepth: 1 })).immediate).toEqual([{ kind: 'close' }]);
      expect(planExit(env({ historyLength: 13, sentinelDepth: 12 })).immediate).toEqual([{ kind: 'close' }]);
    });

    it('counts our own FORWARD sentinels when the visitor has stepped down into an armed buffer (checklist items 2 + 3)', () => {
      const capacity = EXIT_GUARD_SENTINEL_DEPTH;
      expect(capacity).toBe(12);
      // Fresh tab: [real, s1..s12] = 13 entries, visitor pressed back 3
      // times (depth 9). Without the capacity the planner would have fired
      // a history.go(-10) that lands nowhere; with it, it knows those 3
      // forward entries are ours and closes / falls back instead.
      expect(planExit(env({ historyLength: 13, sentinelDepth: 9, sentinelCapacity: capacity })).immediate).toEqual([
        { kind: 'close' },
      ]);
      // A page really is behind us: step over exactly the entries we stand
      // on (the forward ones vanish with the traversal).
      expect(planExit(env({ historyLength: 14, sentinelDepth: 9, sentinelCapacity: capacity })).immediate).toEqual([
        { kind: 'history-back', steps: 10 },
      ]);
      // On the top of the buffer the capacity changes nothing.
      expect(planExit(env({ historyLength: 14, sentinelDepth: 12, sentinelCapacity: capacity })).immediate).toEqual([
        { kind: 'history-back', steps: 13 },
      ]);
      // On the real entry the capacity is not assumed to have been parked.
      expect(planExit(env({ historyLength: 2, sentinelDepth: 0, sentinelCapacity: capacity })).immediate).toEqual([
        { kind: 'history-back', steps: 1 },
      ]);
      // A capacity smaller than the depth actually observed never under-counts.
      expect(planExit(env({ historyLength: 13, sentinelDepth: 12, sentinelCapacity: 2 })).immediate).toEqual([
        { kind: 'close' },
      ]);
    });

    it('shares one sentinel contract with ExitGuard and the Coming-Soon exit control', () => {
      expect(EXIT_GUARD_MARKER).toBe('unitasExitGuard');
      expect(EXIT_GUARD_DEPTH_KEY).toBe('unitasExitDepth');
      expect(EXIT_GUARD_SENTINEL_DEPTH).toBeGreaterThanOrEqual(2);
    });

    it('falls back to the external referrer (the search page) when a step is refused', () => {
      const referrer = 'https://www.google.com/search?q=unitas';
      const plan = planExit(env({ historyLength: 1, referrer }));
      expect(plan.fallback).toEqual({ kind: 'navigate', url: referrer, replace: false });
    });

    it('with no external page to return to, a refused exit terminates in place -- never a restart on the site', () => {
      expect(planExit(env({ referrer: `${ORIGIN}/en/u-ai` })).fallback).toEqual({ kind: 'terminate' });
      expect(planExit(env({ referrer: 'javascript:alert(1)' })).fallback).toEqual({ kind: 'terminate' });
      expect(planExit(env({ referrer: '' })).fallback).toEqual({ kind: 'terminate' });
    });
  });

  it('readSentinelDepth reads the parked depth off history.state defensively', () => {
    const MARKER = 'unitasExitGuard';
    const DEPTH = 'unitasExitDepth';
    expect(readSentinelDepth(null, MARKER, DEPTH)).toBe(0);
    expect(readSentinelDepth(undefined, MARKER, DEPTH)).toBe(0);
    expect(readSentinelDepth('junk', MARKER, DEPTH)).toBe(0);
    expect(readSentinelDepth({ __NA: true }, MARKER, DEPTH)).toBe(0);
    // A marked entry with no depth is the legacy single sentinel.
    expect(readSentinelDepth({ [MARKER]: true }, MARKER, DEPTH)).toBe(1);
    expect(readSentinelDepth({ [MARKER]: true }, MARKER, undefined)).toBe(1);
    expect(readSentinelDepth({ [MARKER]: true, [DEPTH]: 2 }, MARKER, DEPTH)).toBe(2);
    expect(readSentinelDepth({ [MARKER]: true, [DEPTH]: 12 }, MARKER, DEPTH)).toBe(12);
    expect(readSentinelDepth({ [MARKER]: true, [DEPTH]: 2.7 }, MARKER, DEPTH)).toBe(2);
    expect(readSentinelDepth({ [MARKER]: true, [DEPTH]: 0 }, MARKER, DEPTH)).toBe(1);
    expect(readSentinelDepth({ [MARKER]: true, [DEPTH]: 'x' }, MARKER, DEPTH)).toBe(1);
    // No marker configured -> never counts anything.
    expect(readSentinelDepth({ [MARKER]: true, [DEPTH]: 2 }, undefined, DEPTH)).toBe(0);
  });

  it('isExternalReferrer is strict and never throws', () => {
    expect(isExternalReferrer('', ORIGIN)).toBe(false);
    expect(isExternalReferrer('not a url', ORIGIN)).toBe(false);
    expect(isExternalReferrer('ftp://example.com/x', ORIGIN)).toBe(false);
    expect(isExternalReferrer(`${ORIGIN}/ko`, ORIGIN)).toBe(false);
    expect(isExternalReferrer('https://duckduckgo.com/?q=unitas', ORIGIN)).toBe(true);
    expect(isExternalReferrer('http://example.org/', ORIGIN)).toBe(true);
  });
});
