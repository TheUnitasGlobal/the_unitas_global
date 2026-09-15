'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { BadgeCheck, Coins, Crown, Database, Gem, HardDrive, Radio, ShoppingBag, Tag, Upload, Wallet } from 'lucide-react';
import { useWallet } from '@/components/wallet/WalletProvider';
import { useSpatialAudio } from '@/components/audio/SpatialAudioProvider';
import { HOT_NEWS_AXES, hotNewsAxisMeta } from '@/lib/live/hotNewsAxes';
import type { HotNewsCategory } from '@/lib/live/hotNews';
import { createHubChannel, type HubChannelHandle } from '@/lib/hub/hubChannel';
import {
  CREATOR_SHARE,
  LISTING_PRICE_MAX,
  LISTING_PRICE_MIN,
  LISTING_SUMMARY_MAX,
  LISTING_TITLE_MAX,
  UNITAS_SHARE,
  buyPack,
  canBuy,
  catalogView,
  isTradeEvent,
  listPack,
  listingStatus,
  packById,
  packStats,
  projectedEarnings,
  projectedSales,
  readLedger,
  sellerBoard,
  validateListing,
  writeLedger,
  type CatalogSort,
  type ExchangeLedger,
  type KnowledgePack,
  type SellerRow,
  type TradeEvent,
} from '@/lib/hub/knowledgeExchange';
import {
  hasHubSession,
  hubBuyPack,
  hubListPack,
  hubSellerBoard,
  hubSync,
  isHubServerConfigured,
  type HubServerError,
} from '@/lib/hub/hubLedger';
import { useHubIdentity } from './useHubIdentity';

const TICKER_ROWS = 6;
const BOARD_ROWS = 6;

/**
 * REV-29 MISSION 4 -- UNITAS 지식 거래소, the hub's revenue theme. The pure
 * rules live in lib/hub/knowledgeExchange.ts; this renders them: credits,
 * the live trade ticker (every purchase anywhere is broadcast over the hub
 * channel and lands here within the round trip), the themed catalogue, the
 * visitor's library, the listing form with its projected earnings and the
 * creator board.
 *
 * REV-30 M1: there are now TWO ledgers and the UI says which one is in force.
 * A signed-in visitor's credits, purchases and listings live in Postgres
 * under RLS (lib/hub/hubLedger.ts -> the hub_* RPCs); a guest keeps REV-29's
 * device ledger. They are never merged: importing a device's *claimed*
 * purchases would grant whatever the device claims. On the server path the
 * PRICE IS THE SERVER'S -- `hub_buy_pack` takes a pack id and reads the price
 * from `hub_catalog`, so a tampered client cannot buy a 320-credit pack for
 * one. The creator board switches to real revenue from the purchase ledger as
 * soon as it has rows, and falls back to the seeded board until then.
 *
 * Honest labels throughout, and the settlement into U-COIN is still named as
 * the step that opens next -- these credits are not U-COIN.
 */
