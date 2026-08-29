-- Security + longevity hardening (owner request 2026-08-29). Three concerns,
-- all idempotent:
--
--  1. EXECUTE least-privilege on public functions. The hand-built era left
--     them granted to `anon` / PUBLIC; migrations 20260828000000 /
--     20260902000000 intend spend_coins -> authenticated only, credit_coins
--     -> service_role only, and the trigger-only functions callable by no
--     API role at all.
--  2. De-duplicate profiles RLS: drop the dashboard-made "Users can view/
--     update own profile" policies that duplicate the migration's
--     profiles_select_own / profiles_update_own (same `auth.uid() = id`
--     predicate; the dupes target role `public` instead of `authenticated`,
--     which changes nothing -- anon can't satisfy auth.uid() = id).
--  3. Self-pruning module_access_grants: spend_coins() now clears the
--     caller's own expired grants before minting a new one, so the table
--     stays bounded by (active users x modules) without a cron job.

-- ── 1. function EXECUTE grants ────────────────────────────────────────────
revoke execute on function public.spend_coins(text, bigint) from public, anon;
grant  execute on function public.spend_coins(text, bigint) to authenticated;

revoke execute on function public.credit_coins(uuid, bigint, text) from public, anon, authenticated;
grant  execute on function public.credit_coins(uuid, bigint, text) to service_role;

revoke execute on function public.handle_new_user()             from public, anon, authenticated;
revoke execute on function public.handle_phone_verified()       from public, anon, authenticated;
revoke execute on function public.protect_profile_identity()    from public, anon, authenticated;
revoke execute on function public.protect_profile_realname()    from public, anon, authenticated;
revoke execute on function public.set_subscriptions_updated_at() from public, anon, authenticated;

-- ── 2. de-duplicate profiles RLS ─────────────────────────────────────────
drop policy if exists "Users can view own profile"   on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;

-- ── 3. spend_coins(): self-prune expired grants before minting ────────────
create or replace function public.spend_coins(p_module text, p_amount bigint)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_balance bigint;
  v_ledger_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;
  if p_amount <= 0 then
    raise exception 'Amount must be positive';
  end if;
  if p_module not in (
    'Arche', 'Arena', 'Score', 'Fate', 'Codex22',
    'echo', 'void', 'mirror', 'oracle', 'pulse', 'apex',
    'genesis', 'syndicate', 'aura', 'paradox', 'chronos'
  ) then
    raise exception 'Unknown module: %', p_module;
  end if;

  select balance into v_balance
  from public.wallets
  where user_id = v_user_id
  for update;

  if v_balance is null then
    raise exception 'Wallet not found';
  end if;
  if v_balance < p_amount then
    raise exception 'Insufficient balance';
  end if;

  v_balance := v_balance - p_amount;

  update public.wallets
  set balance = v_balance, updated_at = now()
  where user_id = v_user_id;

  insert into public.coin_ledger (user_id, amount, kind, module, balance_after)
  values (v_user_id, -p_amount, 'module_access', p_module, v_balance)
  returning id into v_ledger_id;

  -- Keep module_access_grants bounded: clear this caller's stale grants.
  delete from public.module_access_grants
  where user_id = v_user_id and expires_at < now();

  insert into public.module_access_grants (user_id, module, expires_at, source_ledger_id)
  values (v_user_id, p_module, now() + interval '30 minutes', v_ledger_id);

  return v_balance;
end;
$$;

-- create-or-replace preserves ACL, so re-assert the tightened grant.
revoke execute on function public.spend_coins(text, bigint) from public, anon;
grant  execute on function public.spend_coins(text, bigint) to authenticated;
