'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Home, RefreshCw, Sparkles, X } from 'lucide-react';
import { ModalPortal } from '@/components/ui/ModalPortal';

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
    const measure = () => {
      const nav = document.getElementById('unitas-nav');
      setTop(nav ? Math.max(0, nav.getBoundingClientRect().bottom) : 0);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [open]);

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

  // Mobile/desktop hardware & browser back: opening the tower parks one
  // same-URL history entry, so the device's own back gesture closes the
  // tower instead of ejecting the visitor off the site entirely. The marker
  // check keeps repeated open/close cycles from stacking entries.
  useEffect(() => {
    if (!open) return;
    try {
      const state = window.history.state as Record<string, unknown> | null;
      if (!state?.[historyMarker]) {
        window.history.pushState({ ...(state ?? {}), [historyMarker]: true }, '');
      }
    } catch {
      // history unavailable (embedded webview edge cases) -- the toolbar's
      // back/home buttons still cover navigation.
    }
    const onPop = () => onCloseRef.current();
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [open, historyMarker]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

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

            {/* Full-size panel: nav bottom -> screen bottom, 전폭 100%. */}
            <motion.div
              className="absolute inset-0 flex flex-col overflow-hidden border-t bg-quantum/95"
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
                  className="flex min-w-0 items-center gap-2 text-[11px] font-bold uppercase tracking-[0.3em]"
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
