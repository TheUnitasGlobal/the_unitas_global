/**
 * REV-29 MISSION 4 -- UNITAS 지식 거래소 (Knowledge Exchange), the pure half.
 *
 * The revenue-bearing theme of the UNITAS hub: knowledge packs (a curated
 * ladder, a playbook, a dataset, a prompt kit) listed by pseudonymous
 * creators, bought with exchange credits, with a fixed CREATOR_SHARE /
 * UNITAS_SHARE split on every sale -- the Codex ch.1 subscription-and-margin
 * engine rendered as a marketplace the visitor can act in today.
 *
 * HONEST POSTURE. There is no server ledger for packs yet (that needs a
 * table, an RPC and a settlement job -- a schema change this revision does
 * not make), so:
 *  - the CATALOGUE is a seed: brand-neutral English titles shared by every
 *    locale (the same rule the ranking catalogues and the shorts seed follow).
 *    A pack carries what is actually known about it -- title, theme, seller,
 *    price, kind, tier -- and nothing else;
 *  - the visitor's LEDGER (credits, purchases, listings) lives on the device
 *    (localStorage) and is labelled as such on screen;
 *  - a listing's "demand" is a deterministic projection from its age, shown
 *    as a projection, never as settled income.
 * Every trade is announced over the hub's broadcast channel, so the ticker
 * other visitors see is real activity -- just not yet a bank.
 *
 * REV-40. The seeded counters are GONE, not merely unrendered. An earlier pass
 * stopped printing them but kept the PRNG alive as the ordering key behind the
 * catalogue's default "popularity" tab -- so the first screen a visitor saw was
 * still a fabricated ranking, just one with its numbers hidden. A hidden
 * fabrication is the same lie told more quietly.
 *
 * This module now contains no pseudo-random source at all. The catalogue sorts
 * only two honest ways: catalogue order (newest first) and price. A real
 * popularity ranking arrives when `hub_purchases` has rows to count, and not
 * before. `__tests__/hub/knowledgeExchange.test.ts` asserts the removal
 * structurally so a revert cannot quietly restore it.
 */
import type { HotNewsCategory } from '@/lib/live/hotNews';

export type PackKind = 'ladder' | 'playbook' | 'dataset' | 'prompt';
export type PackTier = 'seed' | 'pro' | 'sovereign';

export interface KnowledgePack {
  id: string;
  title: string;
  theme: HotNewsCategory;
  seller: string;
  /** Exchange credits. */
  price: number;
  kind: PackKind;
  tier: PackTier;
}

export const CREATOR_SHARE = 0.7;
export const UNITAS_SHARE = 0.3;
export const STARTER_CREDITS = 1200;
export const EXCHANGE_STORAGE_KEY = 'unitas.hub.exchange.v1';
export const LISTING_TITLE_MIN = 3;
export const LISTING_TITLE_MAX = 60;
export const LISTING_SUMMARY_MAX = 200;
export const LISTING_PRICE_MIN = 10;
export const LISTING_PRICE_MAX = 5000;

