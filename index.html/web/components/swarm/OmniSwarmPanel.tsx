'use client';

import { useCallback, useMemo, useState, type CSSProperties } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronRight, Cpu, ExternalLink, Loader2 } from 'lucide-react';
import { useSpatialAudio } from '@/components/audio/SpatialAudioProvider';
import { OmniTechSwarm } from '@/components/swarm/OmniTechSwarm';
import { useOmniSwarm } from '@/lib/swarm/useOmniSwarm';
import type { SwarmAnchor } from '@/lib/swarm/swarmTypes';
import { wikiLangFor } from '@/lib/uai/liveSuggest';
import { sourceById, sourceLabel } from '@/lib/uai/sourceRegistry';

/**
 * REV-32 M1 (founder directive 2026-09-15) -- the omni-tech swarm's own shell.
 *
 * WHAT IT REPLACES. `DeeperThemePage`, a 361-line generic lens renderer that
 * drew six card kinds, an infinite feed, a retry block and a sources footer,
 * and which happened to special-case ONE theme into a swarm. The swarm was a
 * branch inside somebody else's page. Here the field IS the page, and the
 * generic machinery is gone rather than carried.
 *
 * WHAT IT ADDS, and the reason the founder asked for the revival: the
 * "modular absorption" loop finally has a memory. Activating a node used to
 * silently swap the anchor -- the visitor walked from Microsoft to OpenAI to
 * Sam Altman with no way back and no sense of having travelled. The trail
 * below records every absorption, so the walk is visible and reversible, and
 * the field reads as a route through the data rather than a series of
 * unrelated pictures.
 *
 * The FIELD itself (`OmniTechSwarm`) and the GEOMETRY (`swarmLayout`) are the
 * REV-24 originals, byte for byte: no WebGL, no render loop, real buttons,
 * pointer parallax through two CSS custom properties. Nothing about how the
 * graph is drawn changed -- only what can reach it.
 */

/** The REV-23 `bigTechPulse` accent, kept so the field looks like itself. */
export const SWARM_ACCENT = '#38bdf8';

export interface OmniSwarmPanelProps {
  /** The organisation to take apart. A QID is required to draw anything. */
  anchor: SwarmAnchor | null;
  /** `page` gives the field the taller frame the standalone route wants. */
  variant?: 'panel' | 'page';
  className?: string;
}

