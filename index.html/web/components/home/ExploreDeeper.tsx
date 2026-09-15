'use client';

import { useCallback, useEffect, useId, useMemo, useState, type CSSProperties } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ExternalLink, Layers3, Loader2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { useSpatialAudio } from '@/components/audio/SpatialAudioProvider';
import { DeeperThemePage } from '@/components/home/deeper/DeeperThemePage';
import { useSlotContext } from '@/lib/live/useSlotContext';
import { useAnchorBridge } from '@/lib/uai/useAnchorBridge';
import { entityAnchor, qidAnchor, type DeeperAnchor } from '@/lib/uai/deeperAnchor';
import { resolveEntity, sitelinkTitles, wikiLinks } from '@/lib/uai/entityResolve';
import { wikiLangFor } from '@/lib/uai/liveSuggest';
import {
  DEEPER_MAX_THEMES_COMPACT,
  DEEPER_MAX_THEMES_DESKTOP,
  DEEPER_MAX_THEMES_MOBILE,
  themesFor,
  type DeeperHost,
  type DeeperThemeKey,
} from '@/lib/uai/deeperThemes';
import { OUTBOUND_BRAND_ROW, outboundSearchUrl, sourceById, sourceLabel, type SourceId } from '@/lib/uai/sourceRegistry';
import type { SurfaceReport } from '@/lib/uai/types';

/**
 * REV-21 §3 / SPEC §12.2 -- the "더 깊이 탐색" (Explore Deeper) block that
 * sits at the bottom of EVERY U-AI popup (founder directive v2 §3A):
 *
 *  - header: the label and the anchored subject ("공기 · Air");
 *  - theme tiles: the fourteen lenses this anchor can feed, in the host's
 *    order (D-16 cap + a '+N' chip that expands in place, no history);
 *  - sources row: the real names behind the lenses plus the outbound
 *    big-tech row (Google Search · Bing · YouTube · Facebook · Instagram ·
 *    Threads · X · LinkedIn · TikTok) as plain text links -- never a logo,
 *    never a fetch (§12.4);
 *  - sources-only mode (D-23) when the host has no identifier: the header
 *    and the outbound row still render, so "every popup" visibly holds.
 *
 * A theme opens its page in a nested Modal INSIDE the host modal's subtree
 * (portal survival, one history layer: back = theme, back again = host).
 * Re-anchoring from a page swaps the anchor in place (no history entry).
 */

export interface ExploreDeeperProps {
  anchor: DeeperAnchor | null;
  host: DeeperHost;
  /** Keyword-tier / ranking-deep variant: fewer tiles, no hooks. */
  compact?: boolean;
  maxThemes?: number;
  /** The visitor's 6-axis surface report, when the host has one. */
  report?: Pick<SurfaceReport, 'constitution'> | null;
  /**
   * REV-25 M1: may an identifier-less subject be resolved to a real-world
   * entity? Default yes. Hosts whose subject is a UNITAS-internal name pass
   * `false`: SPEC §12.2 D-23 put them in sources-only mode deliberately
   * ("no entity behind a pseudonymous operator"), and resolving the module
   * "Echo" to the Greek nymph is exactly the '공기 → Thai film' drift REV-21
   * §2.2 closed, reopened somewhere new.
   */
  bridge?: boolean;
  /**
   * REV-29 M2.4 (founder directive 2026-09-15): the DIRECT-ONLY block. No
   * lens tiles, no bridge, no meanings -- the label, the subject and ONE row
   * of direct shortcuts (Wikipedia · Wikidata · Google · Bing · ...). The
   * live-news surfaces use it so the reader reaches the content by scrolling
   * alone, with nothing to unfold.
   */
  directOnly?: boolean;
  className?: string;
}

const COMPACT_OUTBOUND: readonly SourceId[] = ['googleSearch', 'bingSearch', 'youtube'];

