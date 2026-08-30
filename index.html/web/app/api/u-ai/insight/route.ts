import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { routing } from '@/i18n/routing';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { buildInsightPrompt, normalizeQuery, parseInsightResponse } from '@/lib/uai/deepInsight';
import {
  UAI_DEEP_INSIGHT_COST,
  UAI_MODULE,
  type DeepInsightApiResponse,
  type DeepInsightError,
} from '@/lib/uai/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const INSIGHT_MODEL = process.env.UAI_INSIGHT_MODEL || 'claude-sonnet-5';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
/** Bump when buildInsightPrompt / the DeepReport schema changes, so stale
 *  (or prompt-injection-poisoned) Genesis Memory rows are never served. */
const CACHE_VERSION = 'v1';
const LOCALES = new Set<string>(routing.locales);
const MAX_QUERY_LEN = 400;

/**
 * U-AI deep-insight (Phase 2-4) endpoint -- the "Monopoly Gate" server path.
 *
 * Contract:
 *  - GET  -> { available } so the client can hide the deep button (and never
 *            attempt a burn) when ANTHROPIC_API_KEY is not configured.
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
  return NextResponse.json({ available: Boolean(process.env.ANTHROPIC_API_KEY) });
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

  let body: { query?: unknown; locale?: unknown; shieldScore?: unknown };
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
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
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
        model: (cached.model as string) || INSIGHT_MODEL,
        cached: true,
      } as DeepInsightApiResponse);
    }
  } catch {
    // genesis_memory not applied yet -> treat as a miss.
  }

  const { system, user: userPrompt } = buildInsightPrompt(query, locale);
  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: INSIGHT_MODEL,
        max_tokens: 1800,
        system,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic ${res.status}`);
    const data = (await res.json()) as { content?: Array<{ text?: string }> };
    const text = data.content?.map((c) => c.text ?? '').join('') ?? '';
    const report = parseInsightResponse(text, INSIGHT_MODEL);

    // Persist to Genesis Memory + Brain-Grid (best-effort -- a failure here
    // (tables not applied yet) must not fail the paid request the user
    // already burned a coin for).
    await Promise.allSettled([
      admin
        .from('genesis_memory')
        .upsert({ query_hash: queryHash, locale, payload: report, model: INSIGHT_MODEL }),
      admin.from('brain_grid').insert({ user_id: user.id, query, depth: 'deep', shield_score: shieldScore }),
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
