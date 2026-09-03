'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Search,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  CornerDownLeft,
  ExternalLink,
  Activity,
  TrendingUp,
  Minus,
  TrendingDown,
  type LucideIcon,
} from 'lucide-react';
import { DialogTower } from '@/components/ui/DialogTower';
import { useSpatialAudio } from '@/components/audio/SpatialAudioProvider';
import {
  itemsInGroup,
  findShortcutAxis,
  axisTitle,
  axisDescription,
  type AxisTranslators,
  type HotShortcutAxis,
  type ShortcutGroup,
} from '@/lib/hotIssues';
import { DIRECT_APP_SHORTCUTS } from '@/lib/appShortcuts';
import { useShortcutFeed } from '@/lib/uai/useShortcutFeed';
import { loadShortcutAnalysis } from '@/lib/uai/shortcutCacheClient';
import type { AnalyticsLabels, ShortcutAnalysis } from '@/lib/uai/shortcutAnalytics';
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
  /** static doctrine copy for axis tiers; the parent title for nested ones. */
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
  cursorIndex: number;
  tiers: TierDescriptor[];
  draft: string;
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

const TREND_ICON: Record<ShortcutAnalysis['pulse']['trend'], LucideIcon> = {
  rising: TrendingUp,
  stable: Minus,
  cooling: TrendingDown,
};

/** Whole hours since the served snapshot was synthesized (null = local pass). */
function hoursSince(ts: number | null): number | null {
  if (!ts) return null;
  return Math.max(0, Math.floor((Date.now() - ts) / 3_600_000));
}

/**
 * The multi-tier chained U-AI popup opened by HotShortcutMatrixStrip -- the
 * "infinite knowledge ladder". Tier 0 is the tapped tile; every later tier
 * is appended (never replaced) so the whole reading history stays in one
 * scroll. Four ways to grow it, all endless:
 *
 * 1. prev/next steps to the sibling axis in the same group, wrapping forever.
 * 2. the chain-query box at the bottom stacks a free-text tier.
 * 3. every tier's keyword chips (real entities from the live feed + the
 *    doctrine axes the engine scored) nest a new tier beneath it -- and that
 *    tier yields its own chips, so depth is unbounded.
 * 4. the app/asset loop row hands the visitor out to a webmail / social app
 *    or a UNITAS asset download and back without losing a single tier.
 *
 * Every tier is served by the 24h sovereign caching engine (GET
 * /api/u-ai/shortcut-cache via lib/uai/shortcutCacheClient.ts): the snapshot
 * the nightly batch parked in Postgres + the Vercel CDN, plus the LLM-forged
 * 6-axis UNITAS deep analysis from Genesis Memory -- 0초 to render, 0원 per
 * visit, no browser-side synthesis. The newest tier is "in focus"; its HUD
 * shows the cache state and hosts the manual refresh launcher
 * (useShortcutFeed.refreshNow, cooldown-guarded server-side).
 */