export const EXCHANGE_CATALOG: readonly KnowledgePack[] = [
  { id: 'kp-01', title: 'Central bank week — a 12-rung reading ladder', theme: 'economy', seller: 'quiet.ledger', price: 180, kind: 'ladder', tier: 'pro' },
  { id: 'kp-02', title: 'Zero-capital launch playbook for one-person shops', theme: 'pragma', seller: 'cart.mind', price: 240, kind: 'playbook', tier: 'sovereign' },
  { id: 'kp-03', title: 'Semiconductor supply map, verified sources only', theme: 'technology', seller: 'nomad.kai', price: 320, kind: 'dataset', tier: 'sovereign' },
  { id: 'kp-04', title: 'Courtroom vocabulary in five languages', theme: 'law', seller: 'ink.and.echo', price: 90, kind: 'prompt', tier: 'seed' },
  { id: 'kp-05', title: 'Election night — how to read exit polls', theme: 'politics', seller: 'frame.zero', price: 120, kind: 'playbook', tier: 'pro' },
  { id: 'kp-06', title: 'Earthquake early-warning primer for coastal cities', theme: 'disaster', seller: 'span.wire', price: 60, kind: 'ladder', tier: 'seed' },
  { id: 'kp-07', title: 'Vaccine trial phases, explained in one page', theme: 'health', seller: 'ward.seven', price: 70, kind: 'ladder', tier: 'seed' },
  { id: 'kp-08', title: 'Pension reform tracker — 20 countries', theme: 'welfare', seller: 'quiet.ledger', price: 210, kind: 'dataset', tier: 'pro' },
  { id: 'kp-09', title: 'Ceasefire timelines, 1990–now', theme: 'conflict', seller: 'proof.sketch', price: 150, kind: 'dataset', tier: 'pro' },
  { id: 'kp-10', title: 'Cyber-defence checklist for small teams', theme: 'security', seller: 'bench.notes', price: 260, kind: 'playbook', tier: 'sovereign' },
  { id: 'kp-11', title: 'Summit season — a diplomat’s reading order', theme: 'strategy', seller: 'hem.line', price: 130, kind: 'ladder', tier: 'pro' },
  { id: 'kp-12', title: 'Transfer window arithmetic', theme: 'sports', seller: 'pitch.side', price: 40, kind: 'prompt', tier: 'seed' },
  { id: 'kp-13', title: 'Film festival circuit — who decides what', theme: 'culture', seller: 'frame.zero', price: 110, kind: 'ladder', tier: 'pro' },
  { id: 'kp-14', title: 'Auction house price ladders, 2015–now', theme: 'art', seller: 'lineweight', price: 190, kind: 'dataset', tier: 'pro' },
  { id: 'kp-15', title: 'Press-freedom index, source by source', theme: 'expression', seller: 'ink.and.echo', price: 80, kind: 'dataset', tier: 'seed' },
  { id: 'kp-16', title: 'Endangered languages — a field starter', theme: 'language', seller: 'steam.rising', price: 55, kind: 'ladder', tier: 'seed' },
  { id: 'kp-17', title: 'Birth-rate policy playbook', theme: 'society', seller: 'hem.line', price: 170, kind: 'playbook', tier: 'pro' },
  { id: 'kp-18', title: 'Power grid outage post-mortems', theme: 'structure', seller: 'span.wire', price: 220, kind: 'dataset', tier: 'sovereign' },
  { id: 'kp-19', title: 'Regulator watch — EU · US · KR · JP', theme: 'institution', seller: 'quiet.ledger', price: 200, kind: 'dataset', tier: 'pro' },
  { id: 'kp-20', title: 'University admissions decoded', theme: 'education', seller: 'proof.sketch', price: 95, kind: 'playbook', tier: 'seed' },
  { id: 'kp-21', title: 'Fusion milestones and what they actually mean', theme: 'science', seller: 'bench.notes', price: 140, kind: 'ladder', tier: 'pro' },
  { id: 'kp-22', title: 'Bridge & tunnel megaprojects — cost curves', theme: 'engineering', seller: 'span.wire', price: 230, kind: 'dataset', tier: 'sovereign' },
  { id: 'kp-23', title: 'Prompt kit: brief any news story in 6 axes', theme: 'expression', seller: 'nomad.kai', price: 45, kind: 'prompt', tier: 'seed' },
  { id: 'kp-24', title: 'Tariff rounds — a trader’s timeline', theme: 'economy', seller: 'cart.mind', price: 160, kind: 'ladder', tier: 'pro' },
];

const BY_ID = new Map<string, KnowledgePack>(EXCHANGE_CATALOG.map((p) => [p.id, p]));

export function packById(id: string): KnowledgePack | undefined {
  return BY_ID.get(id);
}

function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * REV-40 -- the seeded counter generator that used to live here is DELETED.
 *
 * It drew a sales total, a star rating and a buyer count for every catalogue
 * pack out of a hash-seeded generator, and a companion helper summed those
 * draws into a creator revenue board. None of it had a source: `hub_purchases`
 * has no rows and there is no ratings signal anywhere in the product. The
 * numbers stopped being printed first, then the last thing reading them -- the
 * catalogue's default popularity tab -- went with them, and now the generator
 * itself is gone. `hashString` above survives only to mint listing ids.
 *
 * Nothing in this module may reintroduce a pseudo-random source. The real
 * popularity ranking is an aggregate over `hub_purchases`, computed server-side
 * when that table has rows to count.
 */

