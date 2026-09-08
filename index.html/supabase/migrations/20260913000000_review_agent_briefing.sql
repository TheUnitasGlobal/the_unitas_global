-- Review Agent executive briefing column (founder audit 2026-09-08):
-- additive to public.review_agent_logs (20260912000000_life_os_sovereign_
-- modules.sql), never an edit to that already-applied file, per this
-- repo's migration convention (CLAUDE.md "Migrations").
--
-- APPLIED 2026-09-08 against the live project (fjznkonbjoierxvopiko) via
-- `npx supabase db push` (CLI already authenticated from a prior session --
-- confirmed with `supabase migration list` before and after). The
-- deployment-ordering fallback in app/api/life/review/run/route.ts (retry
-- insert without `briefing` on error) stays in place regardless -- it's a
-- resilience pattern, not a stand-in for this migration.
--
-- `briefing` holds the short natural-language executive summary generated
-- by lib/lifeOs/reviewAgent.ts's craftExecutiveBriefing() via the U-AI
-- provider chain (lib/uai/provider.ts). Nullable and fail-open by design:
-- a run with no provider configured, or whose generation call failed,
-- still archives with `briefing = null` -- the audit itself never depends
-- on the LLM call succeeding.

alter table public.review_agent_logs
  add column if not exists briefing text;

comment on column public.review_agent_logs.briefing is
  'Optional LLM-generated one-paragraph executive summary of this run''s findings. Null when no insight provider was configured or the generation call failed (fail-open).';
