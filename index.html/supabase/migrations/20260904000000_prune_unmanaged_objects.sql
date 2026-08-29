-- Prune 6 hand-made tables that predate migration tracking (audited 2026-08-29
-- on live project fjznkonbjoierxvopiko). All are code-unreferenced (grep of
-- /web + legacy root + supabase/) and superseded by the tracked schema:
--
--   test_table      1 row  ("Hello Unitas")   -- connection smoke test
--   core_profiles   0 rows (reputation_index) -- early profiles experiment  -> public.profiles
--   integrity_logs  0 rows (neural_signature) -- empty log stub
--   payments        0 rows (stripe_session_id)-- early one-off payments      -> public.coin_ledger + public.subscriptions
--   users           0 rows (mirror of auth.users) -- early identity table    -> public.profiles
--   global_assets   5 rows (module -> null image, null owner; one broken URL) -- image stub -> web/lib/module-registry.ts + public/ownership-manifest.json
--
-- Row data for the two non-empty tables is archived (fully reversible) in
-- supabase/archive/20260903_pre_prune_unmanaged.sql.
--
-- Idempotent: `drop table if exists`. `cascade` clears each table's own RLS
-- policies + the payments_user_id_fkey; nothing in the tracked schema
-- references any of these, so cascade removes nothing else.

drop table if exists public.test_table     cascade;
drop table if exists public.core_profiles  cascade;
drop table if exists public.integrity_logs cascade;
drop table if exists public.payments       cascade;
drop table if exists public.users          cascade;
drop table if exists public.global_assets  cascade;
