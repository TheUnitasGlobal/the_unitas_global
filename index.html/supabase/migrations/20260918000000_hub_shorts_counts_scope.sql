-- REV-37 MISSION 1 (founder directive 2026-09-16) -- U-Square data-scope
-- integrity: make hub_shorts_counts KIND-SCOPED so a like count and a follow
-- count can never interfere, permanently, regardless of data volume.
--
-- WHAT REV-36 LEFT AS A LATENT NOTE (§6): hub_shorts_counts aggregated by
-- `target` alone across BOTH reaction kinds. A clip id (like target, matched
-- by ^[a-z0-9-]+$) and a creator handle (follow target, ^[a-z0-9.]+$) share
-- the pure-alphanumeric charset, so if a clip id string ever equalled a handle
-- string, a follow would inflate that clip's like count. No such collision
-- exists in the current catalogue (verified: 44 clip ids vs 40 handles,
-- 0 overlap), but "no collision today" is not "no collision ever". This
-- migration removes the possibility at the source: the count is now scoped to
-- one kind per call, so the two reaction spaces are fully isolated.
--
-- WHY A SEPARATE, LATER MIGRATION rather than editing 20260917000000: that
-- file is already applied to the live database (founder-applied). The house
-- rule keeps every applied migration immutable and layers changes as new,
-- idempotent files applied through scripts/supabase-sql.mjs, then recorded
-- with `supabase migration repair --status applied 20260918000000`.
--
-- Nothing in this file affects any table, column or row -- it only replaces a
-- read-only aggregate function's signature. The single-argument form is
-- retired (it had no caller in the shipped client; hubShortsCounts is the only
-- reader and it moves to the kind-scoped form in the same revision).

-- Retire the un-scoped single-argument form. Removing a read-only function
-- touches no data and is fully reversible by re-creating it.
drop function if exists public.hub_shorts_counts(text[]);

-- ── RPC: hub_shorts_counts (kind-scoped) ───────────────────────────────────
-- Public aggregate: { "<target>": count } of ACTIVE reactions of ONE kind
-- across ALL users, for up to 100 requested targets. Returns HOW MANY, never
-- WHO. An unknown p_kind yields an empty object (the `kind = p_kind` predicate
-- matches nothing) -- safe by construction, no cross-kind leakage possible.
create or replace function public.hub_shorts_counts(p_kind text, p_targets text[])
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
    where active
      and kind = p_kind
      and target = any (coalesce(p_targets, array[]::text[])[1:100])
    group by target
  ) counts;
$$;

-- Least-privilege, same posture as 20260917000000: nothing callable by anon or
-- PUBLIC, granted to authenticated alone.
revoke execute on function public.hub_shorts_counts(text, text[]) from public, anon;
grant execute on function public.hub_shorts_counts(text, text[])  to authenticated;
