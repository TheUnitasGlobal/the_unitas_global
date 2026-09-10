'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Portals its children to `document.body` -- deliberately OUTSIDE
 * `app/[locale]/layout.tsx`'s `.dashboard-zoom` wrapper (`zoom: 0.75`), which
 * otherwise clips a dialog's header against the viewport's top edge and skews
 * every `getBoundingClientRect()` a tooltip inside the dialog relies on.
 *
 * Renders nothing until mounted so it is SSR-safe.
 *
 * REV-19 §9-11: the children are wrapped in a `data-unitas-portal` element
 * (display: contents -- no box, no layout effect) so the Quantum White
 * theme scope can re-key every portaled surface (dialogs, towers,
 * dropdowns, sheets) to the same glass grammar as the page beneath
 * (app/quantum-white.css §14). Dark routes are untouched: the wrapper only
 * ever matters inside the QW scope.
 */
export function ModalPortal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted || typeof document === 'undefined') return null;
  return createPortal(<div data-unitas-portal="" style={{ display: 'contents' }}>{children}</div>, document.body);
}
