import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { buildInsightPrompt, normalizeQuery, parseInsightResponse } from '@/lib/uai/deepInsight';
import { UAI_BURN_FRESH_MS, type DeepInsightApiResponse } from '@/lib/uai/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const INSIGHT_MODEL = process.env.UAI_INSIGHT_MODEL || 'claude-sonnet-5';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

/**
 * U-AI deep-insight (Phase 2-4) endpoint -- the "Monopoly Gate" server path.
 *
 * Contract:
 *  - GET  -> { available } so the client can hide the deep button (and never
 *            burn a coin) when ANTHROPIC_API_KEY is not configured.
 *  - POST -> requires (a) a valid Supabase session, and (b) a FRESH
 *            module_access_grant for 'u-ai' (< UAI_BURN_FRESH_MS old) as
 *            proof the client already ran spend_coins('u-ai', N). The coin is
 *            ALWAYS burned (absolute margin); the Claude call is skipped on a
 *            Genesis Memory cache hit so the Anthropic bill trends to 0.
 *
 * BYOK (user-supplied API keys) is never accepted -- the key lives only in
 * the server environment.
 */

export function GET() {
  return NextResponse.json({ available: Boolean(process.env.ANTHROPIC_API_KEY) });
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
  const query = typeof body.query === 'string' ? body.query.trim() : '';
  const locale = typeof body.locale === 'string' ? body.locale : 'en';
  const shieldScore = typeof body.shieldScore === 'number' ? Math.round(body.shieldScore) : null;
  if (query.length < 2) {
    return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 });
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

  // Proof-of-burn: a u-ai grant minted in the last UAI_BURN_FRESH_MS. The
  // client calls spend_coins('u-ai', N) immediately before this request.
  const { data: grant } = await admin
    .from('module_access_grants')
    .select('granted_at')
    .eq('user_id', user.id)
    .eq('module', 'u-ai')
    .order('granted_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const grantAge = grant?.granted_at ? Date.now() - new Date(grant.granted_at as string).getTime() : Infinity;
  if (grantAge > UAI_BURN_FRESH_MS) {
    return NextResponse.json({ ok: false, error: 'burn_required' }, { status: 402 });
  }

  const queryHash = createHash('sha256').update(`${locale}::${normalizeQuery(query)}`).digest('hex');

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

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: 'deep_unavailable' }, { status: 503 });
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
    // NOTE: the U-COIN was already burned client-side. There is no auto-refund
    // path yet (credit_coins() is Stripe-webhook-only + idempotent on a
    // payment-intent id) -- documented as a known gap, matching web/CLAUDE.md.
    return NextResponse.json({ ok: false, error: 'generation_failed' }, { status: 502 });
  }
}
