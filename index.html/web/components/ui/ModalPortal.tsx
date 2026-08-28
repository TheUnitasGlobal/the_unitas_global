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
 */
export function ModalPortal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted || typeof document === 'undefined') return null;
  return createPortal(children, document.body);
}