export function KnowledgeExchange() {
  const t = useTranslations('Rev29.exchange');
  const tHub = useTranslations('Rev29.hub');
  /** REV-30 M1: one shared vocabulary for server outcomes, used by every hub
   *  surface, so a refusal reads the same wherever it happens. */
  const tRev30 = useTranslations('Rev30');
  const tNews = useTranslations('HotNews');
  const locale = useLocale();
  const { playHoverSfx, playQuestEnterSfx } = useSpatialAudio();
  const { session, balance, configured } = useWallet();
  const me = useHubIdentity();

  const [ledger, setLedger] = useState<ExchangeLedger>(() => readLedger());
  const [theme, setTheme] = useState<HotNewsCategory | 'all'>('all');
  const [sort, setSort] = useState<CatalogSort>('trending');
  const [trades, setTrades] = useState<TradeEvent[]>([]);
  const [online, setOnline] = useState<number | null>(null);
  const [live, setLive] = useState<boolean | null>(null);
  const [justBought, setJustBought] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  /** REV-30 M1: which ledger is in force. 'pending' until the session is known. */
  const [mode, setMode] = useState<'pending' | 'device' | 'server'>('pending');
  const [serverBoard, setServerBoard] = useState<SellerRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<HubServerError | null>(null);
  const channelRef = useRef<HubChannelHandle | null>(null);

  // Form
  const [title, setTitle] = useState('');
  const [formTheme, setFormTheme] = useState<HotNewsCategory>('economy');
  const [price, setPrice] = useState(120);
  const [summary, setSummary] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // REV-30 M1: the server ledger when there is a session, the device ledger
  // otherwise. A failed sync falls back to the device rather than to a blank
  // hub -- an exchange that renders nothing because the network blinked is
  // worse than one that renders this device's truth and says so.
  useEffect(() => {
    let cancelled = false;
    setNow(Date.now());
    setLedger(readLedger());
    void (async () => {
      const signedIn = isHubServerConfigured() && (await hasHubSession());
      if (cancelled) return;
      if (!signedIn) {
        setMode('device');
        return;
      }
      const res = await hubSync();
      if (cancelled) return;
      if (res.ok && res.data) {
        setLedger(res.data);
        setMode('server');
      } else {
        setMode('device');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Real creator revenue once the purchase ledger has rows; the seeded board
  // stands in until then (and whenever the call cannot be made at all).
  useEffect(() => {
    if (mode !== 'server') return;
    let cancelled = false;
    void hubSellerBoard(BOARD_ROWS).then((rows) => {
      if (!cancelled && rows.length > 0) setServerBoard(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [mode]);

  // The exchange room: a purchase anywhere is a ticker row everywhere.
  useEffect(() => {
    const handle = createHubChannel('exchange', me.id);
    if (!handle) {
      setLive(false);
      return;
    }
    channelRef.current = handle;
    handle
      .onBroadcast('trade', (payload) => {
        if (isTradeEvent(payload)) setTrades((prev) => [payload, ...prev].slice(0, TICKER_ROWS));
      })
      .onPresenceCount(setOnline);
    void handle.ready.then((ok) => {
      setLive(ok);
      if (ok) void handle.track({ name: me.name });
    });
    return () => {
      channelRef.current = null;
      handle.unsubscribe();
    };
  }, [me.id, me.name]);

  function commit(next: ExchangeLedger) {
    setLedger(next);
    writeLedger(next);
  }

  /** The ticker row + broadcast every successful purchase produces. */
  function announce(packId: string, at: number) {
    playQuestEnterSfx();
    setJustBought(packId);
    const trade: TradeEvent = { packId, buyer: me.name, at };
    setTrades((prev) => [trade, ...prev].slice(0, TICKER_ROWS));
    void channelRef.current?.broadcast('trade', { ...trade });
  }

  async function buy(pack: KnowledgePack) {
    if (busy || canBuy(ledger, pack) !== 'ok') return;
    setServerError(null);

    if (mode !== 'server') {
      const at = Date.now();
      commit(buyPack(ledger, pack, at));
      announce(pack.id, at);
      return;
    }

    // Server path: the request carries the pack id alone. The debit, the
    // ownership guard and the 70/30 split all happen inside one Postgres
    // transaction, so a refused purchase leaves nothing half-done.
    setBusy(true);
    const res = await hubBuyPack(pack.id);
    setBusy(false);
    if (!res.ok || !res.data) {
      setServerError(res.error);
      // The server refused: re-read rather than guess at the new state.
      const fresh = await hubSync();
      if (fresh.ok && fresh.data) setLedger(fresh.data);
      return;
    }
    const at = Date.now();
    setLedger((prev) => ({
      ...prev,
      credits: res.data!.credits,
      purchases: [...prev.purchases, { packId: pack.id, at, price: res.data!.price }],
    }));
    announce(pack.id, at);
  }

  async function submitListing(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const input = { title, theme: formTheme, price, summary };
    // The client check is for instant feedback; the server re-checks every
    // one of these rules and is the copy that decides.
    const verdict = validateListing(input);
    if (verdict !== 'ok') {
      setFormError(verdict === 'title' ? t('form.errTitle') : verdict === 'price' ? t('form.errPrice') : t('form.errSummary'));
      return;
    }
    setFormError(null);
    setServerError(null);

    if (mode !== 'server') {
      commit(listPack(ledger, input, Date.now()));
    } else {
      setBusy(true);
      const res = await hubListPack(input);
      setBusy(false);
      if (!res.ok || !res.data) {
        setServerError(res.error);
        return;
      }
      setLedger((prev) => ({ ...prev, listings: [res.data!, ...prev.listings] }));
    }
    playQuestEnterSfx();
    setTitle('');
    setSummary('');
    setNow(Date.now());
  }

  const packs = useMemo(() => catalogView(theme, sort), [theme, sort]);
  const owned = useMemo(() => ledger.purchases.map((p) => packById(p.packId)).filter((p): p is KnowledgePack => Boolean(p)), [ledger.purchases]);
  const earnings = useMemo(() => projectedEarnings(ledger, now), [ledger, now]);
  const seededBoard = useMemo(() => sellerBoard().slice(0, BOARD_ROWS), []);
  const board = serverBoard ?? seededBoard;
  const numberFmt = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const timeFmt = useMemo(() => new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }), [locale]);

  return (
    <div className="qw-hubx" data-hub-exchange="">
      <p className="qw-hub-meta text-[13px] text-gray-400">{t('lede')}</p>

      <div className="qw-hubx-bar" data-hub-exchange-bar="">
        <span className="qw-hubx-pill" data-hub-credits="">
          <Coins size={14} aria-hidden="true" />
          <strong>{numberFmt.format(ledger.credits)}</strong>
          {t('credits')}
        </span>
        {configured && session && balance !== null && (
          <span className="qw-hubx-pill" data-hub-wallet="">
            <Wallet size={14} aria-hidden="true" />
            <strong>{numberFmt.format(balance)}</strong>
            {t('wallet')}
          </span>
        )}
        <span className="qw-hubx-pill qw-hubx-pill--quiet">
          <Gem size={14} aria-hidden="true" />
          {t('split', { creator: Math.round(CREATOR_SHARE * 100), platform: Math.round(UNITAS_SHARE * 100) })}
        </span>
        <span className="qw-hubx-pill qw-hubx-pill--quiet" data-hub-live={live === null ? 'pending' : live ? '1' : '0'}>
          <Radio size={14} aria-hidden="true" />
          {live === false ? tHub('localOnly') : online !== null ? tHub('online', { count: online }) : tHub('live')}
        </span>
        {/* REV-30 M1: which ledger is in force, stated rather than implied. */}
        <span className="qw-hubx-pill qw-hubx-pill--quiet" data-hub-ledger={mode}>
          {mode === 'server' ? <Database size={14} aria-hidden="true" /> : <HardDrive size={14} aria-hidden="true" />}
          {mode === 'server' ? tRev30('ledger.server') : tRev30('ledger.device')}
        </span>
      </div>
      <p className="mt-1 text-[11px] text-gray-500">{mode === 'server' ? tRev30('ledger.serverNote') : t('creditsNote')}</p>
      {serverError && (
        <p className="mt-1 text-[11px] font-bold text-red-400" role="alert" data-hub-server-error={serverError}>
          {tRev30(`error.${serverError}`)}
        </p>
      )}

      <section className="qw-hubx-ticker" data-hub-ticker="" aria-live="polite">
        <p className="qw-deeper-label flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-widest text-accent">
          <Radio size={13} aria-hidden="true" />
          {t('ticker')}
        </p>
        {trades.length === 0 ? (
          <p className="mt-1 text-[12px] text-gray-500">{t('tickerEmpty')}</p>
        ) : (
          <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-gray-300">
            {trades.map((tr) => (
              <li key={`${tr.packId}:${tr.at}:${tr.buyer}`} data-hub-trade="">
                <span className="text-gray-500">{timeFmt.format(new Date(tr.at))} · </span>
                {t('tickerRow', { buyer: tr.buyer, pack: packById(tr.packId)?.title ?? tr.packId })}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="qw-hub-strip select-none mt-4" role="tablist" aria-label={t('form.theme')} data-hub-exchange-themes="">
        <button type="button" role="tab" aria-selected={theme === 'all'} data-active={theme === 'all' ? '1' : '0'} className="qw-hub-chip" onMouseEnter={() => playHoverSfx()} onClick={() => setTheme('all')}>
          <Tag size={15} aria-hidden="true" />
          {t('all')}
        </button>
        {HOT_NEWS_AXES.map((axis) => (
          <button
            key={axis.key}
            type="button"
            role="tab"
            aria-selected={theme === axis.key}
            data-active={theme === axis.key ? '1' : '0'}
            className="qw-hub-chip"
            style={{ '--qw-hub-accent': axis.color } as CSSProperties}
            onMouseEnter={() => playHoverSfx()}
            onClick={() => setTheme(axis.key)}
          >
            <axis.icon size={15} style={{ color: axis.color }} aria-hidden="true" />
            {tNews(`category.${axis.key}`)}
          </button>
        ))}
      </div>

      <div className="qw-hub-tabs mt-3" role="tablist" aria-label={t('sort.trending')}>
        {(['trending', 'newest', 'price'] as const).map((key) => (
          <button key={key} type="button" role="tab" aria-selected={sort === key} className="qw-hub-tab" onMouseEnter={() => playHoverSfx()} onClick={() => setSort(key)}>
            {t(`sort.${key}`)}
          </button>
        ))}
      </div>

      <ul className="qw-hubx-grid" data-hub-packs="">
        {packs.map((pack) => {
          const meta = hotNewsAxisMeta(pack.theme);
          const stats = packStats(pack);
          const verdict = canBuy(ledger, pack);
          return (
            <li key={pack.id} className="qw-hubx-card" data-pack={pack.id} data-tier={pack.tier} style={{ '--qw-hub-accent': meta.color } as CSSProperties}>
              <p className="qw-hubx-chips">
                <span className="qw-hubx-chip">{t(`kind.${pack.kind}`)}</span>
                <span className="qw-hubx-chip qw-hubx-chip--tier" data-tier={pack.tier}>
                  {pack.tier === 'sovereign' ? <Crown size={11} aria-hidden="true" /> : pack.tier === 'pro' ? <Gem size={11} aria-hidden="true" /> : null}
                  {t(`tier.${pack.tier}`)}
                </span>
              </p>
              <p className="qw-hubx-title">{pack.title}</p>
              <p className="qw-hubx-meta">
                <span className="inline-flex items-center gap-1" style={{ color: meta.color }}>
                  <meta.icon size={12} aria-hidden="true" />
                  {tNews(`category.${pack.theme}`)}
                </span>
                <span>{t('by', { handle: pack.seller })}</span>
              </p>
              <p className="qw-hubx-meta">
                <span>{t('sales', { count: numberFmt.format(stats.sales) })}</span>
                <span>{t('rating', { rating: stats.rating.toFixed(1) })}</span>
              </p>
              <div className="qw-hubx-foot">
                <span className="qw-hubx-price">
                  <Coins size={13} aria-hidden="true" />
                  {numberFmt.format(pack.price)}
                </span>
                <button
                  type="button"
                  className="qw-pill-btn qw-hubx-buy"
                  data-on={verdict === 'owned' ? '1' : '0'}
                  data-verdict={verdict}
                  disabled={verdict !== 'ok' || busy}
                  onMouseEnter={() => playHoverSfx()}
                  onClick={() => void buy(pack)}
                >
                  {verdict === 'owned' ? <BadgeCheck size={13} aria-hidden="true" /> : <ShoppingBag size={13} aria-hidden="true" />}
                  {verdict === 'owned' ? t('owned') : verdict === 'insufficient' ? t('insufficient') : t('buy')}
                </button>
              </div>
              {justBought === pack.id && (
                <p className="mt-1 text-[11px] font-bold text-accent" role="status">
                  {t('bought')}
                </p>
              )}
            </li>
          );
        })}
      </ul>

      <div className="qw-hubx-columns">
        <section className="qw-hubx-section" data-hub-library="">
          <p className="qw-deeper-label flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-widest text-accent">
            <BadgeCheck size={13} aria-hidden="true" />
            {t('myPacks')}
          </p>
          {owned.length === 0 ? (
            <p className="mt-1 text-[12px] text-gray-500">—</p>
          ) : (
            <ul className="mt-1 space-y-1 text-[13px] text-gray-200">
              {owned.map((p) => (
                <li key={p.id} className="flex items-center gap-2">
                  <BadgeCheck size={12} className="shrink-0 text-accent" aria-hidden="true" />
                  <span className="min-w-0 truncate">{p.title}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="qw-hubx-section" data-hub-listing="">
          <p className="qw-deeper-label flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-widest text-accent">
            <Upload size={13} aria-hidden="true" />
            {t('listTitle')}
          </p>
          <form className="qw-hubx-form" onSubmit={(e) => void submitListing(e)}>
            <label className="qw-hubx-field">
              <span>{t('form.title')}</span>
              <input type="text" value={title} maxLength={LISTING_TITLE_MAX} onChange={(e) => setTitle(e.target.value)} data-hub-form-title="" />
            </label>
            <label className="qw-hubx-field">
              <span>{t('form.theme')}</span>
              <select value={formTheme} onChange={(e) => setFormTheme(e.target.value as HotNewsCategory)}>
                {HOT_NEWS_AXES.map((axis) => (
                  <option key={axis.key} value={axis.key}>
                    {tNews(`category.${axis.key}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="qw-hubx-field">
              <span>{t('form.price')}</span>
              <input type="number" inputMode="numeric" min={LISTING_PRICE_MIN} max={LISTING_PRICE_MAX} step={1} value={price} onChange={(e) => setPrice(Number(e.target.value))} data-hub-form-price="" />
            </label>
            <label className="qw-hubx-field qw-hubx-field--wide">
              <span>{t('form.summary')}</span>
              <input type="text" value={summary} maxLength={LISTING_SUMMARY_MAX} onChange={(e) => setSummary(e.target.value)} />
            </label>
            {formError && (
              <p className="text-[11px] font-bold text-red-400" role="alert">
                {formError}
              </p>
            )}
            <button type="submit" className="qw-pill-btn" data-on="1" disabled={busy} onMouseEnter={() => playHoverSfx()} data-hub-form-submit="">
              <Upload size={13} aria-hidden="true" />
              {t('form.submit')}
            </button>
          </form>

          {ledger.listings.length > 0 && (
            <div className="mt-3" data-hub-my-listings="">
              <p className="text-[12px] font-bold uppercase tracking-widest text-gray-400">{t('myListings')}</p>
              <ul className="mt-1 space-y-1.5 text-[13px] text-gray-200">
                {ledger.listings.map((l) => {
                  const status = listingStatus(l, now);
                  return (
                    <li key={l.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5" data-hub-listing-row={status}>
                      <span className="qw-hubx-chip" data-status={status}>
                        {t(`status.${status}`)}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-semibold">{l.title}</span>
                      <span className="text-gray-500">
                        {numberFmt.format(l.price)} · {t('projectedSales', { count: projectedSales(l, now) })}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-2 text-[12px] text-gray-400">
                {t('projected')} · <strong className="text-white">{numberFmt.format(earnings.creator)}</strong> / {numberFmt.format(earnings.gross)}
              </p>
            </div>
          )}
        </section>

        <section className="qw-hubx-section" data-hub-board="">
          <p className="qw-deeper-label flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-widest text-accent">
            <Crown size={13} aria-hidden="true" />
            {t('board')}
          </p>
          <ol className="mt-1 space-y-1 text-[13px] text-gray-200">
            {board.map((row, i) => (
              <li key={row.handle} className="flex items-center gap-2">
                <span className="qw-hub-rank shrink-0">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate font-semibold">@{row.handle}</span>
                <span className="text-gray-500">{numberFmt.format(row.revenue)}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
