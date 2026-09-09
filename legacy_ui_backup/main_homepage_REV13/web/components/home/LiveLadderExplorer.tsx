'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronRight, CornerDownLeft, Globe, Layers, Loader2, Route, Sparkles, X } from 'lucide-react';
import { HOT_SHORTCUT_MATRIX, axisTitle, type AxisTranslators, type HotShortcutAxis, type ShortcutGroup } from '@/lib/hotIssues';
import { fetchLiveSuggestions } from '@/lib/uai/liveSuggest';
import { isChoseongJamo } from '@/lib/hangul';
import { useSpatialAudio } from '@/components/audio/SpatialAudioProvider';

/** Which family of vectors a ladder step was picked from. */
type VectorKind = 'axis' | 'constitution' | 'lens' | 'live';

interface LadderStep {
  kind: VectorKind;
  key: string;
  label: string;
  /** Only for `axis` steps -- opens the infinite knowledge ladder directly. */
  axis?: HotShortcutAxis;
}

const CONSTITUTION_KEYS = ['logic', 'future', 'economy', 'security', 'sovereign', 'art'] as const;
const LENS_KEYS = ['tech', 'economy', 'opinion'] as const;
// The old standalone "governance" tab is gone (owner instruction
// 2026-09-03): its 16 axes now live inside hotIssue/finance/career or the
// new "civic" group, so they already ride along here as ordinary tabs.
const MATRIX_GROUPS: ShortcutGroup[] = ['hotIssue', 'finance', 'realEstate', 'dating', 'career', 'civic'];
const MAX_DEPTH = 6;
const LIVE_DEBOUNCE_MS = 260;

interface LiveLadderExplorerProps {
  /** The bar's current (trimmed) query -- the ladder's root node. */
  query: string;
  axisT: AxisTranslators;
  onOpenAxis: (axis: HotShortcutAxis) => void;
  /** Runs the U-AI surface search for the composed path. */
  onRunQuery: (q: string) => void;
}

/**
 * "실시간 사다리 탐색" (owner instruction 2026-09-03): a sub-interface tied
 * to the live keyword results, where the visitor climbs from the typed root
 * through more specific, multi-angle *vectors* -- the 30-axis shortcut
 * matrix, the six constitution axes, the three stereoscopic lenses, and
 * live related keywords for the path composed so far -- and lands on a
 * result either as a U-AI search of the whole path or as the knowledge-
 * ladder tower of the last matrix axis. Every step is a chip in the
 * breadcrumb, so a wrong turn is one tap back. Renders between the live
 * results and the unchanged shortcut strip, never in place of them.
 */
