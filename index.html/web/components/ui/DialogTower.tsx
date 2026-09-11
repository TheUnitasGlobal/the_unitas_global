'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Home, RefreshCw, Sparkles, X } from 'lucide-react';
import { ModalPortal } from '@/components/ui/ModalPortal';
import { useHistoryLayer } from '@/components/ui/useHistoryLayer';

export interface DialogTowerLabels {
  refresh: string;
  home: string;
  back: string;
  close: string;
}

interface DialogTowerProps {
  open: boolean;
  /** HUD title, left slot of the toolbar (brand English, not localized). */
  title: string;
  titleId?: string;
  accent: string;
  accentGlow: string;
  /** REV-20 §5.1: `nav-anchored` (default, unchanged REV-19 behaviour) spans
   *  nav-bottom -> screen-bottom, same as every other tower. `fullscreen`
   *  spans the true viewport top -> bottom, covering the nav -- reserved for
   *  the post-submit U-AI search result. The class names this relies on
   *  (`z-[120]`, the panel's `bg-quantum/95` + `role="dialog"`) are
   *  deliberately left untouched by this prop so the Quantum White portal
   *  remap in quantum-white-rev19.css (§17, keyed on those exact classes)
   *  keeps matching both variants without modification. */
  variant?: 'nav-anchored' | 'fullscreen';
  /** history.state marker so the device back gesture closes this tower
   *  without ejecting the visitor off the site (unique per tower kind). */
  historyMarker: string;
  /** Localized tooltip strings -- every toolbar control carries the same
   *  string as BOTH title and aria-label (이중 툴팁), identical across the
   *  shortcut and search towers. */
  labels: DialogTowerLabels;
  refreshing?: boolean;
  onRefresh?: () => void;
  onBack: () => void;
  onHome: () => void;
  onClose: () => void;
  onButtonHover?: () => void;
  children: ReactNode;
}

/**
 * The shared full-size "dialogue tower" shell: a 100%-width overlay sealed
 * from directly under the top nav bar (#unitas-nav) down to the bottom edge
 * of the screen, with the unified toolbar
 * [title / 갱신 / 홈으로 복귀 / 뒤로 가기 / 창닫기] pinned on top. Both the
 * shortcut-ladder popup and the U-AI live-search popup render through this
 * one frame, so their chrome can never drift apart. The backdrop deliberately
 * does NOT close on click -- leaving is always an explicit toolbar tap, the
 * Escape key, or the device's own back gesture.
 */
export function DialogTower({
  open,
  title,
  titleId,
  accent,
  accentGlow,
  historyMarker,
  labels,
  variant = 'nav-anchored',
  refreshing = false,
  onRefresh,
  onBack,
  onHome,
  onClose,
  onButtonHover,
  children,
}: DialogTowerProps) {
  /** Stable handle on onClose -- parents pass fresh arrows every render, and
   *  the history/keyboard effects below must not re-run on each of those. */
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  /** Live top edge: the nav bar's bottom in true viewport pixels (the tower
   *  portals to document.body, outside the .dashboard-zoom wrapper). */
  const [top, setTop] = useState(0);

  useEffect(() => {
    if (!open) return;
    if (variant === 'fullscreen') {
      setTop(0);
      return;
    }
    const measure = () => {
      const nav = document.getElementById('unitas-nav');
      setTop(nav ? Math.max(0, nav.getBoundingClientRect().bottom) : 0);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [open, variant]);

  // The tower is fixed and fills the viewport below the nav -- freeze the
  // page behind it so the backdrop and panel never drift mid-interaction.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // Mobile/desktop hardware & browser back (REV-19 §1): the tower is one
  // layer on the site-wide deep modal history stack -- the device's own
  // back gesture closes it (and only it), an explicit toolbar close walks
  // history back over its entry so no dead entry is left behind, and a
  // popup opened on top of it (a ranking detail, a legal notice) closes
  // first on the next back press.
  const layer = useHistoryLayer(open, historyMarker, () => onCloseRef.current());

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      // REV-19: only the topmost layer answers Escape (a ranking profile
      // or legal notice opened inside the tower closes first), and the exit
      // confirm's consumed press (defaultPrevented) is left alone.
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      if (!layer.isTop()) return;
      onCloseRef.current();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, layer]);

  const buttonClass =
    'flex h-9 w-9 shrink-0 items-center justify-center border transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50';
  const buttonStyle = { borderColor: `${accent}55`, color: accent };

  return (
    <ModalPortal>
      <AnimatePresence>
        {open && (
          <motion.div
            key="dialog-tower"
            className="fixed inset-x-0 bottom-0 z-[120]"
            style={{ top }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Backdrop seal -- swallows every click/tap so everything under
                the tower is completely inert while it is up; deliberately NOT
                wired to onClose. The nav bar above stays live. */}
            <div className="absolute inset-0 bg-void/85 backdrop-blur-md" role="presentation" aria-hidden="true" />

            {/* Full-size panel: nav-anchored spans nav bottom -> screen
                bottom; fullscreen spans true viewport top -> bottom (top is
                forced to 0 above), covering the nav entirely. 전폭 100%
                either way. */}
            <motion.div
              className={`absolute inset-0 flex flex-col overflow-hidden bg-quantum/95 ${variant === 'fullscreen' ? '' : 'border-t'}`}
              style={{
                borderColor: `${accent}66`,
                boxShadow: `0 -24px 90px ${accentGlow}22, inset 0 0 40px ${accent}0d`,
              }}
              initial={{ opacity: 0, y: 36 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 36 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
            >
              {/* Unified toolbar: [title / 갱신 / 홈으로 복귀 / 뒤로 가기 /
                  창닫기], every control double-tooltipped (title +
                  aria-label), identical in both towers. */}
              <div
                className="flex shrink-0 items-center gap-2 border-b px-2.5 py-3 sm:px-4"
                style={{ borderColor: `${accent}33` }}
              >
                <p
                  id={titleId}
                  title={title}
                  className="flex min-w-0 items-center gap-2 text-[13px] font-bold uppercase tracking-[0.3em]"
                  style={{ color: accent, textShadow: `0 0 16px ${accentGlow}55` }}
                >
                  <Sparkles size={13} className="shrink-0" aria-hidden="true" />
                  <span className="truncate">{title}</span>
                </p>
                <div className="ml-auto flex shrink-0 items-center gap-2">
                  {onRefresh && (
                    <button
                      type="button"
                      onClick={onRefresh}
                      onMouseEnter={() => onButtonHover?.()}
                      disabled={refreshing}
                      title={labels.refresh}
                      aria-label={labels.refresh}
                      className={buttonClass}
                      style={buttonStyle}
                    >
                      <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} aria-hidden="true" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onHome}
                    onMouseEnter={() => onButtonHover?.()}
                    title={labels.home}
                    aria-label={labels.home}
                    className={buttonClass}
                    style={buttonStyle}
                  >
                    <Home size={15} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={onBack}
                    onMouseEnter={() => onButtonHover?.()}
                    title={labels.back}
                    aria-label={labels.back}
                    className={buttonClass}
                    style={buttonStyle}
                  >
                    <ArrowLeft size={15} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    onMouseEnter={() => onButtonHover?.()}
                    title={labels.close}
                    aria-label={labels.close}
                    className={buttonClass}
                    style={buttonStyle}
                  >
                    <X size={16} aria-hidden="true" />
                  </button>
                </div>
              </div>

              {children}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </ModalPortal>
  );
}
