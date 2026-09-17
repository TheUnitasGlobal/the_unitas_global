'use client';

import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { EMPTY_LEDGER, type ExchangeLedger, type Purchase, type SellerRow, type UserListing } from '@/lib/hub/knowledgeExchange';
import { isChatRoomKey, sanitizeChatText, type ChatMessage, type ChatRoomKey } from '@/lib/hub/themeChat';
import { isHotNewsCategory, type HotNewsCategory } from '@/lib/live/hotNews';
import { validatePublicSupabaseEnv } from '@/lib/security/credentialShape';

/* REV-36 M3 shorts-reaction + market-pulse seam is appended at the end of this
 * file (search "REV-36"); it reuses the pure rpc() helper and HubResult shape. */

/**
 * REV-30 MISSION 1 -- the seam between the UNITAS hub and its SERVER LEDGER
 * (supabase/migrations/20260916000000_hub_exchange_and_rooms.sql).
 *
 * TWO LEDGERS, ONE UI. A signed-in visitor's credits, purchases, listings and
 * messages live in Postgres under RLS; a guest keeps REV-29's device ledger.
 * They are never merged -- importing a device's *claimed* purchases would
 * hand out whatever the device claims. Which one is in force is shown on
 * screen rather than inferred, so nobody is told their guest purchases
 * "synced" when they did not.
 *
 * EVERY MAPPER IS PURE AND VALIDATING. An RPC answer is data from the network:
 * it is checked field by field and dropped if it does not fit, exactly as the
 * chat payload guard treats a broadcast. That is also what makes this file
 * unit-testable without a database.
 *
 * FAIL-OPEN, NEVER FAIL-BLANK. Any call returns `null` (or an empty list) when
 * Supabase is unconfigured, the session is absent, or the RPC errors -- the
 * caller then keeps the device ledger and the hub stays usable offline.
 * "Unconfigured" is decided by SHAPE, not by truthiness: an env holding a
 * placeholder key is unreadable, and unreadable degrades here rather than
 * further downstream as a 401 (see `isHubServerConfigured` below).
 */

/** What the buy RPC answers on success. */
export interface BuyResult {
  packId: string;
  price: number;
  credits: number;
  creatorShare: number;
  platformShare: number;
}

/** Why a server call could not proceed -- surfaced verbatim to the UI. */
export type HubServerError = 'unauthenticated' | 'owned' | 'insufficient' | 'too-fast' | 'rejected' | 'offline';

export interface HubResult<T> {
  ok: boolean;
  data: T | null;
  error: HubServerError | null;
}

function ok<T>(data: T): HubResult<T> {
  return { ok: true, data, error: null };
}
function fail<T>(error: HubServerError): HubResult<T> {
  return { ok: false, data: null, error };
}

/**
 * Is the server ledger USABLE? This module owns that answer for the whole hub:
 * `lib/hub/hubChannel.ts` re-exports this very function as
 * `isHubRealtimeConfigured`, because "can I open a Realtime socket" and "can I
 * call an RPC" are the same question about the same public env pair. There used
 * to be two copies of the boolean, and two copies are how the answers drift.
 *
 * It used to be `Boolean(url && anonKey)` -- which is REV-40's `empty` vs
 * `unreadable` confusion smuggled back in. A placeholder is a NON-EMPTY string:
 * `vercel env pull` writes the literal `[SENSITIVE]` for Secret-typed vars and
 * `.env.example` ships `<paste-the-...>`, so an unreadable env reported itself
 * as CONFIGURED, the UI announced that the server ledger was in force, and then
 * every RPC came back 401. An unusable key has to fall back to the device
 * ledger BEFORE a request leaves, not after the server refuses it.
 *
 * `validatePublicSupabaseEnv` (lib/security/credentialShape -- the ISOMORPHIC
 * module; never `web/scripts/credential-core.mjs`, whose Buffer base64url
 * decode throws in a browser bundle) rejects placeholders, non-JWT keys, and
 * keys whose `role` claim is not `anon`. It is the same gate
 * `getSupabaseBrowserClient()` throws on, so this boolean and that factory can
 * never disagree about what "configured" means.
 *
 * Deliberately NOT memoised: every caller is a mount effect or a pre-flight
 * guard in front of a network round trip -- never a render body, never a list
 * map -- so one regex plus one ~200-byte JWT decode is invisible here, while a
 * module-level cache would have to retain the key and grow a reset seam for
 * env-stubbing tests.
 */
