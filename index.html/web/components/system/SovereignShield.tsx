'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';

/**
 * Sovereign Shield -- the per-module runtime fault wrapper (owner instruction
 * 2026-09-07, item 1: "Sovereign Core Error 원인 완전 박멸 및 방어막 구축").
 *
 * WHY A SEPARATE BOUNDARY: Next.js's route-level `error.tsx` only covers the
 * `[locale]` segment's page tree, and `global-error.tsx` REPLACES the whole
 * document. Neither is a containment strategy: one faulty widget (a WebGL
 * context that fails to create, an AudioContext the engine refuses to build,
 * a third-party feed that returns a shape the renderer never expected) used
 * to pull the entire site down into the "SOVEREIGN CORE ERROR" screen. This
 * boundary sits around EACH independent module instead -- the 3D scene, the
 * intro splash, the curtain, the nav, the exit guard, the home-page widgets
 * -- so a fault stays inside the module it came from: the module renders its
 * fallback (nothing by default), everything else keeps running, and the
 * route-level screens are never reached for a module-local fault.
 *
 * SELF-HEALING: a caught fault does not retire the module for good. The
 * shield remounts its children after `retryDelayMs` (default 1.5s), up to
 * `maxRetries` times (default 2) -- a transient failure (a lost GPU context
 * that the browser restores a beat later, a race during hydration, a feed
 * hiccup) heals itself without any visitor action; a persistent one settles
 * on the fallback and stays quiet.
 *
 * DIAGNOSTICS: every catch is logged to the browser console under the
 * `[Sovereign Shield]` tag with the zone name, and announced on `window` as
 * `SHIELD_FAULT_EVENT` (detail: { zone, attempt }) so the founder console can
 * surface it. Nothing about the error is ever rendered to the page -- the
 * same "hide internals from the UI" rule the route boundaries follow.
 *
 * Class component on purpose: React exposes error boundaries only through
 * `getDerivedStateFromError` / `componentDidCatch` -- there is no hook form.
 */

/** Window event fired on every caught fault (detail: { zone, attempt }). */
export const SHIELD_FAULT_EVENT = 'unitas:shield-fault';

export interface SovereignShieldProps {
  /** Short stable name of the module this shield protects (diagnostics). */
  zone: string;
  children: ReactNode;
  /** Rendered while the module is down. Default: nothing at all. A function
   *  form receives `retry` so the fallback can offer a manual remount. */
  fallback?: ReactNode | ((retry: () => void) => ReactNode);
  /** How many self-healing remounts to attempt (default 2, 0 = none). */
  maxRetries?: number;
  /** Delay before each self-healing remount (default 1500ms). */
  retryDelayMs?: number;
  /** When any of these change, the shield resets and remounts its children
   *  at once (a route change, a new query, a phase switch). */
  resetKeys?: ReadonlyArray<unknown>;
}

interface SovereignShieldState {
  failed: boolean;
  attempt: number;
}

const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_RETRY_DELAY_MS = 1500;

function sameKeys(a: ReadonlyArray<unknown> | undefined, b: ReadonlyArray<unknown> | undefined): boolean {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) if (!Object.is(a[i], b[i])) return false;
  return true;
}

export class SovereignShield extends Component<SovereignShieldProps, SovereignShieldState> {
  state: SovereignShieldState = { failed: false, attempt: 0 };

  private healTimer: number | null = null;

  static getDerivedStateFromError(): Partial<SovereignShieldState> {
    return { failed: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    const attempt = this.state.attempt + 1;
    try {
      // Console only -- never rendered. The component stack is the one
      // piece of context that makes a module-local fault actionable.
      console.error(`[Sovereign Shield] zone="${this.props.zone}" fault #${attempt}`, error, info?.componentStack ?? '');
    } catch {
      /* console unavailable */
    }
    try {
      window.dispatchEvent(new CustomEvent(SHIELD_FAULT_EVENT, { detail: { zone: this.props.zone, attempt } }));
    } catch {
      /* no-op */
    }
    const maxRetries = this.props.maxRetries ?? DEFAULT_MAX_RETRIES;
    if (attempt <= maxRetries) {
      this.clearHealTimer();
      const delay = Math.max(0, this.props.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS);
      this.healTimer = window.setTimeout(() => {
        this.healTimer = null;
        this.setState({ failed: false, attempt });
      }, delay);
    } else {
      this.setState({ attempt });
    }
  }

  componentDidUpdate(prevProps: SovereignShieldProps): void {
    if (this.state.failed && !sameKeys(prevProps.resetKeys, this.props.resetKeys)) {
      this.clearHealTimer();
      this.setState({ failed: false, attempt: 0 });
    }
  }

  componentWillUnmount(): void {
    this.clearHealTimer();
  }

  /** Manual remount (the function-form fallback's `retry`). */
  retry = (): void => {
    this.clearHealTimer();
    this.setState({ failed: false, attempt: 0 });
  };

  private clearHealTimer(): void {
    if (this.healTimer !== null) {
      window.clearTimeout(this.healTimer);
      this.healTimer = null;
    }
  }

  render(): ReactNode {
    if (this.state.failed) {
      const { fallback } = this.props;
      if (typeof fallback === 'function') return fallback(this.retry);
      return fallback ?? null;
    }
    return this.props.children;
  }
}
