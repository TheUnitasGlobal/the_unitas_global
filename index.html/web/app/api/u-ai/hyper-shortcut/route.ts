import { NextResponse } from 'next/server';
import { routing } from '@/i18n/routing';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { generateInsight, insightProviderAvailable } from '@/lib/uai/provider';
import { DAILY_REDESIGN_CAP } from '@/lib/uai/constitutionRedesign';
import {
  MAX_HYPER_SEED,
  buildHyperSkeleton,
  hyperEngine,
  isHyperEngineKey,
  isValidHyperVariant,
  normalizeHyperSeed,
  type HyperEngineKey,
} from '@/lib/hyperSovereign';
import {
  HYPER_REPORT_MAX_TOKENS,
  buildHyperPrompt,
  hyperReportHash,
  parseHyperReportResponse,
  type HyperReport,
  type HyperReportApiResponse,
} from '@/lib/uai/hyperShortcut';
import { buildPoolReport, loadPoolMessages } from '@/lib/uai/hyperPool';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const LOCALES = new Set<string>(routing.locales);

/** A narrated (locale, engine, canonical seed, variant) is permanent --
 *  edge-cache it a week so repeat opens almost never reach this route. */
const CDN_CACHE = 'public, s-maxage=604800, stale-while-revalidate=2592000';
/** A pooled fail-safe report is edge-cached only briefly, so the real
 *  narration takes over minutes after the cap / outage clears. */
const POOL_CACHE = 'public, s-maxage=300, stale-while-revalidate=600';
const NO_STORE = 'no-store';

/** Per-function-instance memo in front of Postgres: hot seeds inside one
 *  instance's lifetime never even hit genesis_memory. Bounded FIFO. */
const MEMO_MAX = 500;
const MEMO_HIT_TTL_MS = 24 * 60 * 60_000;
const MEMO_POOL_TTL_MS = 10 * 60_000;
const memo = new Map<string, { report: HyperReport; expires: number }>();

function memoGet(hash: string): HyperReport | null {
  const hit = memo.get(hash);
  if (!hit) return null;
  if (hit.expires < Date.now()) {
    memo.delete(hash);
    return null;
  }
  return hit.report;
}

function memoSet(hash: string, report: HyperReport, ttl: number): void {
  if (memo.size >= MEMO_MAX) {
    const oldest = memo.keys().next().value;
    if (oldest !== undefined) memo.delete(oldest);
  }
  memo.set(hash, { report, expires: Date.now() + ttl });
}

/** Fail-safe state (per instance). Once the provider answers a rate-limit /
 *  overload, or the daily cap is confirmed reached, every visitor goes
 *  straight to the pool for a while instead of paying a doomed round-trip
 *  (and, for the cap, a count query) each. */
const PROVIDER_PENALTY_MS = 5 * 60_000;
const CAP_RECHECK_MS = 10 * 60_000;
let providerPenaltyUntil = 0;
let capReachedUntil = 0;

function nextUtcMidnight(now: number): number {
  const d = new Date(now);
  d.setUTCHours(24, 0, 0, 0);
  return d.getTime();
}

/** provider.ts throws `Anthropic 429` / `openai 529` / ... -- anything that
 *  reads as quota, rate-limit or overload parks the provider for a while. */
function isQuotaError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /\b(429|503|529)\b|rate.?limit|overloaded|quota|too many requests/i.test(msg);
}

type Admin = ReturnType<typeof getSupabaseServerClient>;

function respond(body: HyperReportApiResponse, cacheControl: string, status = 200) {
  return NextResponse.json(body, { status, headers: { 'cache-control': cacheControl } });
}

/**
 * The Pre-warmed Sovereign Pool fallback (lib/uai/hyperPool.ts): a
 * deterministic, locale-native narration of the visitor's exact skeleton.
 * Always HTTP 200 -- the visitor never sees an error state; if even the
 * pool cannot narrate (no templates), `ok:false` lets the client keep its
 * deterministic rendering untouched.
 */
async function servePool(engine: HyperEngineKey, seed: string, variant: string, locale: string, hash: string) {
  try {
    const { messages, fallback } = await loadPoolMessages(locale);
    const report = buildPoolReport(engine, seed, variant, messages, fallback);
    if (!report) return respond({ ok: false, report: null }, NO_STORE);
    memoSet(hash, report, MEMO_POOL_TTL_MS);
    return respond({ ok: true, report }, POOL_CACHE);
  } catch {
    return respond({ ok: false, report: null }, NO_STORE);
  }
}

