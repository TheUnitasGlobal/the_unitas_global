'use client';

import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { EMPTY_LEDGER, type ExchangeLedger, type Purchase, type SellerRow, type UserListing } from '@/lib/hub/knowledgeExchange';
import { isChatRoomKey, sanitizeChatText, type ChatMessage, type ChatRoomKey } from '@/lib/hub/themeChat';
import { isHotNewsCategory, type HotNewsCategory } from '@/lib/live/hotNews';

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

/** True when the public Supabase env is present at all. */
export function isHubServerConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
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
