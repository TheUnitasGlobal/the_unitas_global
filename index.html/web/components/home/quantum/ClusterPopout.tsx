'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { useTranslations } from 'next-intl';
import { X, ChevronLeft } from 'lucide-react';
import { ModalPortal } from '@/components/ui/ModalPortal';
import { releaseGate } from '@/lib/uiGate';
import { playHapticTic } from '@/lib/audio/haptics';
import type { ClusterModule, SingularityCluster } from '@/lib/quantumWhite/clusters';
import type { Precache } from '@/lib/quantumWhite/precache';
import { EntryGate } from './EntryGate';

/** Must match `SingularityCoreGrid`'s gate id -- released the moment this closes. */
const CLUSTER_GATE_ID = 'qw-cluster';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface ClusterPopoutProps {
  cluster: SingularityCluster | null;
  onClose: () => void;
  /** REV-17 (SPEC.md §3.4): fires on every open/close of the Entry Gate view -- `SingularityCoreGrid` is the sole writer of the mirrored surface state (URL hash + sessionStorage + visit ledger), this is just the notification. */
  onModuleChange: (moduleId: string | null) => void;
  /** REV-17: the module id to open straight into on this cluster's FIRST mount (a restored or deep-linked surface) -- consumed once, ignored on any later re-open of the same cluster. */
  initialModuleId: string | null;
  precache: Precache;
}

function resolveModuleTitle(m: ClusterModule, tFull: ReturnType<typeof useTranslations>): string {
  return m.i18n.titleKey ? tFull(m.i18n.titleKey) : m.literalTitle ?? '';
}

/**
 * REV-13 cluster pop-out (spec §3, §10.10-11): a `role="dialog"` layer
 * rendered through `ModalPortal` at the fixed z-200 base layer, with a
 * Frost-Glass backdrop and a CSS-3D entrance. Because the component returns
 * `null` while `cluster` is `null`, every open is a fresh DOM mount -- the
 * entrance keyframe (quantum-white.css) replays every time without needing
 * framer-motion.
 *
 * REV-17 (SPEC.md §5, §6): the tile grid view lost its counter/instructional
 * header and its kind-badge/coin-chip tiles in favour of curiosity-inducing
 * riddle copy; opening a tile now switches the SAME panel into a second
 * VIEW (`data-view="entry"`) rendering `EntryGate` behind a shared header
 * that swaps a cluster title for a back button + module identity, rather
 * than sliding a side panel in next to the grid.
 */
