import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { handleAvailability, mailHandleAddress, probeAllowed } from '@/lib/auth/mailHandleServer';
import { normalizeHandle, validateHandle, type HandleCheckResponse } from '@/lib/auth/unitasHandle';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'cache-control': 'no-store' };

function respond(body: HandleCheckResponse, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

/**
 * GET /api/mail/handle?handle=kai
 *
 * REV-19 follow-up: live availability of a `@theunitas.global` handle
 * while the visitor types it into the sign-up form. Format + reserved
 * rules are the pure `validateHandle`; uniqueness is the service-role
 * ledger (lib/auth/mailHandleServer.ts). Never cached, lightly rate
 * limited per client. With no ledger reachable the answer is honest:
 * `unchecked` (the claim at sign-in re-checks atomically).
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const raw = url.searchParams.get('handle') ?? '';
  const handle = normalizeHandle(raw).slice(0, 64);
  const verdict = validateHandle(handle);
  if (verdict !== 'ok') return respond({ ok: true, handle, verdict });

  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'anon';
  if (!probeAllowed(ip)) {
    return respond({ ok: false, handle, verdict, availability: 'unchecked', address: mailHandleAddress(handle) }, 429);
  }

  let admin: ReturnType<typeof getSupabaseServerClient> | null = null;
  try {
    admin = process.env.SUPABASE_SERVICE_ROLE_KEY ? getSupabaseServerClient() : null;
  } catch {
    admin = null;
  }
  const availability = await handleAvailability(admin, handle);
  return respond({ ok: true, handle, verdict, availability, address: mailHandleAddress(handle) });
}
