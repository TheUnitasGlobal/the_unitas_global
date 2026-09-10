// Global, framework-agnostic PWA install store (owner instruction 2026-09-04,
// item 2: one-click install from EVERY surface -- home, ad/cinema screen,
// landing pages, sub-routes).
//
// Why a singleton and not a per-component hook: Chromium fires
// `beforeinstallprompt` exactly ONCE per page load, usually within the first
// second, and only components already mounted at that instant can catch it.
// The old usePwaInstall registered its listener inside each component's
// effect, so any surface mounted later (a modal, a late-hydrated ad page, the
// sealed cinema screen) missed the event and had no prompt to fire.
//
// Now:
//   1. `PWA_CAPTURE_BOOTSTRAP` -- a tiny inline script in app/layout.tsx's
//      <head> -- captures the event BEFORE React hydrates, parks it on
//      `window.__unitasPwaPrompt`, and registers /sw.js on `load` (the SW +
//      manifest are what make the browser emit the event in the first place).
//   2. This module exposes that captured event via a subscribe/snapshot store
//      (useSyncExternalStore-compatible) so every consumer, whenever it mounts,
//      sees the same prompt.
//   3. `requestPwaInstall()` + the `data-pwa-install` attribute give any
//      button on any route a zero-wiring trigger; <PwaInstallHost/> (mounted in
//      app/[locale]/layout.tsx) turns a request into the native prompt when
//      available, or the localized guide sheet otherwise.

import {
  CINEMA_PHASE_STORAGE_KEY,
  CINEMA_SEGMENT_STORAGE_KEY,
  HANDOFF_STORAGE_KEY,
  LEAVE_STAMP_STORAGE_KEY,
  SPLASH_ACTIVE_STORAGE_KEY,
  SPLASH_ACTIVE_VALUE,
  SPLASH_IN_PLACE_PHASES,
} from '@/lib/splash/splashTimeline';
import { CONSOLE_LOAD_ES5 } from '@/lib/sovereign/consoleTrigger';
import { VISIT_LEDGER_TTL_MS } from '@/lib/entry/loadClass';
import { VISIT_LEDGER_STORAGE_KEY, VISIT_LEDGER_VERSION } from '@/lib/entry/visitLedger';
import { SURFACE_MIRROR_KEY } from '@/lib/quantumWhite/surfaceState';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform?: string }>;
}

declare global {
  interface Window {
    __unitasPwaPrompt?: BeforeInstallPromptEvent | null;
    __unitasPwaInstalled?: boolean;
  }
}

export type PwaInstallStatus =
  | 'idle'
  /** A tap arrived before the browser offered its prompt; we are holding the activation window open for it. */
  | 'awaiting'
  | 'prompting'
  | 'accepted'
  | 'dismissed'
  | 'unavailable';

/**
 * localStorage flag raised by `appinstalled` so a LATER browser-tab visit
 * (where `beforeinstallprompt` will never fire again because the app is
 * already on the device) can still tell the visitor to launch the installed
 * app instead of showing a dead "install" path. Cleared the moment a fresh
 * `beforeinstallprompt` arrives -- that event only fires when the app is NOT
 * installed, so it is the authoritative "uninstalled since" signal.
 */
export const PWA_INSTALLED_STORAGE_KEY = 'unitas.pwa.installed';

/**
 * How long a tap may wait for a late `beforeinstallprompt` before falling
 * back. Chromium's transient user activation lasts ~5s; `prompt()` fired
 * inside that window still counts as gesture-initiated, so a click that
 * lands a beat before the browser finishes its installability check (fresh
 * cold load, slow manifest / SW fetch) is turned into the native dialog
 * instead of a manual guide.
 */
export const PWA_PROMPT_GRACE_MS = 2600;

export interface PwaInstallSnapshot {
  /** The captured `beforeinstallprompt` event, or null when none is available. */
  prompt: BeforeInstallPromptEvent | null;
  /** Running as an installed app (standalone display), or `appinstalled` fired. */
  installed: boolean;
  status: PwaInstallStatus;
}

