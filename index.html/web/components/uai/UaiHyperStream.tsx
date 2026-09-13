'use client';

/**
 * REV-21 §5C / SPEC §12.7 -- the U-AI infinity stream. One host for the
 * fullscreen tower (home Enter) and the /u-ai page (D-10 shared): page 0 is
 * painted from the surface report with no network at all (≤1.2 s after
 * Enter), later pages arrive through useHyperStream and are laid out in
 * the page recipe's order with the local kinds (redesign · deeper · chain)
 * inserted by this component. The scroll root IS the feed
 * (`[data-stream-root role=feed aria-busy]`); the spine is sticky inside it.
 *
 * Engagement charter (§12.7): no auto-scroll ever, `document.hidden`
 * pauses paging, the soft pause every 10 pages needs a tap, 60 pages is
 * the end, the DOM keeps 12 pages mounted (older ones become measured
 * ghosts), and a keyboard visitor has `button[data-stream-more]`.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Sparkles } from 'lucide-react';
import { ExploreDeeper } from '@/components/home/ExploreDeeper';
import { UnitasModuleRankings } from '@/components/home/UnitasModuleRankings';
import { useSlotContext } from '@/lib/live/useSlotContext';
import { entityAnchor, qidAnchor, textAnchor, type DeeperAnchor } from '@/lib/uai/deeperAnchor';
import type { DeeperHost } from '@/lib/uai/deeperThemes';
import { wikiLangFor } from '@/lib/uai/liveSuggest';
import { LOCAL_KINDS, STREAM_DOM_PAGES, streamRecipe, type StreamCard, type StreamCardKind, type StreamPage } from '@/lib/uai/stream/streamTypes';
import { useHyperStream } from '@/lib/uai/stream/useHyperStream';
import type { ConstitutionRedesignReport, DeepReport, SurfaceReport } from '@/lib/uai/types';
import type { UaiError, UaiPhase } from '@/lib/uai/useUai';
import { DisambiguationCard, EndCard, NetworkCard, RetryCard, SoftPauseCard, TeaserCard, type RunQuery } from './stream/StreamCards';
import { AxisSpectrumCard, ChainCard, DeepGateCard, EssenceCard, RedesignCard, SourcesCard, useFollowups } from './stream/StreamLocalCards';

export interface UaiHyperStreamProps {
  phase: UaiPhase;
  surface: SurfaceReport | null;
  deep: DeepReport | null;
  insight?: ConstitutionRedesignReport | null;
  trendHits?: number;
  insightForging?: boolean;
  error: UaiError | null;
  canDeep: boolean;
  deepAvailable: boolean;
  hasSession: boolean;
  onRunDeep: () => void;
  onRunQuery: RunQuery;
  onSelectEcosystem?: (key: string) => void;
  /** Which surface hosts the stream (Explore Deeper card host id). */
  host: DeeperHost;
  /** The entity the search was pinned on (ladder row / chip). */
  submittedQid?: string | null;
  /** Classes for the feed root -- in the tower this is the scroll box. */
  className?: string;
}

const DEEP_GATE_ID = 'stream-deep-gate';

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return reduced;
}