export function splitRevenue(amount: number): { creator: number; platform: number } {
  const creator = Math.round(amount * CREATOR_SHARE);
  return { creator, platform: amount - creator };
}

export interface Purchase {
  packId: string;
  at: number;
  price: number;
}

export interface UserListing {
  id: string;
  title: string;
  theme: HotNewsCategory;
  price: number;
  summary: string;
  at: number;
  status: 'review' | 'live';
}

export interface ExchangeLedger {
  credits: number;
  purchases: Purchase[];
  listings: UserListing[];
}

export const EMPTY_LEDGER: ExchangeLedger = { credits: STARTER_CREDITS, purchases: [], listings: [] };

export function ownsPack(ledger: ExchangeLedger, packId: string): boolean {
  return ledger.purchases.some((p) => p.packId === packId);
}

export type BuyVerdict = 'ok' | 'owned' | 'insufficient';

export function canBuy(ledger: ExchangeLedger, pack: KnowledgePack): BuyVerdict {
  if (ownsPack(ledger, pack.id)) return 'owned';
  if (ledger.credits < pack.price) return 'insufficient';
  return 'ok';
}

/** Pure: the ledger after buying `pack` at `at`; unchanged when it cannot. */
export function buyPack(ledger: ExchangeLedger, pack: KnowledgePack, at: number): ExchangeLedger {
  if (canBuy(ledger, pack) !== 'ok') return ledger;
  return {
    ...ledger,
    credits: ledger.credits - pack.price,
    purchases: [...ledger.purchases, { packId: pack.id, at, price: pack.price }],
  };
}

export interface ListingInput {
  title: string;
  theme: HotNewsCategory;
  price: number;
  summary: string;
}

export type ListingVerdict = 'ok' | 'title' | 'price' | 'summary';

/** Pure: why a listing form cannot be submitted, or 'ok'. */
export function validateListing(input: ListingInput): ListingVerdict {
  const title = input.title.trim();
  if (Array.from(title).length < LISTING_TITLE_MIN || Array.from(title).length > LISTING_TITLE_MAX) return 'title';
  if (!Number.isFinite(input.price) || input.price < LISTING_PRICE_MIN || input.price > LISTING_PRICE_MAX || Math.floor(input.price) !== input.price) return 'price';
  if (Array.from(input.summary.trim()).length > LISTING_SUMMARY_MAX) return 'summary';
  return 'ok';
}

/** Pure: the ledger with a new listing (status 'review'); unchanged when invalid. */
export function listPack(ledger: ExchangeLedger, input: ListingInput, at: number): ExchangeLedger {
  if (validateListing(input) !== 'ok') return ledger;
  const title = input.title.trim();
  const listing: UserListing = {
    id: `ul:${at.toString(36)}:${hashString(title).toString(36)}`,
    title,
    theme: input.theme,
    price: input.price,
    summary: input.summary.trim(),
    at,
    status: 'review',
  };
  return { ...ledger, listings: [listing, ...ledger.listings] };
}

/** A listing goes live after this long in review. */
export const LISTING_REVIEW_MS = 10 * 60 * 1000;

/** Pure: the listing's status as of `now` (review -> live after the window). */
export function listingStatus(listing: UserListing, now: number): UserListing['status'] {
  return now - listing.at >= LISTING_REVIEW_MS ? 'live' : 'review';
}

/** Pure: a deterministic demand PROJECTION for one listing -- one sale per
 *  six live hours, capped -- shown as a projection, never as income. */
export function projectedSales(listing: UserListing, now: number): number {
  const live = now - listing.at - LISTING_REVIEW_MS;
  if (live <= 0) return 0;
  return Math.min(40, Math.floor(live / (6 * 60 * 60 * 1000)));
}

export interface Earnings {
  gross: number;
  creator: number;
  platform: number;
  sales: number;
}

