'use client';

import { useEffect, useMemo, useRef, type CSSProperties } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowUpRight, ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import { useSpatialAudio } from '@/components/audio/SpatialAudioProvider';
import type { DeeperAnchor } from '@/lib/uai/deeperAnchor';
import { deeperTheme, type DeeperCard, type DeeperContext, type DeeperItem, type DeeperPage, type DeeperScope, type DeeperThemeKey } from '@/lib/uai/deeperThemes';
import { useDeeperPage } from '@/lib/uai/useDeeperPage';
import { OmniTechSwarm } from '@/components/home/deeper/OmniTechSwarm';
import type { SwarmInputDimension } from '@/lib/uai/swarmLayout';
import { sourceAttribution, sourceById, sourceLabel, type SourceId } from '@/lib/uai/sourceRegistry';

/**
 * REV-21 §3.4 -- one theme's page inside its modal: cards grouped global
 * → country (§2A), an IntersectionObserver sentinel that pulls the next
 * cursor page (with a plain button as the keyboard / reduced-motion
 * fallback), every card stamped with its REAL source, and a re-anchor chip
 * on any item that carries a Wikidata item (rule ③: the anchor swaps in
 * place, no history entry). Paging never pushes history.
 */

export interface DeeperThemePageProps {
  theme: DeeperThemeKey;
  anchor: DeeperAnchor;
  ctx: Pick<DeeperContext, 'locale' | 'lang' | 'country'>;
  onReanchor?: (next: { qid: string; title: string; lang?: string }) => void;
}

function Spark({ points, unit, color }: { points: number[]; unit?: string; color: string }) {
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const span = max - min || 1;
  const w = 100;
  const h = 32;
  const d = points.map((p, i) => `${((i / Math.max(1, points.length - 1)) * w).toFixed(2)},${(h - ((p - min) / span) * h).toFixed(2)}`).join(' ');
  return (
    <svg className="qw-deeper-spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <polyline points={d} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      {unit && <title>{unit}</title>}
    </svg>
  );
}