/** Fired (on `window`) by the bootstrap script once it has parked the event. */
export const PWA_PROMPT_CAPTURED_EVENT = 'unitas:pwa-prompt-captured';
/** Fired (on `window`) by `requestPwaInstall()`; <PwaInstallHost/> listens. */
export const PWA_INSTALL_REQUEST_EVENT = 'unitas:pwa-install-request';
/** Any element carrying this attribute becomes a one-click install trigger. */
export const PWA_INSTALL_TRIGGER_ATTR = 'data-pwa-install';
/** Query param that disables the intro splash (QA / E2E only). */
export const SPLASH_OFF_QUERY = /[?&]splash=(0|off|false)(&|$)/;

/**
 * Pre-hydration bootstrap. Injected verbatim into <head> by app/layout.tsx.
 * Kept dependency-free ES5 so it runs on every engine before any bundle.
 *  - captures `beforeinstallprompt` (preventDefault so Chrome's mini-infobar
 *    doesn't steal the moment; we fire it ourselves on the visitor's click)
 *  - tracks `appinstalled` (persisted in localStorage, see
 *    PWA_INSTALLED_STORAGE_KEY; a fresh `beforeinstallprompt` clears it)
 *  - registers the installability service worker IMMEDIATELY -- not on
 *    `load` any more (owner instruction 2026-09-07, one-click hardening):
 *    Chromium runs its installability check once manifest + SW are known,
 *    so the earlier the registration, the earlier `beforeinstallprompt`
 *    lands and the more likely the visitor's FIRST tap meets a live prompt
 *  - stamps `data-splash="off"` on <html> for `?splash=0` so the SSR'd intro
 *    splash never paints on a QA/E2E run (pure CSS gate, no JS race)
 *  - RE-ENTRY RESET, three-way (owner instruction 2026-09-05, round 11, item
 *    3; refined REV-17, SPEC.md §3.1): every document load is classified
 *    `refresh` / `restore` / `entry` (mirrors the pure `classifyDocumentLoad()`
 *    in lib/entry/loadClass.ts -- this block is its ES5 pre-hydration twin,
 *    tested for parity in __tests__/entry/loadClass.test.ts). A genuine
 *    ENTRY -- a typed / bookmarked URL, an external link, a fresh tab, a
 *    history traversal after a normal exit -- wipes the tab's session state
 *    (curtain phase, sub-view UI state, open popups) BEFORE any of it is
 *    read, so the visitor starts from the "logo page" splash instead of
 *    being restored into a sub-view they never actually left. But three
 *    loads that are NOT a genuine re-entry used to be wiped anyway because
 *    their `navigationType` isn't `reload`: a Chromium tab discarded for
 *    memory and restored (`document.wasDiscarded`), a WebKit process
 *    purge/restore (no `pagehide` ever fired, so `unitas_leave_at` never got
 *    written), and an installed App cold-relaunching within 30 minutes (no
 *    sessionStorage survives that at all -- recovered from the
 *    `unitas_visit_ledger` localStorage record instead, see
 *    lib/entry/visitLedger.ts). All three now RESTORE in place. A same-tab
 *    hand-off (`unitas_handoff`, e.g. the standalone locale prefetch
 *    redirect in lib/pwa/standaloneLaunch.ts) is treated as a continuation,
 *    same as a `reload`. A bfcache restore (`pageshow` with `persisted`) is
 *    still always treated as a re-entry: the state is wiped and the document
 *    reloads so the same bootstrap runs again from scratch. `?splash=0` (QA
 *    harness) keeps state, as before.
 *  - stamps the same attribute when the tab carries ANY persisted Coming-Soon
 *    curtain phase (gate / cinema / sealed / released): a refresh parked on
 *    any of those pages -- the entry gate, an ad stage, the sealed
 *    Coming-Soon screen or the released MAIN HOME -- must re-render that
 *    page in place with no "logo page" in between (owner instruction
 *    2026-09-05, checklist items 2 + 3: "새로고침시 ... 아무것도 안보이게",
 *    and in particular no logo page on a main-home F5). Only a cold entry
 *    (no persisted phase) keeps the splash. Pre-hydration on purpose -- the
 *    splash is SSR'd visible, so only a pre-paint gate avoids a flash of it;
 *    the React component skips its timer separately. Because the re-entry
 *    reset above runs first, this branch can only ever fire on a genuine
 *    `reload`.
 *  - EXCEPT when the tab also carries `unitas_splash_active=1` (owner
 *    instruction 2026-09-05, 7-point hardening, item 6): that flag is raised
 *    by the splash component for exactly as long as the logo page is on
 *    screen, and the curtain persists `gate` beneath it from its first
 *    frame -- so a refresh DURING the logo page used to skip ahead to the
 *    entry gate. With the flag present the splash is left visible and
 *    replays: the visitor lands on the very page they were looking at.
 *  - SOVEREIGN CONSOLE ISOLATION (owner instruction 2026-09-07, master audit
 *    item 2): a document load that is a founder-console action -- `?dev=skip`
 *    (메인사이트 진입), `?dev=replay` (시퀀스 다시 재생), `?dev=off` or the
 *    storage-carried revoke reload (권한 해제) -- is a TRANSITION, not an
 *    entry: the logo page is stamped off here, before paint, and the entry
 *    chime bootstrap (which runs next) stands down on the same predicate
 *    (lib/sovereign/consoleTrigger.ts `CONSOLE_LOAD_ES5`).
 */
