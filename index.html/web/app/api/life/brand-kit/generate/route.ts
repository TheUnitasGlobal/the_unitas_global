import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { generateMarketingAssets } from '@/lib/lifeOs/marketingAssets';
import {
  SOVEREIGN_SESSION_COOKIE,
  resolveSovereignSigningSecret,
  verifySovereignSession,
} from '@/lib/sovereignAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const MAX_BRIEF_LENGTH = 500;

/**
 * Brand Kit marketing-asset generator (founder directive 2026-09-08): the
 * Pomelli/Opal-pattern chained workflow (brief -> LLM draft -> brand-voice
 * sanitize), see lib/lifeOs/marketingAssets.ts's header comment. Founder-
 * only -- this route path does not start with `/sovereign`, so
 * middleware.ts's edge fence does not cover it (same caveat as
 * app/api/life/review/run/route.ts), hence its own verified-session check.
 */
async function authorizedByFounder(): Promise<boolean> {
  const result = await verifySovereignSession(
    cookies().get(SOVEREIGN_SESSION_COOKIE)?.value,
    resolveSovereignSigningSecret(),
  );
  return result.ok;
}

export async function POST(req: Request) {
  if (!(await authorizedByFounder())) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  let body: { brief?: unknown; locale?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 });
  }

  const brief = typeof body.brief === 'string' ? body.brief.trim().slice(0, MAX_BRIEF_LENGTH) : '';
  const locale = typeof body.locale === 'string' && body.locale ? body.locale : 'ko';
  if (!brief) {
    return NextResponse.json({ ok: false, error: 'brief_required' }, { status: 400 });
  }

  try {
    const result = await generateMarketingAssets(brief, locale);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'generation_failed';
    const status = message === 'No insight provider configured' ? 503 : 502;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