export function HotShortcutResultModal({ shortcut, onClose }: HotShortcutResultModalProps) {
  const locale = useLocale();
  const tGovernance = useTranslations('Governance');
  const tHotIssue = useTranslations('HotIssue');
  const tFinance = useTranslations('Finance');
  const tRealEstate = useTranslations('RealEstate');
  const tDating = useTranslations('Dating');
  const tCareer = useTranslations('Career');
  const tUai = useTranslations('UAI');
  const tEcosystems = useTranslations('Ecosystems');
  const tModal = useTranslations('HotShortcutModal');
  const tEmail = useTranslations('Email');
  const tSocial = useTranslations('Social');
  const { playHoverSfx, playQuestEnterSfx, playTypingTick } = useSpatialAudio();

  const axisT: AxisTranslators = {
    governance: tGovernance,
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
  const [chainQuery, setChainQuery] = useState('');
  const [cursorIndex, setCursorIndex] = useState(0);
  const [restored, setRestored] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  /** Mirrors `cursorIndex` but read/written synchronously -- `stepLadder`
   *  reads this instead of the `cursorIndex` state so back-to-back clicks in
   *  the same tick each see the previous click's result instead of all
   *  computing from the same stale render's value. */
  const cursorRef = useRef(0);
  /** Monotonic counter for tier ids -- two tiers appended within the same
   *  millisecond would otherwise collide as duplicate React keys. */
  const tierSeqRef = useRef(0);
  /** Identity of the shortcut the current chain was built for -- lets the
   *  persist effect skip the transient empty chain between open() and seed. */
  const seededForRef = useRef<string | null>(null);

  const open = shortcut !== null;
  const groupItems = shortcut ? itemsInGroup(shortcut.group) : [];
  const focus = chain.length > 0 ? chain[chain.length - 1] : null;

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
      // (HomeContent restores the open shortcut in an effect), and wiping
      // here would destroy the ladder we are about to re-hydrate.
      if (seededForRef.current !== null) writeLadder(null);
      seededForRef.current = null;
      setChain([]);
      setChainQuery('');
      setRestored(false);
      return;
    }
    const identity = `${shortcut.group}:${shortcut.key}`;
    const saved = readLadder();
    const canRestore =
      saved !== null && saved.group === shortcut.group && saved.key === shortcut.key && saved.tiers.length > 0;

    let tiers: ChainTier[] = [];
    let idx = 0;
    if (canRestore && saved) {
      tiers = saved.tiers
        .map((d) => materialize(d, shortcut.color, shortcut.glow))
        .filter((t): t is ChainTier => t !== null);
      idx = Math.min(Math.max(0, saved.cursorIndex), Math.max(0, groupItems.length - 1));
      setChainQuery(saved.draft ?? '');
      setRestored(tiers.length > 1);
    }
    if (tiers.length === 0) {
      const seed = materialize({ kind: 'seed', group: shortcut.group, key: shortcut.key, depth: 0 }, shortcut.color, shortcut.glow);
      tiers = seed ? [seed] : [];
      const found = groupItems.findIndex((a) => a.key === shortcut.key);
      idx = found === -1 ? 0 : found;
      setChainQuery('');
      setRestored(false);
    }
    seededForRef.current = identity;
    cursorRef.current = idx;
    setCursorIndex(idx);
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
      cursorIndex,
      tiers: chain.slice(-MAX_PERSISTED_TIERS).map((t) => t.descriptor),
      draft: chainQuery,
    });
  }, [shortcut, chain, cursorIndex, chainQuery]);

  useEffect(() => {
    if (!restored) return;
    const timer = window.setTimeout(() => setRestored(false), 4200);
    return () => window.clearTimeout(timer);
  }, [restored]);

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

  // Fold the feed's latest pass into the focused tier so it keeps its chips,
  // pulse and sources after the focus moves on to a deeper tier.
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

  function stepLadder(delta: number) {
    if (groupItems.length === 0 || !shortcut) return;
    playHoverSfx();
    const nextIndex = (cursorRef.current + delta + groupItems.length) % groupItems.length;
    const nextAxis = groupItems[nextIndex];
    cursorRef.current = nextIndex;
    setCursorIndex(nextIndex);
    appendTier({ kind: 'ladder', group: shortcut.group, key: nextAxis.key, depth: 0 });
  }

  function nestKeyword(parent: ChainTier, query: string) {
    playQuestEnterSfx();
    appendTier({ kind: 'keyword', query, depth: parent.depth + 1, parent: parent.title });
  }

  function handleChainSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = chainQuery.trim();
    if (!trimmed || !focus) return;
    playQuestEnterSfx();
    appendTier({ kind: 'query', query: trimmed, depth: focus.depth + 1, parent: focus.title });
    setChainQuery('');
  }

  /** [← 뒤로 가기]: steps one tier back up the ladder; on the last tier it
   *  closes the tower (same effect as the device back gesture). */
  function goBackTier() {
    playHoverSfx();
    if (chain.length <= 1) {
      onClose();
      return;
    }
    const next = chain.slice(0, -1);
    const landing = next[next.length - 1];
    if (landing && 'group' in landing.descriptor) {
      const idx = groupItems.findIndex((a) => a.key === (landing.descriptor as { key: string }).key);
      if (idx !== -1) {
        cursorRef.current = idx;
        setCursorIndex(idx);
      }
    }
    setChain(next);
  }

  /** [⌂ 홈으로 복귀]: collapses the whole tower back to the home screen. */
  function goHome() {
    playHoverSfx();
    onClose();
  }

  const accent = shortcut?.color ?? '#22d3ee';
  const accentGlow = shortcut?.glow ?? '#67e8f9';

  return (
    <DialogTower
      open={open && shortcut !== null}
      title="U-AI SEARCH RESULT"
      titleId="hot-shortcut-result-title"
      accent={accent}
      accentGlow={accentGlow}
      historyMarker="unitasShortcutModal"
      labels={{
        refresh: tModal('refreshAria'),
        home: tModal('homeButton'),
        back: tModal('backButton'),
        close: tModal('closeAria'),
      }}
      refreshing={feed.refreshing}
      onRefresh={() => {
        playHoverSfx();
        feed.refreshNow();
      }}
      onBack={goBackTier}
      onHome={goHome}
      onClose={onClose}
      onButtonHover={playHoverSfx}
    >
      {shortcut && (
        <>
            {/* Sibling ladder -- steps to the prev/next axis in the same
                group, wrapping endlessly, stacking each stop below. The page
                counter is dead-centered regardless of button widths. */}
            {groupItems.length > 1 && (
              <div
                className="relative flex shrink-0 items-center justify-between border-b px-2.5 py-2 sm:px-4"
                style={{ borderColor: `${accent}22` }}
              >
                <button
                  type="button"
                  onClick={() => stepLadder(-1)}
                  className="flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-gray-400 transition-colors hover:text-accent"
                >
                  <ChevronLeft size={14} aria-hidden="true" />
                  {tGovernance('prev')}
                </button>
                <span className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[10px] uppercase tracking-[0.25em] text-gray-500">
                  {tGovernance('indexLabel', { current: cursorIndex + 1, total: groupItems.length })}
                </span>
                <button
                  type="button"
                  onClick={() => stepLadder(1)}
                  className="flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-gray-400 transition-colors hover:text-accent"
                >
                  {tGovernance('next')}
                  <ChevronRight size={14} aria-hidden="true" />
                </button>
              </div>
            )}

            <AnimatePresence>
              {restored && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="shrink-0 overflow-hidden border-b px-2.5 py-2 text-[11px] text-gray-300 sm:px-4"
                  style={{ borderColor: `${accent}22`, backgroundColor: `${accent}12` }}
                >
                  {tModal('restoredNote')}
                </motion.p>
              )}
            </AnimatePresence>

            {/* Chained tier stack -- tier 0 is the tapped axis, every tier
                after it is a ladder step, a nested keyword or a free-tier
                query result, all stacked below in one continuous scroll. */}
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-2.5 py-4 sm:px-4">
              {chain.map((tier, index) => (
                <TierCard
                  key={tier.id}
                  tier={tier}
                  focused={index === chain.length - 1}
                  feed={index === chain.length - 1 ? feed : null}
                  tModal={tModal}
                  tUai={tUai}
                  extraChips={
                    'group' in tier.descriptor
                      ? groupItems
                          .filter((a) => a.key !== (tier.descriptor as { key: string }).key)
                          .map((a) => ({ label: axisTitle(a, axisT), query: axisTitle(a, axisT) }))
                      : []
                  }
                  onNest={(q) => nestKeyword(tier, q)}
                  onHover={playHoverSfx}
                />
              ))}
              <div ref={bottomRef} />
            </div>

            {/* 추가검색 bar -- the "다단 연쇄" entry point: a compact label
                chip + input + a real keyboard-Enter submit key. Each submit
                stacks a new tier above, all inside this one popup (the old
                hint sentence was cleansed per owner instruction 2026-09-02). */}
            <form
              onSubmit={handleChainSubmit}
              className="shrink-0 border-t px-2.5 pb-2 pt-3 sm:px-4"
              style={{ borderColor: `${accent}33` }}
            >
              <div className="flex items-stretch gap-2">
                <span
                  className="flex shrink-0 items-center border px-2.5 text-[11px] font-bold uppercase tracking-widest"
                  style={{ borderColor: `${accent}55`, color: accent }}
                >
                  {tModal('chainLabel')}
                </span>
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
                  title={tModal('chainSubmitAria')}
                  aria-label={tModal('chainSubmitAria')}
                  className="flex shrink-0 items-center justify-center border px-3 transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                  style={{ borderColor: `${accent}66`, color: accent }}
                >
                  <CornerDownLeft size={16} aria-hidden="true" />
                </button>
              </div>
            </form>

            {/* Direct app loop -- out to a webmail / social app and straight
                back; the ladder above is persisted so nothing is lost on the
                round trip. Every launcher carries its brand name as a visible
                text label plus the double hover tooltip (owner instruction
                2026-09-02). */}
            <div className="shrink-0 border-t px-2.5 pb-3 pt-2 sm:px-4" style={{ borderColor: `${accent}22` }}>
              <p className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.3em] text-gray-500">
                {tModal('appLoopLabel')}
              </p>
              <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:thin]">
                {DIRECT_APP_SHORTCUTS.map((app) => (
                  <a
                    key={app.key}
                    href={app.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={(app.family === 'email' ? tEmail : tSocial)('openAria', { brand: app.brand })}
                    aria-label={(app.family === 'email' ? tEmail : tSocial)('openAria', { brand: app.brand })}
                    onMouseEnter={() => playHoverSfx()}
                    style={{ borderColor: `${app.color}55`, color: app.color }}
                    className="flex h-9 shrink-0 items-center gap-1.5 border bg-void/50 px-2.5 transition-colors hover:bg-void/90"
                  >
                    <app.icon size={14} aria-hidden="true" />
                    <span className="whitespace-nowrap text-[11px] font-bold">{app.brand}</span>
                  </a>
                ))}
              </div>
            </div>
        </>
      )}
    </DialogTower>
  );
}

