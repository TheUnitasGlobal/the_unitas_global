-- DEPRECATED (Rev 0 coin-core, see 20260828000000_wallets_and_ledger.sql):
-- module access is now gated by coin balance, not subscription status. This
-- table is left in place, live, and unmodified -- untouched by this
-- migration -- in case a future "coin auto-refill subscription" tier wants
-- it. No current UI reads or writes it.
--
-- Subscriptions table: the Supabase-side record of Stripe subscription state.
--
-- NOT YET APPLIED — review alongside 20260821000000_profiles_rls.sql before
-- running `supabase db push`. One row per (user, module): a user may hold
-- concurrent subscriptions across the five modules (Arche/Arena/Score/Fate/
-- Codex22), so `profiles` (1 row per user) cannot represent this — hence a
-- separate table keyed on (user_id, module).
--
-- Written to by supabase/functions/stripe-webhook/index.ts using the
-- Supabase-injected SUPABASE_SERVICE_ROLE_KEY (bypasses RLS). Never written
-- to by the browser/anon key.

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  module text not null check (module in ('Arche', 'Arena', 'Score', 'Fate', 'Codex22')),
  stripe_customer_id text not null,
  stripe_subscription_id text not null unique,
  status text not null,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, module)
);

create index if not exists subscriptions_user_id_idx on public.subscriptions (user_id);

create or replace function public.set_subscriptions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists subscriptions_set_updated_at on public.subscriptions;
create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_subscriptions_updated_at();

-- Zero-Trust: RLS on, forced even for the table owner, default-deny, then
-- one narrow allow rule. Only the webhook (service_role, bypasses RLS)
-- writes; authenticated users may only read their own rows.
alter table public.subscriptions enable row level security;
alter table public.subscriptions force row level security;

drop policy if exists "subscriptions_select_own" on public.subscriptions;
create policy "subscriptions_select_own"
  on public.subscriptions
  for select
  to authenticated
  using (auth.uid() = user_id);

-- Deliberately no INSERT/UPDATE/DELETE policy for `authenticated`/`anon`:
-- rows are only ever written by the stripe-webhook Edge Function via
-- service_role, which bypasses RLS entirely.