export const PWA_CAPTURE_BOOTSTRAP = `(function(){try{
window.__unitasPwaPrompt=null;
try{window.__unitasPwaInstalled=localStorage.getItem('${PWA_INSTALLED_STORAGE_KEY}')==='1';}catch(_){}
window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__unitasPwaPrompt=e;window.__unitasPwaInstalled=false;try{localStorage.removeItem('${PWA_INSTALLED_STORAGE_KEY}');}catch(_){}try{window.dispatchEvent(new CustomEvent('${PWA_PROMPT_CAPTURED_EVENT}'));}catch(_){}});
window.addEventListener('appinstalled',function(){window.__unitasPwaInstalled=true;window.__unitasPwaPrompt=null;try{localStorage.setItem('${PWA_INSTALLED_STORAGE_KEY}','1');}catch(_){}});
if('serviceWorker' in navigator){try{navigator.serviceWorker.register('/sw.js').catch(function(){});}catch(_){}}
var qa=/[?&]splash=(0|off|false)(&|$)/.test(location.search);
if(qa){document.documentElement.setAttribute('data-splash','off');}
try{
var nt='navigate';
try{var en=performance.getEntriesByType&&performance.getEntriesByType('navigation');if(en&&en[0]&&en[0].type){nt=String(en[0].type);}else if(performance.navigation&&performance.navigation.type===1){nt='reload';}}catch(_){}
var wasDiscarded=false;try{wasDiscarded=document.wasDiscarded===true;}catch(_){}
var phaseVal=null;try{phaseVal=sessionStorage.getItem('${CINEMA_PHASE_STORAGE_KEY}');}catch(_){}
var hasPhase=!!phaseVal;
var leaveStamp=false;try{leaveStamp=!!sessionStorage.getItem('${LEAVE_STAMP_STORAGE_KEY}');}catch(_){}
var handoff=false;try{handoff=!!sessionStorage.getItem('${HANDOFF_STORAGE_KEY}');if(handoff){sessionStorage.removeItem('${HANDOFF_STORAGE_KEY}');}}catch(_){}
var standalone=false;try{var mm=window.matchMedia;standalone=!!((mm&&(mm.call(window,'(display-mode: standalone)').matches||mm.call(window,'(display-mode: minimal-ui)').matches||mm.call(window,'(display-mode: window-controls-overlay)').matches))||navigator.standalone===true);}catch(_){}
var ledger=null;var ledgerAge=null;
try{var ls=window.localStorage;var raw=ls&&ls.getItem('${VISIT_LEDGER_STORAGE_KEY}');if(raw){var parsed=JSON.parse(raw);if(parsed&&parsed.v===${VISIT_LEDGER_VERSION}&&typeof parsed.at==='number'){var age=Date.now()-parsed.at;if(age>=0&&age<${VISIT_LEDGER_TTL_MS}){ledgerAge=age;ledger=parsed;}}}}catch(_){}
var cls='entry';
if(qa){cls='refresh';}
else if(handoff){cls='refresh';}
else if(nt.toLowerCase()==='reload'){cls='refresh';}
else if(wasDiscarded&&hasPhase){cls='restore';}
else if(hasPhase&&!leaveStamp){cls='restore';}
else if(!hasPhase&&standalone&&ledgerAge!==null){cls='restore';}
if(cls==='entry'){
try{sessionStorage.clear();}catch(_){}
try{window.localStorage&&window.localStorage.removeItem('${VISIT_LEDGER_STORAGE_KEY}');}catch(_){}
}else if(cls==='restore'&&ledger){
try{
sessionStorage.setItem('${CINEMA_PHASE_STORAGE_KEY}',String(ledger.phase));
if(ledger.segment){sessionStorage.setItem('${CINEMA_SEGMENT_STORAGE_KEY}',String(ledger.segment));}
if(ledger.surface){sessionStorage.setItem('${SURFACE_MIRROR_KEY}',String(ledger.surface));}
}catch(_){}
}
try{sessionStorage.removeItem('${LEAVE_STAMP_STORAGE_KEY}');}catch(_){}
window.addEventListener('pagehide',function(){try{sessionStorage.setItem('${LEAVE_STAMP_STORAGE_KEY}',String(Date.now()));}catch(_){}});
var rl=false;window.addEventListener('pageshow',function(e){if(!e||!e.persisted||qa||rl)return;rl=true;try{sessionStorage.clear();}catch(_){}try{location.reload();}catch(_){}});
}catch(_){}
try{var sa=sessionStorage.getItem('${SPLASH_ACTIVE_STORAGE_KEY}');var p=sessionStorage.getItem('${CINEMA_PHASE_STORAGE_KEY}');if(!(sa&&String(sa).trim()==='${SPLASH_ACTIVE_VALUE}')&&p&&${JSON.stringify([...SPLASH_IN_PLACE_PHASES])}.indexOf(String(p).trim())!==-1){document.documentElement.setAttribute('data-splash','off');}}catch(_){}
${CONSOLE_LOAD_ES5}
try{if(consoleLoad()){document.documentElement.setAttribute('data-splash','off');}}catch(_){}
}catch(_){}})();`;

