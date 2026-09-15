'use client';

import { useLocale, useTranslations } from 'next-intl';
import { ExternalLink } from 'lucide-react';
import { useSpatialAudio } from '@/components/audio/SpatialAudioProvider';
import { wikiLangFor } from '@/lib/uai/liveSuggest';
import type { DeeperAnchor } from '@/lib/uai/deeperAnchor';
import {
  OMNI_SOURCE_ROW,
  OUTBOUND_BRAND_ROW,
  omniOpenUrl,
  outboundSearchUrl,
  sourceById,
  sourceLabel,
  type SourceId,
} from '@/lib/uai/sourceRegistry';

/**
 * REV-31 (founder directive 2026-09-15) -- the OMNI-OPEN block that closes
 * every U-AI popup. It replaces the REV-21 "더 깊이 탐색" block, whose lens
 * grid, theme pages, meaning chooser and anchor bridge were deleted whole
 * (M1). What is left is two rows and nothing else:
 *
 *   "다른출처에서열기"   -- the corpora behind the subject (M2)
 *   "다른플랫폼에서열기" -- the big-tech surfaces that hold it (M3)
 *
 * THREE INVARIANTS, enforced by construction rather than by review:
 *
 *  1. ONE TITLE, TWO PLACES. Both headings render from the single
 *     `ROW_TITLE_CLASS` constant with the same icon at the same size, so
 *     "pixel-identical" is not a thing a future edit can drift away from --
 *     there is only one string to edit. Same class, same glyph, same box.
 *  2. ALWAYS A PAIR. The rows render together or not at all. There is no
 *     prop and no anchor shape that yields one without the other, because
 *     the founder directive requires the sources row wherever the platform
 *     row exists, and the sources row sits directly above it in the DOM.
 *  3. NEVER AN EMPTY ROW. Both rows are built from a bare term through
 *     keyless search URLs, so a subject with no Wikidata identifier still
 *     fills both. A subject that HAS one is upgraded in place to the direct
 *     article, which is the only thing the identifier buys here.
 *
 * 한계비용 0원 (Codex §2 #160, #309, #409): this block performs no fetch, no
 * resolution and no caching of any kind. Every href is derived synchronously
 * from the anchor it was handed. The REV-25 anchor bridge existed only to
 * feed the lens grid an entity, and died with it.
 */

/** SPEC host registry -- which surface the block is placed on. */
export type OmniOpenHost =
  | 'weather'
  | 'feed'
  | 'rankingDeep'
  | 'globalRankingDetail'
  | 'unitasProfile'
  | 'keywordTier'
  | 'tower'
  | 'uaiPage'
  | 'newsRail';

export interface OmniOpenProps {
  anchor: DeeperAnchor | null;
  host: OmniOpenHost;
  /** Tight surfaces (keyword tiers, ranking popups) take the short rows. */
  compact?: boolean;
  className?: string;
}

/**
 * INVARIANT 1. The one and only title presentation. Both rows spread this
 * exact string, so their font, size, weight, tracking, colour, gap and
 * icon box are identical by construction.
 */
const ROW_TITLE_CLASS = 'qw-section-label inline-flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-widest text-accent';
/** Both rows share one link presentation too. */
const ROW_CLASS = 'qw-omni-row flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-500';
const LINK_CLASS = 'inline-flex items-center gap-1 font-semibold text-gray-300 hover:underline';

const COMPACT_SOURCES = 3;
const COMPACT_PLATFORMS: readonly SourceId[] = ['googleSearch', 'bingSearch', 'youtube'];

export function OmniOpen({ anchor, host, compact = false, className = '' }: OmniOpenProps) {
  const t = useTranslations('Rev21.deeper');
  const locale = useLocale();
  const { playHoverSfx } = useSpatialAudio();
  const lang = wikiLangFor(locale);

  const term = anchor?.localeTitle ?? anchor?.term ?? '';
  // INVARIANT 2: no subject means no rows -- never one row.
  if (!anchor || !term.trim()) return null;

  const sources = compact ? OMNI_SOURCE_ROW.slice(0, COMPACT_SOURCES) : OMNI_SOURCE_ROW;
  const platforms = compact ? COMPACT_PLATFORMS : OUTBOUND_BRAND_ROW;

  return (
    <section
      className={`qw-omni-open ${compact ? 'qw-omni-open--compact' : ''} ${className}`}
      data-omni-open=""
      data-anchor-kind={anchor.kind}
      data-host={host}
    >
      {/* M2: the sources row, directly above the platform row, always. */}
      <p className={ROW_CLASS} data-omni-row="sources">
        <span className={ROW_TITLE_CLASS}>
          <ExternalLink size={13} aria-hidden="true" />
          {t('sourcesLabel')}
        </span>
        {sources.map((id) => (
          <a
            key={id}
            href={omniOpenUrl(id, term, lang, anchor)}
            target="_blank"
            rel="noopener noreferrer nofollow"
            data-omni-source={id}
            onMouseEnter={() => playHoverSfx()}
            className={LINK_CLASS}
          >
            {sourceLabel(id, locale)}
            <ExternalLink size={9} className="opacity-60" aria-hidden="true" />
          </a>
        ))}
      </p>

      {/* M3: the platform row. */}
      <p className={`${ROW_CLASS} mt-1.5`} data-omni-row="platforms">
        <span className={ROW_TITLE_CLASS}>
          <ExternalLink size={13} aria-hidden="true" />
          {t('outboundLabel')}
        </span>
        {platforms.map((id) => {
          const s = sourceById(id);
          return (
            <a
              key={id}
              href={outboundSearchUrl(id, term, lang)}
              target="_blank"
              rel="noopener noreferrer nofollow"
              data-omni-platform={id}
              title={s.loginWall ? `${sourceLabel(id, locale)} · ${t('loginHint')}` : sourceLabel(id, locale)}
              onMouseEnter={() => playHoverSfx()}
              className={LINK_CLASS}
            >
              {sourceLabel(id, locale)}
              {s.loginWall && (
                <span className="text-[9px] text-gray-600" aria-hidden="true">
                  🔒
                </span>
              )}
              <ExternalLink size={9} className="opacity-60" aria-hidden="true" />
            </a>
          );
        })}
      </p>
    </section>
  );
}
