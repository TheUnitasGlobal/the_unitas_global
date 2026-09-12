'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Search, ArrowRight, ExternalLink, X, type LucideIcon } from 'lucide-react';
import { useHistoryLayer } from '@/components/ui/useHistoryLayer';
import { useSpatialAudio } from '@/components/audio/SpatialAudioProvider';
import {
  findShortcutAxis,
  axisTitle,
  axisDescription,
  type AxisTranslators,
  type HotShortcutAxis,
  type ShortcutGroup,
} from '@/lib/hotIssues';
import { useShortcutFeed } from '@/lib/uai/useShortcutFeed';
import { loadShortcutAnalysis } from '@/lib/uai/shortcutCacheClient';
import type { AnalyticsLabels, ShortcutAnalysis } from '@/lib/uai/shortcutAnalytics';
import { formatSourceName, sourceNameOf } from '@/lib/uai/sourceName';
import type { ConstitutionAxis, ConstitutionRedesignReport, LensKey } from '@/lib/uai/types';

interface HotShortcutResultModalProps {
  shortcut: HotShortcutAxis | null;
  onClose: () => void;
}

type TierKind = 'seed' | 'ladder' | 'query' | 'keyword';

/**
 * The serializable identity of one tier -- everything needed to rebuild it
 * (title, description, colors, analysis) in ANY locale. This, not the
 * rendered tier, is what survives a next-intl locale switch: the whole
 * client tree remounts on `router.replace(pathname, {locale})`, so the
 * ladder is re-hydrated from these descriptors and every string re-resolves
 * in the new language. Nothing the visitor built is lost.
 */
type TierDescriptor =
  | { kind: 'seed' | 'ladder'; group: ShortcutGroup; key: string; depth: number }
  | { kind: 'query' | 'keyword'; query: string; depth: number; parent: string };

interface ChainTier {
  id: string;
  kind: TierKind;
  descriptor: TierDescriptor;
  /** the query this tier's engine pass runs on. */
  query: string;
  title: string;
  /** the parent tier's title, for nested (query/keyword) tiers only. */
  description: string;
  color: string;
  glow: string;
  icon?: LucideIcon;
  depth: number;
  analysis?: ShortcutAnalysis;
}

interface PersistedLadder {
  group: ShortcutGroup;
  key: string;
  tiers: TierDescriptor[];
}

/** sessionStorage slot for the whole ladder (HomeContent keeps the coarser
 *  "which shortcut is open" key; this holds what was built inside it). */
const LADDER_STORAGE_KEY = 'unitas.ouroboros.ladder.v2';
const MAX_PERSISTED_TIERS = 40;

