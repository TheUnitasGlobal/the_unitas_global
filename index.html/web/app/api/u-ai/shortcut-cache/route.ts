import { NextResponse } from 'next/server';
import { routing } from '@/i18n/routing';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { redesignHash } from '@/lib/uai/constitutionRedesign';
import {
  SHORTCUT_CACHE_TABLE,
  buildSnapshot,
  bumpHit,
  isSeedQuery,
  loadMessages,
  shortcutCacheKey,
  upsertSnapshot,
  type ShortcutCacheRow,
} from '@/lib/uai/shortcutCache';
import {
  SHORTCUT_MANUAL_REFRESH_MIN_AGE_MS,
  SHORTCUT_CACHE_TTL_MS,
  SHORTCUT_CACHE_VERSION,
  isViableShortcutQuery,
  type ShortcutCacheApiResponse,
  type ShortcutSnapshot,
} from '@/lib/uai/shortcutCore';
import type { ConstitutionRedesignReport } from '@/lib/uai/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const LOCALES = new Set<string>(routing.locales);
const MAX_QUERY_LEN = 400;

/** One in N cache hits that reach the origin bumps hit_count (the CDN
 *  already absorbs the rest, so this stays a whisper on Postgres). */
const HIT_SAMPLE = 3;

/** CDN policy for a served snapshot: an hour fresh at the edge, a day of
 *  stale-while-revalidate -- so the origin (and Postgres) see a tier at most
 *  ~once an hour per edge region regardless of traffic. */
const CDN_CACHE = 'public, s-maxage=3600, stale-while-revalidate=86400';
const NO_STORE = 'no-store';

type Admin = ReturnType<typeof getSupabaseServerClient>;

function respond(body: ShortcutCacheApiResponse, cacheControl: string, status = 200) {
  return NextResponse.json(body, { status, headers: { 'cache-control': cacheControl } });
}

const EMPTY: ShortcutCacheApiResponse = {
  ok: false,
  snapshot: null,
  deep: null,
  hits: 0,
  synthesizedAt: null,
  nextRefreshAt: null,
  source: 'fresh',
  deepQueued: true,
};

function fromSnapshot(
  snapshot: ShortcutSnapshot,
  deep: ConstitutionRedesignReport | null,
  hits: number,
  source: ShortcutCacheApiResponse['source'],
): ShortcutCacheApiResponse {
  return {
    ok: true,
    snapshot,
    deep,
    hits,
    synthesizedAt: snapshot.synthesizedAt,
    nextRefreshAt: snapshot.synthesizedAt + SHORTCUT_CACHE_TTL_MS,
    source,
    deepQueued: !deep,
  };
}

/**
 * The visitor-facing edge of the 24h sovereign caching engine.
 *
 *  - Cache hit (current snapshot version)   -> served as-is, CDN-cached 1h.
 *    Zero synthesis, zero external call, zero LLM: cost 0원. A row older
 *    than 24h is still served (stale-but-valid) -- the nightly batch, not
 *    the visitor, is what re-synthesizes it.
 *  - Miss (a brand-new nested keyword)      -> synthesized ONCE inline,
 *    parked for everyone after, CDN-cached.
 *  - `refresh=1` (the manual 갱신 런처)        -> re-synthesized only when the
 *    parked snapshot is older than the 10-min cooldown; otherwise the cache
 *    is served with `source: 'cooldown'`. Never CDN-cached (must bypass).
 *
 * Fail-open: if Supabase is unreachable the tier is synthesized in memory
 * and served `no-store`, so the popup never breaks.
 */
export async function GET(req: Request): Promise<NextResponse<ShortcutCacheApiResponse>> {
  const url = new URL(req.url);
  const query = (url.searchParams.get('q') ?? '').trim().slice(0, MAX_QUERY_LEN);
  const rawLocale = url.searchParams.get('locale') ?? '';
  const locale = LOCALES.has(rawLocale) ? rawLocale : routing.defaultLocale;
  const wantsRefresh = url.searchParams.get('refresh') === '1';
  if (!isViableShortcutQuery(query)) return respond(EMPTY, NO_STORE, 400);

  const messages = await loadMessages(locale);
  const cacheKey = shortcutCacheKey(locale, query);

  let admin: Admin | null = null;
  try {
    admin = getSupabaseServerClient();
  } catch {
    admin = null;
  }

  // Fail-open: no Supabase -> in-memory synthesis, never cached at the edge.
  if (!admin) {
    const snapshot = await buildSnapshot(query, locale, isSeedQuery(messages, query) ? 'seed' : 'ladder', messages);
    return respond(fromSnapshot(snapshot, null, 0, 'fresh'), NO_STORE);
  }

  let row: ShortcutCacheRow | null = null;
  try {
    const { data } = await admin
      .from(SHORTCUT_CACHE_TABLE)
      .select('cache_key, locale, query, tier, payload, hit_count, synthesized_at')
      .eq('cache_key', cacheKey)
      .maybeSingle();
    row = (data as ShortcutCacheRow | null) ?? null;
  } catch {
    row = null;
  }

  const deep = await readDeep(admin, locale, query);
  const valid = row !== null && row.payload?.version === SHORTCUT_CACHE_VERSION;
  const rowAge = row ? Date.now() - Date.parse(row.synthesized_at) : Number.POSITIVE_INFINITY;

  if (row && valid) {
    // Manual refresh inside the cooldown -> serve the cache, flag the cooldown.
    if (wantsRefresh && rowAge < SHORTCUT_MANUAL_REFRESH_MIN_AGE_MS) {
      return respond(fromSnapshot(row.payload, deep, row.hit_count, 'cooldown'), NO_STORE);
    }
    // Cache hit -> the 0원 path.
    if (!wantsRefresh) {
      if (Math.random() * HIT_SAMPLE < 1) bumpHit(admin, cacheKey, row.hit_count);
      return respond(fromSnapshot(row.payload, deep, row.hit_count, 'cache'), CDN_CACHE);
    }
  }

  // Miss / stale version / eligible manual refresh -> synthesize once, park it.
  const tier = row?.tier ?? (isSeedQuery(messages, query) ? 'seed' : 'ladder');
  const snapshot = await buildSnapshot(query, locale, tier, messages);
  const parked = await upsertSnapshot(admin, snapshot, cacheKey);
  return respond(
    fromSnapshot(snapshot, deep, row?.hit_count ?? 0, 'fresh'),
    parked && !wantsRefresh ? CDN_CACHE : NO_STORE,
  );
}

/** The LLM-forged 6-axis deep report, if the nightly batch (or the search
 *  bar's threshold channel) has already parked one in Genesis Memory. */
async function readDeep(admin: Admin, locale: string, query: string): Promise<ConstitutionRedesignReport | null> {
  try {
    const { data } = await admin
      .from('genesis_memory')
      .select('payload, model')
      .eq('query_hash', redesignHash(locale, query))
      .maybeSingle();
    if (!data?.payload) return null;
    const payload = data.payload as ConstitutionRedesignReport;
    return { ...payload, model: (data.model as string) || payload.model || 'genesis-memory', cached: true };
  } catch {
    return null;
  }
}
