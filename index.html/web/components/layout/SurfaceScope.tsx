'use client';

import '@/app/quantum-white.css';
import '@/app/quantum-white-rev19.css';

import { useEffect, useLayoutEffect, type ReactNode } from 'react';

/** `<html data-unitas-surface="...">` value the whole Quantum White theme
 *  scope (app/quantum-white.css, app/quantum-white-rev19.css) keys on. */
export const QUANTUM_WHITE_SURFACE = 'quantum-white';

// useLayoutEffect has no server-side equivalent; swap to useEffect during
// SSR (mirrors components/home/quantum/useCurtainReleased.ts).
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/**
 * REV-21 §6.1 (F-1) -- activate the Quantum White theme scope for as long
 * as the caller is mounted: stamps `data-unitas-surface` on `<html>`
 * before first paint and removes it on unmount (only if it still holds
 * this value, so two scopes handing over across a client navigation never
 * strip each other's stamp). Extracted from QuantumWhiteHome so the
 * /company, /legal and /support routes render the same white surface as
 * the home they were opened from instead of the dark route default. The
 * two theme stylesheets are imported here as well, so a cold load of a
 * route (no home in the tree) still ships them.
 */
export function useSurfaceScope(value: string = QUANTUM_WHITE_SURFACE): void {
  useIsomorphicLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.unitasSurface = value;
    return () => {
      if (root.dataset.unitasSurface === value) delete root.dataset.unitasSurface;
    };
  }, [value]);
}

/** Wrapper form of `useSurfaceScope` for server-rendered route bodies. */
export function SurfaceScope({ children }: { children: ReactNode }) {
  useSurfaceScope();
  return <>{children}</>;
}
