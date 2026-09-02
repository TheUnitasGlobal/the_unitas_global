import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { routing } from '@/i18n/routing';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { buildInsightPrompt, normalizeQuery, parseInsightResponse } from '@/lib/uai/deepInsight';
import {
  REDESIGN_MAX_TOKENS,
  buildRedesignPrompt,
  parseRedesignResponse,
  redesignHash,
} from '@/lib/uai/constitutionRedesign';
import { generateInsight, insightProviderAvailable } from '@/lib/uai/provider';
import {
  UAI_DEEP_INSIGHT_COST,
  UAI_MODULE,
  type DeepInsightApiResponse,
  type DeepInsightError,
} from '@/lib/uai/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Bump when buildInsightPrompt / the DeepReport schema changes, so stale
 *  (or prompt-injection-poisoned) Genesis Memory rows are never served. */
const CACHE_VERSION = 'v1';
const LOCALES = new Set<string>(routing.locales);
const MAX_QUERY_LEN = 400;

/** Multimodal input validation -- see "U-AI multimodal" in provider.ts. */
const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
/** ~4MB raw -> base64 inflates by ~4/3. */
const MAX_IMAGE_BASE64_LEN = 5_600_000;
const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;

/**
 * U-AI deep-insight (Phase 2-4) endpoint -- the "Monopoly Gate" server path.
 *
 * Contract:
 *  - GET  -> { available } so the client can hide the deep button (and never
 *            attempt a burn) when no LLM provider key is configured.
 *  - POST -> requires a valid Supabase session. The U-COIN burn
 *            (spend_coins('u-ai', N)) happens HERE, server-side, exactly once
 *            per request, using a client scoped to the caller's JWT -- there
 *            is no client-trusted "proof of burn" to replay, so one burn can
 *            never buy more than one insight. The coin is burned BEFORE the
 *            Claude call, so a failed/insufficient burn never reaches the
 *            paid API. On a Genesis Memory cache hit the coin is still burned
 *            (the margin is the product), but the Anthropic call is skipped.
 *
 * BYOK (user-supplied API keys) is never accepted -- the key lives only in
 * the server environment.
 */

export function GET() {
  return NextResponse.json({ available: insightProviderAvailable() });
}

function mapSpendError(message: string | undefined): DeepInsightError {
  const m = (message ?? '').toLowerCase();
  if (m.includes('insufficient') || m.includes('wallet not found')) return 'insufficient';
  if (m.includes('phone')) return 'phone';
  if (m.includes('authenticat')) return 'unauthenticated';
  return 'burn_required';
}