export function DeeperThemePage({ theme, anchor, ctx, onReanchor }: DeeperThemePageProps) {
  const t = useTranslations('Rev21.deeper');
  const { playHoverSfx } = useSpatialAudio();
  const meta = deeperTheme(theme);
  const feed = useDeeperPage(theme, anchor, ctx);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const field = (f: string | undefined) => (f ? t(`themes.${theme}.${f}`) : '');

  // The sentinel pulls the next page when it scrolls into view; the modal
  // body is the scroll root (nearest scrollable ancestor).
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || feed.done || feed.failed || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) feed.loadMore();
      },
      { rootMargin: '160px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [feed, feed.done, feed.failed, feed.pages.length]);

  const cards = useMemo(() => feed.pages.flatMap((p) => p.cards), [feed.pages]);
  const usedSources = useMemo(() => Array.from(new Set(feed.pages.flatMap((p: DeeperPage) => p.sources))), [feed.pages]);
  const accent = { '--qw-deeper-accent': meta.color } as CSSProperties;

  /**
   * REV-24 MISSION 4 (founder directive 2026-09-13) -- THE OMNI-TECH SWARM.
   *
   * `bigTechPulse` emits one `chips` card per Wikidata dimension, three
   * dimensions per cursor page. Rendered as chips those six cards are six
   * disconnected word lists; what the adapter actually found is a graph with
   * the organisation at its centre. So for this ONE theme the chips cards are
   * lifted out of the ordinary card flow and fused into a single living
   * field, which grows another sector every time a cursor page lands.
   *
   * Every other theme, and every other card kind on this one (the
   * `bigtech-scale` employees/revenue facts card included), renders exactly
   * as before -- this is an additional reading of the same data, not a fork
   * of the page.
   */
  const swarmDimensions = useMemo<SwarmInputDimension[]>(() => {
    if (theme !== 'bigTechPulse') return [];
    return cards
      .filter((c) => c.kind === 'chips' && c.items && c.items.length > 0)
      .map((c) => ({
        key: c.id,
        label: field(c.field) || c.id,
        nodes: (c.items ?? []).map((it) => ({ id: it.id, title: it.title, qid: it.qid, url: it.url })),
      }));
    // `field` closes over `t` and `theme`; both are stable for a given page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme, cards]);
  const byScope = useMemo(() => {
    const absorbed = new Set(swarmDimensions.map((d) => d.key));
    const groups: Record<DeeperScope, DeeperCard[]> = { global: [], country: [] };
    // REV-24 M4: a card the swarm absorbed is not ALSO drawn as chips below.
    for (const c of cards) if (!absorbed.has(c.id)) groups[c.scope].push(c);
    return groups;
  }, [cards, swarmDimensions]);

  function renderItem(item: DeeperItem, card: DeeperCard) {
    const canReanchor = Boolean(item.qid && onReanchor && item.qid !== anchor.qid);
    return (
      <li key={item.id} className="qw-deeper-item flex items-start gap-2 text-[14px] leading-snug">
        <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: meta.color }} aria-hidden="true" />
        <span className="min-w-0 flex-1">
          {item.url ? (
            <a href={item.url} target="_blank" rel="noopener noreferrer nofollow" onMouseEnter={() => playHoverSfx()} className="qw-deeper-link font-semibold text-white hover:underline">
              {item.title}
              <ExternalLink size={10} className="ml-1 inline opacity-60" aria-hidden="true" />
            </a>
          ) : (
            <span className="font-semibold text-white">{item.title}</span>
          )}
          {item.meta && <span className="qw-deeper-meta ml-1.5 text-[12px] text-gray-500">{item.meta}</span>}
          {canReanchor && (
            <button
              type="button"
              onMouseEnter={() => playHoverSfx()}
              onClick={() => onReanchor?.({ qid: item.qid!, title: item.title, lang: item.lang })}
              className="qw-deeper-reanchor ml-2 inline-flex items-center gap-1 border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest"
              style={{ borderColor: `${meta.color}66`, color: meta.color }}
              data-deeper-reanchor={item.qid}
            >
              <ArrowUpRight size={10} aria-hidden="true" />
              {t('reAnchor')}
            </button>
          )}
          {item.sourceId && item.sourceId !== card.sourceId && (
            <span className="ml-1.5 text-[10px] uppercase tracking-widest text-gray-500">{sourceLabel(item.sourceId, ctx.locale)}</span>
          )}
        </span>
      </li>
    );
  }

  function renderCard(card: DeeperCard) {
    const source = sourceById(card.sourceId);
    return (
      <article key={card.id} className="qw-deeper-card border border-white/10 bg-void/40 p-3" data-deeper-card={card.kind} data-deeper-source={card.sourceId} style={accent}>
        {(card.field || card.text) && (
          <p className="qw-deeper-card-head mb-1.5 flex flex-wrap items-baseline gap-x-2 text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: meta.color }}>
            {field(card.field)}
            {card.text && <span className="normal-case tracking-normal text-gray-400">{card.text}</span>}
          </p>
        )}
        {card.kind === 'facts' && card.facts && (
          <dl className="qw-deeper-facts grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2">
            {card.facts.map((f, i) => (
              <div key={i} className={`min-w-0 ${f.emphasis ? 'sm:col-span-2' : ''}`}>
                <dt className="qw-deeper-fact-label text-[11px] uppercase tracking-widest text-gray-500">{f.literal ? f.label : field(f.label)}</dt>
                <dd className={`qw-deeper-fact-value break-words tabular-nums ${f.emphasis ? 'text-[24px] font-bold text-white' : 'text-[14px] font-semibold text-gray-200'}`}>
                  {f.value}
                  {f.unit && <span className="ml-1 text-[11px] font-semibold text-gray-500">{f.unit}</span>}
                </dd>
              </div>
            ))}
          </dl>
        )}
        {card.kind === 'spark' && card.series && (
          <div className="qw-deeper-spark-wrap">
            <Spark points={card.series.points} unit={card.series.unit} color={meta.color} />
            {card.facts && (
              <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
                {card.facts.map((f, i) => (
                  <span key={i} className={f.emphasis ? 'text-[22px] font-bold tabular-nums text-white' : 'text-[13px] font-semibold text-gray-300'}>
                    {f.value}
                    <span className="ml-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-500">{f.literal ? f.label : field(f.label)}</span>
                  </span>
                ))}
              </div>
            )}
            {card.series.dates && card.series.dates.length > 1 && (
              <p className="mt-1 flex justify-between text-[10px] text-gray-500">
                <span>{card.series.dates[0]}</span>
                <span>{card.series.dates[card.series.dates.length - 1]}</span>
              </p>
            )}
          </div>
        )}
        {(card.kind === 'list' || card.kind === 'chips') && card.items && (
          card.kind === 'chips' ? (
            <ul className="flex flex-wrap gap-1.5">
              {card.items.map((item) => (
                <li key={item.id}>
                  {item.url ? (
                    <a href={item.url} target="_blank" rel="noopener noreferrer nofollow" onMouseEnter={() => playHoverSfx()} className="qw-deeper-chip inline-flex items-center gap-1.5 border border-white/15 px-2 py-1 text-[12px] font-semibold text-gray-200 hover:border-white/40">
                      {item.meta && <span className="text-[10px] uppercase tracking-widest text-gray-500">{item.meta}</span>}
                      {item.title}
                    </a>
                  ) : (
                    <span className="qw-deeper-chip inline-flex items-center gap-1.5 border border-white/15 px-2 py-1 text-[12px] font-semibold text-gray-200">
                      {item.meta && <span className="text-[10px] uppercase tracking-widest text-gray-500">{item.meta}</span>}
                      {item.title}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <ol className="space-y-1.5">{card.items.map((item) => renderItem(item, card))}</ol>
          )
        )}
        {card.kind === 'list' && card.facts && card.facts.length > 0 && (
          <p className="mt-2 text-[11px] text-gray-500">
            {card.facts.map((f, i) => (
              <span key={i} className="mr-3">
                {f.literal ? f.label : field(f.label)} <span className="font-bold text-gray-300">{f.value}</span>
              </span>
            ))}
          </p>
        )}
        {card.kind === 'image' && card.image && (
          <figure className="qw-deeper-figure">
            <a href={card.image.pageUrl} target="_blank" rel="noopener noreferrer nofollow" onMouseEnter={() => playHoverSfx()}>
              {/* eslint-disable-next-line @next/next/no-img-element -- remote Commons thumbnail, sized by the API */}
              <img
                src={card.image.src}
                alt={card.image.alt}
                width={card.image.width}
                height={card.image.height}
                loading="lazy"
                decoding="async"
                className="qw-deeper-img h-auto w-full bg-void/60 object-cover"
                style={card.image.width && card.image.height ? { aspectRatio: `${card.image.width} / ${card.image.height}` } : undefined}
              />
            </a>
            <figcaption className="mt-1.5 text-[11px] text-gray-500">
              {card.image.license && (
                <span className="mr-3">
                  {t('licenseLabel')} <span className="font-bold text-gray-300">{card.image.license}</span>
                </span>
              )}
              {card.image.author && (
                <span>
                  {t('authorLabel')} <span className="font-bold text-gray-300">{card.image.author}</span>
                </span>
              )}
            </figcaption>
          </figure>
        )}
        {card.kind === 'text' && card.text && !card.field && <p className="text-[14px] leading-relaxed text-gray-200">{card.text}</p>}
        <p className="qw-deeper-card-source mt-2 text-[10px] uppercase tracking-widest text-gray-500">
          {card.sourceUrl ? (
            <a href={card.sourceUrl} target="_blank" rel="noopener noreferrer nofollow" className="hover:text-gray-300">
              {t('viaSource', { source: sourceLabel(card.sourceId, ctx.locale, true) })}
            </a>
          ) : (
            t('viaSource', { source: sourceLabel(card.sourceId, ctx.locale, true) })
          )}
          {source.side === 'server' && <span className="ml-1.5 normal-case tracking-normal">· {sourceAttribution(card.sourceId, ctx.locale)}</span>}
        </p>
      </article>
    );
  }

  const nothingYet = feed.pages.length > 0 && cards.length === 0 && feed.done;

  return (
    <article className="qw-deeper-page space-y-4" data-deeper-page={theme} data-deeper-anchor={anchor.qid ?? anchor.term} style={accent}>
      <header className="flex items-start gap-3">
        <meta.icon size={26} style={{ color: meta.color }} className="mt-0.5 shrink-0" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p id={`deeper-${theme}-title`} className="text-[20px] font-bold text-white">
            {t(`themes.${theme}.title`)}
          </p>
          <p className="mt-0.5 text-[14px] text-gray-400">{t(`themes.${theme}.hook`)}</p>
          <p className="qw-deeper-anchor-line mt-1 text-[12px] font-semibold text-gray-500" aria-label={t('anchorAria', { term: anchor.term })}>
            {anchor.term}
            {anchor.enTitle && anchor.enTitle !== anchor.term && <span> · {anchor.enTitle}</span>}
            {anchor.qid && <span className="ml-1.5 font-mono text-[10px] text-gray-600">{anchor.qid}</span>}
          </p>
        </div>
      </header>

      {/* REV-24 M4: the swarm sits directly under the header, above the
          remaining cards, so the graph is what the visitor meets first and
          the numeric scale card reads as its footnote. It carries the same
          `data-deeper-card` / `data-deeper-source` hooks the E2E selectors
          expect of anything in this flow. */}
      {swarmDimensions.length > 0 && (
        <section data-deeper-scope="global" className="space-y-2">
          <article className="qw-deeper-card qw-deeper-card--swarm border border-white/10 bg-void/40 p-3" data-deeper-card="swarm" data-deeper-source="wikidata" style={accent}>
            <p className="qw-deeper-card-head mb-1.5 flex flex-wrap items-baseline gap-x-2 text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: meta.color }}>
              {t(`themes.${theme}.title`)}
            </p>
            <OmniTechSwarm
              dimensions={swarmDimensions}
              coreLabel={anchor.term}
              color={meta.color}
              reAnchorLabel={t('reAnchor')}
              onReanchor={onReanchor ? ({ qid, title }) => onReanchor({ qid, title, lang: ctx.lang }) : undefined}
            />
          </article>
        </section>
      )}

      {(['global', 'country'] as const).map((scope) =>
        byScope[scope].length > 0 ? (
          <section key={scope} data-deeper-scope={scope} className="space-y-2">
            <p className="qw-deeper-scope text-[11px] font-bold uppercase tracking-[0.25em] text-gray-500">{t(`scope.${scope}`)}</p>
            <div className="grid grid-cols-1 gap-2">{byScope[scope].map(renderCard)}</div>
          </section>
        ) : null,
      )}

      {feed.loading && (
        <p className="flex items-center gap-2 py-2 text-[13px] text-gray-400" aria-live="polite">
          <Loader2 size={14} className="animate-spin" style={{ color: meta.color }} aria-hidden="true" />
          {t('loading')}
        </p>
      )}
      {feed.failed && (
        <div className="qw-deeper-retry border border-white/10 p-3 text-[13px] text-gray-400" role="status">
          <p>{t('retryHint')}</p>
          <button type="button" onMouseEnter={() => playHoverSfx()} onClick={feed.retry} className="mt-2 flex items-center gap-1.5 border px-3 py-1.5 text-[12px] font-bold uppercase tracking-widest" style={{ borderColor: `${meta.color}66`, color: meta.color }}>
            <RefreshCw size={12} aria-hidden="true" />
            {t('retry')}
          </button>
        </div>
      )}
      {nothingYet && <p className="py-2 text-[13px] text-gray-500">{t('emptyPage')}</p>}
      {!feed.done && !feed.failed && (
        <>
          <div ref={sentinelRef} data-deeper-sentinel="" aria-hidden="true" className="h-px" />
          <button
            type="button"
            onMouseEnter={() => playHoverSfx()}
            onClick={feed.loadMore}
            disabled={feed.loading}
            className="qw-deeper-more flex w-full items-center justify-center gap-2 border border-white/15 py-2 text-[12px] font-bold uppercase tracking-widest text-gray-300 hover:border-white/40 disabled:opacity-50"
            data-deeper-more=""
          >
            {t('more')}
          </button>
        </>
      )}
      {feed.done && cards.length > 0 && <p className="text-center text-[11px] text-gray-500">{t('end')}</p>}

      <footer className="qw-deeper-page-sources border-t border-white/10 pt-3 text-[11px] text-gray-500">
        <p className="mb-1 font-bold uppercase tracking-widest">{t('sourcesLabel')}</p>
        <ul className="space-y-0.5">
          {(usedSources.length > 0 ? usedSources : [...meta.sources]).map((id: SourceId) => (
            <li key={id}>
              <a href={sourceById(id).homepage} target="_blank" rel="noopener noreferrer nofollow" className="font-bold text-gray-300 hover:underline">
                {sourceLabel(id, ctx.locale, true)}
              </a>
              <span className="ml-1.5">{sourceAttribution(id, ctx.locale)}</span>
            </li>
          ))}
        </ul>
      </footer>
    </article>
  );
}
