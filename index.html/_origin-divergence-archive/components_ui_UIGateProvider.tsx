'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  acquireGate,
  IDLE_GATE,
  isGateBlocked,
  releaseGate,
  type GateState,
} from '@/lib/uiGate';

interface AcquireOptions {
  /** Freeze document scroll while this surface is open (modals: yes, U-AI search hub: no). */
  lockScroll?: boolean;
}

interface UIGateValue {
  /** id of the single surface currently allowed to be open, or null. */
  activeId: string | null;
  /**
   * Synchronous check -- true when some OTHER surface holds the gate. Safe to
   * call inside an event handler right before deciding whether to open.
   */
  isBlocked: (id: string) => boolean;
  /** Try to take the gate for `id`. Returns false (and changes nothing) if blocked. */
  acquire: (id: string, options?: AcquireOptions) => boolean;
  /** Release the gate iff `id` currently holds it. */
  release: (id: string) => void;
}

const UIGateContext = createContext<UIGateValue | null>(null);

function applyScrollLock(locked: boolean) {
  if (typeof document === 'undefined') return;
  // Mirror AudioGate's approach (documentElement.style.overflow) so the two
  // locks compose cleanly and restore to the same baseline.
  document.documentElement.style.overflow = locked ? 'hidden' : '';
}

/**
 * Site-wide interaction gate. Guarantees that at most one popup / modal /
 * function-window is open at a time across the entire homepage -- nav menu
 * actions, the U-AI (OMNI-SYNAPSE) search hub, the 11/5/3-module entry
 * modals, the B2B inquiry form, the language dropdown. A surface must
 * `acquire(id)` before opening and `release(id)` when it closes; while one
 * holds the gate every other surface's `acquire` fails and its trigger
 * no-ops.
 *
 * State is mirrored into a ref so `acquire`/`release`/`isBlocked` resolve
 * synchronously within a single event handler (e.g. the search hub can
 * release and hand the gate to a module modal in the same click).
 */
export function UIGateProvider({ children }: { children: ReactNode }) {
  const stateRef = useRef<GateState>(IDLE_GATE);
  const [state, setState] = useState<GateState>(IDLE_GATE);

  const commit = useCallback((next: GateState) => {
    if (next === stateRef.current) return;
    stateRef.current = next;
    applyScrollLock(next.scrollLocked);
    setState(next);
  }, []);

  const acquire = useCallback(
    (id: string, options?: AcquireOptions) => {
      const next = acquireGate(stateRef.current, id, options?.lockScroll ?? false);
      const ok = !isGateBlocked(stateRef.current, id);
      if (ok) commit(next);
      return ok;
    },
    [commit],
  );

  const release = useCallback(
    (id: string) => {
      commit(releaseGate(stateRef.current, id));
    },
    [commit],
  );

  const isBlocked = useCallback((id: string) => isGateBlocked(stateRef.current, id), []);

  // Safety net: never leave the document scroll-locked if the provider unmounts
  // (locale switch remounts app/[locale]/layout.tsx) mid-modal.
  useEffect(() => () => applyScrollLock(false), []);

  const value = useMemo<UIGateValue>(
    () => ({ activeId: state.activeId, isBlocked, acquire, release }),
    [state.activeId, isBlocked, acquire, release],
  );

  return <UIGateContext.Provider value={value}>{children}</UIGateContext.Provider>;
}

export function useUIGate(): UIGateValue {
  const ctx = useContext(UIGateContext);
  if (!ctx) throw new Error('useUIGate must be used within <UIGateProvider>');
  return ctx;
}

/**
 * Drop-in replacement for `const [open, setOpen] = useState(false)` on a
 * boolean-open surface (nav modals, dropdowns). `open` reflects whether this
 * surface holds the gate; `setOpen(true)` acquires it (and is ignored when
 * another surface is open); `blocked` lets the trigger dim/ignore itself.
 * Releases automatically on unmount.
 */
export function useGatedSurface(id: string, options?: AcquireOptions) {
  const { activeId, acquire, release } = useUIGate();
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const open = activeId === id;
  const blocked = activeId !== null && activeId !== id;

  const setOpen = useCallback(
    (next: boolean): boolean => {
      if (next) return acquire(id, optionsRef.current);
      release(id);
      return true;
    },
    [id, acquire, release],
  );

  useEffect(() => () => release(id), [id, release]);

  return { open, setOpen, blocked };
}
