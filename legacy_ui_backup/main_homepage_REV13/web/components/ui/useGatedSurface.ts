'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import {
  acquireGate,
  forceGate,
  getGateOwner,
  releaseGate,
  subscribeGate,
  type GateId,
} from '@/lib/uiGate';

interface GatedSurfaceOptions {
  /** Lock body scroll while this surface holds the gate. Default: false. */
  lockScroll?: boolean;
}

interface GatedSurface {
  /** This surface currently holds the gate (i.e. it is the open one). */
  open: boolean;
  /** Some OTHER surface holds the gate -- this trigger should be inert. */
  blocked: boolean;
  /** Acquire (true) / release (false) the gate for this surface. Acquiring
   *  while another surface holds it is a no-op unless `force` is passed. */
  setOpen: (next: boolean, opts?: { force?: boolean }) => void;
  /** Convenience toggle. Opening while blocked is a no-op (see setOpen). */
  toggle: () => void;
}

/**
 * Drop-in replacement for `useState(false)` on a boolean-open popup/modal that
 * must participate in the site-wide single-open-surface gate (`lib/uiGate.ts`).
 *
 * - `open` is derived from the shared gate owner, not local state, so two
 *   surfaces can never both believe they are open.
 * - Releases the gate automatically on unmount (covers route changes and the
 *   NavBar remount on locale switch).
 */
export function useGatedSurface(id: GateId, options: GatedSurfaceOptions = {}): GatedSurface {
  const { lockScroll = false } = options;

  const owner = useSyncExternalStore(
    subscribeGate,
    getGateOwner,
    () => null,
  );

  const open = owner === id;
  const blocked = owner !== null && owner !== id;

  const setOpen = useCallback(
    (next: boolean, opts?: { force?: boolean }) => {
      if (next) {
        if (opts?.force) forceGate(id);
        else acquireGate(id);
      } else {
        releaseGate(id);
      }
    },
    [id],
  );

  const toggle = useCallback(() => {
    if (getGateOwner() === id) releaseGate(id);
    else acquireGate(id);
  }, [id]);

  // Always surrender the gate if this surface leaves the tree while holding it.
  useEffect(() => {
    return () => releaseGate(id);
  }, [id]);

  useEffect(() => {
    if (!open || !lockScroll || typeof document === 'undefined') return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open, lockScroll]);

  return { open, blocked, setOpen, toggle };
}
