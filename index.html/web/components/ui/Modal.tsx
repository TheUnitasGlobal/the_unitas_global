'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { ModalPortal } from './ModalPortal';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  labelledBy?: string;
  /** Widen the panel for feature-dense dialogs (wallet/charge) or long-form
   *  encyclopedic content ('xl' -- ranking detail popups). Default: 'md'. */
  size?: 'md' | 'lg' | 'xl';
  /** Owner instruction 2026-09-05 (round 5): the exit/logout confirm already
   *  has explicit Cancel/Confirm actions plus backdrop-click-to-close, so its
   *  corner 'X' was pure redundant clutter competing with the title for
   *  attention. Opt-in per dialog -- every other modal keeps the X. */
  hideCloseButton?: boolean;
  /** Stacking layer. 'base' (default, z-200) sits under the pre-launch
   *  curtain (z-400) -- correct for every in-site dialog, which only opens
   *  once the curtain is gone. 'top' (z-680) sits above the curtain, the
   *  founder console (z-450) and the PWA install sheet (z-650), below only
   *  the intro splash (z-700): reserved for the exit/logout confirm, which
   *  must be reachable from the sealed Coming-Soon screen too (owner
   *  instruction 2026-09-05, round 10 -- the dialog opening invisibly
   *  beneath the curtain was the "'X' 무반응" / "진입 시 팝업" root cause). */
  layer?: 'base' | 'top';
}

/** Shared overlay/dialog shell used by the wallet, quest, and inquiry modals. */
export function Modal({
  open,
  onClose,
  children,
  labelledBy,
  size = 'md',
  hideCloseButton = false,
  layer = 'base',
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  return (
    <ModalPortal>
      <AnimatePresence>
        {open && (
          <motion.div
            className={`fixed inset-0 ${
              layer === 'top' ? 'z-[680]' : 'z-[200]'
            } h-[100dvh] overflow-y-auto overscroll-contain bg-void/80 backdrop-blur-sm`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            role="presentation"
          >
            {/* min-h-full flex centering + safe-area padding: the panel is never
                clipped on short / landscape / notched screens, and long panels
                scroll the backdrop rather than overflowing the viewport. */}
            <div
              className="flex min-h-full items-center justify-center p-[max(1.5rem,env(safe-area-inset-top))]"
            >
              <motion.div
                className={`glow-box relative w-full ${
                  size === 'xl' ? 'max-w-2xl' : size === 'lg' ? 'max-w-lg' : 'max-w-md'
                } bg-quantum p-6 sm:p-8`}
                initial={{ opacity: 0, scale: 0.95, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 12 }}
                transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby={labelledBy}
              >
                {!hideCloseButton && (
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    className="absolute right-4 top-4 z-10 flex h-7 w-7 items-center justify-center border border-accent/40 bg-quantum/80 text-accent transition-colors hover:border-accent"
                  >
                    <X size={14} />
                  </button>
                )}
                {children}
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </ModalPortal>
  );
}