export async function POST(req: Request): Promise<NextResponse<DeepInsightApiResponse>> {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) {
    return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 });
  }

  let body: { query?: unknown; locale?: unknown; shieldScore?: unknown; image?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 });
  }
  const query = (typeof body.query === 'string' ? body.query.trim() : '').slice(0, MAX_QUERY_LEN);
  const locale = typeof body.locale === 'string' && LOCALES.has(body.locale) ? body.locale : routing.defaultLocale;
  const shieldScore =
    typeof body.shieldScore === 'number' && Number.isFinite(body.shieldScore)
      ? Math.max(0, Math.min(100, Math.round(body.shieldScore)))
      : null;
  if (query.length < 2) {
    return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 });
  }

  // Multimodal image input -- fail-open: a malformed/oversized/disallowed
  // image is dropped silently (the request proceeds text-only) rather than
  // rejecting a request whose coin burn is about to happen; a burned coin
  // must never come back empty-handed over an optional attachment.
  let image: { mediaType: string; data: string } | undefined;
  if (body.image && typeof body.image === 'object') {
    const raw = body.image as { mediaType?: unknown; data?: unknown };
    const mediaType = typeof raw.mediaType === 'string' ? raw.mediaType : '';
    const data = typeof raw.data === 'string' ? raw.data : '';
    if (
      ALLOWED_IMAGE_TYPES.has(mediaType) &&
      data.length > 0 &&
      data.length <= MAX_IMAGE_BASE64_LEN &&
      BASE64_RE.test(data)
    ) {
      image = { mediaType, data };
    }
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return NextResponse.json({ ok: false, error: 'deep_unavailable' }, { status: 503 });
  }

  let admin;
  try {
    admin = getSupabaseServerClient();
  } catch {
    return NextResponse.json({ ok: false, error: 'deep_unavailable' }, { status: 503 });
  }

  const {
    data: { user },
    error: userError,
  } = await admin.auth.getUser(token);
  if (userError || !user) {
    return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 });
  }

  // Capability gate BEFORE burning: if we can't deliver a deep insight at all,
  // the caller must not be charged.
  if (!insightProviderAvailable()) {
    return NextResponse.json({ ok: false, error: 'deep_unavailable' }, { status: 503 });
  }

  const queryHash = createHash('sha256')
    .update(`${CACHE_VERSION}::${locale}::${normalizeQuery(query)}`)
    .digest('hex');

  // Micro-Burn: exactly one spend per request, enforced server-side with a
  // JWT-scoped client so spend_coins()'s auth.uid() == this user. spend_coins
  // is itself atomic (balance check + debit + ledger row + grant, one tx).
  const scoped = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { error: spendError } = await scoped.rpc('spend_coins', {
    p_module: UAI_MODULE,
    p_amount: UAI_DEEP_INSIGHT_COST,
  });
  if (spendError) {
    const error = mapSpendError(spendError.message);
    return NextResponse.json({ ok: false, error }, { status: error === 'unauthenticated' ? 401 : 402 });
  }

  // Genesis Memory cache -- burn already happened; skip the paid API call.
  try {
    const { data: cached } = await admin
      .from('genesis_memory')
      .select('payload, model, hit_count')
      .eq('query_hash', queryHash)
      .maybeSingle();
    if (cached?.payload) {
      await Promise.allSettled([
        admin
          .from('genesis_memory')
          .update({
            hit_count: ((cached as { hit_count?: number }).hit_count ?? 0) + 1,
            last_hit_at: new Date().toISOString(),
          })
          .eq('query_hash', queryHash),
        admin.from('brain_grid').insert({ user_id: user.id, query, depth: 'deep', shield_score: shieldScore }),
      ]);
      return NextResponse.json({
        ok: true,
        ...(cached.payload as object),
        model: (cached.model as string) || 'genesis-memory',
        cached: true,
      } as DeepInsightApiResponse);
    }
  } catch {
    // genesis_memory not applied yet -> treat as a miss.
  }

  const { system, user: userPrompt } = buildInsightPrompt(query, locale);
  const systemWithImage = image
    ? `${system}\n\nAn image was attached to this request -- incorporate genuine visual analysis of it into the brief wherever relevant.`
    : system;
  try {
    const { text, model } = await generateInsight(systemWithImage, userPrompt, undefined, image);
    const report = parseInsightResponse(text, model);

    // Persist to Genesis Memory + Brain-Grid (best-effort -- a failure here
    // (tables not applied yet) must not fail the paid request the user
    // already burned a coin for).
    await Promise.allSettled([
      admin
        .from('genesis_memory')
        .upsert({ query_hash: queryHash, locale, payload: report, model }),
      admin.from('brain_grid').insert({ user_id: user.id, query, depth: 'deep', shield_score: shieldScore }),
      primeRedesign(admin, query, locale),
    ]);

    return NextResponse.json({ ok: true, ...report } as DeepInsightApiResponse);
  } catch {
    // NOTE: the U-COIN was burned just above and there is no clean auto-refund
    // path (credit_coins() is Stripe-webhook-only + idempotent on a
    // payment-intent id). Documented known gap -- see CLAUDE.md "Known gaps".
    // The burn is server-side and strictly 1:1 with the request, so this is
    // an honest "paid, generation failed", not a margin exploit.
    return NextResponse.json({ ok: false, error: 'generation_failed' }, { status: 502 });
  }
}

/**
 * A paid burn also primes the FREE 6-axis Sovereign Redesign for that subject
 * (owner instruction 2026-08-31 §3) — one extra LLM call, written to the
 * disjoint 'cr-v1::' Genesis Memory namespace so every LATER *free* searcher of
 * this query is served it at engine cost 0원. Best-effort: a failure here never
 * touches the paid response (the coin is already 1:1 with the deep report).
 */
async function primeRedesign(
  admin: ReturnType<typeof getSupabaseServerClient>,
  query: string,
  locale: string,
): Promise<void> {
  try {
    const hash = redesignHash(locale, query);
    const { data: existing } = await admin
      .from('genesis_memory')
      .select('query_hash')
      .eq('query_hash', hash)
      .maybeSingle();
    if (existing) return;
    const { system, user } = buildRedesignPrompt(query, locale);
    const { text, model } = await generateInsight(system, user, REDESIGN_MAX_TOKENS);
    const redesign = parseRedesignResponse(text, model, query, 0);
    await admin.from('genesis_memory').upsert({ query_hash: hash, locale, payload: redesign, model });
  } catch {
    // free-tier priming is a bonus — never fatal to the paid path.
  }
}
