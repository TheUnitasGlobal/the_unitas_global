'use client';

import { useEffect } from 'react';

/**
 * Global runtime fault shield (owner instruction 2026-09-07, item 1) --
 * renders nothing; installs, once per document, the window-level guards that
 * no React boundary can provide:
 *
 *  - `error` / `unhandledrejection`: faults thrown OUTSIDE React's render
 *    path (event handlers, timers, promise chains, third-party scripts) never
 *    reach an error boundary, so they never show an error screen -- but they
 *    are the ones that leave a click silently dead. They are tagged and
 *    counted here (console + `window.__unitasRuntimeFaults`) so the founder
 *    console can see them, and a rejection is marked handled so engines that
 *    surface unhandled rejections as page-level errors (some WebViews, the
 *    dev overlay) stay quiet. Nothing is swallowed silently: every fault is
 *    still logged in full.
 *
 *  - `webglcontextlost` (capture phase, on the document): calling
 *    `preventDefault()` is what tells the browser the page WANTS the context
 *    back, so `webglcontextrestored` fires and the 3D scene can rebuild
 *    instead of throwing from a dead context on its next frame. three.js
 *    does this on its own canvas once its renderer exists; this covers the
 *    window between canvas creation and renderer setup, and any canvas the
 *    site draws outside three.js.
 */

declare global {
  interface Window {
    /** Count of runtime faults caught by RuntimeShield on this document. */
    __unitasRuntimeFaults?: number;
    __unitasRuntimeShieldLive?: boolean;
  }
}

/** Window event fired for each runtime fault (detail: { kind, message }). */
export const RUNTIME_FAULT_EVENT = 'unitas:runtime-fault';

function describe(reason: unknown): string {
  if (reason instanceof Error) return reason.message;
  if (typeof reason === 'string') return reason;
  try {
    return JSON.stringify(reason);
  } catch {
    return String(reason);
  }
}

function record(kind: 'error' | 'rejection', reason: unknown): void {
  try {
    window.__unitasRuntimeFaults = (window.__unitasRuntimeFaults ?? 0) + 1;
    window.dispatchEvent(new CustomEvent(RUNTIME_FAULT_EVENT, { detail: { kind, message: describe(reason) } }));
  } catch {
    /* no-op */
  }
}

export function RuntimeShield() {
  useEffect(() => {
    if (window.__unitasRuntimeShieldLive) return;
    window.__unitasRuntimeShieldLive = true;

    const onError = (event: ErrorEvent) => {
      try {
        console.error('[Sovereign Shield] runtime fault', event.error ?? event.message);
      } catch {
        /* console unavailable */
      }
      record('error', event.error ?? event.message);
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      try {
        console.error('[Sovereign Shield] unhandled rejection', event.reason);
      } catch {
        /* console unavailable */
      }
      record('rejection', event.reason);
      // Mark handled: logged above, never a page-level fault.
      try {
        event.preventDefault();
      } catch {
        /* no-op */
      }
    };
    const onContextLost = (event: Event) => {
      try {
        event.preventDefault();
      } catch {
        /* no-op */
      }
    };

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    document.addEventListener('webglcontextlost', onContextLost, true);
    return () => {
      window.__unitasRuntimeShieldLive = false;
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
      document.removeEventListener('webglcontextlost', onContextLost, true);
    };
  }, []);

  return null;
}
