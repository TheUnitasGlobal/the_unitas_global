'use client';

import { useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowRight, Cpu } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Link } from '@/i18n/navigation';
import { useSpatialAudio } from '@/components/audio/SpatialAudioProvider';
import { OmniSwarmPanel, SWARM_ACCENT } from '@/components/swarm/OmniSwarmPanel';
import type { SwarmAnchor } from '@/lib/swarm/swarmTypes';

/**
 * REV-32 M2 (founder directive 2026-09-15) -- the hyper-entrance.
 *
 * THE PROBLEM IT SOLVES. The swarm used to be three taps deep behind a lens
 * tile most visitors never opened, and REV-31 removed even that. It needs a
 * door that is impossible to miss but that does not shout over the rest of
 * the result.
 *
 * WHY A PORTAL AND NOT THE FIELD ITSELF. The U-AI result page has a hard
 * per-page Wikimedia budget (`WIKIMEDIA_PAGE_BUDGET = 2`, asserted for every
 * page up to the cap in `__tests__/uai/streamKindParity.test.ts`). The swarm
 * spends four Wikidata calls to draw itself. Rendering it inline on page 1
 * would double that page's network cost for every visitor, including the
 * ones who never look at it. So the card on the page costs ZERO -- it is a
 * door, not a window -- and the four calls are spent only when someone walks
 * through it. 한계비용 0원 (Codex §2 #160, #309, #409).
 *
 * The door opens the field in a nested Modal, which keeps the visitor's
 * result exactly where they left it: closing the swarm returns to the same
 * scroll position in the same stream, one history layer, no navigation.
 *
 * TWO DOORS, NEVER NONE. Live web synthesis is a best-effort, keyless pass;
 * when it resolves no entity for the query the result's anchor is plain text
 * and there is no identifier to decompose. The first version of this file
 * simply removed itself in that case -- and then the founder's "가장 눈에 띄는
 * 독립된 구역" was missing from most results, which is exactly the disease
 * REV-32 exists to cure. So an anchorless result gets the OTHER door: a link
 * to the standalone route carrying the query, where a full resolver (with the
 * Wikidata fallback the stream's synthesis skips) gets its own attempt. One
 * of the two is always present, and neither is a dead end.
 */

export interface OmniSwarmPortalProps {
  /** The subject the result is about. A QID opens the field in place. */
  anchor: SwarmAnchor | null;
  /** What the visitor actually searched for -- the fallback door's payload. */
  query?: string;
  className?: string;
}

export function OmniSwarmPortal({ anchor, query = '', className = '' }: OmniSwarmPortalProps) {
  const t = useTranslations('Rev32.swarm');
  const { playHoverSfx, playQuestEnterSfx } = useSpatialAudio();
  const [open, setOpen] = useState(false);

  const enter = useCallback(() => {
    playQuestEnterSfx();
    setOpen(true);
  }, [playQuestEnterSfx]);

  const term = (anchor?.term || query).trim();
  // Nothing at all to name: no door, because there would be nothing behind it.
  if (!term) return null;

  const face = (
    <span className="qw-swarm-portal-body">
      <span className="qw-section-label inline-flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-widest" style={{ color: SWARM_ACCENT }}>
        <Cpu size={13} aria-hidden="true" />
        {t('portal.title')}
      </span>
      <span className="qw-swarm-portal-lede mt-1.5 block text-[14px] font-semibold leading-snug text-white">
        {t('portal.lede', { term })}
      </span>
      <span className="qw-swarm-portal-cta mt-2 inline-flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-widest" style={{ color: SWARM_ACCENT }}>
        {t('portal.cta')}
        <ArrowRight size={13} aria-hidden="true" />
      </span>
    </span>
  );

  // THE SECOND DOOR: no identifier here, so hand the query to the route whose
  // resolver can still find one. Same face, same place, different mechanism.
  if (!anchor?.qid) {
    return (
      <Link
        href={{ pathname: '/omni-swarm', query: { q: term } }}
        data-omni-swarm-portal=""
        data-swarm-subject="query"
        onMouseEnter={() => playHoverSfx()}
        className={`qw-swarm-portal ${className}`}
        aria-label={t('portal.aria', { term })}
      >
        <span className="qw-swarm-portal-glow" aria-hidden="true" />
        {face}
      </Link>
    );
  }

  return (
    <>
      <button
        type="button"
        data-omni-swarm-portal=""
        data-swarm-subject={anchor.qid}
        onMouseEnter={() => playHoverSfx()}
        onClick={enter}
        className={`qw-swarm-portal ${className}`}
        aria-label={t('portal.aria', { term })}
      >
        <span className="qw-swarm-portal-glow" aria-hidden="true" />
        {face}
      </button>

      <Modal open={open} onClose={() => setOpen(false)} labelledBy="omni-swarm-title" size="xl">
        <div id="omni-swarm-title" className="sr-only">
          {t('title')}
        </div>
        <OmniSwarmPanel anchor={anchor} />
      </Modal>
    </>
  );
}
