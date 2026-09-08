import { timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { runNightlyAudit } from '@/lib/lifeOs/reviewAgent';
import {
  SOVEREIGN_SESSION_COOKIE,
  resolveSovereignSigningSecret,
  verifySovereignSession,
} from '@/lib/sovereignAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const RECENT_RUNS_LIMIT = 20;

/** Bearer CRON_SECRET (the nightly Vercel cron, web/vercel.json) -- same
 *  constant-time comparison as app/api/u-ai/shortcut-cache/refresh/route.ts. */
function authorizedByCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET ?? '';
  if (!secret) return false;
  const header = req.headers.get('authorization') ?? '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!bearer || bearer.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(bearer), Buffer.from(secret));
}

/** Manual trigger from the Review Agent engine UI -- the founder's own
 *  verified sovereign session (same HMAC-signed HttpOnly cookie the
 *  (gated) layout and the sovereign debug panel already trust). */
async function authorizedByFounder(): Promise<boolean> {
  const result = await verifySovereignSession(
    cookies().get(SOVEREIGN_SESSION_COOKIE)?.value,
    resolveSovereignSigningSecret(),
  );
  return result.ok;
}

/**
 * Recent runs for the Review Agent engine's history list. This route path
 * does NOT start with `/sovereign`, so middleware.ts's edge fence does not
 * cover it -- unlike the page that calls it, this API route needs its own
 * check, so it requires the same verified sovereign session as the POST
 * trigger below.
 */
export async function GET() {
  if (!(await authorizedByFounder())) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('review_agent_logs')
    .select('id, run_at, status, summary, findings, triggered_by')
    .order('run_at', { ascending: false })
    .limit(RECENT_RUNS_LIMIT);

  if (error) {
    return NextResponse.json({ ok: false, error: 'query_failed' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, runs: data ?? [] });
}

export async function POST(req: Request) {
  const viaCron = authorizedByCron(req);
  const viaFounder = !viaCron && (await authorizedByFounder());
  if (!viaCron && !viaFounder) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseServerClient();
  const result = await runNightlyAudit(supabase);

  const { data, error } = await supabase
    .from('review_agent_logs')
    .insert({
      status: result.status,
      summary: result.summary,
      findings: result.findings,
      triggered_by: viaCron ? 'cron' : 'manual',
    })
    .select('id, run_at, status, summary, findings, triggered_by')
    .single();

  if (error || !data) {
    return NextResponse.json({ ok: false, error: 'archive_failed', result }, { status: 500 });
  }

  return NextResponse.json({ ok: true, run: data });
}