function readLadder(): PersistedLadder | null {
  try {
    const raw = sessionStorage.getItem(LADDER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedLadder;
    return parsed && Array.isArray(parsed.tiers) ? parsed : null;
  } catch {
    return null;
  }
}

function writeLadder(next: PersistedLadder | null): void {
  try {
    if (!next) sessionStorage.removeItem(LADDER_STORAGE_KEY);
    else sessionStorage.setItem(LADDER_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // sessionStorage unavailable -- persistence is a nicety, not a requirement.
  }
}

/** Whole hours since the served snapshot was synthesized (null = local pass). */
function hoursSince(ts: number | null): number | null {
  if (!ts) return null;
  return Math.max(0, Math.floor((Date.now() - ts) / 3_600_000));
}

/**
 * REV-20 §4 -- the keyword-click deep dive. Anchored to the search bar's own
 * width (rendered by OmniSynapseSearch.tsx as a `.qw-keyword-panel` sibling
 * of the typing dropdown, NOT a portal, NEVER fullscreen -- the founder's
 * explicit boundary). Every generic/navigational block REV-19 carried
 * (sibling-axis stepper, the "restored" banner, the clickable 6-axis score
 * grid, sibling-axis keyword chips, the free-text chain-query form, the
 * pinned AppLoopRow) is gone; only content strictly about the clicked
 * keyword remains: its live web sources (up to 24 now, §6.1), the LLM-forged
 * 6-axis UNITAS deep report, and real entity keyword chips that keep
 * nesting new tiers -- the "infinite knowledge ladder" itself, now inside a
 * constrained, scrollable box instead of a fullscreen tower.
 *
 * Four ways to grow it, all endless:
 * 1. every tier's keyword chips (real entities from the live feed) nest a
 *    new tier beneath it -- and that tier yields its own chips, unbounded.
 * 2. reopening the same keyword restores exactly where the ladder left off.
 *
 * Every tier is served by the 24h sovereign caching engine (GET
 * /api/u-ai/shortcut-cache via lib/uai/shortcutCacheClient.ts) -- 0초 to
 * render, 0원 per visit, no browser-side synthesis.
 */
export function HotShortcutResultModal({ shortcut, onClose }: HotShortcutResultModalProps) {
  const locale = useLocale();
  const tCivic = useTranslations('Civic');
  const tHotIssue = useTranslations('HotIssue');
  const tFinance = useTranslations('Finance');
  const tRealEstate = useTranslations('RealEstate');
  const tDating = useTranslations('Dating');
  const tCareer = useTranslations('Career');
  const tUai = useTranslations('UAI');
  const tEcosystems = useTranslations('Ecosystems');
  const tModal = useTranslations('HotShortcutModal');
  const { playHoverSfx, playQuestEnterSfx } = useSpatialAudio();

  const axisT: AxisTranslators = {
    civic: tCivic,
    hotIssue: tHotIssue,
    finance: tFinance,
    realEstate: tRealEstate,
    dating: tDating,
    career: tCareer,
  };
  const axisTRef = useRef(axisT);
  axisTRef.current = axisT;

  const labels = useMemo<AnalyticsLabels>(
    () => ({
      ecosystems: (key: string) => tEcosystems(key),
      constitution: (axis: ConstitutionAxis) => tUai(`constitution.${axis}`),
      lens: (key: LensKey) => tUai(`lens.${key}`),
    }),
    [tEcosystems, tUai],
  );
  const labelsRef = useRef(labels);
  labelsRef.current = labels;

  const [chain, setChain] = useState<ChainTier[]>([]);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  /** Monotonic counter for tier ids -- two tiers appended within the same
   *  millisecond would otherwise collide as duplicate React keys. */
  const tierSeqRef = useRef(0);
  /** Identity of the shortcut the current chain was built for -- lets the
   *  persist effect skip the transient empty chain between open() and seed. */
  const seededForRef = useRef<string | null>(null);

  const open = shortcut !== null;
  const focus = chain.length > 0 ? chain[chain.length - 1] : null;

  const layer = useHistoryLayer(open, 'unitasKeywordPanel', onClose);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      if (!layer.isTop()) return;
      onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, layer, onClose]);

  const feed = useShortcutFeed(open && focus ? focus.query : null, locale, labels);

  const nextTierId = useCallback((label: string) => {
    tierSeqRef.current += 1;
    return `${tierSeqRef.current}-${label}`;
  }, []);

  /** Builds a renderable tier from its descriptor in the CURRENT locale. */
  const materialize = useCallback(
    (descriptor: TierDescriptor, fallbackColor: string, fallbackGlow: string): ChainTier | null => {
      if ('group' in descriptor) {
        const axis = findShortcutAxis(descriptor.group, descriptor.key);
        if (!axis) return null;
        const title = axisTitle(axis, axisTRef.current);
        return {
          id: nextTierId(axis.key),
          kind: descriptor.kind,
          descriptor,
          query: title,
          title,
          description: axisDescription(axis, axisTRef.current),
          color: axis.color,
          glow: axis.glow,
          icon: axis.icon,
          depth: descriptor.depth,
        };
      }
      return {
        id: nextTierId(descriptor.query),
        kind: descriptor.kind,
        descriptor,
        query: descriptor.query,
        title: descriptor.query,
        description: descriptor.parent,
        color: fallbackColor,
        glow: fallbackGlow,
        depth: descriptor.depth,
      };
    },
    [nextTierId],
  );

  // Seed (or re-hydrate) the ladder whenever the open shortcut changes.
  useEffect(() => {
    if (!shortcut) {
      // Only an explicit close (was open -> null) discards the persisted
      // ladder. The very first render after a locale remount is ALSO null
      // (the parent restores the open shortcut in an effect), and wiping
      // here would destroy the ladder we are about to re-hydrate.
      if (seededForRef.current !== null) writeLadder(null);
      seededForRef.current = null;
      setChain([]);
      return;
    }
    const identity = `${shortcut.group}:${shortcut.key}`;
    const saved = readLadder();
    const canRestore =
      saved !== null && saved.group === shortcut.group && saved.key === shortcut.key && saved.tiers.length > 0;

    let tiers: ChainTier[] = [];
    if (canRestore && saved) {
      tiers = saved.tiers
        .map((d) => materialize(d, shortcut.color, shortcut.glow))
        .filter((t): t is ChainTier => t !== null);
    }
    if (tiers.length === 0) {
      const seed = materialize({ kind: 'seed', group: shortcut.group, key: shortcut.key, depth: 0 }, shortcut.color, shortcut.glow);
      tiers = seed ? [seed] : [];
    }
    seededForRef.current = identity;
    setChain(tiers);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shortcut]);

  // Persist the ladder's descriptors on every change (locale-agnostic, so a
  // language switch re-hydrates every tier in the new language).
  useEffect(() => {
    if (!shortcut || !seededForRef.current || chain.length === 0) return;
    writeLadder({
      group: shortcut.group,
      key: shortcut.key,
      tiers: chain.slice(-MAX_PERSISTED_TIERS).map((t) => t.descriptor),
    });
  }, [shortcut, chain]);

  // Every non-focused tier without an analysis (i.e. restored ones) is
  // re-read from the 24h cache, sequentially so a long restored ladder is a
  // trickle of CDN hits, not a burst. The focused tier is served by the feed
  // hook below.
  useEffect(() => {
    if (!open) return;
    const missing = chain.filter((t, i) => !t.analysis && i !== chain.length - 1);
    if (missing.length === 0) return;
    let cancelled = false;
    (async () => {
      for (const tier of missing) {
        if (cancelled) return;
        const { analysis } = await loadShortcutAnalysis(tier.query, locale, labelsRef.current);
        if (cancelled) return;
        setChain((prev) => prev.map((t) => (t.id === tier.id && !t.analysis ? { ...t, analysis } : t)));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, chain.length, locale]);

  // Fold the feed's latest pass into the focused tier so it keeps its chips
  // and sources after the focus moves on to a deeper tier.
  useEffect(() => {
    if (!feed.analysis) return;
    const landed = feed.analysis;
    setChain((prev) =>
      prev.map((t, i) => (i === prev.length - 1 && t.query === landed.query ? { ...t, analysis: landed } : t)),
    );
  }, [feed.analysis]);

  useEffect(() => {
    if (chain.length > 1) bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [chain.length]);

  function appendTier(descriptor: TierDescriptor) {
    const tier = materialize(descriptor, shortcut?.color ?? '#22d3ee', shortcut?.glow ?? '#67e8f9');
    if (!tier) return;
    setChain((prev) => [...prev, tier]);
  }

  function nestKeyword(parent: ChainTier, query: string) {
    playQuestEnterSfx();
    appendTier({ kind: 'keyword', query, depth: parent.depth + 1, parent: parent.title });
  }

  /** Tapping a tier's own header steps back to it (a compact substitute for
   *  the removed toolbar back-button -- see the header close button below
   *  for the one remaining explicit control). */
  function goBackTo(index: number) {
    playHoverSfx();
    setChain((prev) => prev.slice(0, index + 1));
  }

  if (!shortcut) return null;

  const accent = shortcut.color;
  const accentGlow = shortcut.glow;
  const ShortcutIcon = shortcut.icon;

  return (
    <div
      className="qw-keyword-panel absolute top-full z-40 mt-3 flex flex-col overflow-hidden rounded-sm border bg-quantum/95 shadow-[0_30px_90px_rgba(0,0,0,0.6)] backdrop-blur-2xl"
      style={{ borderColor: `${accent}55` }}
      role="dialog"
      aria-modal="false"
      aria-labelledby="hot-shortcut-result-title"
    >
      <div className="flex shrink-0 items-center gap-2 border-b px-4 py-3" style={{ borderColor: `${accent}33` }}>
        {ShortcutIcon && <ShortcutIcon size={16} className="shrink-0" style={{ color: accent }} aria-hidden="true" />}
        <p
          id="hot-shortcut-result-title"
          title={shortcut ? axisTitle(shortcut, axisT) : ''}
          className="min-w-0 flex-1 truncate text-[14px] font-bold text-white"
        >
          {shortcut ? axisTitle(shortcut, axisT) : ''}
        </p>
        <button
          type="button"
          onClick={onClose}
          onMouseEnter={() => playHoverSfx()}
          title={tModal('closeAria')}
          aria-label={tModal('closeAria')}
          className="flex h-8 w-8 shrink-0 items-center justify-center border transition-colors hover:bg-white/5"
          style={{ borderColor: `${accent}55`, color: accent }}
        >
          <X size={15} aria-hidden="true" />
        </button>
      </div>

      {/* Chained tier stack -- tier 0 is the tapped axis, every tier after it
          a nested keyword result, all stacked in one continuous, internally
          scrolled column (REV-20 §4.3: 우아한 내부 스크롤, never a fullscreen
          takeover). */}
      <div
        className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4"
        style={{ maxHeight: 'min(72vh, calc(100svh - var(--unitas-nav-bottom, 64px) / var(--unitas-zoom, .75) - 140px))' }}
      >
        {chain.map((tier, index) => (
          <TierCard
            key={tier.id}
            tier={tier}
            focused={index === chain.length - 1}
            feed={index === chain.length - 1 ? feed : null}
            tModal={tModal}
            tUai={tUai}
            onNest={(q) => nestKeyword(tier, q)}
            onFocusTier={() => goBackTo(index)}
            onHover={playHoverSfx}
          />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

interface TierCardProps {
  tier: ChainTier;
  focused: boolean;
  feed: ReturnType<typeof useShortcutFeed> | null;
  tModal: ReturnType<typeof useTranslations>;
  tUai: ReturnType<typeof useTranslations>;
  onNest: (query: string) => void;
  /** Tapping a non-focused tier's header collapses the ladder back to it. */
  onFocusTier: () => void;
  onHover: () => void;
}

function TierCard({ tier, focused, feed, tModal, tUai, onNest, onFocusTier, onHover }: TierCardProps) {
  const TierIcon = tier.icon;
  const analysis = focused && feed?.analysis ? feed.analysis : tier.analysis;
  // Every tier carries its own parked deep report now (the cache route
  // returns it with the snapshot), so a restored / stepped-past tier keeps
  // showing it -- not only the one in focus.
  const report: ConstitutionRedesignReport | null = focused && feed ? feed.report : (analysis?.deep ?? null);
  const leadSnippet = analysis?.web.sources[0]?.snippet ?? '';
  const isNested = tier.kind === 'query' || tier.kind === 'keyword';
  const cachedHours = analysis && analysis.source !== 'local' ? hoursSince(analysis.synthesizedAt) : null;

  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className="relative border bg-void/40 p-4"
      style={{
        borderColor: `${tier.color}${focused ? '77' : '44'}`,
        marginLeft: `${Math.min(tier.depth, 4) * 10}px`,
        boxShadow: focused ? `0 0 28px ${tier.glow}22` : undefined,
      }}
    >
      <button
        type="button"
        onClick={onFocusTier}
        onMouseEnter={onHover}
        disabled={focused}
        className="mb-2 flex min-w-0 items-center gap-2 text-left disabled:cursor-default"
      >
        {isNested && <Search size={14} className="shrink-0" style={{ color: tier.color }} aria-hidden="true" />}
        {TierIcon && <TierIcon size={18} className="shrink-0" style={{ color: tier.color }} aria-hidden="true" />}
        <h2
          className="break-words font-serif text-lg font-bold text-white sm:text-2xl"
          style={{ textShadow: `0 0 16px ${tier.glow}55` }}
        >
          {tier.title}
        </h2>
      </button>

      {analysis && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {analysis.web.sourced && (
            <span className="border border-white/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-gray-400">
              {tUai('webSourcedBadge', { count: analysis.web.sources.length })}
            </span>
          )}
          {cachedHours !== null && (
            <span
              className="border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest"
              style={{ color: `${tier.color}cc`, borderColor: `${tier.color}33` }}
            >
              {cachedHours === 0 ? tModal('synthesizedJustNow') : tModal('synthesizedAgo', { hours: cachedHours })}
            </span>
          )}
        </div>
      )}

      {/* Strictly keyword-relevant text: for a nested tier, the breadcrumb of
          what it was nested from; then the lead LIVE snippet (real online
          text) once the engine pass lands. No static generic doctrine copy
          (REV-20 §4.2 -- removed). */}
      <div className="border-l-2 pl-3" style={{ borderColor: `${tier.color}88` }}>
        {isNested && (
          <p className="text-[13px] uppercase tracking-widest text-gray-500">
            {tModal('nestedFrom', { parent: tier.description })}
          </p>
        )}
        {analysis ? (
          <p className={`text-[14px] leading-relaxed text-gray-200 sm:text-[16px] ${isNested ? 'mt-1' : ''}`}>
            {leadSnippet || tUai('constitutionAxisNote', { axis: tUai(`constitution.${analysis.report.redesignAxis}`) })}
          </p>
        ) : (
          <p className="mt-2 animate-pulse text-[12px] text-gray-500">{tModal('analyzing')}</p>
        )}
      </div>

      {analysis && (
        <div className="mt-3 space-y-3">
          {/* UNITAS deep analysis -- the LLM-forged 6-axis sovereign redesign
              the nightly batch parks in Genesis Memory. */}
          {report && (
            <div className="border p-3" style={{ borderColor: `${tier.color}33`, backgroundColor: `${tier.color}0a` }}>
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.3em]" style={{ color: tier.color }}>
                {tModal('deepLabel')}
              </p>
              <div className="space-y-2">
                <p className="text-[13px] italic leading-relaxed text-gray-100 [text-wrap:balance]">{report.vector}</p>
                <p className="text-[12px] leading-relaxed text-gray-300">{report.synthesis}</p>
                <ul className="grid gap-1.5 sm:grid-cols-2">
                  {report.axes.map((ax) => (
                    <li key={ax.axis} className="border border-white/10 p-2">
                      <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: tier.color }}>
                        {tUai(`constitution.${ax.axis}`)}
                      </p>
                      <p className="mt-1 text-[11px] leading-snug text-gray-300">{ax.redesign}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Live sources -- up to 24 now (REV-20 §6.1's widened cap flows
              straight through the 24h cache into every tier here). */}
          {analysis.web.sources.length > 0 && (
            <div>
              <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.25em] text-gray-500">{tModal('feedLabel')}</p>
              <ul className="space-y-1">
                {analysis.web.sources.slice(0, 11).map((source) => (
                  <li key={source.url}>
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onMouseEnter={onHover}
                      className="group flex items-start gap-1.5 text-[13px] text-gray-300 transition-colors hover:text-white"
                    >
                      <ExternalLink size={11} className="mt-0.5 shrink-0 text-gray-500 group-hover:text-accent" aria-hidden="true" />
                      <span className="line-clamp-2">
                        <span className="font-bold" style={{ color: tier.color }}>
                          {source.title}
                        </span>
                        {/* REV-21 §3.2: the engine's real name, from the URL. */}
                        <span className="ml-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-gray-500" data-source-origin>
                          {formatSourceName(sourceNameOf(source.url))}
                        </span>
                        {source.snippet && <span className="text-gray-400"> — {source.snippet.slice(0, 160)}</span>}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Keyword expansion -- real entities from the live feed only
              (sibling-axis chips removed, REV-20 §4.2): each nests a new
              tier beneath, unbounded depth. */}
          {analysis.keywords.length > 0 && (
            <div>
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.25em] text-gray-500">
                {tModal('keywordsLabel')}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {analysis.keywords.map((chip) => (
                  <button
                    key={`${chip.kind}-${chip.query}`}
                    type="button"
                    onMouseEnter={onHover}
                    onClick={() => onNest(chip.query)}
                    title={tModal('keywordHint')}
                    className="flex items-center gap-1 border px-2.5 py-1.5 text-[12px] font-bold transition-colors hover:bg-white/5"
                    style={{
                      borderColor: chip.kind === 'entity' ? `${tier.color}66` : 'rgba(255,255,255,0.15)',
                      color: chip.kind === 'entity' ? tier.color : '#d1d5db',
                    }}
                  >
                    {chip.label}
                    <ArrowRight size={10} className="opacity-60" aria-hidden="true" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </motion.article>
  );
}