export function UaiHyperStream({
  phase,
  surface,
  deep,
  insight = null,
  trendHits = 0,
  insightForging = false,
  error,
  canDeep,
  deepAvailable,
  hasSession,
  onRunDeep,
  onRunQuery,
  onSelectEcosystem,
  host,
  submittedQid = null,
  className = '',
}: UaiHyperStreamProps) {
  const t = useTranslations('Rev21');
  const tUai = useTranslations('UAI');
  const locale = useLocale();
  const slotCtx = useSlotContext();
  const country = slotCtx.country ?? 'US';
  const lang = wikiLangFor(locale);
  const reducedMotion = usePrefersReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const heightsRef = useRef<Map<number, number>>(new Map());

  const term = surface?.query ?? '';
  // §2.2: the stream is keyed on the entity, never on the raw string. A
  // ladder-pinned QID wins over the synthesis' own anchor.
  const anchor = useMemo<DeeperAnchor | null>(() => {
    if (!surface) return null;
    if (submittedQid) return qidAnchor(submittedQid, surface.web.anchor?.localeTitle ?? surface.query, lang, surface.web.anchor?.enTitle);
    return surface.web.anchor ? entityAnchor(surface.web.anchor, lang, surface.query) : textAnchor(surface.query, lang);
  }, [surface, submittedQid, lang]);

  const stream = useHyperStream({
    query: surface ? surface.query : null,
    anchor,
    locale,
    lang,
    country,
    constitution: surface?.constitution ?? [],
  });

  const followups = useFollowups(surface);

  // The IO root is the feed itself when it scrolls (tower), the viewport
  // when the document scrolls (/u-ai).
  useEffect(() => {
    const el = sentinelRef.current;
    const rootEl = rootRef.current;
    if (!el || !surface || phase === 'surface-loading' || typeof IntersectionObserver === 'undefined') return;
    if (stream.paused || stream.capped || stream.stalled) return;
    const scrolls = rootEl ? /(auto|scroll)/.test(getComputedStyle(rootEl).overflowY) : false;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) stream.loadMore();
      },
      { root: scrolls ? rootEl : null, rootMargin: '480px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [surface, phase, stream.paused, stream.capped, stream.stalled, stream.loadMore, stream]);

  // DOM budget (§12.7): remember each page's height before it turns into a
  // ghost so the scroll position never jumps.
  useEffect(() => {
    const rootEl = rootRef.current;
    if (!rootEl) return;
    rootEl.querySelectorAll<HTMLElement>('[data-stream-page-section]').forEach((el) => {
      const n = Number(el.dataset.streamPageSection);
      if (Number.isFinite(n) && el.offsetHeight > 0) heightsRef.current.set(n, el.offsetHeight);
    });
  });

  const goPaid = useCallback(() => {
    if (canDeep) onRunDeep();
    document.getElementById(DEEP_GATE_ID)?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' });
  }, [canDeep, onRunDeep, reducedMotion]);

  if (phase === 'idle') return null;

  const pages = stream.pages;
  const ghostBefore = Math.max(0, pages.length - STREAM_DOM_PAGES);
  const cardTotal = (surface ? streamRecipe(0).length : 0) + pages.reduce((s, p) => s + p.cards.length + streamRecipe(p.page).filter((k) => LOCAL_KINDS.has(k) && k !== 'cogs').length, 0);
  const sourceKinds = new Set<string>();
  pages.forEach((p) => p.cards.forEach((c) => c.sourceId && sourceKinds.add(c.sourceId)));
  surface?.web.sources.forEach((s) => s.origin && sourceKinds.add(`origin:${s.origin}`));
  const nextPage = (pages[pages.length - 1]?.page ?? 0) + 1;
  const busy = phase === 'surface-loading' || stream.loading;

  const renderPage = (page: StreamPage) => {
    const recipe = streamRecipe(page.page);
    const byKind = new Map<StreamCardKind, StreamCard[]>();
    page.cards.forEach((c) => byKind.set(c.kind, [...(byKind.get(c.kind) ?? []), c]));
    const nodes: JSX.Element[] = [];
    recipe.forEach((kind) => {
      if (kind === 'redesign') nodes.push(<RedesignCard key={`redesign-${page.page}`} insight={insight} trendHits={trendHits} forging={insightForging} />);
      else if (kind === 'deeper' && anchor && surface)
        nodes.push(
          <article key={`deeper-${page.page}`} className="qw-stream-card" data-stream-card="deeper" data-stream-page={page.page}>
            <ExploreDeeper anchor={anchor} host={host} report={surface} compact={page.page > 1} className="qw-stream-deeper" />
          </article>,
        );
      else if (kind === 'chain') nodes.push(<ChainCard key={`chain-${page.page}`} page={page.page} followups={followups} onQuery={onRunQuery} />);
      else (byKind.get(kind) ?? []).forEach((card) => nodes.push(<NetworkCard key={card.id} card={card} term={term} lang={lang} onQuery={onRunQuery} />));
    });
    return nodes;
  };

  return (
    <div
      ref={rootRef}
      className={`qw-stream ${className}`}
      data-stream-root
      data-stream-host={host}
      data-stream-depth={pages.length}
      role="feed"
      aria-busy={busy}
      aria-label={term ? t('stream.feedAria', { term }) : undefined}
    >
      {/* Spine -- sticky, solid (no blur), the visitor's own depth + tier. */}
      <div className="qw-stream-spine" data-stream-spine>
        <span className="qw-stream-spine-stat">
          <span className="qw-stream-spine-label">{t('stream.spine.depth')}</span>
          <span className="qw-stream-mono" data-stream-spine-depth>
            p{pages[pages.length - 1]?.page ?? 0}
          </span>
        </span>
        <span className="qw-stream-spine-stat">
          <span className="qw-stream-spine-label">{t('stream.spine.cards')}</span>
          <span className="qw-stream-mono">{cardTotal}</span>
        </span>
        <span className="qw-stream-spine-stat">
          <span className="qw-stream-spine-label">{t('stream.spine.sources')}</span>
          <span className="qw-stream-mono">{sourceKinds.size}</span>
        </span>
        <span className="qw-stream-spine-stat qw-stream-spine-tier" data-stream-tier={stream.tier}>
          <span className="qw-stream-spine-label">{t('stream.spine.tier')}</span>
          <span>{t(`stream.tier.${stream.tier}`)}</span>
        </span>
        <button type="button" className="qw-stream-spine-cta" onClick={goPaid} data-stream-spine-deep>
          <Sparkles size={12} aria-hidden="true" />
          {t('stream.spine.deepCta')}
        </button>
      </div>

      {(phase === 'surface-loading' || !surface) && (
        <div className="qw-stream-status qw-stream-status--teaser" data-stream-p0-loading aria-live="polite">
          <p className="qw-stream-status-title">{tUai('surfaceScanning')}</p>
          <div className="qw-stream-skeleton" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </div>
      )}

      {surface && (
        <section className="qw-stream-page" data-stream-page-section={0} aria-label={t('stream.page', { page: 0 })}>
          {surface.web.anchor?.disambiguation && (
            <DisambiguationCard term={surface.web.anchor.localeTitle} url={surface.web.sources.find((s) => s.origin === 'wiki')?.url} />
          )}
          <EssenceCard surface={surface} hasSession={hasSession} onGoPaid={goPaid} onSelectEcosystem={onSelectEcosystem} />
          <AxisSpectrumCard surface={surface} />
          <SourcesCard surface={surface} lang={lang} />
          <ChainCard page={0} followups={followups} onQuery={onRunQuery} />
          <DeepGateCard id={DEEP_GATE_ID} phase={phase} deep={deep} error={error} canDeep={canDeep} deepAvailable={deepAvailable} hasSession={hasSession} onRunDeep={onRunDeep} />
          {/* "실시간 유니타스 랭킹" stays mounted in the result (owner
              instruction 2026-09-04 round 2). */}
          <div className="qw-stream-rankings">
            <UnitasModuleRankings />
          </div>
        </section>
      )}

      {surface &&
        pages.map((page, i) =>
          i < ghostBefore ? (
            <div
              key={`ghost-${page.page}`}
              className="qw-stream-ghost"
              data-stream-ghost={page.page}
              style={{ minHeight: heightsRef.current.get(page.page) ?? 480 }}
              aria-hidden="true"
            >
              <span>{t('stream.ghost', { page: page.page })}</span>
            </div>
          ) : (
            <section key={`page-${page.page}`} className="qw-stream-page" data-stream-page-section={page.page} data-stream-thin={page.thin ? '1' : undefined} aria-label={t('stream.page', { page: page.page })}>
              <p className="qw-stream-page-marker">
                <span className="qw-stream-mono">p{page.page}</span>
                {page.thin && <span className="qw-stream-scope qw-stream-scope--honest">{t('stream.thin')}</span>}
              </p>
              {renderPage(page)}
            </section>
          ),
        )}

      {surface && stream.loading && <TeaserCard page={nextPage} next={streamRecipe(nextPage).filter((k) => k !== 'cogs')} />}
      {surface && stream.paused && !stream.capped && <SoftPauseCard pages={pages[pages.length - 1]?.page ?? 0} onResume={stream.resume} />}
      {surface && stream.stalled && !stream.capped && <RetryCard onRetry={stream.retry} />}
      {surface && stream.capped && <EndCard />}

      <div ref={sentinelRef} className="qw-stream-sentinel" data-stream-sentinel aria-hidden="true" />
      {surface && !stream.capped && (
        <button
          type="button"
          className="qw-stream-more"
          onClick={stream.paused ? stream.resume : stream.stalled ? stream.retry : stream.loadMore}
          disabled={stream.loading}
          data-stream-more
        >
          {stream.loading ? t('stream.loading') : t('stream.more')}
        </button>
      )}
    </div>
  );
}
