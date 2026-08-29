-- Activate the Zero-Trust phone-verification guard in spend_coins()
-- (owner decision 2026-08-29 — "결제 보안의 무결성 완성").
--
-- The write path has been live since 20260903000000: profiles.phone_verified
-- / .deleted_at, handle_phone_verified() firing off auth.users.
-- phone_confirmed_at, and protect_profile_identity() reverting client PATCHes.
-- This 1-function migration is the final activation, matching CLAUDE.md
-- "Zero-Trust identity": spend_coins() refuses to run for any account with
-- phone_verified = false.
--
-- Body is 20260905000000's spend_coins verbatim (16-module whitelist,
-- module_access_grant mint + self-prune) with ONE addition: the phone guard,
-- placed right after the module-whitelist check (same position as
-- 20260823000000 / 20260830000000 intended).
--
-- OPERATIONAL NOTE: the 5 existing profiles all have phone_verified = false
-- and coin_ledger is empty (no spend has ever occurred), so nothing breaks
-- retroactively — but from now a spend requires a verified phone, i.e. the
-- Supabase SMS OTP provider must be configured/live for anyone to spend.

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

  -- Zero-Trust guard: DB-side enforcement, independent of the frontend.
  if not exists (
    select 1 from public.profiles
    where id = v_user_id and phone_verified = true and deleted_at is null
  ) then
    raise exception 'Phone verification required before spending coins';
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

-- create-or-replace preserves ACL; re-assert the least-privilege grant.
revoke execute on function public.spend_coins(text, bigint) from public, anon;
grant  execute on function public.spend_coins(text, bigint) to authenticated;