interface TierCardProps {
  tier: ChainTier;
  focused: boolean;
  feed: ReturnType<typeof useShortcutFeed> | null;
  tModal: ReturnType<typeof useTranslations>;
  tUai: ReturnType<typeof useTranslations>;
  /** Sibling-axis ladder chips (the rest of the tier's group) -- merged into
   *  the keyword chip wall so every tier offers dozens of onward clicks. */
  extraChips: Array<{ label: string; query: string }>;
  onNest: (query: string) => void;
  onHover: () => void;
}

function TierCard({ tier, focused, feed, tModal, tUai, extraChips, onNest, onHover }: TierCardProps) {
  const TierIcon = tier.icon;
  const analysis = focused && feed?.analysis ? feed.analysis : tier.analysis;
  // Every tier carries its own parked deep report now (the cache route
  // returns it with the snapshot), so a restored / stepped-past tier keeps
  // showing it -- not only the one in focus.
  const report: ConstitutionRedesignReport | null = focused && feed ? feed.report : (analysis?.deep ?? null);
  const hits = focused && feed ? feed.hits : (analysis?.hits ?? 0);
  const leadSnippet = analysis?.web.sources[0]?.snippet ?? '';
  const isNested = tier.kind === 'query' || tier.kind === 'keyword';
  const TrendIcon = analysis ? TREND_ICON[analysis.pulse.trend] : Activity;
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
      {/* The "깊이 N" badge and its icon were cleansed per owner instruction
          2026-09-02 -- the indent already communicates nesting. */}
      <div className="mb-2 flex min-w-0 items-center gap-2">
        {isNested && <Search size={14} className="shrink-0" style={{ color: tier.color }} aria-hidden="true" />}
        {TierIcon && <TierIcon size={18} className="shrink-0" style={{ color: tier.color }} aria-hidden="true" />}
        <h2
          className="break-words font-serif text-lg font-bold text-white sm:text-2xl"
          style={{ textShadow: `0 0 16px ${tier.glow}55` }}
        >
          {tier.title}
        </h2>
      </div>

      {analysis && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          <span
            className="border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest"
            style={{ color: tier.color, borderColor: `${tier.color}55` }}
          >
            {tUai(`constitution.${analysis.report.topConstitutionAxis}`)}
          </span>
          <span className="border border-white/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-gray-400">
            {tUai(`shield.${analysis.report.shield.verdict}`)}
          </span>
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

      {/* Highlighted keyword description: the axis's doctrine copy, or -- for
          a nested keyword -- the parent breadcrumb, then the lead live
          snippet (real online text) once the engine pass lands. */}
      <div className="border-l-2 pl-3" style={{ borderColor: `${tier.color}88` }}>
        {isNested ? (
          <p className="text-[11px] uppercase tracking-widest text-gray-500">
            {tModal('nestedFrom', { parent: tier.description })}
          </p>
        ) : (
          <p className="text-[14px] leading-relaxed text-gray-300 sm:text-[16px]">{tier.description}</p>
        )}
        {analysis ? (
          <p className={`text-[14px] leading-relaxed text-gray-200 sm:text-[16px] ${isNested ? 'mt-1' : 'mt-2'}`}>
            {leadSnippet || tUai('constitutionAxisNote', { axis: tUai(`constitution.${analysis.report.redesignAxis}`) })}
          </p>
        ) : (
          <p className="mt-2 animate-pulse text-[12px] text-gray-500">{tModal('analyzing')}</p>
        )}
      </div>

      {analysis && (
        <div className="mt-3 space-y-3">
          {/* Global pulse gauge */}
          <div>
            <div className="mb-1 flex items-center justify-between text-[9px] font-bold uppercase tracking-[0.25em] text-gray-500">
              <span className="flex items-center gap-1.5">
                <Activity size={10} aria-hidden="true" />
                {tModal('pulseLabel')}
              </span>
              <span className="flex items-center gap-1.5" style={{ color: tier.color }}>
                <TrendIcon size={11} aria-hidden="true" />
                {tModal(`pulse.${analysis.pulse.trend}`)}
                <span className="text-gray-500">· {analysis.pulse.momentum}%</span>
                {hits > 0 && <span className="text-gray-500">· {tModal('hitsLabel', { count: hits })}</span>}
              </span>
            </div>
            <div className="h-1 w-full bg-white/10">
              <motion.div
                className="h-full"
                style={{ backgroundColor: tier.color, boxShadow: `0 0 10px ${tier.glow}88` }}
                initial={{ width: 0 }}
                animate={{ width: `${analysis.pulse.momentum}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              />
            </div>
          </div>

          {/* PRIMARY live trend feed -- real titles + URLs from the open web,
              directly tied to this tier's main description. */}
          <div>
            <p className="mb-1 text-[9px] font-bold uppercase tracking-[0.25em] text-gray-500">{tModal('feedLabel')}</p>
            {analysis.web.sources.length > 0 ? (
              <ul className="space-y-1">
                {analysis.web.sources.slice(0, 5).map((source) => (
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
                        {source.snippet && <span className="text-gray-400"> — {source.snippet.slice(0, 110)}</span>}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[11px] text-gray-500">{tModal('feedEmpty')}</p>
            )}
          </div>

          {/* SECONDARY multi-angle feed -- the same subject re-read through
              every scored doctrine axis (each angle nests a new tier), plus
              any live sources beyond the primary five. */}
          <div>
            <p className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.25em] text-gray-500">
              {tModal('multiFeedLabel')}
            </p>
            <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
              {analysis.report.constitution.slice(0, 6).map((cs) => (
                <button
                  key={cs.axis}
                  type="button"
                  onMouseEnter={onHover}
                  onClick={() => onNest(`${tier.title} ${tUai(`constitution.${cs.axis}`)}`)}
                  title={tModal('keywordHint')}
                  className="flex items-center justify-between gap-2 border border-white/10 px-2.5 py-1.5 text-left transition-colors hover:bg-white/5"
                >
                  <span className="truncate text-[12px] font-bold text-gray-200">
                    {tUai(`constitution.${cs.axis}`)}
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    <span className="h-1 w-10 bg-white/10">
                      <span
                        className="block h-full"
                        style={{ width: `${cs.score}%`, backgroundColor: tier.color }}
                      />
                    </span>
                    <span className="text-[10px] font-bold" style={{ color: tier.color }}>
                      {cs.score}
                    </span>
                  </span>
                </button>
              ))}
            </div>
            {analysis.web.sources.length > 5 && (
              <ul className="mt-2 space-y-1">
                {analysis.web.sources.slice(5, 11).map((source) => (
                  <li key={source.url}>
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onMouseEnter={onHover}
                      className="group flex items-start gap-1.5 text-[12px] text-gray-400 transition-colors hover:text-white"
                    >
                      <ExternalLink size={10} className="mt-0.5 shrink-0 text-gray-600 group-hover:text-accent" aria-hidden="true" />
                      <span className="line-clamp-1">{source.title}</span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Keyword expansion wall -- live-feed entities, doctrine axes AND
              every sibling axis of this tier's group: each chip nests a new
              tier beneath, so the ladder invites endless clicking. */}
          {(analysis.keywords.length > 0 || extraChips.length > 0) && (
            <div>
              <p className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.25em] text-gray-500">
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
                {extraChips.map((chip) => (
                  <button
                    key={`sibling-${chip.query}`}
                    type="button"
                    onMouseEnter={onHover}
                    onClick={() => onNest(chip.query)}
                    title={tModal('keywordHint')}
                    className="flex items-center gap-1 border border-white/15 px-2.5 py-1.5 text-[12px] font-bold text-gray-400 transition-colors hover:bg-white/5 hover:text-white"
                  >
                    {chip.label}
                    <ArrowRight size={10} className="opacity-60" aria-hidden="true" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* UNITAS deep analysis -- the LLM-forged 6-axis sovereign redesign
              the nightly batch parks in Genesis Memory, served at 0원 on every
              tier that has one. (The queue-waiting notice box was removed per
              owner cleansing instruction 2026-09-02 -- no report, no box.) */}
          {report && (
            <div className="border p-3" style={{ borderColor: `${tier.color}33`, backgroundColor: `${tier.color}0a` }}>
              <p className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.3em]" style={{ color: tier.color }}>
                {tModal('deepLabel')}
              </p>
              <div className="space-y-2">
                <p className="text-[13px] italic leading-relaxed text-gray-100 [text-wrap:balance]">{report.vector}</p>
                <p className="text-[12px] leading-relaxed text-gray-300">{report.synthesis}</p>
                <ul className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                  {report.axes.map((ax) => (
                    <li key={ax.axis} className="border border-white/10 p-2">
                      <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: tier.color }}>
                        {tUai(`constitution.${ax.axis}`)}
                      </p>
                      <p className="mt-1 text-[11px] leading-snug text-gray-300">{ax.redesign}</p>
                    </li>
                  ))}
                </ul>
                <p className="text-[10px] text-gray-500">{tUai('insightCachedNote')}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </motion.article>
  );
}