function useIsNarrow(): boolean {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const update = () => setNarrow(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return narrow;
}

export function ExploreDeeper({ anchor, host, compact = false, maxThemes, report = null, bridge = true, directOnly = false, className = '' }: ExploreDeeperProps) {
  const t = useTranslations('Rev21.deeper');
  const locale = useLocale();
  const ctx = useSlotContext();
  const { playHoverSfx, playQuestEnterSfx } = useSpatialAudio();
  const headingId = useId();
  const narrow = useIsNarrow();
  const lang = wikiLangFor(locale);
  const deeperCtx = useMemo(() => ({ locale, lang, country: ctx.country ?? 'US' }), [locale, lang, ctx.country]);

  // A disambiguated subject resolves to a chosen meaning here; a page's
  // re-anchor chip swaps the modal's own anchor.
  const [chosen, setChosen] = useState<DeeperAnchor | null>(null);
  const [meanings, setMeanings] = useState<Array<{ title: string }>>([]);
  const [resolving, setResolving] = useState(false);
  const [modalTheme, setModalTheme] = useState<DeeperThemeKey | null>(null);
  const [modalAnchor, setModalAnchor] = useState<DeeperAnchor | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    setChosen(null);
    setMeanings([]);
    setShowAll(false);
  }, [anchor?.qid, anchor?.term, anchor?.coord?.lat, anchor?.coord?.lon]);

  // REV-25 M1 -- THE ANCHOR BRIDGE. A host that had no identifier to give
  // (live web synthesis resolved nothing, a ranking row is a literal string)
  // used to land here as a TEXT anchor, and `themesFor` then offered zero
  // lenses: the omni-tech swarm was unreachable from the tower. The bridge
  // resolves that term ONCE per device on the visitor's own-language
  // Wikipedia and hands back an entity anchor. A meaning the visitor chose
  // themselves still outranks it.
  const { bridged, bridging } = useAnchorBridge(bridge && !directOnly ? anchor : null);
  const effective = chosen ?? bridged ?? anchor;

  // §3.1: a disambiguation page offers its top links as "which meaning?".
  useEffect(() => {
    if (!anchor?.disambiguation || chosen || !anchor.localeTitle) return;
    const controller = new AbortController();
    wikiLinks(lang, anchor.localeTitle, controller.signal)
      .then((page) => {
        if (!controller.signal.aborted) setMeanings(page.links.slice(0, 8).map((title) => ({ title })));
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [anchor?.disambiguation, anchor?.localeTitle, chosen, lang]);

  const themes = useMemo(() => (directOnly ? [] : themesFor(host, effective, report)), [host, effective, report, directOnly]);
  const cap = maxThemes ?? (compact ? DEEPER_MAX_THEMES_COMPACT : narrow ? DEEPER_MAX_THEMES_MOBILE : DEEPER_MAX_THEMES_DESKTOP);
  const visible = showAll ? themes : themes.slice(0, cap);
  const hiddenCount = themes.length - visible.length;

  const openTheme = useCallback(
    (key: DeeperThemeKey) => {
      if (!effective) return;
      playQuestEnterSfx();
      setModalAnchor(effective);
      setModalTheme(key);
    },
    [effective, playQuestEnterSfx],
  );
  const closeTheme = useCallback(() => setModalTheme(null), []);

  async function chooseMeaning(title: string) {
    setResolving(true);
    try {
      const resolved = await resolveEntity(title, lang, new AbortController().signal, { wikidataFallback: false });
      if (resolved && !resolved.disambiguation) setChosen(entityAnchor(resolved, lang));
    } finally {
      setResolving(false);
    }
  }

  // Rule ③: swap the modal's anchor in place; the exact titles arrive one
  // sitelink call later so the text-search legs get the English title.
  function reanchor(next: { qid: string; title: string; lang?: string }) {
    const immediate = qidAnchor(next.qid, next.title, next.lang ?? lang);
    setModalAnchor(immediate);
    sitelinkTitles(next.qid, [lang, 'en'], new AbortController().signal)
      .then((titles) => {
        setModalAnchor((prev) =>
          prev && prev.qid === next.qid ? { ...prev, localeTitle: titles[lang] ?? prev.localeTitle, enTitle: titles.en ?? prev.enTitle, term: titles[lang] ?? prev.term } : prev,
        );
      })
      .catch(() => undefined);
  }

  const outbound = compact ? COMPACT_OUTBOUND : OUTBOUND_BRAND_ROW;
  const term = effective?.localeTitle ?? effective?.term ?? '';
  const themeSources = useMemo(() => Array.from(new Set(visible.flatMap((th) => th.sources))), [visible]);
  const kind = effective ? effective.kind : 'none';

  return (
    <section
      className={`qw-deeper-block ${compact ? 'qw-deeper-block--compact' : ''} ${className}`}
      data-explore-deeper=""
      data-anchor-kind={kind}
      data-anchor-bridged={bridged && !chosen ? '' : undefined}
      data-anchor-bridging={bridging ? '' : undefined}
      data-host={host}
      data-deeper-direct={directOnly ? '' : undefined}
      aria-labelledby={headingId}
    >
      <header className="qw-deeper-head mb-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <p id={headingId} className="qw-deeper-label flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-widest text-accent">
          <Layers3 size={13} aria-hidden="true" />
          {t('label')}
        </p>
        {effective && (
          <p className="qw-deeper-subject min-w-0 truncate text-[13px] font-semibold text-gray-300" aria-label={t('anchorAria', { term })}>
            {term}
            {effective.enTitle && effective.enTitle !== term && <span className="text-gray-500"> · {effective.enTitle}</span>}
          </p>
        )}
      </header>

      {!directOnly && anchor?.disambiguation && !chosen && (
        <div className="qw-deeper-meanings mb-3" data-deeper-meanings="">
          <p className="mb-1.5 text-[12px] text-gray-400">{t('chooseMeaning')}</p>
          <div className="flex flex-wrap gap-1.5">
            {meanings.map((m) => (
              <button
                key={m.title}
                type="button"
                disabled={resolving}
                onMouseEnter={() => playHoverSfx()}
                onClick={() => void chooseMeaning(m.title)}
                className="qw-deeper-chip border border-white/15 px-2 py-1 text-[12px] font-semibold text-gray-200 hover:border-white/40 disabled:opacity-50"
              >
                {m.title}
              </button>
            ))}
            {resolving && <Loader2 size={14} className="animate-spin text-accent" aria-hidden="true" />}
          </div>
        </div>
      )}

      {directOnly ? null : themes.length > 0 ? (
        <ul className={`qw-deeper-themes ${compact ? 'qw-deeper-themes--compact' : ''}`} role="list">
          {visible.map((th) => (
            <li key={th.key}>
              <button
                type="button"
                data-deeper-theme={th.key}
                aria-label={t('themeAria', { theme: t(`themes.${th.key}.title`) })}
                onMouseEnter={() => playHoverSfx()}
                onClick={() => openTheme(th.key)}
                className="qw-deeper-theme flex h-full w-full flex-col items-start gap-1 border border-white/10 bg-void/40 p-2.5 text-left hover:border-white/30"
                style={{ '--qw-deeper-accent': th.color } as CSSProperties}
              >
                <span className="flex items-center gap-1.5 text-[12px] font-bold text-white">
                  <th.icon size={14} style={{ color: th.color }} aria-hidden="true" />
                  <span className="min-w-0 truncate">{t(`themes.${th.key}.title`)}</span>
                </span>
                {!compact && <span className="qw-deeper-hook line-clamp-2 text-[11px] leading-snug text-gray-400">{t(`themes.${th.key}.hook`)}</span>}
              </button>
            </li>
          ))}
          {hiddenCount > 0 && (
            <li>
              <button
                type="button"
                data-deeper-more-themes=""
                onMouseEnter={() => playHoverSfx()}
                onClick={() => setShowAll(true)}
                className="qw-deeper-theme qw-deeper-theme--more flex h-full w-full items-center justify-center border border-dashed border-white/20 p-2.5 text-[12px] font-bold uppercase tracking-widest text-gray-300 hover:border-white/40"
              >
                {t('moreThemes', { count: hiddenCount })}
              </button>
            </li>
          )}
        </ul>
      ) : bridging ? (
        // The bridge is resolving this term: saying "아직 연결된 존재가 없습니다"
        // now and replacing it with a full lens grid a moment later would be a
        // lie followed by a flash. Hold the line until the answer is in.
        <p className="qw-deeper-noanchor mb-2 flex items-center gap-1.5 text-[12px] text-gray-500" data-deeper-bridging-note="">
          <Loader2 size={12} className="animate-spin text-accent" aria-hidden="true" />
          {t('loading')}
        </p>
      ) : (
        <p className="qw-deeper-noanchor mb-2 text-[12px] text-gray-500" data-deeper-noanchor="">
          {t('noAnchor')}
        </p>
      )}

      {!directOnly && (
      <p className="qw-deeper-sources mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-500">
        <span className="font-bold uppercase tracking-widest">{t('sourcesLabel')}</span>
        {effective?.qid && effective.localeTitle && (
          <a
            href={`https://${lang}.wikipedia.org/wiki/${encodeURIComponent(effective.localeTitle.replace(/ /g, '_'))}`}
            target="_blank"
            rel="noopener noreferrer nofollow"
            data-deeper-source="wikipedia"
            className="font-bold text-gray-300 hover:underline"
          >
            {sourceLabel('wikipedia', locale)} ({lang})
          </a>
        )}
        {effective?.qid && (
          <a href={`https://www.wikidata.org/wiki/${effective.qid}`} target="_blank" rel="noopener noreferrer nofollow" data-deeper-source="wikidata" className="font-bold text-gray-300 hover:underline">
            {sourceLabel('wikidata', locale)}
          </a>
        )}
        {themeSources
          .filter((id) => id !== 'wikipedia' && id !== 'wikidata')
          .map((id) => (
            <a key={id} href={sourceById(id).homepage} target="_blank" rel="noopener noreferrer nofollow" data-deeper-source={id} className="font-bold text-gray-300 hover:underline">
              {sourceLabel(id, locale, true)}
            </a>
          ))}
      </p>
      )}

      {term && (
        <p className="qw-deeper-outbound mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-500" data-deeper-outbound="">
          {/* REV-29 M2.4: the "다른 곳에서 열기" title is the SAME element as
              "더 깊이 탐색" -- same class, same size, same colour, same icon
              weight -- so the two rows read as one system. */}
          <span className="qw-deeper-label inline-flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-widest text-accent">
            <ExternalLink size={13} aria-hidden="true" />
            {t('outboundLabel')}
          </span>
          {directOnly && effective?.qid && effective.localeTitle && (
            <a
              href={`https://${lang}.wikipedia.org/wiki/${encodeURIComponent(effective.localeTitle.replace(/ /g, '_'))}`}
              target="_blank"
              rel="noopener noreferrer nofollow"
              data-deeper-source="wikipedia"
              onMouseEnter={() => playHoverSfx()}
              className="inline-flex items-center gap-1 font-semibold text-gray-300 hover:underline"
            >
              {sourceLabel('wikipedia', locale)}
              <ExternalLink size={9} className="opacity-60" aria-hidden="true" />
            </a>
          )}
          {directOnly && effective?.qid && (
            <a
              href={`https://www.wikidata.org/wiki/${effective.qid}`}
              target="_blank"
              rel="noopener noreferrer nofollow"
              data-deeper-source="wikidata"
              onMouseEnter={() => playHoverSfx()}
              className="inline-flex items-center gap-1 font-semibold text-gray-300 hover:underline"
            >
              {sourceLabel('wikidata', locale)}
              <ExternalLink size={9} className="opacity-60" aria-hidden="true" />
            </a>
          )}
          {outbound.map((id) => {
            const s = sourceById(id);
            return (
              <a
                key={id}
                href={outboundSearchUrl(id, term, lang)}
                target="_blank"
                rel="noopener noreferrer nofollow"
                data-deeper-outbound-source={id}
                title={s.loginWall ? `${sourceLabel(id, locale)} · ${t('loginHint')}` : sourceLabel(id, locale)}
                onMouseEnter={() => playHoverSfx()}
                className="inline-flex items-center gap-1 font-semibold text-gray-300 hover:underline"
              >
                {sourceLabel(id, locale)}
                {s.loginWall && <span className="text-[9px] text-gray-600" aria-hidden="true">🔒</span>}
                <ExternalLink size={9} className="opacity-60" aria-hidden="true" />
              </a>
            );
          })}
        </p>
      )}

      <Modal open={modalTheme !== null && modalAnchor !== null} onClose={closeTheme} labelledBy={modalTheme ? `deeper-${modalTheme}-title` : undefined} size="xl">
        {modalTheme && modalAnchor && <DeeperThemePage theme={modalTheme} anchor={modalAnchor} ctx={deeperCtx} onReanchor={reanchor} />}
      </Modal>
    </section>
  );
}