const SERVER_SNAPSHOT: PwaInstallSnapshot = { prompt: null, installed: false, status: 'idle' };

let snapshot: PwaInstallSnapshot = SERVER_SNAPSHOT;
const listeners = new Set<() => void>();
let wired = false;

function emit(): void {
  for (const listener of listeners) listener();
}

function patch(partial: Partial<PwaInstallSnapshot>): void {
  snapshot = { ...snapshot, ...partial };
  emit();
}

export function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /android|iphone|ipad|ipod|windows phone|mobile/i.test(navigator.userAgent);
}

export function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** Registers /sw.js (idempotent -- the browser dedupes repeat registrations). */
export function ensureServiceWorker(): void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('/sw.js').catch(() => {
    /* non-fatal: the guide sheet covers browsers without an install prompt */
  });
}

function readInstalledFlag(): boolean {
  try {
    return window.localStorage.getItem(PWA_INSTALLED_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeInstalledFlag(installed: boolean): void {
  try {
    if (installed) window.localStorage.setItem(PWA_INSTALLED_STORAGE_KEY, '1');
    else window.localStorage.removeItem(PWA_INSTALLED_STORAGE_KEY);
  } catch {
    /* storage blocked -- in-memory state still covers this document */
  }
}

/**
 * Whether this engine can EVER hand us a programmatic install prompt
 * (Chromium family: Chrome, Edge, Samsung Internet, Opera, Brave, Arc...).
 * Safari / Firefox never will, so a tap there must not wait for one.
 */
export function canBrowserPrompt(): boolean {
  if (typeof window === 'undefined') return false;
  return 'onbeforeinstallprompt' in window || 'BeforeInstallPromptEvent' in window;
}

function wireWindow(): void {
  if (wired || typeof window === 'undefined') return;
  wired = true;

  // Adopt whatever the bootstrap script parked before hydration.
  const prompt = window.__unitasPwaPrompt ?? null;
  snapshot = {
    prompt,
    // A live prompt is authoritative: it only ever fires for a NOT-installed app.
    installed: prompt ? false : window.__unitasPwaInstalled === true || readInstalledFlag() || isStandaloneDisplay(),
    status: 'idle',
  };

  window.addEventListener(PWA_PROMPT_CAPTURED_EVENT, () => {
    patch({ prompt: window.__unitasPwaPrompt ?? null, installed: false, status: 'idle' });
  });
  // Belt and braces: if the bootstrap was somehow absent, catch it here too.
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    window.__unitasPwaPrompt = event as BeforeInstallPromptEvent;
    window.__unitasPwaInstalled = false;
    writeInstalledFlag(false);
    patch({ prompt: event as BeforeInstallPromptEvent, installed: false, status: 'idle' });
  });
  window.addEventListener('appinstalled', () => {
    window.__unitasPwaInstalled = true;
    window.__unitasPwaPrompt = null;
    writeInstalledFlag(true);
    patch({ prompt: null, installed: true, status: 'accepted' });
  });
  ensureServiceWorker();
}

/**
 * Resolves with the captured prompt as soon as one exists, or null once
 * `timeoutMs` elapses. Used by the install host to bridge the gap between a
 * visitor's tap and a `beforeinstallprompt` that is still in flight, while
 * the tap's transient activation is still valid (see PWA_PROMPT_GRACE_MS).
 */
export function waitForPwaPrompt(timeoutMs = PWA_PROMPT_GRACE_MS): Promise<BeforeInstallPromptEvent | null> {
  const current = getPwaInstallSnapshot();
  if (current.prompt) return Promise.resolve(current.prompt);
  if (!canBrowserPrompt() || current.installed) return Promise.resolve(null);
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: BeforeInstallPromptEvent | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      window.removeEventListener(PWA_PROMPT_CAPTURED_EVENT, onCaptured);
      resolve(value);
    };
    const onCaptured = () => finish(window.__unitasPwaPrompt ?? getPwaInstallSnapshot().prompt);
    const timer = window.setTimeout(() => finish(null), Math.max(0, timeoutMs));
    window.addEventListener(PWA_PROMPT_CAPTURED_EVENT, onCaptured);
    patch({ status: 'awaiting' });
  }).then((value) => {
    if (!value && snapshot.status === 'awaiting') patch({ status: 'idle' });
    return value as BeforeInstallPromptEvent | null;
  });
}

