'use client';

/**
 * The infinity stream's NETWORK and STATUS cards. Every card names its real
 * source through the omni-tech registry, every follow-up re-runs the stream
 * on the entity, and nothing here uses backdrop-filter or animates anything
 * but transform / opacity.
 *
 * REV-23 M2.2 (founder directive 2026-09-13): the switch below used to serve
 * 23 kinds. It now serves the nine networked survivors -- concepts · sites ·
 * news · derived · attention · community · graph · global · extracts -- and
 * the four status cards. `CogsCardView`, `Gallery` and `OutboundRow` went
 * with the kinds they existed for; the outbound brand row now lives once, in
 * the omni-open block ("다른플랫폼에서열기").
 *
 * REV-23 M2.3 -- TWO-STEP ACTIVATION. A card no longer opens because the
 * visitor happened to click its padding, and the top-right shortcut arrow is
 * gone. Only the title text area is a target: the first click SELECTS
 * (`data-selected="1"`, a visible focus ring), a second click on the same
 * title OPENS. See lib/uai/twoStepSelect.ts for the state machine and its
 * unit tests.
 */
import { useCallback, useState, type ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  ArrowRight,
  ExternalLink,
  Link2,
  Newspaper,
  Layers,
  Activity,
  MessageSquare,
  BookOpen,
  PauseCircle,
  RotateCcw,
  Flag,
  Workflow,
  AlignLeft,
  Globe2,
} from 'lucide-react';
import { sourceById, sourceLabel, type SourceId } from '@/lib/uai/sourceRegistry';
import { nextSelectState, type TwoStepAction } from '@/lib/uai/twoStepSelect';
import type { StreamCard, StreamCardKind, StreamFact, StreamItem } from '@/lib/uai/stream/streamTypes';

export type RunQuery = (query: string, qid?: string) => void;

const KIND_ICON: Partial<Record<StreamCardKind, typeof Link2>> = {
  concepts: Link2,
  sites: ExternalLink,
  news: Newspaper,
  derived: BookOpen,
  attention: Activity,
  community: MessageSquare,
  omni: Layers,
  graph: Workflow,
  extracts: AlignLeft,
  global: Globe2,
};

/* ------------------------------------------------------------------ */
/* Two-step title                                                       */
/* ------------------------------------------------------------------ */

/**
 * REV-23 M2.3 -- the ONLY activation target on a card, sub-heading or
 * detail heading. One click selects, the next opens. `onOpen` may be
 * omitted, in which case the title is a pure selection affordance (a card
 * whose body is already fully visible has nothing to open).
 */
export function TwoStepTitle({
  children,
  onOpen,
  className = '',
  as: Tag = 'span',
}: {
  children: ReactNode;
  onOpen?: () => void;
  className?: string;
  as?: 'span' | 'p' | 'h3';
}) {
  const [selected, setSelected] = useState(false);
  const act = useCallback(
    (action: TwoStepAction) => {
      const next = nextSelectState(selected, action);
      setSelected(next.selected);
      if (next.open) onOpen?.();
    },
    [selected, onOpen],
  );
  return (
    <Tag className={`qw-two-step ${className}`.trim()} data-two-step="">
      <button
        type="button"
        className="qw-two-step-hit"
        data-selected={selected ? '1' : '0'}
        aria-pressed={selected}
        onClick={() => act('click')}
        onDoubleClick={() => act('dblclick')}
        onBlur={() => setSelected(false)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            act('click');
          }
          if (e.key === 'Escape') setSelected(false);
        }}
      >
        {children}
      </button>
    </Tag>
  );
}

/* ------------------------------------------------------------------ */
/* Shell                                                                */
/* ------------------------------------------------------------------ */

export interface CardShellProps {
  kind: StreamCardKind;
  page: number;
  scope?: 'global' | 'country';
  sourceId?: SourceId;
  sourceUrl?: string;
  /** Overrides the kind label. */
  title?: string;
  id?: string;
  children: ReactNode;
  className?: string;
}

