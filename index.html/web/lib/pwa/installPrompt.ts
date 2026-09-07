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
  SPLASH_ACTIVE_STORAGE_KEY,
  SPLASH_ACTIVE_VALUE,
  SPLASH_IN_PLACE_PHASES,
} from '@/lib/splash/splashTimeline';
import { CONSOLE_LOAD_ES5 } from '@/lib/sovereign/consoleTrigger';

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

export type PwaInstallStatus = 'idle' | 'prompting' | 'accepted' | 'dismissed' | 'unavailable';

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
 *  - tracks `appinstalled`
 *  - registers the installability service worker as early as possible
 *  - stamps `data-splash="off"` on <html> for `?splash=0` so the SSR'd intro
 *    splash never paints on a QA/E2E run (pure CSS gate, no JS race)
 *  - RE-ENTRY RESET (owner instruction 2026-09-05, round 11, item 3): on
 *    every document load that is not an in-place `reload` -- a PWA launch,
 *    a typed / bookmarked URL, an external link, a browser session restore,
 *    a history traversal back onto the site -- the tab's session state
 *    (curtain phase, sub-view UI state, open popups) is wiped BEFORE any of
 *    it is read, so PC, mobile and tablet, online and App alike, always
 *    re-enter through the very first "logo page" splash instead of being
 *    restored into the login / main / ad / Coming-Soon sub-view they left.
 *    A bfcache restore (`pageshow` with `persisted`) is a re-entry too: the
 *    state is wiped and the document reloads so the same bootstrap runs
 *    again. `?splash=0` (QA harness) keeps state. Mirrors the pure predicate
 *    `shouldResetEntrySession()` in lib/splash/splashTimeline.ts.
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
window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__unitasPwaPrompt=e;try{window.dispatchEvent(new CustomEvent('${PWA_PROMPT_CAPTURED_EVENT}'));}catch(_){}});
window.addEventListener('appinstalled',function(){window.__unitasPwaInstalled=true;window.__unitasPwaPrompt=null;});
var qa=/[?&]splash=(0|off|false)(&|$)/.test(location.search);
if(qa){document.documentElement.setAttribute('data-splash','off');}
try{var nt='navigate';try{var en=performance.getEntriesByType&&performance.getEntriesByType('navigation');if(en&&en[0]&&en[0].type){nt=String(en[0].type);}else if(performance.navigation&&performance.navigation.type===1){nt='reload';}}catch(_){}
if(!qa&&nt.toLowerCase()!=='reload'){try{sessionStorage.clear();}catch(_){}}
var rl=false;window.addEventListener('pageshow',function(e){if(!e||!e.persisted||qa||rl)return;rl=true;try{sessionStorage.clear();}catch(_){}try{location.reload();}catch(_){}});}catch(_){}
try{var sa=sessionStorage.getItem('${SPLASH_ACTIVE_STORAGE_KEY}');var p=sessionStorage.getItem('${CINEMA_PHASE_STORAGE_KEY}');if(!(sa&&String(sa).trim()==='${SPLASH_ACTIVE_VALUE}')&&p&&${JSON.stringify([...SPLASH_IN_PLACE_PHASES])}.indexOf(String(p).trim())!==-1){document.documentElement.setAttribute('data-splash','off');}}catch(_){}
${CONSOLE_LOAD_ES5}
try{if(consoleLoad()){document.documentElement.setAttribute('data-splash','off');}}catch(_){}
if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){});});}
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

function wireWindow(): void {
  if (wired || typeof window === 'undefined') return;
  wired = true;

  // Adopt whatever the bootstrap script parked before hydration.
  snapshot = {
    prompt: window.__unitasPwaPrompt ?? null,
    installed: window.__unitasPwaInstalled === true || isStandaloneDisplay(),
    status: 'idle',
  };

  window.addEventListener(PWA_PROMPT_CAPTURED_EVENT, () => {
    patch({ prompt: window.__unitasPwaPrompt ?? null, status: 'idle' });
  });
  // Belt and braces: if the bootstrap was somehow absent, catch it here too.
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    window.__unitasPwaPrompt = event as BeforeInstallPromptEvent;
    patch({ prompt: event as BeforeInstallPromptEvent, status: 'idle' });
  });
  window.addEventListener('appinstalled', () => {
    window.__unitasPwaInstalled = true;
    window.__unitasPwaPrompt = null;
    patch({ prompt: null, installed: true, status: 'accepted' });
  });
  ensureServiceWorker();
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
    patch({ prompt: null, status, installed: current.installed || outcome === 'accepted' });
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
