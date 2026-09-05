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

import { CINEMA_PHASE_STORAGE_KEY, SPLASH_SUB_VIEW_PHASES } from '@/lib/splash/splashTimeline';

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
 *  - stamps the same attribute when the tab's persisted Coming-Soon curtain
 *    phase is a SUB-VIEW (gate / cinema / sealed): a refresh parked on one of
 *    those must re-render that view in place with no "logo page" in between
 *    (owner instruction 2026-09-05, round 10, item 3). The main home
 *    (`released`) and a cold first visit keep the splash. Pre-hydration on
 *    purpose -- the splash is SSR'd visible, so only a pre-paint gate avoids
 *    a flash of it; the React component skips its audio/timer separately.
 */
export const PWA_CAPTURE_BOOTSTRAP = `(function(){try{
window.__unitasPwaPrompt=null;
window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__unitasPwaPrompt=e;try{window.dispatchEvent(new CustomEvent('${PWA_PROMPT_CAPTURED_EVENT}'));}catch(_){}});
window.addEventListener('appinstalled',function(){window.__unitasPwaInstalled=true;window.__unitasPwaPrompt=null;});
if(/[?&]splash=(0|off|false)(&|$)/.test(location.search)){document.documentElement.setAttribute('data-splash','off');}
try{var p=sessionStorage.getItem('${CINEMA_PHASE_STORAGE_KEY}');if(p&&${JSON.stringify([...SPLASH_SUB_VIEW_PHASES])}.indexOf(p)!==-1){document.documentElement.setAttribute('data-splash','off');}}catch(_){}
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