export function getPwaInstallSnapshot(): PwaInstallSnapshot {
  wireWindow();
  return snapshot;
}

export function getPwaInstallServerSnapshot(): PwaInstallSnapshot {
  return SERVER_SNAPSHOT;
}

export function subscribePwaInstall(listener: () => void): () => void {
  wireWindow();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Fires the native install prompt. MUST be called synchronously inside a user
 * gesture (Chromium requires transient user activation for `prompt()`); the
 * first statement below calls it before any `await`, so a click -> CustomEvent
 * -> this call chain preserves the activation.
 */
export async function promptPwaInstall(): Promise<PwaInstallStatus> {
  const current = getPwaInstallSnapshot();
  const event = current.prompt;
  if (!event) {
    patch({ status: 'unavailable' });
    return 'unavailable';
  }
  patch({ status: 'prompting' });
  try {
    const shown = event.prompt();
    const { outcome } = await event.userChoice;
    await shown.catch(() => {});
    const status: PwaInstallStatus = outcome === 'accepted' ? 'accepted' : 'dismissed';
    // A BeforeInstallPromptEvent can only be prompted once.
    window.__unitasPwaPrompt = null;
    const installed = current.installed || outcome === 'accepted';
    if (outcome === 'accepted') writeInstalledFlag(true);
    patch({ prompt: null, status, installed });
    return status;
  } catch {
    window.__unitasPwaPrompt = null;
    patch({ prompt: null, status: 'unavailable' });
    return 'unavailable';
  }
}

/**
 * Programmatic one-click install trigger for any surface. The host decides:
 * native prompt if the browser offered one, otherwise the localized guide.
 */
export function requestPwaInstall(source = 'unknown'): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(PWA_INSTALL_REQUEST_EVENT, { detail: { source } }));
}
