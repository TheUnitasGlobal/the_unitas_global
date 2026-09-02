'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { AnimatePresence, motion } from 'framer-motion';
import { Search, Sparkles, X, ArrowRight } from 'lucide-react';
import { useSpatialAudio } from '@/components/audio/SpatialAudioProvider';
import { analyzeSurface } from '@/lib/uai/heuristics';
import type { HotShortcutAxis } from '@/lib/hotIssues';

interface HotShortcutResultModalProps {
  shortcut: HotShortcutAxis | null;
  onClose: () => void;
}

interface ChainTier {
  id: string;
  /** null for the seed tier (the shortcut itself has no "query text" header --
   *  its own colored title is shown instead). */
  query: string | null;
  title: string;
  description: string;
  color: string;
  glow: string;
  axisBadge?: string;
  shieldBadge?: string;
}

/**
 * The multi-tier chained U-AI popup opened by HotShortcutMatrixStrip. Each
 * tap on a governance-axis or hot-issue tile seeds tier 0 with that axis's
 * static, translated title+description (colored/highlighted per the axis's
 * palette). The chain-query box at the bottom feeds free-tier
 * `analyzeSurface` (same zero-cost client heuristic OmniSynapseSearch's main
 * search bar uses -- no coin burn, no network call) and stacks the result as
 * a new tier below, so one tap can spiral into an open-ended reading chain
 * without ever leaving this one popup. Deliberately separate from
 * GovernanceLadderModal (which stays a pure 16-axis stepper for Section 4) --
 * this surface is a search result, not a doctrine reference page.
 */
