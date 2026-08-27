-- Coin-core: wallets + append-only ledger, replacing subscription-based module
-- gating (owner decision — see plan "THE UNITAS GLOBAL — Rev 0" 2026-08-21).
--
-- public.subscriptions / create-checkout-session / stripe-webhook's
-- subscription branches are DEPRECATED but left in place, untouched, and
-- still live -- nothing in this migration drops or alters them. No new UI
-- should read/write them after this lands.
--
-- Caveat (documented, not silently papered over): pages/*.html are static
-- files with no server render step, so this delivers tamper-proof coin
-- accounting (the spend itself cannot be faked or replayed), not content
-- secrecy (page source is not hidden from a non-payer). Acceptable for v1
-- per owner sign-off; real content-hiding would need a server/SSR layer.

create table if not exists public.wallets (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  balance bigint not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.coin_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount bigint not null,
  kind text not null check (kind in ('purchase', 'module_access', 'admin_grant', 'refund')),
  module text check (module in ('Arche', 'Arena', 'Score', 'Fate', 'Codex22')),
  stripe_payment_intent_id text,
  balance_after bigint not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists coin_ledger_user_id_idx on public.coin_ledger (user_id, created_at desc);

-- Idempotency guard: a retried Stripe webhook event must not double-credit.
create unique index if not exists coin_ledger_stripe_payment_intent_id_idx
  on public.coin_ledger (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

-- Extend the existing signup trigger function (defined in
-- 20260821000000_profiles_rls.sql) so a wallet row is created atomically
-- alongside the profile row, rather than adding a second trigger.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone, nationality, gender, age, blood, mbti)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'phone',
    new.raw_user_meta_data ->> 'nationality',
    new.raw_user_meta_data ->> 'gender',
    nullif(new.raw_user_meta_data ->> 'age', '')::integer,
    new.raw_user_meta_data ->> 'blood',
    new.raw_user_meta_data ->> 'mbti'
  )
  on conflict (id) do nothing;

  insert into public.wallets (user_id, balance)
  values (new.id, 0)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

-- Atomic spend: locks the caller's own wallet row, checks sufficient
-- balance, debits it, and appends a ledger row -- all inside the one
-- implicit transaction wrapping this function call, so a failure (e.g.
-- insufficient balance) rolls back cleanly with no partial state.
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
  if p_module not in ('Arche', 'Arena', 'Score', 'Fate', 'Codex22') then
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
  values (v_user_id, -p_amount, 'module_access', p_module, v_balance);

  return v_balance;
end;
$$;

-- Atomic credit: called only by the webhook's service-role client after a
-- verified Stripe payment. p_user_id is caller-supplied (unlike
-- spend_coins, which always uses auth.uid()), so EXECUTE is intentionally
-- restricted to service_role only -- see grants below. Idempotent on
-- p_stripe_payment_intent_id via an existence check plus the unique index
-- above as a hard backstop against concurrent double-credit.
create or replace function public.credit_coins(p_user_id uuid, p_amount bigint, p_stripe_payment_intent_id text default null)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance bigint;
begin
  if p_amount <= 0 then
    raise exception 'Amount must be positive';
  end if;

  if p_stripe_payment_intent_id is not null
     and exists (
       select 1 from public.coin_ledger
       where stripe_payment_intent_id = p_stripe_payment_intent_id
     )
  then
    select balance into v_balance from public.wallets where user_id = p_user_id;
    return v_balance;
  end if;

  insert into public.wallets (user_id, balance)
  values (p_user_id, 0)
  on conflict (user_id) do nothing;

  update public.wallets
  set balance = balance + p_amount, updated_at = now()
  where user_id = p_user_id
  returning balance into v_balance;

  insert into public.coin_ledger (user_id, amount, kind, stripe_payment_intent_id, balance_after)
  values (p_user_id, p_amount, 'purchase', p_stripe_payment_intent_id, v_balance);

  return v_balance;
end;
$$;

revoke all on function public.spend_coins(text, bigint) from public;
grant execute on function public.spend_coins(text, bigint) to authenticated;

revoke all on function public.credit_coins(uuid, bigint, text) from public;
grant execute on function public.credit_coins(uuid, bigint, text) to service_role;

-- Zero-Trust: RLS on, forced even for the table owner, default-deny, then
-- one narrow select-own rule. All writes happen through the SECURITY
-- DEFINER functions above (or the webhook's service_role client, which
-- bypasses RLS), never directly from authenticated/anon.
alter table public.wallets enable row level security;
alter table public.wallets force row level security;

drop policy if exists "wallets_select_own" on public.wallets;
create policy "wallets_select_own"
  on public.wallets
  for select
  to authenticated
  using (auth.uid() = user_id);

alter table public.coin_ledger enable row level security;
alter table public.coin_ledger force row level security;

drop policy if exists "coin_ledger_select_own" on public.coin_ledger;
create policy "coin_ledger_select_own"
  on public.coin_ledger
  for select
  to authenticated
  using (auth.uid() = user_id);

-- Backfill: existing users signed up before this migration have no wallet
-- row yet (the trigger only fires on new signups). Give everyone a starting
-- balance of 0 so fetchWallet() never has to special-case a missing row.
insert into public.wallets (user_id, balance)
select id, 0 from public.profiles
on conflict (user_id) do nothing;