export function LiveLadderExplorer({ query, axisT, onOpenAxis, onRunQuery }: LiveLadderExplorerProps) {
  const t = useTranslations('OmniSynapse');
  const tUai = useTranslations('UAI');
  const locale = useLocale();
  const { playHoverSfx, playTypingTick } = useSpatialAudio();

  const [path, setPath] = useState<LadderStep[]>([]);
  const [activeGroup, setActiveGroup] = useState<ShortcutGroup>('hotIssue');
  const [live, setLive] = useState<string[]>([]);
  const [liveLoading, setLiveLoading] = useState(false);

  // A new root query starts a new climb -- a stale path under a fresh root
  // would compose nonsense.
  useEffect(() => {
    setPath([]);
  }, [query]);

  const composed = useMemo(() => [query, ...path.map((s) => s.label)].join(' ').trim(), [query, path]);
  const lastAxis = path.length > 0 ? path[path.length - 1].axis : undefined;

  // Live related keywords for the composed path -- prefix search on the
  // visitor's own wiki, debounced so climbing several rungs quickly only
  // pays for the last one. A lone 초성 root ('ㅅ') is skipped: nothing useful
  // prefix-matches half a syllable.
  useEffect(() => {
    const chars = Array.from(composed);
    if (chars.length === 0 || chars.every((c) => isChoseongJamo(c) || c === ' ')) {
      setLive([]);
      setLiveLoading(false);
      return;
    }
    const controller = new AbortController();
    setLiveLoading(true);
    const timer = setTimeout(() => {
      fetchLiveSuggestions(composed, locale, controller.signal, 8)
        .then((list) => {
          if (controller.signal.aborted) return;
          const chosen = new Set(path.map((s) => s.label.toLowerCase()));
          setLive(
            list
              .map((s) => s.title)
              .filter((title) => title.toLowerCase() !== composed.toLowerCase() && !chosen.has(title.toLowerCase()))
              .slice(0, 6),
          );
        })
        .finally(() => {
          if (!controller.signal.aborted) setLiveLoading(false);
        });
    }, LIVE_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [composed, locale, path]);

  function push(step: LadderStep) {
    if (path.length >= MAX_DEPTH) return;
    if (path.some((s) => s.kind === step.kind && s.key === step.key)) return;
    playTypingTick();
    setPath((prev) => [...prev, step]);
  }

  function popTo(index: number) {
    playTypingTick();
    setPath((prev) => prev.slice(0, index));
  }

  const chip =
    'flex shrink-0 items-center gap-1.5 border px-2.5 py-1.5 text-[12px] font-semibold transition-colors sm:text-[13px]';
  const idleChip = `${chip} border-white/15 bg-void/40 text-gray-300 hover:border-white/35 hover:text-white`;

  return (
    <div className="border border-white/10 bg-white/[0.03] px-4 py-4 sm:px-6">
      {/* Breadcrumb: root query, then every vector chosen so far. */}
      <div className="mb-3 flex flex-wrap items-center gap-1.5" aria-label={t('ladderRoot')}>
        <span className="flex items-center gap-1.5 border border-accent/50 bg-accent/10 px-2.5 py-1.5 text-[12px] font-bold text-accent sm:text-[13px]">
          <Route size={13} aria-hidden="true" />
          {query}
        </span>
        <AnimatePresence initial={false}>
          {path.map((step, i) => (
            <motion.button
              key={`${step.kind}:${step.key}`}
              type="button"
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -6 }}
              transition={{ duration: 0.15 }}
              onMouseEnter={() => playHoverSfx()}
              onClick={() => popTo(i)}
              title={t('ladderPopHint')}
              className="flex items-center gap-1 text-[12px] font-semibold text-white sm:text-[13px]"
            >
              <ChevronRight size={13} className="text-gray-500" aria-hidden="true" />
              <span className="flex items-center gap-1 border border-white/25 bg-white/[0.06] px-2.5 py-1.5">
                {step.label}
                <X size={11} className="text-gray-500" aria-hidden="true" />
              </span>
            </motion.button>
          ))}
        </AnimatePresence>
        {path.length > 0 && (
          <span className="ml-auto text-[10px] font-bold uppercase tracking-widest text-gray-500">
            {t('ladderDepth', { depth: path.length })}
          </span>
        )}
      </div>

      {/* Vector 1 -- the shortcut matrix, grouped by family. */}
      <div className="mb-3">
        <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-500">
          <Layers size={11} aria-hidden="true" />
          {t('ladderVectorsLabel')}
        </p>
        <div className="mb-2 flex flex-wrap gap-1.5" role="tablist">
          {MATRIX_GROUPS.map((group) => (
            <button
              key={group}
              type="button"
              role="tab"
              aria-selected={activeGroup === group}
              onMouseEnter={() => playHoverSfx()}
              onClick={() => setActiveGroup(group)}
              className={`border px-2.5 py-1 text-[11px] font-bold uppercase tracking-widest transition-colors ${
                activeGroup === group
                  ? 'border-accent bg-accent/15 text-accent'
                  : 'border-white/10 text-gray-500 hover:border-white/30 hover:text-white'
              }`}
            >
              {t(`tab.${group}`)}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {HOT_SHORTCUT_MATRIX.filter((axis) => axis.group === activeGroup).map((axis) => {
            const label = axisTitle(axis, axisT);
            return (
              <button
                key={axis.key}
                type="button"
                onMouseEnter={() => playHoverSfx()}
                onClick={() => push({ kind: 'axis', key: `${axis.group}:${axis.key}`, label, axis })}
                style={{ borderColor: `${axis.color}55` }}
                className={`${chip} bg-void/40 text-gray-200 hover:bg-void/70 hover:text-white`}
              >
                <axis.icon size={13} style={{ color: axis.color }} aria-hidden="true" />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Vector 2 -- the expanded flat vector pool: constitution axes and
          stereoscopic lenses, every one a single-word box with no group tabs.
          The old flat 16-item governance dump that used to sit here is gone
          (owner instruction 2026-09-03) -- those axes now ride the tabbed
          matrix above like every other group. */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {CONSTITUTION_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            onMouseEnter={() => playHoverSfx()}
            onClick={() => push({ kind: 'constitution', key, label: tUai(`constitution.${key}`) })}
            className={idleChip}
          >
            <Sparkles size={12} className="text-accent" aria-hidden="true" />
            {tUai(`constitution.${key}`)}
          </button>
        ))}
        {LENS_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            onMouseEnter={() => playHoverSfx()}
            onClick={() => push({ kind: 'lens', key, label: tUai(`lens.${key}`) })}
            className={idleChip}
          >
            {tUai(`lens.${key}`)}
          </button>
        ))}
      </div>

      {/* Vector 4 -- live related keywords for the composed path. */}
      <div className="mb-4">
        <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-500">
          <Globe size={11} aria-hidden="true" />
          {t('ladderLiveLabel')}
          {liveLoading && <Loader2 size={11} className="animate-spin text-accent" aria-hidden="true" />}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {live.length === 0 && !liveLoading && (
            <span className="text-[12px] text-gray-500">{t('noBrowseMatches')}</span>
          )}
          {live.map((title) => (
            <button
              key={title}
              type="button"
              onMouseEnter={() => playHoverSfx()}
              onClick={() => push({ kind: 'live', key: title, label: title })}
              className={`${chip} border-neon/30 bg-neon/[0.05] text-gray-200 hover:border-neon/60 hover:text-white`}
            >
              {title}
            </button>
          ))}
        </div>
      </div>

      {/* Reach the result: the whole path as one U-AI search, or the last
          matrix axis's knowledge-ladder tower. The hint sits directly above
          the button it explains rather than floating at the top of the
          card, separated from the action by the entire vector picker. */}
      <p className="mb-1.5 text-[12px] text-gray-400">{t('ladderVectorHint')}</p>
      <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
        <span className="min-w-0 flex-1 truncate text-[12px] text-gray-400" title={composed}>
          {composed}
        </span>
        {lastAxis && (
          <button
            type="button"
            onMouseEnter={() => playHoverSfx()}
            onClick={() => onOpenAxis(lastAxis)}
            style={{ borderColor: `${lastAxis.color}88`, color: lastAxis.color }}
            className="flex shrink-0 items-center gap-1.5 border px-3 py-1.5 text-[12px] font-bold transition-colors hover:bg-white/5"
          >
            <lastAxis.icon size={13} aria-hidden="true" />
            {t('ladderOpenAxis')}
          </button>
        )}
        <button
          type="button"
          onMouseEnter={() => playHoverSfx()}
          onClick={() => onRunQuery(composed)}
          className="flex shrink-0 items-center gap-1.5 border border-accent/60 bg-accent/10 px-3 py-1.5 text-[12px] font-bold text-accent transition-colors hover:bg-accent/20"
        >
          <CornerDownLeft size={13} aria-hidden="true" />
          {t('ladderReach')}
        </button>
      </div>
    </div>
  );
}