export function HotShortcutResultModal({ shortcut, onClose }: HotShortcutResultModalProps) {
  const tGovernance = useTranslations('Governance');
  const tHotIssue = useTranslations('HotIssue');
  const tUai = useTranslations('UAI');
  const tEcosystems = useTranslations('Ecosystems');
  const tModal = useTranslations('HotShortcutModal');
  const { playHoverSfx, playQuestEnterSfx, playTypingTick } = useSpatialAudio();

  const [chain, setChain] = useState<ChainTier[]>([]);
  const [chainQuery, setChainQuery] = useState('');
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const open = shortcut !== null;

  useEffect(() => {
    if (!shortcut) {
      setChain([]);
      setChainQuery('');
      return;
    }
    const title =
      shortcut.group === 'hotIssue'
        ? tHotIssue(`axes.${shortcut.messageKey}.title`)
        : tGovernance(`axes.${shortcut.messageKey}.title`);
    const description =
      shortcut.group === 'hotIssue'
        ? tHotIssue(`axes.${shortcut.messageKey}.description`)
        : tGovernance(`axes.${shortcut.messageKey}.description`);
    setChain([
      { id: shortcut.key, query: null, title, description, color: shortcut.color, glow: shortcut.glow },
    ]);
    setChainQuery('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shortcut]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (chain.length > 1) bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [chain.length]);

  function handleChainSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = chainQuery.trim();
    if (!trimmed) return;
    const report = analyzeSurface(trimmed, (k) => tEcosystems(k));
    const seedColor = shortcut?.color ?? '#22d3ee';
    const seedGlow = shortcut?.glow ?? '#67e8f9';
    playQuestEnterSfx();
    setChain((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${trimmed}`,
        query: trimmed,
        title: trimmed,
        description: tUai('constitutionAxisNote', { axis: tUai(`constitution.${report.redesignAxis}`) }),
        color: seedColor,
        glow: seedGlow,
        axisBadge: tUai(`constitution.${report.topConstitutionAxis}`),
        shieldBadge: tUai(`shield.${report.shield.verdict}`),
      },
    ]);
    setChainQuery('');
  }

  return (
    <AnimatePresence>
      {open && shortcut && (
        <motion.div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-void/85 p-4 backdrop-blur-md sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          role="presentation"
        >
          <motion.div
            className="relative flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden border bg-quantum/95"
            style={{
              borderColor: `${shortcut.color}66`,
              boxShadow: `0 0 60px ${shortcut.glow}33, inset 0 0 40px ${shortcut.color}11`,
            }}
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 16 }}
            transition={{ type: 'spring', stiffness: 300, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="hot-shortcut-result-title"
          >
            {/* Header -- literal HUD-style badge, matching the site's existing
                English telemetry labels (SYN-LOAD, NODES, ...) regardless of
                locale, per owner's exact copy. */}
            <div
              className="flex shrink-0 items-center justify-between border-b px-5 py-4 sm:px-6"
              style={{ borderColor: `${shortcut.color}33` }}
            >
              <p
                id="hot-shortcut-result-title"
                className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.3em]"
                style={{ color: shortcut.color, textShadow: `0 0 16px ${shortcut.glow}55` }}
              >
                <Sparkles size={13} aria-hidden="true" />
                U-AI SEARCH RESULT
              </p>
              <button
                type="button"
                onClick={onClose}
                aria-label={tModal('closeAria')}
                className="flex h-7 w-7 shrink-0 items-center justify-center border text-xs"
                style={{ borderColor: `${shortcut.color}55`, color: shortcut.color }}
              >
                <X size={14} />
              </button>
            </div>

            {/* Chained tier stack -- tier 0 is the tapped axis, every tier
                after it is a follow-up free-tier U-AI read stacked below. */}
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
              {chain.map((tier, i) => (
                <motion.div
                  key={tier.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22 }}
                  className="border bg-void/40 p-4"
                  style={{ borderColor: `${tier.color}44` }}
                >
                  <div className="mb-2 flex items-center gap-2">
                    {i > 0 && <Search size={14} style={{ color: tier.color }} aria-hidden="true" />}
                    {i === 0 && shortcut.icon && (
                      <shortcut.icon size={18} style={{ color: tier.color }} aria-hidden="true" />
                    )}
                    <h2
                      className="font-serif text-base font-bold text-white sm:text-lg"
                      style={{ textShadow: `0 0 16px ${tier.glow}55` }}
                    >
                      {tier.title}
                    </h2>
                  </div>
                  {(tier.axisBadge || tier.shieldBadge) && (
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      {tier.axisBadge && (
                        <span
                          className="border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest"
                          style={{ color: tier.color, borderColor: `${tier.color}55` }}
                        >
                          {tier.axisBadge}
                        </span>
                      )}
                      {tier.shieldBadge && (
                        <span className="border border-white/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                          {tier.shieldBadge}
                        </span>
                      )}
                    </div>
                  )}
                  <p
                    className="border-l-2 pl-3 text-[13px] leading-relaxed text-gray-300 sm:text-[14px]"
                    style={{ borderColor: `${tier.color}88` }}
                  >
                    {tier.description}
                  </p>
                </motion.div>
              ))}
              <div ref={bottomRef} />
            </div>

            {/* Chain-query box -- the "다단 연쇄" entry point: each submit
                stacks a new tier above, all inside this one popup. */}
            <form
              onSubmit={handleChainSubmit}
              className="shrink-0 border-t px-5 py-4 sm:px-6"
              style={{ borderColor: `${shortcut.color}33` }}
            >
              <p className="mb-2 text-[11px] text-gray-500">{tModal('chainHint')}</p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={chainQuery}
                  onChange={(e) => {
                    setChainQuery(e.target.value);
                    playTypingTick();
                  }}
                  placeholder={tModal('chainPlaceholder')}
                  className="w-full border border-white/15 bg-void/60 px-3 py-2.5 text-sm text-white placeholder:text-gray-500 focus:border-white/30 focus:outline-none"
                />
                <button
                  type="submit"
                  onMouseEnter={() => playHoverSfx()}
                  disabled={!chainQuery.trim()}
                  aria-label={tModal('chainSubmitAria')}
                  className="flex shrink-0 items-center justify-center border px-3 py-2.5 transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                  style={{ borderColor: `${shortcut.color}66`, color: shortcut.color }}
                >
                  <ArrowRight size={16} aria-hidden="true" />
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
