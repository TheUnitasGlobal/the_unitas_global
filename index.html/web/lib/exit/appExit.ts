// Sovereign omni-channel exit doctrine (owner instruction 2026-09-05, round
// 10, items 5 + 6). ONE primitive every "leave the site / close the app"
// affordance routes through -- ExitGuard's confirmed 종료 button and the
// Coming-Soon sealed screen's 'X' -- so the two channels the doctrine names
// behave identically everywhere they are reached from:
//
//   ONLINE (browser tab -- PC, mobile, tablet, anything):
//     return to the page the visitor came from ("이전 검색 페이지로 복귀").
//     A fresh tab with nothing behind it is closed outright when the browser
//     permits (Chromium/Firefox allow `window.close()` on a tab whose session
//     history holds a single document, even one not opened by script); if
//     neither is possible the external referrer is used, and as a last resort
//     the page hard-refreshes in place -- never a dead-end notice, never a
//     blank document.
//
//   APP (installed PWA / native container, any device):
//     terminate immediately and drop the visitor back onto the launcher /
//     desktop. `window.close()` is the only web API that genuinely ends an
//     installed app's window, and Chromium only honours it while the window's
//     history holds ONE entry -- which is exactly why ExitGuard no longer
//     parks its back-gesture sentinel entry in standalone mode (see
//     components/interaction/ExitGuard.tsx). When the runtime still refuses
//     (iOS home-screen apps expose no close path at all; an app that has
//     navigated between routes has more than one entry) the app restarts
//     cleanly at its own root instead of freezing on `about:blank` -- the
//     "백지 멈춤" this round explicitly retires.
//
// `planExit()` is pure (no DOM) so the branching is unit-tested in
// __tests__/exit/appExit.test.ts; `executeAppExit()` is the thin browser
// runner around it.

export type ExitChannel = 'app' | 'online';

export interface ExitEnvironment {
  /** Running as an installed app (display-mode: standalone / iOS standalone). */
  standalone: boolean;
  /** `history.length` -- an upper bound on how many entries sit behind us. */
  historyLength: number;
  /** ExitGuard's synthetic sentinel entry is the CURRENT entry (online only). */
  onSentinel: boolean;
  /** `document.referrer` (may be empty). */
  referrer: string;
  /** `location.origin` -- a same-origin referrer is not "the previous site". */
  origin: string;
}

export type ExitStep =
  | { kind: 'close' }
  | { kind: 'history-back'; steps: number }
  | { kind: 'navigate'; url: string; replace: boolean };

export interface ExitPlan {
  channel: ExitChannel;
  /** Fired synchronously, in order, inside the user gesture. */
  immediate: ExitStep[];
  /** Fired only if the document is still visible after LEAVE_SETTLE_MS. */
  fallback: ExitStep;
}

/** Give a leave attempt this long to actually unload before admitting the
 *  runtime refused it and running the plan's fallback. */
export const LEAVE_SETTLE_MS = 450;

/** Pure: is `referrer` an external http(s) page we can hand the visitor back to? */
export function isExternalReferrer(referrer: string, origin: string): boolean {
  if (!referrer) return false;
  try {
    const url = new URL(referrer);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    return url.origin !== origin;
  } catch {
    return false;
  }
}

/**
 * Pure planner. `fallbackUrl` is the same-origin URL used when nothing else
 * unloads the page (the current locale's root -- an in-place refresh that,
 * thanks to the sub-view splash gate, re-renders the same view).
 */
export function planExit(env: ExitEnvironment, fallbackUrl: string): ExitPlan {
  if (env.standalone) {
    return {
      channel: 'app',
      immediate: [{ kind: 'close' }],
      // A clean restart of the app at its root -- never `about:blank`.
      fallback: { kind: 'navigate', url: fallbackUrl, replace: true },
    };
  }

  const ownEntries = env.onSentinel ? 2 : 1;
  const immediate: ExitStep[] =
    env.historyLength > ownEntries
      ? [{ kind: 'history-back', steps: ownEntries }]
      : [{ kind: 'close' }];

  const fallback: ExitStep = isExternalReferrer(env.referrer, env.origin)
    ? { kind: 'navigate', url: env.referrer, replace: false }
    : { kind: 'navigate', url: fallbackUrl, replace: false };

  return { channel: 'online', immediate, fallback };
}

// ---------------------------------------------------------------------------
// browser runner
// ---------------------------------------------------------------------------

export function isStandaloneApp(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return (
      window.matchMedia?.('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true
    );
  } catch {
    return false;
  }
}

function runStep(step: ExitStep): void {
  try {
    switch (step.kind) {
      case 'close':
        window.close();
        return;
      case 'history-back':
        window.history.go(-step.steps);
        return;
      case 'navigate':
        if (step.replace) window.location.replace(step.url);
        else window.location.href = step.url;
        return;
    }
  } catch {
    /* a refused step must never throw out of the gesture handler */
  }
}

let leaving = false;

/** True once an exit has been started on this document (callers can dedupe). */
export function isExitInProgress(): boolean {
  return leaving;
}

export interface ExecuteAppExitOptions {
  /** Same-origin URL for the in-place fallback (normally `/${locale}`). */
  fallbackUrl: string;
  /** ExitGuard's sentinel-history marker key, if the caller parks one. */
  sentinelMarker?: string;
}

/**
 * Runs the plan for the live environment. MUST be called synchronously inside
 * a user gesture -- `window.close()` and history traversal are both
 * activation-gated. Returns the channel that was executed.
 */
export function executeAppExit(options: ExecuteAppExitOptions): ExitChannel {
  if (typeof window === 'undefined') return 'online';
  let onSentinel = false;
  try {
    const state = window.history.state as Record<string, unknown> | null;
    onSentinel = Boolean(options.sentinelMarker && state?.[options.sentinelMarker]);
  } catch {
    onSentinel = false;
  }

  const plan = planExit(
    {
      standalone: isStandaloneApp(),
      historyLength: (() => {
        try {
          return window.history.length;
        } catch {
          return 1;
        }
      })(),
      onSentinel,
      referrer: typeof document === 'undefined' ? '' : document.referrer || '',
      origin: window.location.origin,
    },
    options.fallbackUrl,
  );

  leaving = true;
  for (const step of plan.immediate) runStep(step);

  window.setTimeout(() => {
    if (document.visibilityState === 'hidden') {
      // Something DID take us away (app backgrounded / tab hidden). If the
      // visitor ever returns to this exact document -- an app resumed from
      // the launcher, a bfcache restore -- give them a fresh start rather
      // than a dialog frozen mid-exit.
      const revive = () => {
        if (document.visibilityState !== 'visible') return;
        document.removeEventListener('visibilitychange', revive);
        window.removeEventListener('pageshow', revive);
        leaving = false;
        try {
          window.location.reload();
        } catch {
          /* no-op */
        }
      };
      document.addEventListener('visibilitychange', revive);
      window.addEventListener('pageshow', revive);
      return;
    }
    // Nothing unloaded us -- the runtime refused every immediate step.
    runStep(plan.fallback);
  }, LEAVE_SETTLE_MS);

  return plan.channel;
}