/** Pure: projected earnings across the visitor's listings. */
export function projectedEarnings(ledger: ExchangeLedger, now: number): Earnings {
  let gross = 0;
  let sales = 0;
  for (const l of ledger.listings) {
    const n = projectedSales(l, now);
    sales += n;
    gross += n * l.price;
  }
  const split = splitRevenue(gross);
  return { gross, creator: split.creator, platform: split.platform, sales };
}

/**
 * One creator's settled revenue. The ONLY producer is `hub_seller_board`
 * (lib/hub/hubLedger.ts) aggregating `hub_purchases`; this module ships no
 * local implementation, so an empty board means the ledger is empty or could
 * not be read -- never that a fallback was substituted.
 */
export interface SellerRow {
  handle: string;
  packs: number;
  sales: number;
  revenue: number;
}

/**
 * REV-40 -- the catalogue's two HONEST orderings.
 *
 * There used to be a third, offered first and selected by default, that ranked
 * packs by the seeded sales draw described above. Twenty-four packs arrived in
 * a confident popularity order that nothing had measured, and it was the very
 * first thing a visitor read. It is removed rather than relabelled: there is no
 * wording that makes an invented ranking true.
 *
 * 'newest' is catalogue order reversed -- the seed is authored oldest-first, so
 * the reverse is a fact about the file, not a claim about the market. 'price'
 * is the price. A third option returns when a purchase aggregate exists.
 */
export type CatalogSort = 'newest' | 'price';

/** The ordering a visitor gets before touching anything: catalogue truth. */
export const DEFAULT_CATALOG_SORT: CatalogSort = 'newest';

/** Pure: the catalogue filtered by theme and sorted. Both sorts are total and
 *  stable, so the same arguments always give the same order. */
export function catalogView(theme: HotNewsCategory | 'all', sort: CatalogSort): KnowledgePack[] {
  const list = EXCHANGE_CATALOG.filter((p) => theme === 'all' || p.theme === theme);
  if (sort === 'price') return [...list].sort((a, b) => a.price - b.price || a.id.localeCompare(b.id));
  return [...list].reverse();
}

function isLedger(value: unknown): value is ExchangeLedger {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.credits === 'number' && Array.isArray(v.purchases) && Array.isArray(v.listings);
}

export function readLedger(): ExchangeLedger {
  if (typeof window === 'undefined') return EMPTY_LEDGER;
  try {
    const raw = window.localStorage.getItem(EXCHANGE_STORAGE_KEY);
    if (!raw) return EMPTY_LEDGER;
    const parsed = JSON.parse(raw) as unknown;
    if (!isLedger(parsed)) return EMPTY_LEDGER;
    return {
      credits: Math.max(0, Math.floor(parsed.credits)),
      purchases: parsed.purchases.filter((p): p is Purchase => Boolean(p) && typeof p === 'object' && typeof (p as Purchase).packId === 'string' && typeof (p as Purchase).at === 'number'),
      listings: parsed.listings.filter((l): l is UserListing => Boolean(l) && typeof l === 'object' && typeof (l as UserListing).id === 'string' && typeof (l as UserListing).at === 'number'),
    };
  } catch {
    return EMPTY_LEDGER;
  }
}

export function writeLedger(ledger: ExchangeLedger): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(EXCHANGE_STORAGE_KEY, JSON.stringify(ledger));
  } catch {
    // quota / private mode -- the ledger stays in memory for the session
  }
}

/** A trade announced over the hub channel: what the ticker renders. */
export interface TradeEvent {
  packId: string;
  buyer: string;
  at: number;
  /**
   * REV-36 M3 marked simulated (network-pulse) trades with this. REV-40 stopped
   * producing them, but the field stays so the ticker can REJECT any payload
   * that still carries it -- a stale tab or an older client must not be able to
   * put an invented trade on the wire. Nothing may set it.
   */
  sim?: true;
}

export function isTradeEvent(value: unknown): value is TradeEvent {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.packId === 'string' && BY_ID.has(v.packId) && typeof v.buyer === 'string' && v.buyer.length > 0 && v.buyer.length <= 40 && typeof v.at === 'number';
}