export function ClusterPopout({ cluster, onClose, onModuleChange, initialModuleId, precache }: ClusterPopoutProps) {
  const t = useTranslations('QuantumWhite');
  const tFull = useTranslations();
  const panelRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<Element | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const onModuleChangeRef = useRef(onModuleChange);
  onModuleChangeRef.current = onModuleChange;
  const [activeModuleId, setActiveModuleId] = useState<string | null>(null);

  const activeModule = useMemo(
    () => (cluster && activeModuleId ? cluster.modules.find((m) => m.id === activeModuleId) ?? null : null),
    [cluster, activeModuleId],
  );

  // A different cluster (or a fresh open of the same one) starts on the
  // tile grid, UNLESS a restored/deep-linked surface named a module to open
  // straight into (REV-17, SPEC.md §3.4) -- consumed here, once.
  useEffect(() => {
    setActiveModuleId(initialModuleId ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deliberately
    // keyed to `cluster?.key` only: `initialModuleId` is a one-shot seed
    // read at the moment this cluster opens, not a controlled value the
    // parent keeps re-pushing on every render.
  }, [cluster?.key]);

  // Focus trap + inert background + ESC handling while the dialog is open.
  useEffect(() => {
    if (!cluster) return undefined;

    openerRef.current = document.activeElement;
    const nav = document.getElementById('unitas-nav');
    const main = document.querySelector('main');
    nav?.setAttribute('inert', '');
    nav?.setAttribute('aria-hidden', 'true');
    main?.setAttribute('inert', '');
    main?.setAttribute('aria-hidden', 'true');

    const firstFocusable = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    firstFocusable?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented) return;
      if (event.key === 'Escape') {
        event.stopPropagation();
        // Always closes the whole dialog (matches components/ui/Modal.tsx) --
        // the dedicated "Back" button is the one-level-back affordance for
        // the module panel, so ESC's behaviour never depends on a value this
        // effect (intentionally scoped to `[cluster]`, see below) would
        // otherwise read from a stale closure.
        onCloseRef.current();
        return;
      }
      if (event.key === 'Tab' && panelRef.current) {
        const focusables = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
          (el) => el.offsetParent !== null,
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }
    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      nav?.removeAttribute('inert');
      nav?.removeAttribute('aria-hidden');
      main?.removeAttribute('inert');
      main?.removeAttribute('aria-hidden');
      releaseGate(CLUSTER_GATE_ID);
      if (openerRef.current instanceof HTMLElement) openerRef.current.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deliberately scoped to
    // `cluster` only: re-running this on every keystroke-driven `activeModuleId` change
    // would re-grab focus and re-toggle `inert` mid-interaction. ESC always reads
    // `onCloseRef.current`, so it never sees a stale `onClose` closure.
  }, [cluster]);

  function handleTileOpen(m: ClusterModule) {
    playHapticTic();
    setActiveModuleId(m.id);
    onModuleChangeRef.current(m.id);
  }

  function handleBack() {
    setActiveModuleId(null);
    onModuleChangeRef.current(null);
  }

  if (!cluster) return null;

  const title = tFull(cluster.titleKey);

  return (
    <ModalPortal>
      <div
        className="qw-popout-backdrop fixed inset-0 z-[200] flex items-center justify-center p-6"
        role="presentation"
        onClick={onClose}
      >
        <div
          ref={panelRef}
          className="qw-popout-panel relative flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-[22px] bg-[var(--qw-bg)] shadow-[0_30px_80px_rgba(10,10,12,.22)]"
          data-view={activeModule ? 'entry' : 'grid'}
          role="dialog"
          aria-modal="true"
          aria-labelledby="qw-popout-title"
          onClick={(event) => event.stopPropagation()}
        >
          <header
            className="qw-popout-header flex items-center justify-between gap-4 border-b border-[var(--qw-line)] px-7 pb-5"
            style={{ paddingTop: 'max(1.5rem, var(--u-safe-top))' }}
          >
            {activeModule ? (
              <>
                <button
                  type="button"
                  className="unitas-tap qw-entry-back flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--qw-line)] text-[var(--qw-ink-2)] transition-colors hover:border-[var(--qw-ink-3)] hover:text-[var(--qw-ink)]"
                  onClick={handleBack}
                  aria-label={t('entry.back')}
                >
                  <ChevronLeft size={18} />
                </button>
                <div className="qw-entry-ident flex min-w-0 flex-1 items-center gap-3">
                  <span
                    className="qw-tile-medallion shrink-0"
                    aria-hidden="true"
                    style={{ '--qw-tile-accent': activeModule.color } as CSSProperties}
                  >
                    <activeModule.icon size={18} strokeWidth={1.75} />
                  </span>
                  <div className="min-w-0">
                    <p className="qw-entry-eyebrow">{title}</p>
                    <h2 id="qw-popout-title" className="truncate font-serif text-lg font-bold text-[var(--qw-ink)] md:text-xl">
                      {resolveModuleTitle(activeModule, tFull)}
                    </h2>
                  </div>
                </div>
              </>
            ) : (
              <div className="min-w-0">
                <h2 id="qw-popout-title" className="font-serif text-xl font-bold text-[var(--qw-ink)] md:text-2xl">
                  {title}
                </h2>
                <p className="qw-popout-enigma">{tFull(cluster.enigmaKey)}</p>
              </div>
            )}
            <button
              type="button"
              className="unitas-tap flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--qw-line)] text-[var(--qw-ink-2)] transition-colors hover:border-[var(--qw-ink-3)] hover:text-[var(--qw-ink)]"
              onClick={onClose}
              aria-label={t('closeCluster')}
            >
              <X size={18} />
            </button>
          </header>

          {activeModule ? (
            <EntryGate module={activeModule} />
          ) : (
            <div className="qw-popout-body flex flex-1 overflow-hidden px-7 pb-7 pt-6">
              <div className="qw-tile-grid grid flex-1 overflow-y-auto pb-2">
                {cluster.modules.map((m) => (
                  <ModuleTile
                    key={m.id}
                    module={m}
                    onOpen={() => handleTileOpen(m)}
                    onWarm={() => precache.warmModule(m)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </ModalPortal>
  );
}

interface ModuleTileProps {
  module: ClusterModule;
  onOpen: () => void;
  onWarm: () => void;
}

/** One sub-module tile inside the pop-out, with a CSS-only 3D pointer tilt (no libraries). */
function ModuleTile({ module, onOpen, onWarm }: ModuleTileProps) {
  const tFull = useTranslations();
  const ref = useRef<HTMLButtonElement>(null);
  const reduceMotionRef = useRef(false);

  useEffect(() => {
    try {
      reduceMotionRef.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      reduceMotionRef.current = false;
    }
  }, []);

  function handlePointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    if (reduceMotionRef.current) return;
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const relX = (event.clientX - rect.left) / rect.width - 0.5;
    const relY = (event.clientY - rect.top) / rect.height - 0.5;
    el.style.setProperty('--qw-tilt-x', `${(relY * -6).toFixed(2)}deg`);
    el.style.setProperty('--qw-tilt-y', `${(relX * 6).toFixed(2)}deg`);
  }

  function resetTilt() {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty('--qw-tilt-x', '0deg');
    el.style.setProperty('--qw-tilt-y', '0deg');
  }

  const Icon = module.icon;
  const title = resolveModuleTitle(module, tFull);
  const riddle = tFull(module.i18n.riddleKey);
  const style = { '--qw-tile-accent': module.color } as CSSProperties;

  return (
    <button
      ref={ref}
      type="button"
      data-kind={module.kind}
      className="qw-tile unitas-tap rounded-2xl border border-[var(--qw-line)] bg-[var(--qw-bg-2)]"
      style={style}
      onPointerEnter={onWarm}
      onFocus={onWarm}
      onPointerMove={handlePointerMove}
      onPointerLeave={resetTilt}
      onClick={onOpen}
    >
      <span className="qw-tile-head">
        <span className="qw-tile-medallion" aria-hidden="true">
          <Icon size={18} strokeWidth={1.75} />
        </span>
        <span className="qw-tile-title">{title}</span>
      </span>
      <span className="qw-tile-riddle">{riddle}</span>
      <span className="qw-tile-cue" aria-hidden="true" />
    </button>
  );
}