export function isHubServerConfigured(): boolean {
  return validatePublicSupabaseEnv(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  ).ok;
}

/* ------------------------------------------------------------------ */
/* Pure mappers (unit-tested, no network)                              */
/* ------------------------------------------------------------------ */

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function asFiniteInt(value: unknown): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

/** Pure: one purchase row from the `hub_sync` payload. */
export function mapServerPurchase(value: unknown): Purchase | null {
  const r = asRecord(value);
  if (!r) return null;
  const price = asFiniteInt(r.price);
  const at = asFiniteInt(r.at);
  if (typeof r.packId !== 'string' || !r.packId || price === null || price <= 0 || at === null) return null;
  return { packId: r.packId, price, at };
}

/** Pure: one listing row from the `hub_sync` / `hub_list_pack` payload. */
export function mapServerListing(value: unknown): UserListing | null {
  const r = asRecord(value);
  if (!r) return null;
  const price = asFiniteInt(r.price);
  const at = asFiniteInt(r.at);
  if (typeof r.id !== 'string' || !r.id) return null;
  if (typeof r.title !== 'string' || !r.title.trim()) return null;
  if (!isHotNewsCategory(String(r.theme))) return null;
  if (price === null || at === null) return null;
  const status = r.status === 'live' ? 'live' : 'review';
  return {
    id: r.id,
    title: r.title,
    theme: r.theme as HotNewsCategory,
    price,
    summary: typeof r.summary === 'string' ? r.summary : '',
    at,
    status,
  };
}

/**
 * Pure: the whole `hub_sync` payload -> an ExchangeLedger the existing UI
 * already knows how to render. A malformed row is dropped, never guessed at;
 * a malformed envelope yields null so the caller keeps the device ledger.
 */
export function mapServerLedger(value: unknown): ExchangeLedger | null {
  const r = asRecord(value);
  if (!r) return null;
  const credits = asFiniteInt(r.credits);
  if (credits === null || credits < 0) return null;
  const purchases = Array.isArray(r.purchases) ? r.purchases.map(mapServerPurchase).filter((p): p is Purchase => p !== null) : [];
  const listings = Array.isArray(r.listings) ? r.listings.map(mapServerListing).filter((l): l is UserListing => l !== null) : [];
  return { credits, purchases, listings };
}

/** Pure: the `hub_buy_pack` payload. */
export function mapBuyResult(value: unknown): BuyResult | null {
  const r = asRecord(value);
  if (!r || r.ok !== true) return null;
  const price = asFiniteInt(r.price);
  const credits = asFiniteInt(r.credits);
  const creatorShare = asFiniteInt(r.creatorShare);
  const platformShare = asFiniteInt(r.platformShare);
  if (typeof r.packId !== 'string' || price === null || credits === null || creatorShare === null || platformShare === null) return null;
  // The server's own constraint: the split must add back up to the price.
  // Re-checked here so a broken settlement can never be rendered as fine.
  if (creatorShare + platformShare !== price) return null;
  return { packId: r.packId, price, credits, creatorShare, platformShare };
}

/** Pure: one durable message row -> the same ChatMessage the broadcast uses. */
export function mapServerMessage(value: unknown): ChatMessage | null {
  const r = asRecord(value);
  if (!r) return null;
  const at = asFiniteInt(r.at);
  if (typeof r.id !== 'string' || !r.id) return null;
  if (!isChatRoomKey(r.room)) return null;
  if (typeof r.author !== 'string' || !r.author) return null;
  if (typeof r.authorId !== 'string' || !r.authorId) return null;
  if (typeof r.text !== 'string') return null;
  const text = sanitizeChatText(r.text);
  if (!text || at === null) return null;
  return { id: r.id, room: r.room, author: r.author.slice(0, 40), authorId: r.authorId, text, at };
}

/** Pure: the `hub_seller_board` payload. */
export function mapServerBoard(value: unknown): SellerRow[] {
  if (!Array.isArray(value)) return [];
  const rows: SellerRow[] = [];
  for (const entry of value) {
    const r = asRecord(entry);
    if (!r || typeof r.handle !== 'string' || !r.handle) continue;
    const sales = asFiniteInt(r.sales);
    const revenue = asFiniteInt(r.revenue);
    if (sales === null || revenue === null) continue;
    rows.push({ handle: r.handle, packs: 0, sales, revenue });
  }
  return rows;
}

