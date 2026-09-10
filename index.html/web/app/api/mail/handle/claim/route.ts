import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { claimHandle, mailHandleAddress } from '@/lib/auth/mailHandleServer';
import {
  UNITAS_MAIL_CLAIMED_KEY,
  UNITAS_MAIL_LOST_KEY,
  UNITAS_MAIL_METADATA_KEY,
  normalizeHandle,
  validateHandle,
  type HandleClaimResponse,
} from '@/lib/auth/unitasHandle';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'cache-control': 'no-store' };

function respond(body: HandleClaimResponse, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

/**
 * POST /api/mail/handle/claim   (Authorization: Bearer <access token>)
 *
 * REV-19 follow-up: binds the handle a signed-in account carries in its
 * `user_metadata.unitas_mail_handle` to that account ATOMICALLY in the
 * uniqueness ledger. Outcomes:
 *   claimed  -- bound now (or already bound to this very account);
 *               `unitas_mail_handle_claimed_at` is stamped on the account.
 *   taken    -- another account claimed it first: the handle is REMOVED
 *               from this account's metadata (`unitas_mail_handle_lost`
 *               keeps the word so the UI can say what happened) -- no two
 *               accounts ever display the same address.
 *   none     -- the account carries no handle.
 *   invalid  -- the metadata handle fails the format / reserved rules.
 *   error    -- ledger unreachable; nothing bound, nothing promised.
 */
export async function POST(req: Request) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  if (!token) return respond({ ok: false, status: 'error' }, 401);

  let admin: ReturnType<typeof getSupabaseServerClient>;
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return respond({ ok: false, status: 'error' }, 503);
    admin = getSupabaseServerClient();
  } catch {
    return respond({ ok: false, status: 'error' }, 503);
  }

  const {
    data: { user },
    error: userError,
  } = await admin.auth.getUser(token);
  if (userError || !user) return respond({ ok: false, status: 'error' }, 401);

  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const raw = typeof meta[UNITAS_MAIL_METADATA_KEY] === 'string' ? (meta[UNITAS_MAIL_METADATA_KEY] as string) : '';
  const handle = normalizeHandle(raw);
  if (!handle) return respond({ ok: true, status: 'none' });
  if (validateHandle(handle) !== 'ok') {
    await admin.auth.admin.updateUserById(user.id, {
      user_metadata: { ...meta, [UNITAS_MAIL_METADATA_KEY]: null, [UNITAS_MAIL_LOST_KEY]: handle },
    });
    return respond({ ok: true, status: 'invalid', handle });
  }

  const outcome = await claimHandle(admin, handle, user.id);
  if (outcome === 'claimed' || outcome === 'already-owner') {
    if (typeof meta[UNITAS_MAIL_CLAIMED_KEY] !== 'string') {
      await admin.auth.admin.updateUserById(user.id, {
        user_metadata: { ...meta, [UNITAS_MAIL_CLAIMED_KEY]: new Date().toISOString(), [UNITAS_MAIL_LOST_KEY]: null },
      });
    }
    return respond({ ok: true, status: 'claimed', handle, address: mailHandleAddress(handle) });
  }
  if (outcome === 'taken') {
    await admin.auth.admin.updateUserById(user.id, {
      user_metadata: { ...meta, [UNITAS_MAIL_METADATA_KEY]: null, [UNITAS_MAIL_CLAIMED_KEY]: null, [UNITAS_MAIL_LOST_KEY]: handle },
    });
    return respond({ ok: true, status: 'taken', handle });
  }
  return respond({ ok: false, status: 'error', handle }, 503);
}