export function OmniSwarmPanel({ anchor, variant = 'panel', className = '' }: OmniSwarmPanelProps) {
  const t = useTranslations('Rev32.swarm');
  const locale = useLocale();
  const { playHoverSfx, playQuestEnterSfx } = useSpatialAudio();
  const lang = wikiLangFor(locale);

  /** The absorption trail. The last entry is what the field is drawing. */
  const [trail, setTrail] = useState<SwarmAnchor[]>([]);
  const rootKey = `${anchor?.qid ?? ''}|${anchor?.term ?? ''}`;
  const [rootSeen, setRootSeen] = useState(rootKey);
  if (rootKey !== rootSeen) {
    // A new subject arrived from the host: start a new walk, in render, so
    // the field never paints one frame of the previous organisation.
    setRootSeen(rootKey);
    setTrail([]);
  }

  const current = trail.length > 0 ? trail[trail.length - 1] : anchor;

  const fieldLabel = useCallback((field: string) => t(`fields.${field}` as 'fields.f1'), [t]);
  const swarm = useOmniSwarm(current, lang, locale, fieldLabel);

  const absorb = useCallback(
    (next: { qid: string; title: string }) => {
      playQuestEnterSfx();
      setTrail((prev) => [...prev, { qid: next.qid, term: next.title, lang }]);
    },
    [lang, playQuestEnterSfx],
  );

  /** Step back to any earlier subject; index -1 is the host's own anchor. */
  const rewind = useCallback((index: number) => {
    setTrail((prev) => prev.slice(0, index + 1));
  }, []);

  const accent = { '--qw-swarm-accent': SWARM_ACCENT } as CSSProperties;
  const crumbs = useMemo(() => [anchor, ...trail].filter(Boolean) as SwarmAnchor[], [anchor, trail]);
  const term = current?.term ?? '';
  const hasEntity = Boolean(current?.qid);
  const drawable = swarm.dimensions.length > 0;

  return (
    <section
      className={`qw-swarm-panel ${variant === 'page' ? 'qw-swarm-panel--page' : ''} ${className}`}
      data-omni-swarm-panel=""
      data-swarm-state={swarm.loading ? 'loading' : swarm.failed ? 'failed' : drawable ? 'ready' : 'empty'}
      style={accent}
    >
      <header className="qw-swarm-head mb-3">
        <p className="qw-section-label inline-flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-widest text-accent">
          <Cpu size={13} aria-hidden="true" />
          {t('title')}
        </p>
        <p className="qw-swarm-lede mt-1 text-[13px] leading-snug text-gray-400">{t('lede')}</p>

        {/* The absorption trail: every subject this walk has passed through. */}
        {crumbs.length > 0 && (
          <nav className="qw-swarm-trail mt-2 flex flex-wrap items-center gap-x-1 gap-y-1 text-[12px]" aria-label={t('trailAria')} data-swarm-trail="">
            {crumbs.map((c, i) => {
              const last = i === crumbs.length - 1;
              return (
                <span key={`${c.qid ?? c.term}-${i}`} className="inline-flex items-center gap-1">
                  {i > 0 && <ChevronRight size={11} className="opacity-50" aria-hidden="true" />}
                  {last ? (
                    <span className="font-bold text-white" aria-current="location" data-swarm-crumb-current="">
                      {c.term}
                    </span>
                  ) : (
                    <button
                      type="button"
                      data-swarm-crumb={i}
                      onMouseEnter={() => playHoverSfx()}
                      onClick={() => rewind(i - 1)}
                      className="font-semibold text-gray-400 hover:text-white hover:underline"
                    >
                      {c.term}
                    </button>
                  )}
                </span>
              );
            })}
          </nav>
        )}
      </header>

      {/* The scale header: what this organisation weighs. */}
      {swarm.facts.length > 0 && (
        <dl className="qw-swarm-facts mb-3 flex flex-wrap gap-x-6 gap-y-2" data-swarm-facts="">
          {swarm.facts.map((f) => (
            <div key={f.label}>
              <dt className="text-[11px] uppercase tracking-widest text-gray-500">
                {f.literal ? f.label : t(`facts.${f.label}` as 'facts.scaleEmployees')}
                {f.unit && <span className="ml-1 opacity-70">({f.unit})</span>}
              </dt>
              <dd className={`tabular-nums ${f.emphasis ? 'text-[24px] font-bold text-white' : 'text-[15px] font-semibold text-gray-200'}`}>{f.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {!hasEntity ? (
        <p className="qw-swarm-note text-[13px] text-gray-500" data-swarm-note="no-entity">
          {t('needsEntity')}
        </p>
      ) : swarm.loading ? (
        <p className="qw-swarm-note flex items-center gap-2 py-6 text-[13px] text-gray-400" aria-live="polite" data-swarm-note="loading">
          <Loader2 size={14} className="animate-spin" style={{ color: SWARM_ACCENT }} aria-hidden="true" />
          {t('loading')}
        </p>
      ) : swarm.failed ? (
        <p className="qw-swarm-note py-6 text-[13px] text-gray-400" role="status" data-swarm-note="failed">
          {t('failed')}
        </p>
      ) : drawable ? (
        <div className="qw-swarm-frame border border-white/10 bg-void/40 p-3" data-swarm-card="swarm" data-swarm-source="wikidata">
          <OmniTechSwarm
            dimensions={swarm.dimensions}
            coreLabel={term}
            color={SWARM_ACCENT}
            reAnchorLabel={t('reAnchor')}
            onReanchor={absorb}
            viewportLabels={{
              zoomIn: t('viewport.zoomIn'),
              zoomOut: t('viewport.zoomOut'),
              reset: t('viewport.reset'),
              hint: t('viewport.hint'),
            }}
          />
        </div>
      ) : (
        <p className="qw-swarm-note py-6 text-[13px] text-gray-500" data-swarm-note="empty">
          {t('empty')}
        </p>
      )}

      {swarm.sources.length > 0 && (
        <p className="qw-swarm-sources mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-500" data-swarm-sources="">
          <span className="font-bold uppercase tracking-widest">{t('sourceNote')}</span>
          {swarm.sources.map((id) => (
            <a
              key={id}
              href={current?.qid && id === 'wikidata' ? `https://www.wikidata.org/wiki/${current.qid}` : sourceById(id).homepage}
              target="_blank"
              rel="noopener noreferrer nofollow"
              data-swarm-source-link={id}
              onMouseEnter={() => playHoverSfx()}
              className="inline-flex items-center gap-1 font-semibold text-gray-300 hover:underline"
            >
              {sourceLabel(id, locale)}
              <ExternalLink size={9} className="opacity-60" aria-hidden="true" />
            </a>
          ))}
        </p>
      )}
    </section>
  );
}
