import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Soft-deletes the caller's account: anonymizes public.profiles and bans +
 * scrubs the auth.users row via the admin API, but does NOT delete
 * auth.users itself -- profiles/wallets/coin_ledger all cascade from it
 * (ON DELETE CASCADE), and coin_ledger is the financial audit trail this
 * app must keep. See supabase/migrations/20260823000000_zero_trust_identity.sql
 * for the profile-identity guard trigger this route relies on (it's
 * service_role, so it's allowed to clear phone_verified here).
 */
export async function POST(req: Request) {
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.replace(/^Bearer\s+/i, '');
  if (!token) {
    return NextResponse.json({ error: 'Missing authorization' }, { status: 401 });
  }

  const supabaseAdmin = getSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabaseAdmin.auth.getUser(token);

  if (userError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .update({
      full_name: null,
      nationality: null,
      gender: null,
      age: null,
      blood: null,
      mbti: null,
      phone: null,
      phone_verified: false,
      deleted_at: new Date().toISOString(),
    })
    .eq('id', user.id);

  if (profileError) {
    return NextResponse.json({ error: 'Failed to anonymize profile' }, { status: 500 });
  }

  const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
    email: `deleted-${user.id}@deleted.unitas.invalid`,
    phone: '',
    password: crypto.randomUUID(),
    ban_duration: '876000h',
    user_metadata: {},
  });

  if (banError) {
    return NextResponse.json({ error: 'Failed to deactivate account' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
