-- Extends the coin economy to the 11 "Cognitive Ecosystem" modules
-- (web/lib/ecosystems.ts: echo, void, mirror, oracle, pulse, apex, genesis,
-- syndicate, aura, paradox, chronos), which previously had coin costs
-- displayed in the UI but were never actually accepted by spend_coins() --
-- only the original 5 "Live Consumer Services" modules (Arche, Arena,
-- Score, Fate, Codex22) were. Per owner decision 2026-08-30: both tiers
-- share one coin economy, not two.
--
-- NOT YET APPLIED (same convention as every other migration in this repo --
-- see 20260821000000_profiles_rls.sql). Apply with `supabase db push` after
-- reconciling against the live project.

alter table public.coin_ledger drop constraint if exists coin_ledger_module_check;
alter table public.coin_ledger add constraint coin_ledger_module_check
  check (module in (
    'Arche', 'Arena', 'Score', 'Fate', 'Codex22',
    'echo', 'void', 'mirror', 'oracle', 'pulse', 'apex',
    'genesis', 'syndicate', 'aura', 'paradox', 'chronos'
  ));

-- Re-create spend_coins() (defined in 20260828000000_wallets_and_ledger.sql,
-- extended with the phone-verification guard in
-- 20260823000000_zero_trust_identity.sql) with the same body except the
-- module whitelist, which now covers both tiers.
create or replace function public.spend_coins(p_module text, p_amount bigint)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_balance bigint;
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
  values (v_user_id, -p_amount, 'module_access', p_module, v_balance);

  return v_balance;
end;
$$;