/**
 * GET /api/u-ai/hyper-shortcut?engine=ideaReplicator&seed=coffee&variant=root:0&locale=ko
 *
 * FREE U-AI oracle narration for one Hyper-Sovereign engine result (see
 * lib/uai/hyperShortcut.ts). The server re-derives the deterministic
 * skeleton from the same seed/variant the client rendered, narrates it once
 * via the LLM provider, parks the report in genesis_memory (`hs-v1::`
 * namespace, keyed on the *canonical* seed so near-duplicate seeds merge)
 * and serves every later visitor of that combination from Postgres at 0원.
 *
 * Fail-safe ladder (owner instruction 2026-09-04 round 7 -- the visitor
 * must never see an error even past the 400/day free-forge cap):
 *   1. per-instance memo  →  2. genesis_memory exact hit  →
 *   3. fresh LLM forge (only while under DAILY_REDESIGN_CAP and the
 *      provider is not in its penalty box)  →
 *   4. the pre-warmed sovereign pool: a deterministic, locale-native
 *      narration of the same skeleton (never persisted, briefly cached).
 * Only malformed requests answer 4xx.
 */
export async function GET(req: Request): Promise<NextResponse<HyperReportApiResponse>> {
  const url = new URL(req.url);
  const rawLocale = url.searchParams.get('locale') ?? '';
  const locale = LOCALES.has(rawLocale) ? rawLocale : routing.defaultLocale;
  const engineParam = url.searchParams.get('engine') ?? '';
  const seedRaw = url.searchParams.get('seed') ?? '';
  const variant = url.searchParams.get('variant') ?? '';

  if (!isHyperEngineKey(engineParam) || !hyperEngine(engineParam).narrated || !isValidHyperVariant(variant)) {
    return respond({ ok: false, report: null }, NO_STORE, 400);
  }
  const engine = engineParam;
  const seed = normalizeHyperSeed(seedRaw);
  if (!seed || seed.length > MAX_HYPER_SEED) {
    return respond({ ok: false, report: null }, NO_STORE, 400);
  }
  const skeleton = buildHyperSkeleton(engine, seed, variant);
  if (!skeleton) {
    return respond({ ok: false, report: null }, NO_STORE, 400);
  }

  const hash = hyperReportHash(locale, engine, seed, variant);

  // 1. per-instance memo
  const memoHit = memoGet(hash);
  if (memoHit) {
    return respond({ ok: true, report: memoHit }, memoHit.pooled ? POOL_CACHE : CDN_CACHE);
  }

  let admin: Admin | null = null;
  try {
    admin = getSupabaseServerClient();
  } catch {
    admin = null;
  }

  // 2. genesis_memory exact hit (canonical seed)
  if (admin) {
    try {
      const { data } = await admin
        .from('genesis_memory')
        .select('payload, model, hit_count')
        .eq('query_hash', hash)
        .maybeSingle();
      if (data?.payload) {
        void admin
          .from('genesis_memory')
          .update({
            hit_count: ((data as { hit_count?: number }).hit_count ?? 0) + 1,
            last_hit_at: new Date().toISOString(),
          })
          .eq('query_hash', hash)
          .then(
            () => undefined,
            () => undefined,
          );
        const report: HyperReport = {
          ...(data.payload as HyperReport),
          model: (data.model as string) || 'genesis-memory',
          cached: true,
        };
        memoSet(hash, report, MEMO_HIT_TTL_MS);
        return respond({ ok: true, report }, CDN_CACHE);
      }
    } catch {
      // genesis_memory unavailable / transient error -> fall through to a fresh forge.
    }
  }

  // 3. fresh forge -- only while it can possibly succeed
  if (!insightProviderAvailable()) {
    return servePool(engine, seed, variant, locale, hash);
  }
  const now = Date.now();
  if (now < providerPenaltyUntil || now < capReachedUntil) {
    return servePool(engine, seed, variant, locale, hash);
  }

  // Daily global cost backstop -- the seed is free text, so unlike the
  // bounded ranking-detail popup this route must not be able to forge
  // without limit. Past the cap the pool answers, not a 429.
  if (admin) {
    try {
      const startOfDay = new Date(now);
      startOfDay.setUTCHours(0, 0, 0, 0);
      const { count } = await admin
        .from('genesis_memory')
        .select('query_hash', { count: 'exact', head: true })
        .gte('created_at', startOfDay.toISOString());
      if ((count ?? 0) >= DAILY_REDESIGN_CAP) {
        capReachedUntil = Math.min(now + CAP_RECHECK_MS, nextUtcMidnight(now));
        return servePool(engine, seed, variant, locale, hash);
      }
    } catch {
      // cap check failed -> proceed (a single forge is cheap).
    }
  }

  try {
    const { system, user } = buildHyperPrompt(engine, seed, skeleton, locale);
    const { text, model } = await generateInsight(system, user, HYPER_REPORT_MAX_TOKENS);
    const report = parseHyperReportResponse(text, model, engine, seed, variant);
    if (admin) {
      void admin
        .from('genesis_memory')
        .upsert({ query_hash: hash, locale, payload: report, model })
        .then(
          () => undefined,
          () => undefined,
        );
    }
    memoSet(hash, report, MEMO_HIT_TTL_MS);
    return respond({ ok: true, report }, CDN_CACHE);
  } catch (err) {
    // 4. the pool -- and park the provider if it was a quota / overload answer
    if (isQuotaError(err)) providerPenaltyUntil = Date.now() + PROVIDER_PENALTY_MS;
    return servePool(engine, seed, variant, locale, hash);
  }
}
