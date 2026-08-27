'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface ModalPortalProps {
  open: boolean;
  onClose: () => void;
  /** The dialog panel. Must stop click propagation itself if it should not close on inner clicks. */
  children: ReactNode;
  /** Backdrop tint/blur -- a few modals want a heavier treatment. */
  backdropClassName?: string;
  /** z-index layer. Default 200; the language dropdown sits just below at 190. */
  z?: number;
}

/**
 * Portal + scroll-safe shell shared by every dialog on the site.
 *
 * Rendered straight into <body>, deliberately OUTSIDE
 * app/[locale]/layout.tsx's `.dashboard-zoom` wrapper (`zoom: 0.75`). CSS
 * `zoom` offsets `position: fixed` descendants and shrinks their box, which
 * is what pushed modal headers off the top edge and clipped "Charge Coins" /
 * "Login" / settings panels against the viewport border. At full scale in
 * <body> the backdrop always covers the true viewport.
 *
 * The backdrop is the scroll container (`overflow-y-auto`) and the panel is
 * centered by an inner `min-h-full` flex row: when the panel is taller than
 * the screen (small phones, landscape, large system font) it grows and the
 * backdrop scrolls, with symmetric `py` + `env(safe-area-inset-*)` padding
 * so the first and last lines are always reachable -- never cut off.
 */
export function ModalPortal({
  open,
  onClose,
  children,
  backdropClassName = 'bg-void/80 backdrop-blur-sm',
  z = 200,
}: ModalPortalProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="modal-backdrop"
          className={`fixed inset-0 h-[100dvh] overflow-y-auto overscroll-contain ${backdropClassName}`}
          style={{ zIndex: z }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          role="presentation"
        >
          <div
            className="flex min-h-full w-full items-center justify-center"
            style={{
              paddingTop: 'max(1.5rem, env(safe-area-inset-top))',
              paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))',
              paddingLeft: 'max(1rem, env(safe-area-inset-left))',
              paddingRight: 'max(1rem, env(safe-area-inset-right))',
            }}
          >
            {children}
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