export function CardShell({ kind, page, scope, sourceId, sourceUrl, title, id, children, className = '' }: CardShellProps) {
  const t = useTranslations('Rev21');
  const locale = useLocale();
  const Icon = KIND_ICON[kind];
  const source = sourceId ? sourceById(sourceId) : null;
  return (
    <article
      id={id}
      className={`qw-stream-card ${className}`}
      data-stream-card={kind}
      data-stream-page={page}
      data-stream-scope={scope}
      data-stream-source={sourceId}
    >
      <header className="qw-stream-card-head">
        {/* M2.3: the heading is the activation target; the header's padding
            and the card's whitespace are inert. There is no shortcut arrow
            in the top-right corner any more. */}
        <TwoStepTitle as="p" className="qw-stream-card-kind">
          {Icon && <Icon size={13} aria-hidden="true" />}
          <span>{title ?? t(`stream.kinds.${kind}`)}</span>
        </TwoStepTitle>
        <div className="qw-stream-card-meta">
          {scope && <span className="qw-stream-scope" data-scope={scope}>{t(`deeper.scope.${scope}`)}</span>}
        </div>
      </header>
      <div className="qw-stream-card-body">{children}</div>
      {source && (
        <footer className="qw-stream-card-source">
          {sourceUrl ? (
            <a href={sourceUrl} target="_blank" rel="noopener noreferrer nofollow">
              {t('deeper.viaSource', { source: sourceLabel(source.id, locale, true) })}
            </a>
          ) : (
            <span>{t('deeper.viaSource', { source: sourceLabel(source.id, locale, true) })}</span>
          )}
        </footer>
      )}
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* Shared pieces                                                        */
/* ------------------------------------------------------------------ */

export function Facts({ facts }: { facts: StreamFact[] }) {
  const t = useTranslations('Rev21');
  return (
    <div className="qw-stream-facts">
      {facts.map((f, i) => (
        <span key={i} className={f.emphasis ? 'qw-stream-fact qw-stream-fact--big' : 'qw-stream-fact'}>
          <span className="qw-stream-fact-value">
            {f.value}
            {f.unit && <span className="qw-stream-fact-unit">{f.unit}</span>}
          </span>
          <span className="qw-stream-fact-label">{f.literal ? f.label : t(`stream.fields.${f.label}`)}</span>
        </span>
      ))}
    </div>
  );
}

export function Items({ items, onQuery, dense = false }: { items: StreamItem[]; onQuery: RunQuery; dense?: boolean }) {
  const locale = useLocale();
  return (
    <ul className={`qw-stream-items ${dense ? 'qw-stream-items--dense' : ''}`}>
      {items.map((it) => (
        <li key={it.id} className="qw-stream-item">
          {it.url ? (
            <a href={it.url} target="_blank" rel="noopener noreferrer nofollow" className="qw-stream-item-link" data-stream-item-source={it.sourceId}>
              <span className="qw-stream-item-title">{it.title}</span>
              {it.meta && <span className="qw-stream-item-meta">{it.meta}</span>}
              {it.sourceId && <span className="qw-stream-item-badge">{sourceLabel(it.sourceId, locale)}</span>}
            </a>
          ) : (
            <span className="qw-stream-item-link">
              <span className="qw-stream-item-title">{it.title}</span>
              {it.meta && <span className="qw-stream-item-meta">{it.meta}</span>}
            </span>
          )}
          {it.query && (
            <button type="button" className="qw-stream-follow" onClick={() => onQuery(it.query!, it.qid)} data-stream-follow={it.qid ?? it.query} aria-label={it.query}>
              <ArrowRight size={13} aria-hidden="true" />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

export function Chips({ items, onQuery }: { items: StreamItem[]; onQuery: RunQuery }) {
  return (
    <div className="qw-stream-chips">
      {items.map((it) => (
        <button key={it.id} type="button" className="qw-stream-chip" onClick={() => onQuery(it.query ?? it.title, it.qid)} data-stream-chip={it.qid ?? it.title}>
          {it.title}
          <ArrowRight size={12} aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}

export function Spark({ points, color = '#22d3ee' }: { points: number[]; color?: string }) {
  const w = 240;
  const h = 56;
  if (points.length < 2) return null;
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const span = Math.max(1, max - min);
  const d = points.map((p, i) => `${((i / (points.length - 1)) * w).toFixed(1)},${(h - ((p - min) / span) * (h - 4) - 2).toFixed(1)}`).join(' ');
  return (
    <svg className="qw-stream-spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <polyline points={d} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Network cards                                                        */
/* ------------------------------------------------------------------ */

export function NetworkCard({ card, onQuery }: { card: StreamCard; onQuery: RunQuery }) {
  switch (card.kind) {
    case 'concepts':
      return (
        <CardShell kind="concepts" page={card.page} scope={card.scope} sourceId={card.sourceId} sourceUrl={card.sourceUrl}>
          {card.items && <Chips items={card.items} onQuery={onQuery} />}
        </CardShell>
      );
    case 'sites':
      return (
        <CardShell kind="sites" page={card.page} scope={card.scope} sourceId={card.sourceId} sourceUrl={card.sourceUrl}>
          {card.items && <Items items={card.items} onQuery={onQuery} dense />}
        </CardShell>
      );
    case 'news':
      return (
        <CardShell kind="news" page={card.page} scope={card.scope} sourceId={card.sourceId} sourceUrl={card.sourceUrl}>
          {card.items && <Items items={card.items} onQuery={onQuery} />}
        </CardShell>
      );
    case 'derived':
      return (
        <CardShell kind="derived" page={card.page} scope={card.scope} sourceId={card.sourceId} sourceUrl={card.sourceUrl}>
          {card.items && <Items items={card.items} onQuery={onQuery} />}
        </CardShell>
      );
    case 'attention':
      return (
        <CardShell kind="attention" page={card.page} scope={card.scope} sourceId={card.sourceId} sourceUrl={card.sourceUrl}>
          {card.series && <Spark points={card.series.points} />}
          {card.series?.dates && card.series.dates.length > 1 && (
            <p className="qw-stream-spark-dates">
              <span>{card.series.dates[0]}</span>
              <span>{card.series.dates[card.series.dates.length - 1]}</span>
            </p>
          )}
          {card.facts && <Facts facts={card.facts} />}
        </CardShell>
      );
    case 'community':
      return (
        <CardShell kind="community" page={card.page} scope={card.scope} sourceId={card.sourceId} sourceUrl={card.sourceUrl}>
          {card.items && <Items items={card.items} onQuery={onQuery} />}
        </CardShell>
      );
    case 'graph':
      return (
        <CardShell kind="graph" page={card.page} scope={card.scope} sourceId={card.sourceId} sourceUrl={card.sourceUrl}>
          {card.facts && card.facts.length > 0 && <Facts facts={card.facts} />}
          {card.items && <Chips items={card.items} onQuery={onQuery} />}
        </CardShell>
      );
    case 'global':
      return (
        <CardShell kind="global" page={card.page} scope={card.scope} sourceId={card.sourceId} sourceUrl={card.sourceUrl}>
          {card.facts && card.facts.length > 0 && <Facts facts={card.facts} />}
          {card.items && <Items items={card.items} onQuery={onQuery} />}
        </CardShell>
      );
    case 'extracts':
      return (
        <CardShell kind="extracts" page={card.page} scope={card.scope} sourceId={card.sourceId} sourceUrl={card.sourceUrl}>
          {card.text &&
            card.text.split('\n\n').map((p, i) => (
              <p key={i} className="qw-stream-text">
                {p}
              </p>
            ))}
          {card.facts && <Facts facts={card.facts} />}
        </CardShell>
      );
    default:
      return null;
  }
}

/* ------------------------------------------------------------------ */
/* Status cards                                                         */
/* ------------------------------------------------------------------ */

export function TeaserCard({ page, next }: { page: number; next: StreamCardKind[] }) {
  const t = useTranslations('Rev21');
  return (
    <div className="qw-stream-status qw-stream-status--teaser" data-stream-teaser={page} aria-live="polite">
      <p className="qw-stream-status-title">{t('stream.loading')}</p>
      <p className="qw-stream-status-body">
        <span className="qw-stream-status-label">{t('stream.teaser')}</span>
        {next.map((k) => (
          <span key={k} className="qw-stream-scope">
            {t(`stream.kinds.${k}`)}
          </span>
        ))}
      </p>
      <div className="qw-stream-skeleton" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}

export function SoftPauseCard({ pages, onResume }: { pages: number; onResume: () => void }) {
  const t = useTranslations('Rev21');
  return (
    <div className="qw-stream-status qw-stream-status--pause" data-stream-pause={pages} role="status">
      <p className="qw-stream-card-kind">
        <PauseCircle size={13} aria-hidden="true" />
        <span>{t('stream.softPause.title')}</span>
        <span className="qw-stream-scope qw-stream-scope--honest">{t('stream.softPause.badge')}</span>
      </p>
      <p className="qw-stream-status-body">{t('stream.softPause.body', { pages })}</p>
      <button type="button" className="qw-stream-more" onClick={onResume} data-stream-resume>
        {t('stream.softPause.continue')}
        <ArrowRight size={13} aria-hidden="true" />
      </button>
    </div>
  );
}

export function EndCard() {
  const t = useTranslations('Rev21');
  return (
    <div className="qw-stream-status qw-stream-status--end" data-stream-end role="status">
      <p className="qw-stream-card-kind">
        <Flag size={13} aria-hidden="true" />
        <span>{t('stream.end.title')}</span>
      </p>
      <p className="qw-stream-status-body">{t('stream.end.body')}</p>
    </div>
  );
}

export function RetryCard({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations('Rev21');
  return (
    <div className="qw-stream-status qw-stream-status--retry" data-stream-retry role="status">
      <p className="qw-stream-card-kind">
        <RotateCcw size={13} aria-hidden="true" />
        <span>{t('stream.retry.title')}</span>
      </p>
      <p className="qw-stream-status-body">{t('stream.retry.body')}</p>
      <button type="button" className="qw-stream-more" onClick={onRetry} data-stream-retry-action>
        {t('stream.retry.action')}
      </button>
    </div>
  );
}

export function DisambiguationCard({ term, url }: { term: string; url?: string }) {
  const t = useTranslations('Rev21');
  return (
    <div className="qw-stream-status qw-stream-status--disambiguation" data-stream-disambiguation role="note">
      <p className="qw-stream-card-kind">
        <Layers size={13} aria-hidden="true" />
        <span>{t('deeper.chooseMeaning')}</span>
      </p>
      <p className="qw-stream-status-body">{t('stream.disambiguation.body')}</p>
      {url && (
        <a href={url} target="_blank" rel="noopener noreferrer nofollow" className="qw-stream-item-badge">
          {term} · {t('deeper.wikiLink')}
        </a>
      )}
    </div>
  );
}