/**
 * Pure: classify a Postgres error message into the reason the UI shows. The
 * RPCs raise plain-text exceptions (`Already owned`, `Insufficient credits`,
 * `Too fast`), so this is a whitelist over those, never a regex over
 * arbitrary server text.
 */
export function classifyHubError(message: string | null | undefined): HubServerError {
  const m = (message ?? '').toLowerCase();
  if (m.includes('not authenticated')) return 'unauthenticated';
  if (m.includes('already owned')) return 'owned';
  if (m.includes('insufficient')) return 'insufficient';
  if (m.includes('too fast')) return 'too-fast';
  return 'rejected';
}

/* ------------------------------------------------------------------ */
/* Calls                                                               */
/* ------------------------------------------------------------------ */

async function rpc<T>(name: string, args: Record<string, unknown>, map: (value: unknown) => T | null): Promise<HubResult<T>> {
  if (!isHubServerConfigured()) return fail<T>('offline');
  try {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.rpc(name, args);
    if (error) return fail<T>(classifyHubError(error.message));
    const mapped = map(data);
    return mapped === null ? fail<T>('rejected') : ok(mapped);
  } catch {
    return fail<T>('offline');
  }
}

/** Is there a signed-in session right now? Decides which ledger is in force. */
export async function hasHubSession(): Promise<boolean> {
  if (!isHubServerConfigured()) return false;
  try {
    const { data } = await getSupabaseBrowserClient().auth.getSession();
    return Boolean(data.session);
  } catch {
    return false;
  }
}

/** Open the hub: mints the starter credits once, returns the whole ledger. */
export function hubSync(): Promise<HubResult<ExchangeLedger>> {
  return rpc('hub_sync', {}, mapServerLedger);
}

/** Buy a pack. The PRICE IS THE SERVER'S -- this call carries only the id. */
export function hubBuyPack(packId: string): Promise<HubResult<BuyResult>> {
  return rpc('hub_buy_pack', { p_pack_id: packId }, mapBuyResult);
}

/** File a listing. Every rule is re-checked server-side. */
export function hubListPack(input: { title: string; theme: HotNewsCategory; price: number; summary: string }): Promise<HubResult<UserListing>> {
  return rpc(
    'hub_list_pack',
    { p_title: input.title, p_theme: input.theme, p_price: input.price, p_summary: input.summary },
    mapServerListing,
  );
}

/** The durable history of one room, oldest first. */
export async function hubRoomHistory(room: ChatRoomKey, limit = 60): Promise<ChatMessage[]> {
  const res = await rpc('hub_room_history', { p_room: room, p_limit: limit }, (value) =>
    Array.isArray(value) ? value.map(mapServerMessage).filter((m): m is ChatMessage => m !== null) : null,
  );
  return res.data ?? [];
}

/** Persist a message. The stored row comes back, so the UI renders what the
 *  server kept rather than its own optimistic copy. */
export function hubPostMessage(room: ChatRoomKey, body: string, author: string): Promise<HubResult<ChatMessage>> {
  return rpc('hub_post_message', { p_room: room, p_body: body, p_author: author }, mapServerMessage);
}

/** Real creator revenue from the purchase ledger. Empty until it has rows. */
export async function hubSellerBoard(limit = 6): Promise<SellerRow[]> {
  const res = await rpc('hub_seller_board', { p_limit: limit }, (value) => mapServerBoard(value));
  return res.data ?? [];
}

/** The device ledger a guest keeps, unchanged from REV-29. */
export const DEVICE_LEDGER_FALLBACK = EMPTY_LEDGER;

/* ================================================================== */
/* REV-36 MISSION 3 -- shorts reactions + market pulse                  */
/* (supabase/migrations/20260917000000_hub_shorts_reactions_and_market_pulse.sql)
 *
 * A signed-in visitor's shorts likes/follows become durable (hub_shorts_*),
 * and the exchange's market bar can read the REAL 24h ledger (hub_market_pulse)
 * instead of the deterministic simulation. Every mapper is pure and validating,
 * exactly like the REV-30 mappers above; every call is fail-open through the
 * same rpc() helper, so a guest / offline visitor simply keeps the device
 * toggles and the simulated market bar.                                        */
/* ================================================================== */

