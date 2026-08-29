-- ============================================================================
-- supabase/SCHEMA_REFERENCE.sql  —  LIVE public-schema reference
-- project fjznkonbjoierxvopiko. Reconstructed via information_schema /
-- pg_get_*def introspection (NOT pg_dump — Docker was unavailable on the
-- authoring machine, so `supabase db pull` / `db dump` could not run).
-- Authoritative schema = supabase/migrations/*.sql (10 files, all verified
-- applied; `supabase db push --dry-run` reports the remote up-to-date).
-- Regenerate the canonical baseline with `supabase db pull` from a
-- Docker-capable host / CI when available.
-- generated_at: 2026-08-29T14:23:18.740364+00:00
-- ============================================================================

-- --------- TABLE public.coin_ledger   (RLS enabled/forced: true/true) ---------
-- columns:
--   id uuid NOT NULL
--   user_id uuid NOT NULL
--   amount bigint NOT NULL
--   kind text NOT NULL
--   module text
--   stripe_payment_intent_id text
--   balance_after bigint NOT NULL
--   metadata jsonb
--   created_at timestamp with time zone NOT NULL
--   CONSTRAINT coin_ledger_kind_check: CHECK ((kind = ANY (ARRAY['purchase'::text, 'module_access'::text, 'admin_grant'::text, 'refund'::text])))
--   CONSTRAINT coin_ledger_module_check: CHECK ((module = ANY (ARRAY['Arche'::text, 'Arena'::text, 'Score'::text, 'Fate'::text, 'Codex22'::text, 'echo'::text, 'void'::text, 'mirror'::text, 'oracle'::text, 'pulse'::text, 'apex'::text, 'genesis'::text, 'syndicate'::text, 'aura'::text, 'paradox'::text, 'chronos'::text])))
--   CONSTRAINT coin_ledger_pkey: PRIMARY KEY (id)
--   CONSTRAINT coin_ledger_user_id_fkey: FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
CREATE UNIQUE INDEX coin_ledger_pkey ON public.coin_ledger USING btree (id);
CREATE UNIQUE INDEX coin_ledger_stripe_payment_intent_id_idx ON public.coin_ledger USING btree (stripe_payment_intent_id) WHERE (stripe_payment_intent_id IS NOT NULL);
CREATE INDEX coin_ledger_user_id_idx ON public.coin_ledger USING btree (user_id, created_at DESC);
--   POLICY coin_ledger_select_own   USING ((auth.uid() = user_id))

-- --------- TABLE public.module_access_grants   (RLS enabled/forced: true/true) ---------
-- columns:
--   id uuid NOT NULL
--   user_id uuid NOT NULL
--   module text NOT NULL
--   granted_at timestamp with time zone NOT NULL
--   expires_at timestamp with time zone NOT NULL
--   source_ledger_id uuid
--   CONSTRAINT module_access_grants_module_check: CHECK ((module = ANY (ARRAY['Arche'::text, 'Arena'::text, 'Score'::text, 'Fate'::text, 'Codex22'::text, 'echo'::text, 'void'::text, 'mirror'::text, 'oracle'::text, 'pulse'::text, 'apex'::text, 'genesis'::text, 'syndicate'::text, 'aura'::text, 'paradox'::text, 'chronos'::text])))
--   CONSTRAINT module_access_grants_pkey: PRIMARY KEY (id)
--   CONSTRAINT module_access_grants_source_ledger_id_fkey: FOREIGN KEY (source_ledger_id) REFERENCES coin_ledger(id) ON DELETE SET NULL
--   CONSTRAINT module_access_grants_user_id_fkey: FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
CREATE INDEX module_access_grants_lookup_idx ON public.module_access_grants USING btree (user_id, module, expires_at DESC);
CREATE UNIQUE INDEX module_access_grants_pkey ON public.module_access_grants USING btree (id);
--   POLICY module_access_grants_select_own   USING ((auth.uid() = user_id))

-- --------- TABLE public.profiles   (RLS enabled/forced: true/true) ---------
-- columns:
--   id uuid NOT NULL
--   full_name text
--   phone text
--   nationality text
--   gender text
--   age text
--   blood text
--   mbti text
--   created_at timestamp with time zone
--   updated_at timestamp with time zone NOT NULL
--   phone_verified boolean NOT NULL
--   deleted_at timestamp with time zone
--   iq integer
--   eq integer
--   CONSTRAINT profiles_eq_range: CHECK (((eq IS NULL) OR ((eq >= 0) AND (eq <= 200))))
--   CONSTRAINT profiles_id_fkey: FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE
--   CONSTRAINT profiles_iq_range: CHECK (((iq IS NULL) OR ((iq >= 40) AND (iq <= 200))))
--   CONSTRAINT profiles_pkey: PRIMARY KEY (id)
CREATE UNIQUE INDEX profiles_phone_verified_unique_idx ON public.profiles USING btree (phone) WHERE ((phone_verified = true) AND (deleted_at IS NULL));
CREATE UNIQUE INDEX profiles_pkey ON public.profiles USING btree (id);
CREATE TRIGGER protect_profile_identity_trigger BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION protect_profile_identity();
CREATE TRIGGER protect_profile_realname_trigger BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION protect_profile_realname();
--   POLICY profiles_select_own   USING ((auth.uid() = id))
--   POLICY profiles_update_own   USING ((auth.uid() = id))

-- --------- TABLE public.subscriptions   (RLS enabled/forced: true/true) ---------
-- columns:
--   id uuid NOT NULL
--   user_id uuid NOT NULL
--   module text NOT NULL
--   stripe_customer_id text NOT NULL
--   stripe_subscription_id text NOT NULL
--   status text NOT NULL
--   current_period_end timestamp with time zone
--   created_at timestamp with time zone NOT NULL
--   updated_at timestamp with time zone NOT NULL
--   CONSTRAINT subscriptions_module_check: CHECK ((module = ANY (ARRAY['Arche'::text, 'Arena'::text, 'Score'::text, 'Fate'::text, 'Codex22'::text])))
--   CONSTRAINT subscriptions_pkey: PRIMARY KEY (id)
--   CONSTRAINT subscriptions_stripe_subscription_id_key: UNIQUE (stripe_subscription_id)
--   CONSTRAINT subscriptions_user_id_fkey: FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
--   CONSTRAINT subscriptions_user_id_module_key: UNIQUE (user_id, module)
CREATE UNIQUE INDEX subscriptions_pkey ON public.subscriptions USING btree (id);
CREATE UNIQUE INDEX subscriptions_stripe_subscription_id_key ON public.subscriptions USING btree (stripe_subscription_id);
CREATE INDEX subscriptions_user_id_idx ON public.subscriptions USING btree (user_id);
CREATE UNIQUE INDEX subscriptions_user_id_module_key ON public.subscriptions USING btree (user_id, module);
CREATE TRIGGER subscriptions_set_updated_at BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION set_subscriptions_updated_at();
--   POLICY subscriptions_select_own   USING ((auth.uid() = user_id))

-- --------- TABLE public.wallets   (RLS enabled/forced: true/true) ---------
-- columns:
--   user_id uuid NOT NULL
--   balance bigint NOT NULL
--   updated_at timestamp with time zone NOT NULL
--   CONSTRAINT wallets_balance_check: CHECK ((balance >= 0))
--   CONSTRAINT wallets_pkey: PRIMARY KEY (user_id)
--   CONSTRAINT wallets_user_id_fkey: FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
CREATE UNIQUE INDEX wallets_pkey ON public.wallets USING btree (user_id);
--   POLICY wallets_select_own   USING ((auth.uid() = user_id))

-- =========== FUNCTIONS ===========

CREATE OR REPLACE FUNCTION public.credit_coins(p_user_id uuid, p_amount bigint, p_stripe_payment_intent_id text DEFAULT NULL::text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.profiles (
    id, full_name, phone, nationality, gender, age, blood, mbti, iq, eq
  )
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    coalesce(new.raw_user_meta_data ->> 'phone', new.phone),
    new.raw_user_meta_data ->> 'nationality',
    new.raw_user_meta_data ->> 'gender',
    nullif(new.raw_user_meta_data ->> 'age', '')::integer,
    new.raw_user_meta_data ->> 'blood',
    new.raw_user_meta_data ->> 'mbti',
    nullif(new.raw_user_meta_data ->> 'iq', '')::integer,
    nullif(new.raw_user_meta_data ->> 'eq', '')::integer
  )
  on conflict (id) do nothing;

  insert into public.wallets (user_id, balance)
  values (new.id, 0)
  on conflict (user_id) do nothing;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.handle_phone_verified()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.phone_confirmed_at is not null and (old.phone_confirmed_at is null or old.phone is distinct from new.phone) then
    update public.profiles
    set phone = new.phone, phone_verified = true
    where id = new.id;
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.protect_profile_identity()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if pg_trigger_depth() = 1
     and coalesce(auth.role(), '') is distinct from 'service_role'
     and new.phone_verified is distinct from old.phone_verified
  then
    new.phone_verified := old.phone_verified;
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.protect_profile_realname()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if pg_trigger_depth() = 1
     and coalesce(auth.role(), '') is distinct from 'service_role'
     and old.full_name is not null
     and btrim(old.full_name) <> ''
     and new.full_name is distinct from old.full_name
  then
    new.full_name := old.full_name;
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_subscriptions_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.spend_coins(p_module text, p_amount bigint)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

-- =========== FUNCTION EXECUTE GRANTS ===========
--   credit_coins: postgres,service_role
--   handle_new_user: postgres,service_role
--   handle_phone_verified: postgres,service_role
--   protect_profile_identity: postgres,service_role
--   protect_profile_realname: postgres,service_role
--   set_subscriptions_updated_at: postgres,service_role
--   spend_coins: authenticated,postgres,service_role
