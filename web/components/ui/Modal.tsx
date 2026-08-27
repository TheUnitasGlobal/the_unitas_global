'use client';

import { motion } from 'framer-motion';
import { type ReactNode } from 'react';
import { X } from 'lucide-react';
import { ModalPortal } from './ModalPortal';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  labelledBy?: string;
}

/**
 * Shared overlay/dialog shell used by the app-download, wallet, auth,
 * account, quest and inquiry modals. Positioning, scroll safety, the
 * backdrop click-to-close and Escape all live in <ModalPortal> (rendered
 * into <body>, above `.dashboard-zoom`); this component only supplies the
 * panel chrome and close button.
 */
export function Modal({ open, onClose, children, labelledBy }: ModalProps) {
  return (
    <ModalPortal open={open} onClose={onClose}>
      <motion.div
        className="glow-box relative my-2 w-full max-w-md bg-quantum p-8"
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center border border-accent/40 text-accent transition-colors hover:border-accent"
        >
          <X size={14} />
        </button>
        {children}
      </motion.div>
    </ModalPortal>
  );
}