/** This account's durable shorts toggles (liked clip ids, followed handles). */
export interface ShortsSync {
  liked: string[];
  followed: string[];
}

/** The answer to one toggle: which reaction, which target, and its new state. */
export interface ShortsToggleResult {
  kind: 'like' | 'follow';
  target: string;
  on: boolean;
}

/** Public like/follow totals: { "<target>": count }. */
export type ShortsCounts = Record<string, number>;

/** The real 24h market figures from the purchase ledger. */
export interface MarketPulse {
  volume24h: number;
  trades24h: number;
  traders24h: number;
  /** The hottest theme by volume, or null when the ledger has no rows. */
  topTheme: HotNewsCategory | null;
}

/** Pure: an array of validated target strings (drops non-strings). */
function asTargetList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((t): t is string => typeof t === 'string' && t.length > 0) : [];
}

/** Pure: the `hub_shorts_sync` payload. */
export function mapShortsSync(value: unknown): ShortsSync | null {
  const r = asRecord(value);
  if (!r) return null;
  return { liked: asTargetList(r.liked), followed: asTargetList(r.followed) };
}

/** Pure: the `hub_shorts_toggle` payload. */
export function mapShortsToggle(value: unknown): ShortsToggleResult | null {
  const r = asRecord(value);
  if (!r || r.ok !== true) return null;
  if (r.kind !== 'like' && r.kind !== 'follow') return null;
  if (typeof r.target !== 'string' || !r.target) return null;
  if (typeof r.on !== 'boolean') return null;
  return { kind: r.kind, target: r.target, on: r.on };
}

/** Pure: the `hub_shorts_counts` payload -> a plain { target: count } map. */
export function mapShortsCounts(value: unknown): ShortsCounts {
  const r = asRecord(value);
  if (!r) return {};
  const out: ShortsCounts = {};
  for (const [target, raw] of Object.entries(r)) {
    const n = asFiniteInt(raw);
    if (n !== null && n >= 0) out[target] = n;
  }
  return out;
}

/** Pure: the `hub_market_pulse` payload; topTheme validated, else null. */
export function mapMarketPulse(value: unknown): MarketPulse | null {
  const r = asRecord(value);
  if (!r) return null;
  const volume24h = asFiniteInt(r.volume24h);
  const trades24h = asFiniteInt(r.trades24h);
  const traders24h = asFiniteInt(r.traders24h);
  if (volume24h === null || trades24h === null || traders24h === null) return null;
  const topTheme = typeof r.topTheme === 'string' && isHotNewsCategory(r.topTheme) ? (r.topTheme as HotNewsCategory) : null;
  return {
    volume24h: Math.max(0, volume24h),
    trades24h: Math.max(0, trades24h),
    traders24h: Math.max(0, traders24h),
    topTheme,
  };
}

/** This account's durable shorts toggles, or an empty pair when signed out. */
export async function hubShortsSync(): Promise<HubResult<ShortsSync>> {
  return rpc('hub_shorts_sync', {}, mapShortsSync);
}

/** Toggle a like (target = clip id) or a follow (target = handle). */
export function hubShortsToggle(kind: 'like' | 'follow', target: string): Promise<HubResult<ShortsToggleResult>> {
  return rpc('hub_shorts_toggle', { p_kind: kind, p_target: target }, mapShortsToggle);
}

/**
 * Public totals of ONE reaction kind for up to 100 targets (REV-37: kind-scoped
 * so a like count and a follow count are fully isolated -- a clip id and a
 * handle that happened to share a string can never merge). Pass 'like' with
 * clip ids, or 'follow' with handles.
 */
export async function hubShortsCounts(kind: 'like' | 'follow', targets: string[]): Promise<ShortsCounts> {
  const res = await rpc('hub_shorts_counts', { p_kind: kind, p_targets: targets.slice(0, 100) }, (value) => mapShortsCounts(value));
  return res.data ?? {};
}

/**
 * The real 24h market pulse. On an EMPTY ledger the RPC returns zeros with a
 * null topTheme, and the mapper passes that through (data is present, not null);
 * data is null only on a malformed or unreachable envelope. The UI keeps the
 * deterministic simulation until trades24h > 0 (SPEC D-6).
 */
export function hubMarketPulse(): Promise<HubResult<MarketPulse>> {
  return rpc('hub_market_pulse', {}, mapMarketPulse);
}
