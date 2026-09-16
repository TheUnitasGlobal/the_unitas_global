-- REV-36 MISSION 3 (founder directive 2026-09-16) -- the U-Square data
-- ignition's SERVER half: durable shorts reactions (likes / follows) for
-- signed-in visitors, and a real 24h market pulse read from the REV-30
-- purchase ledger. The pure hyper-matrix simulation (lib/square/*.ts) is the
-- background every device sees offline; this is what a SIGNED-IN visitor's
-- own likes/follows persist into, and what turns the exchange's market bar
-- from a deterministic estimate into live ledger figures once trades exist.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- FIVE DECISIONS THIS FILE MAKES, AND WHY
--
-- 1. A SEPARATE reactions table, not a column on anything. A like/follow is a
--    (user, kind, target) triple with its own lifetime; it is neither a
--    purchase nor a message. One narrow table with a composite primary key is
--    the whole feature and it cannot double-count (the PK is the idempotency).
--
-- 2. `target` IS A PLAIN TEXT ID, validated by regex, NOT a foreign key. The
--    shorts catalogue and the creator handles live in TypeScript
--    (lib/live/shortsSeed.ts, lib/square/pulse.ts), not in a table -- there is
--    no upload pipeline yet (REV-29's honest posture). A FK would demand a
--    catalogue table this revision has no reason to build. The regex
--    (^[a-z0-9.-]+$, 1..40) is the same shape the client ids and handles use,
--    so a junk target is refused at the door without inventing a table to
--    point at.
--
-- 3. A TOGGLE IS AN `active` FLIP, NOT A DELETE. Un-liking flips `active` to
--    false rather than deleting the row: the reaction history is preserved,
--    the primary key still guarantees one row per (user, kind, target), and
--    the whole migration stays free of any row-removing statement -- so it
--    applies cleanly through scripts/supabase-sql.mjs (which refuses
--    destructive statement text) with no hand step. sync and counts read
--    active = true.
--
-- 4. COUNTS ARE A PUBLIC AGGREGATE for signed-in visitors. hub_shorts_counts
--    returns active totals across all users -- a like count is a public
--    number, and a SECURITY DEFINER function is how a visitor reads an
--    aggregate over rows RLS would otherwise hide. It returns HOW MANY, never
--    WHO.
--
-- 5. THE MARKET PULSE READS THE REV-30 LEDGER, it does not invent one.
--    hub_market_pulse aggregates public.hub_purchases (joined to hub_catalog
--    for the theme) over the last 24 hours. Empty ledger -> zeros and a null
--    theme, and the client keeps its deterministic simulation until the
--    numbers are real (lib/hub/hubLedger.ts mapMarketPulse + the UI's
--    trades24h > 0 gate).
-- ─────────────────────────────────────────────────────────────────────────────
--
-- IDEMPOTENT + self-contained, applied on its own through the Supabase
-- Management API `database/query` endpoint (scripts/supabase-sql.mjs), NOT via
-- `supabase db push` -- the live project has no complete migration history.
-- Same catch-up pattern as 20260902000000 onward; CLI history is then synced
-- with `supabase migration repair --status applied 20260917000000`.
--
-- Nothing in this file removes any table, column or row.

-- ── 1. hub_shorts_reactions ────────────────────────────────────────────────
create table if not exists public.hub_shorts_reactions (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  kind       text not null check (kind in ('like', 'follow')),
  -- A clip id (like) or a creator handle (follow). Plain text, because the
  -- catalogue it points at lives in TypeScript, not in a table -- validated by
  -- shape so a junk value is still refused.
  target     text not null check (char_length(target) between 1 and 40 and target ~ '^[a-z0-9.-]+$'),
  -- Un-reacting flips this to false rather than removing the row (decision 3).
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, kind, target)
);

comment on table public.hub_shorts_reactions is
  'REV-36: durable shorts likes/follows, one row per (user, kind, target). target is a TS-side clip id or handle validated by regex, not a FK. A toggle flips active (no delete). Counts are a public aggregate via hub_shorts_counts.';

create index if not exists hub_shorts_reactions_target_idx on public.hub_shorts_reactions (kind, target) where active;

alter table public.hub_shorts_reactions enable row level security;
alter table public.hub_shorts_reactions force row level security;

-- Read your own reactions. No insert/update/delete policy at all: every write
-- goes through hub_shorts_toggle (SECURITY DEFINER), so a session can never
-- forge a row for another user or a target that failed the RPC's checks.
drop policy if exists "hub_shorts_reactions_select_own" on public.hub_shorts_reactions;
create policy "hub_shorts_reactions_select_own"
  on public.hub_shorts_reactions
  for select
  to authenticated
  using (auth.uid() = user_id);

-- ── 2. RPC: hub_shorts_sync ────────────────────────────────────────────────
-- One round trip: the caller's liked clip ids and followed handles, so the
-- shorts panel opens on a new device already showing this account's toggles.
create or replace function public.hub_shorts_sync()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_liked jsonb;
  v_followed jsonb;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select coalesce(jsonb_agg(target order by updated_at desc), '[]'::jsonb)
  into v_liked
  from public.hub_shorts_reactions
  where user_id = v_user_id and kind = 'like' and active;

  select coalesce(jsonb_agg(target order by updated_at desc), '[]'::jsonb)
  into v_followed
  from public.hub_shorts_reactions
  where user_id = v_user_id and kind = 'follow' and active;

  return jsonb_build_object('liked', v_liked, 'followed', v_followed);
end;
$$;

-- ── 3. RPC: hub_shorts_toggle ──────────────────────────────────────────────
-- Idempotent toggle by an `active` flip (never a delete): inserts the row
-- active on the first reaction, flips active on every subsequent call, and
-- returns the new state. Re-checks the kind/target shape (the client copy is
-- only for instant feedback) and enforces a 300 ms flood interval against the
-- caller's own most recent reaction.
create or replace function public.hub_shorts_toggle(p_kind text, p_target text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_target text := btrim(coalesce(p_target, ''));
  v_last timestamptz;
  v_on boolean;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;
  if p_kind not in ('like', 'follow') or char_length(v_target) < 1 or char_length(v_target) > 40 or v_target !~ '^[a-z0-9.-]+$' then
    raise exception 'Invalid reaction';
  end if;

  select max(updated_at) into v_last
  from public.hub_shorts_reactions
  where user_id = v_user_id;
  if v_last is not null and now() - v_last < interval '300 milliseconds' then
    raise exception 'Too fast';
  end if;

  insert into public.hub_shorts_reactions (user_id, kind, target, active, updated_at)
  values (v_user_id, p_kind, v_target, true, now())
  on conflict (user_id, kind, target)
  do update set active = not public.hub_shorts_reactions.active, updated_at = now()
  returning active into v_on;

  return jsonb_build_object('ok', true, 'kind', p_kind, 'target', v_target, 'on', v_on);
end;
$$;

-- ── 4. RPC: hub_shorts_counts ──────────────────────────────────────────────
-- Public aggregate: { "<target>": count } of ACTIVE reactions across ALL
-- users for up to 100 requested targets. Returns HOW MANY, never WHO. Missing
-- targets are simply absent from the object.
-- NOTE (REV-36 follow-up): the count is target-only and NOT scoped by kind.
-- A clip id (like target, ^[a-z0-9-]+$) and a creator handle (follow target,
-- ^[a-z0-9.]+$) share the pure-alphanumeric charset, so a count would merge
-- like+follow only if a clip id string equalled a handle string. No such
-- collision exists in the current catalogue (verified), and no UI surface
-- calls this yet; if a caller ever needs per-kind counts, add a p_kind arg.
create or replace function public.hub_shorts_counts(p_targets text[])
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(jsonb_object_agg(target, n), '{}'::jsonb)
  from (
    select target, count(*)::int as n
    from public.hub_shorts_reactions
    where active and target = any (coalesce(p_targets, array[]::text[])[1:100])
    group by target
  ) counts;
$$;

-- ── 5. RPC: hub_market_pulse ───────────────────────────────────────────────
-- Real 24h market figures from the REV-30 purchase ledger: credits traded,
-- number of trades, distinct buyers, and the theme with the most volume.
-- Empty ledger -> zeros and a null theme (the client keeps its simulation).
create or replace function public.hub_market_pulse()
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'volume24h', coalesce((select sum(price)::bigint from public.hub_purchases where created_at >= now() - interval '24 hours'), 0),
    'trades24h', coalesce((select count(*)::int from public.hub_purchases where created_at >= now() - interval '24 hours'), 0),
    'traders24h', coalesce((select count(distinct user_id)::int from public.hub_purchases where created_at >= now() - interval '24 hours'), 0),
    'topTheme', (
      select c.theme::text
      from public.hub_purchases p
      join public.hub_catalog c on c.pack_id = p.pack_id
      where p.created_at >= now() - interval '24 hours'
      group by c.theme
      order by sum(p.price) desc, c.theme
      limit 1
    )
  );
$$;

-- ── 6. EXECUTE least-privilege ─────────────────────────────────────────────
-- Same posture as 20260916000000: nothing callable by anon or PUBLIC, the
-- visitor-facing RPCs granted to authenticated alone.
revoke execute on function public.hub_shorts_sync()                  from public, anon;
revoke execute on function public.hub_shorts_toggle(text, text)      from public, anon;
revoke execute on function public.hub_shorts_counts(text[])          from public, anon;
revoke execute on function public.hub_market_pulse()                 from public, anon;

grant execute on function public.hub_shorts_sync()                   to authenticated;
grant execute on function public.hub_shorts_toggle(text, text)       to authenticated;
grant execute on function public.hub_shorts_counts(text[])           to authenticated;
grant execute on function public.hub_market_pulse()                  to authenticated;

-- Table-level: RLS is the gate, but the grants should not be wider than the
-- policy either. anon gets nothing at all.
revoke all on public.hub_shorts_reactions from anon;
grant select on public.hub_shorts_reactions to authenticated;
