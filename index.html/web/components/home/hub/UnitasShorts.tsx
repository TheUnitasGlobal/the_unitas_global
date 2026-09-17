'use client';

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Heart, MessageCircle, Play, Radio, Sparkles, Tag, Ticket, Upload, UserPlus } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { useSpatialAudio } from '@/components/audio/SpatialAudioProvider';
import { OmniOpen } from '@/components/home/OmniOpen';
import { HubDot } from '@/components/home/hub/HubDot';
import { ShortsCreatorPass } from './ShortsCreatorPass';
import { hotNewsAxisMeta } from '@/lib/live/hotNewsAxes';
import type { HotNewsCategory } from '@/lib/live/hotNews';
import { textAnchor } from '@/lib/uai/deeperAnchor';
import { wikiLangFor } from '@/lib/uai/liveSuggest';
import {
  SHORTS_SEED,
  compactCount,
  readShortsPrefs,
  shortsByTheme,
  toggleMember,
  writeShortsPrefs,
  type ShortSeed,
  type ShortsPrefs,
} from '@/lib/live/shortsSeed';
import { PULSE_SLOT_MS } from '@/lib/square/pulse';
import {
  hasHubSession,
  hubShortsCounts,
  hubShortsSync,
  hubShortsToggle,
  isHubServerConfigured,
  type ShortsCounts,
} from '@/lib/hub/hubLedger';

function posterStyle(short: ShortSeed): CSSProperties {
  return {
    background: `linear-gradient(160deg, hsl(${short.hue[0]} 70% 52%) 0%, hsl(${short.hue[1]} 80% 30%) 100%)`,
  };
}

type SortMode = 'liked' | 'catalogue';

/**
 * The public reaction ledger for the rail.
 *   loading    -- the session probe / the RPC pair has not answered yet.
 *   ready      -- the ledger was READ. Its figures are facts, zero included.
 *   unreadable -- there is no readable source from here at all. NOT zero.
 */
interface ReactionState {
  status: 'loading' | 'ready' | 'unreadable';
  /** { clipId: likes } as reported by hub_shorts_counts('like'). */
  like: ShortsCounts;
  /** { handle: follows } as reported by hub_shorts_counts('follow'). */
  follow: ShortsCounts;
}

const REACTIONS_LOADING: ReactionState = { status: 'loading', like: {}, follow: {} };
/** No readable source (signed out, or no project configured) -- never "0". */
const REACTIONS_UNREADABLE: ReactionState = { status: 'unreadable', like: {}, follow: {} };

/**
 * REV-40: the settled answer, held at MODULE scope. Flicking away from the
 * shorts tab and back unmounts and remounts this component, and every remount
 * used to re-fire the RPC pair and replay the em-dash -> settled repaint
 * across all 44 cards. The cache makes re-entry instant and silent; only an
 * explicit tick (a durable toggle, or the pulse cadence while the ledger has
 * rows) re-reads the totals.
 */
let reactionCache: ReactionState | null = null;

/**
 * UNITAS Shorts -- retired in REV-20 §7.1, revived in REV-29 M4, ignited in
 * REV-36 M3 and made HONEST in REV-40: every fabricated counter is gone.
 *
 * WHAT IS REAL AND WHAT IS NOT. The clip catalogue (lib/live/shortsSeed.ts) is
 * a TS constant because there is no upload pipeline yet, and the rail says so
 * (`seedNote`). Everything else on a card is now either a REAL number from the
 * server ledger (hub_shorts_counts, 'like' over clip ids and 'follow' over
 * handles) or it is not rendered at all. The simulated view / watcher /
 * momentum counters were deleted outright -- there is no view telemetry and no
 * presence channel, so no honest number exists to show -- and the invented
 * reaction feed of strangers liking clips is now an empty section instead of
 * fiction. The rail is ordered by the real like ledger, so on an empty ledger
 * it is simply the catalogue order, never a fabricated "trending" ranking.
 *
 * FOUR STATES, NEVER A FALLBACK. The reaction ledger renders as loading
 * (`data-hub-loading`, counts shown as an em dash), as data, as empty
 * (`data-hub-empty`, counts shown as a real 0) or as UNREADABLE
 * (`data-hub-unreadable`, counts shown as an em dash).
 *
 * REV-40 split that last state out of EMPTY, because collapsing them was a
 * lie. `hub_shorts_counts` is `revoke from public, anon` + `grant to
 * authenticated`, so a signed-out visitor's call cannot succeed -- PGRST202
 * before the migration, 42501 after -- and hubShortsCounts soft-fails to `{}`,
 * which the rail then rendered as "0 likes" on 44 cards. Zero is a claim about
 * the ledger; we had not read the ledger. So we no longer call the RPC without
 * a session at all (two guaranteed-failed round trips per mount, gone), and
 * what a guest sees is an em dash and one line saying the totals are not
 * readable from here.
 *
 * THE TWO LEDGERS STAY. A signed-in visitor's own likes/follows are durable
 * (hub_shorts_*, `data-shorts-ledger="account"`); a guest keeps this device's
 * toggles in localStorage (`data-shorts-ledger="device"`). That badge is an
 * honest statement about where a toggle lives, not a simulation label, and the
 * guest path is the site's default state.
 */
