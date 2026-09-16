'use client';

import { useLocale, useTranslations } from 'next-intl';
import { ExternalLink } from 'lucide-react';
import { useSpatialAudio } from '@/components/audio/SpatialAudioProvider';
import { wikiLangFor } from '@/lib/uai/liveSuggest';
import type { DeeperAnchor } from '@/lib/uai/deeperAnchor';
import { omniOpenUrl, omniRowsFor, outboundSearchUrl, sourceById, sourceLabel, type OmniFamily } from '@/lib/uai/sourceRegistry';

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
 *
 * REV-34 M2 (founder directive 2026-09-16, D-8): the rows are no longer one
 * global pair. The host names a THEME FAMILY (`family` prop, stamped as
 * `data-omni-family`) and the registry's `OMNI_FAMILY_ROWS` hands back the
 * curated corpora and platforms of that theme -- finance engines under the
 * FX card, code hosts under the dev pulse, the ten omni-business engines of
 * Codex ch.6 under everything by default. The three invariants above hold
 * for every family by construction: each row still opens with the same two
 * ids, so the compact slice and the E2E contract never see a difference.
 */

/** SPEC host registry -- which surface the block is placed on. REV-35 M1
 *  (D-2): `rankingDeep` became `uRankingDeep` (the carousel's U-Ranking deep
 *  modal) and the `globalRankingDetail` / `unitasProfile` hosts died with
 *  the legacy ranking panels that placed them. */
export type OmniOpenHost =
  | 'weather'
  | 'feed'
  | 'uRankingDeep'
  | 'keywordTier'
  | 'tower'
  | 'uaiPage'
  | 'newsRail';

export interface OmniOpenProps {
  anchor: DeeperAnchor | null;
  host: OmniOpenHost;
  /** Tight surfaces (keyword tiers, ranking popups) take the short rows. */
  compact?: boolean;
  /** REV-34 M2: the theme family that picks the two rows (`default` when
   *  the host has no theme -- the stream, keyword tiers). */
  family?: OmniFamily;
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

/** Compact hosts take the head of each row: the first three sources and
 *  the first three platforms of the family (every family opens with the
 *  wiki pair and the Google / Bing pair, so the slice is always usable). */
const COMPACT_SOURCES = 3;
const COMPACT_PLATFORMS = 3;

export function OmniOpen({ anchor, host, compact = false, family = 'default', className = '' }: OmniOpenProps) {
  const t = useTranslations('Rev21.deeper');
  const locale = useLocale();
  const { playHoverSfx } = useSpatialAudio();
  const lang = wikiLangFor(locale);

  const term = anchor?.localeTitle ?? anchor?.term ?? '';
  // INVARIANT 2: no subject means no rows -- never one row.
  if (!anchor || !term.trim()) return null;

  const rows = omniRowsFor(family);
  const sources = compact ? rows.sources.slice(0, COMPACT_SOURCES) : rows.sources;
  const platforms = compact ? rows.platforms.slice(0, COMPACT_PLATFORMS) : rows.platforms;

  return (
    <section
      className={`qw-omni-open ${compact ? 'qw-omni-open--compact' : ''} ${className}`}
      data-omni-open=""
      data-anchor-kind={anchor.kind}
      data-host={host}
      data-omni-family={family}
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