export function UnitasShorts() {
  const t = useTranslations('Rev29.shorts');
  const t36 = useTranslations('Rev36');
  /** REV-40: the honest loading / empty / unreadable vocabulary. */
  const t40 = useTranslations('Rev40');
  const tNews = useTranslations('HotNews');
  const tPass = useTranslations('Rev29.shorts.pass');
  const locale = useLocale();
  const lang = wikiLangFor(locale);
  const { playHoverSfx } = useSpatialAudio();
  const [prefs, setPrefs] = useState<ShortsPrefs>({ liked: [], followed: [] });
  const [openId, setOpenId] = useState<string | null>(null);
  const [passOpen, setPassOpen] = useState(false);
  const [theme, setTheme] = useState<HotNewsCategory | 'all'>('all');
  const [sort, setSort] = useState<SortMode>('liked');
  /** 'device' = this device only; 'account' = durable on the server. */
  const [ledger, setLedger] = useState<'device' | 'account'>('device');
  /** The public like/follow totals -- seeded from the module cache on re-entry. */
  const [reactions, setReactions] = useState<ReactionState>(() => reactionCache ?? REACTIONS_LOADING);
  /** Bumped to re-read the totals (after a durable toggle, and while they exist). */
  const [reactionTick, setReactionTick] = useState(0);
  /** `null` until the session probe answers: until then nothing is known, so
   *  the ledger stays in LOADING rather than guessing at a state. */
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    setPrefs(readShortsPrefs());
  }, []);

  // ONE session probe drives everything: which ledger is in force, whether the
  // account's durable toggles can be pulled, and whether the public totals are
  // readable at all. (It used to be two probes and an unconditional RPC pair.)
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const yes = isHubServerConfigured() && (await hasHubSession());
      if (cancelled) return;
      setSignedIn(yes);
      if (!yes) return;
      setLedger('account');
      const res = await hubShortsSync();
      if (cancelled || !res.ok || !res.data) return;
      // REV-40: REPLACE, never union. `prefs` carries this device's GUEST
      // toggles, which the server has never seen. Unioning them in left the
      // heart lit on a clip the account has not liked while likesFor() (rightly)
      // reported the server total -- the "Liked · 0" card. In account mode the
      // server is the only truth. The copy on disk is left untouched: it is the
      // guest ledger, and signing out must return to exactly what it was.
      setPrefs({ liked: [...res.data.liked], followed: [...res.data.followed] });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // The public reaction ledger. One call per kind, kind-scoped so a clip id and
  // a handle can never merge (hubLedger.ts) -- and only ever with a session,
  // since hub_shorts_counts is `authenticated`-only and an anon call is a
  // round trip whose failure is certain before it is sent.
  useEffect(() => {
    // Probe still out: hold LOADING. Never settle on an unprobed guess.
    if (signedIn === null) return;
    if (!signedIn) {
      reactionCache = REACTIONS_UNREADABLE;
      setReactions(REACTIONS_UNREADABLE);
      return;
    }
    // A settled read survives a tab flick; only an explicit tick re-reads.
    if (reactionTick === 0 && reactionCache?.status === 'ready') {
      setReactions(reactionCache);
      return;
    }
    let cancelled = false;
    void (async () => {
      const clipIds = SHORTS_SEED.map((s) => s.id);
      const handles = Array.from(new Set(SHORTS_SEED.map((s) => s.handle)));
      const [like, follow] = await Promise.all([hubShortsCounts('like', clipIds), hubShortsCounts('follow', handles)]);
      if (cancelled) return;
      const settled: ReactionState = { status: 'ready', like, follow };
      reactionCache = settled;
      setReactions(settled);
    })();
    return () => {
      cancelled = true;
    };
  }, [signedIn, reactionTick]);

  /** True once the ledger has answered with at least one recorded reaction. */
  const hasReactionRows =
    reactions.status === 'ready' && (Object.keys(reactions.like).length > 0 || Object.keys(reactions.follow).length > 0);

  // Re-read the totals on the pulse cadence ONLY while the ledger actually has
  // rows: an empty ledger is a settled fact, not something to poll for.
  useEffect(() => {
    if (!hasReactionRows) return;
    const id = setInterval(() => setReactionTick((n) => n + 1), PULSE_SLOT_MS);
    return () => clearInterval(id);
  }, [hasReactionRows]);

  function persist(next: ShortsPrefs) {
    setPrefs(next);
    writeShortsPrefs(next);
  }

  /** Toggle a like/follow: optimistic locally, durable on the server, reverted on refusal. */
  const react = useCallback(
    (kind: 'like' | 'follow', target: string, nextList: string[], key: 'liked' | 'followed') => {
      const optimistic = { ...prefs, [key]: nextList } as ShortsPrefs;
      persist(optimistic);
      if (ledger !== 'account') return;
      void hubShortsToggle(kind, target).then((res) => {
        if (res.ok && res.data) {
          // The server's `on` is the truth about this account's reaction --
          // mapShortsToggle has already validated it as a boolean. Snap the
          // local state onto it so the button can never disagree with the
          // total beside it (the "Liked · 0" class of drift), then re-read the
          // public total so the number on screen is the ledger's, never an
          // optimistic guess layered on top.
          const { on } = res.data;
          setPrefs((cur) => {
            if (cur[key].includes(target) === on) return cur;
            const corrected = {
              ...cur,
              [key]: on ? [...cur[key], target] : cur[key].filter((t) => t !== target),
            } as ShortsPrefs;
            writeShortsPrefs(corrected);
            return corrected;
          });
          setReactionTick((n) => n + 1);
          return;
        }
        // The server refused (offline, flood, invalid) -- put the device
        // copy back rather than pretend it stuck.
        setPrefs((cur) => {
          const reverted = { ...cur, [key]: toggleMember(cur[key], target) } as ShortsPrefs;
          writeShortsPrefs(reverted);
          return reverted;
        });
      });
    },
    [prefs, ledger],
  );

  /**
   * Likes for a clip. The server total is the truth; this device's own like is
   * added only while it is NOT in that total (the guest / device ledger), so a
   * signed-in visitor's like is never counted twice. Whether the figure is
   * PRINTED at all is countText's decision -- in the unreadable state there is
   * no server total to stand behind, so nothing is shown.
   */
  const likesFor = useCallback(
    (clipId: string): number => {
      const server = reactions.like[clipId] ?? 0;
      if (ledger === 'account') return server;
      return server + (prefs.liked.includes(clipId) ? 1 : 0);
    },
    [reactions, ledger, prefs.liked],
  );

  /** Followers of a creator handle, under the same two-ledger rule. */
  const followsFor = useCallback(
    (handle: string): number => {
      const server = reactions.follow[handle] ?? 0;
      if (ledger === 'account') return server;
      return server + (prefs.followed.includes(handle) ? 1 : 0);
    },
    [reactions, ledger, prefs.followed],
  );

  /**
   * A figure is printed only when the ledger was actually READ -- then it is
   * the real one, zero included. Loading and unreadable both render an em
   * dash: '0' is a statement about the ledger, and in neither state have we
   * read it.
   */
  const countText = useCallback(
    (n: number): string => (reactions.status === 'ready' ? compactCount(n) : '—'),
    [reactions.status],
  );

  const themes = useMemo(() => Array.from(new Set(SHORTS_SEED.map((s) => s.theme))), []);
  const clips = useMemo(() => {
    const byTheme = shortsByTheme(theme);
    if (sort !== 'liked') return byTheme;
    // Ordered by the PUBLIC like ledger only -- this device's own optimistic
    // like is not a public reaction, so pressing the heart never reshuffles the
    // rail underneath the visitor. Array#sort is stable, so an empty ledger
    // (every count 0) leaves the catalogue order exactly as seeded.
    return [...byTheme].sort((a, b) => (reactions.like[b.id] ?? 0) - (reactions.like[a.id] ?? 0));
  }, [theme, sort, reactions.like]);
  const open = useMemo(() => SHORTS_SEED.find((s) => s.id === openId) ?? null, [openId]);

  function renderToggles(short: ShortSeed) {
    const liked = prefs.liked.includes(short.id);
    const followed = prefs.followed.includes(short.handle);
    return (
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="qw-pill-btn"
          data-on={liked ? '1' : '0'}
          aria-pressed={liked}
          onMouseEnter={() => playHoverSfx()}
          onClick={() => react('like', short.id, toggleMember(prefs.liked, short.id), 'liked')}
          data-short-like=""
        >
          <Heart size={13} aria-hidden="true" fill={liked ? 'currentColor' : 'none'} />
          {liked ? t('liked') : t('like')} · {countText(likesFor(short.id))}
        </button>
        <button
          type="button"
          className="qw-pill-btn"
          data-on={followed ? '1' : '0'}
          aria-pressed={followed}
          onMouseEnter={() => playHoverSfx()}
          onClick={() => react('follow', short.handle, toggleMember(prefs.followed, short.handle), 'followed')}
          data-short-follow=""
        >
          <UserPlus size={13} aria-hidden="true" />
          {followed ? t('following') : t('follow')}
        </button>
      </div>
    );
  }

  return (
    <div className="w-full" data-unitas-shorts="">
      <div className="mb-1.5 flex flex-wrap items-center gap-3">
        <p className="qw-discovery-label mb-0 text-[15px] font-bold text-white">
          <Play size={16} aria-hidden="true" />
          {t('label')}
        </p>
        <button
          type="button"
          className="qw-pill-btn ml-auto"
          title={t('uploadSoon')}
          aria-label={`${t('upload')} · ${tPass('eyebrow')}`}
          onMouseEnter={() => playHoverSfx()}
          onClick={() => setPassOpen(true)}
          data-shorts-upload=""
        >
          <Upload size={13} aria-hidden="true" />
          {t('upload')}
        </button>
      </div>
      <p className="qw-hub-meta mb-2 text-[12px] text-gray-500">{t('lede')}</p>

      {/* REV-40: the reaction stream. REV-36 filled this with invented rows
          ("{handle} liked {title}") drawn from a seeded PRNG; there is no
          activity source behind it -- no event table, no presence channel --
          so it renders as an honest, permanently empty section rather than as
          fiction. It becomes real the day an event feed exists. */}
      <div className="qw-shorts-pulse" data-shorts-pulse="" data-hub-empty="1" aria-live="polite">
        <p className="qw-shorts-pulse-head">
          <Radio size={12} aria-hidden="true" />
          {t36('shorts.feed')}
        </p>
        <p className="qw-shorts-pulse-row" data-shorts-feed-empty="">
          {t36('shorts.feedEmpty')}
        </p>
      </div>

      {/* The state of the REAL like/follow ledger. Loading until the session
          probe and the RPC pair answer; then either live figures on the cards,
          or the honest empty line (the ledger was read and has no rows), or
          the unreadable line (there is no readable source from here -- the
          counts RPC is `authenticated`-only). Never a fallback, and never a
          fabricated zero. */}
      {reactions.status === 'loading' ? (
        <p className="qw-hub-meta mb-2 text-[11px] text-gray-500" data-shorts-counts="" data-hub-loading="1" aria-live="polite">
          {t36('common.loading')}
        </p>
      ) : reactions.status === 'unreadable' ? (
        <p className="qw-hub-meta mb-2 text-[11px] text-gray-500" data-shorts-counts="" data-hub-unreadable="1" aria-live="polite">
          {t40('shorts.countsUnreadable')}
        </p>
      ) : hasReactionRows ? null : (
        <p className="qw-hub-meta mb-2 text-[11px] text-gray-500" data-shorts-counts="" data-hub-empty="1" aria-live="polite">
          {t36('shorts.countsEmpty')}
        </p>
      )}

      <div className="mb-2 flex flex-wrap items-center gap-2">
        <div className="qw-hub-tabs" role="tablist" aria-label={t36('shorts.sortLabel')}>
          {(['liked', 'catalogue'] as const).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={sort === key}
              className="qw-hub-tab"
              data-shorts-sort={key}
              onMouseEnter={() => playHoverSfx()}
              onClick={() => setSort(key)}
            >
              {key === 'liked' ? <Heart size={12} aria-hidden="true" /> : null}
              {key === 'liked' ? t36('shorts.sortMostLiked') : t36('shorts.sortCatalogue')}
            </button>
          ))}
        </div>
        <span className="qw-hub-meta ml-auto text-[11px] text-gray-500" data-shorts-ledger={ledger}>
          {ledger === 'account' ? t36('shorts.account') : t36('shorts.device')}
        </span>
      </div>

      <div className="qw-hub-strip select-none mb-3" role="tablist" aria-label={t('filterAll')}>
        <button type="button" role="tab" aria-selected={theme === 'all'} data-active={theme === 'all' ? '1' : '0'} className="qw-hub-chip" onMouseEnter={() => playHoverSfx()} onClick={() => setTheme('all')}>
          <Tag size={15} aria-hidden="true" />
          {t('filterAll')}
        </button>
        {themes.map((key) => {
          const meta = hotNewsAxisMeta(key);
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={theme === key}
              data-active={theme === key ? '1' : '0'}
              className="qw-hub-chip"
              style={{ '--qw-hub-accent': meta.color } as CSSProperties}
              onMouseEnter={() => playHoverSfx()}
              onClick={() => setTheme(key)}
            >
              <HubDot color={meta.color} />
              {tNews(`category.${key}`)}
            </button>
          );
        })}
      </div>

      <div className="qw-shorts-rail" data-shorts-rail="">
        {clips.map((short) => {
          const meta = hotNewsAxisMeta(short.theme);
          return (
            <button
              key={short.id}
              type="button"
              className="qw-short-card"
              style={posterStyle(short)}
              onMouseEnter={() => playHoverSfx()}
              onClick={() => setOpenId(short.id)}
              aria-label={t('openAria', { title: short.title })}
              data-short={short.id}
            >
              <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-black/35 px-2 py-0.5 text-[11px] font-bold backdrop-blur">
                <HubDot color={meta.color} size={7} />
                {tNews(`category.${short.theme}`)}
              </span>
              <span className="qw-short-title">{short.title}</span>
              <span className="qw-short-meta">
                <span>@{short.handle}</span>
              </span>
              <span className="qw-short-meta">
                <span className="inline-flex items-center gap-1" data-short-likes="">
                  <Heart size={12} aria-hidden="true" />
                  {countText(likesFor(short.id))}
                </span>
              </span>
            </button>
          );
        })}
        <button
          type="button"
          className="u-wl-rail-card"
          onMouseEnter={() => playHoverSfx()}
          onClick={() => setPassOpen(true)}
          aria-label={tPass('cta')}
          data-shorts-pass-card=""
        >
          <span className="u-wl-rail-plus" aria-hidden="true">
            <Ticket size={18} />
          </span>
          <span className="u-wl-rail-sub">
            <Sparkles size={11} aria-hidden="true" style={{ display: 'inline', marginRight: 4, verticalAlign: '-1px' }} />
            {tPass('eyebrow')}
          </span>
          <span className="u-wl-rail-title">{tPass('cta')}</span>
        </button>
      </div>
      <p className="mt-2 text-[11px] uppercase tracking-widest text-gray-500">{t('seedNote')}</p>

      <ShortsCreatorPass open={passOpen} onClose={() => setPassOpen(false)} />

      <Modal open={open !== null} onClose={() => setOpenId(null)} labelledBy="unitas-short-title" size="lg">
        {open &&
          (() => {
            const meta = hotNewsAxisMeta(open.theme);
            return (
              <div className="space-y-4" data-short-modal={open.id}>
                <div className="qw-short-poster qw-short-card w-full" style={posterStyle(open)} aria-hidden="true">
                  <span className="qw-short-title">{open.title}</span>
                </div>
                <div>
                  <p id="unitas-short-title" className="text-[19px] font-bold text-white">
                    {open.title}
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-gray-400">
                    <span>
                      {t('creator')} · @{open.handle}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <HubDot color={meta.color} />
                      {tNews(`category.${open.theme}`)}
                    </span>
                    <span data-short-modal-followers="">{t('followers', { count: countText(followsFor(open.handle)) })}</span>
                  </p>
                </div>
                {renderToggles(open)}
                <div className="border-l-2 border-accent/40 pl-3">
                  <p className="flex items-center gap-1.5 text-[13px] font-bold text-accent">
                    <MessageCircle size={13} aria-hidden="true" />
                    {t('share')}
                  </p>
                  <p className="mt-1 text-[13px] leading-relaxed text-gray-300">{t('shareHint')}</p>
                </div>
                <OmniOpen anchor={textAnchor(open.title, lang)} host="newsRail" family="shorts" />
                <p className="text-[11px] uppercase tracking-widest text-gray-500">{t('seedNote')}</p>
              </div>
            );
          })()}
      </Modal>
    </div>
  );
}
