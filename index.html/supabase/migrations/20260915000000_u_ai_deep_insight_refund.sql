-- REV-20 SPEC.md §12 D-6 -- finalizes the U-AI deep-insight caching /
-- Micro-Burn governance the founder was asked to rule on (owner directive
-- 2026-09-11, "D-6 Resolution"). The ruling:
--
--   * A Genesis Memory CACHE HIT keeps burning the coin. This is NOT the gap
--     being closed here -- it is deliberate, permanent product design (see
--     the comment above POST in web/app/api/u-ai/insight/route.ts: "the
--     margin is the product"). The visitor receives the exact same full deep
--     report either way; the Anthropic call is simply skipped server-side.
--     Exempting the burn there would give away the product for free on every
--     repeat query with ZERO benefit to the payer, directly opposite the
--     constitution's absolute-margin doctrine (제1장 "U-COIN Micro-Burn 절대
--     마진 게이트": 실질 한계비용 0원 + 마진율 무한대). Left unchanged --
--     this migration adds NOTHING to that path.
--
--   * A GENERATION FAILURE (the LLM call itself throwing after the burn
--     already committed) is the real, undisputed gap: the payer received
--     NOTHING for a burned coin, and CLAUDE.md's "Known gaps" section has
--     documented the missing refund path since 2026-08-30. This migration
--     closes exactly that gap with one new function, `refund_coins`, wired
--     into the insight route's existing failure catch (never the cache-hit
--     path, never a client-callable endpoint -- service_role only, so a
--     compromised/malicious client can never self-refund).
--
-- `refund_coins` deliberately does NOT reuse `credit_coins()`: that function
-- is Stripe-webhook-only and idempotent on `stripe_payment_intent_id` (a
-- payment never repeats), which has no equivalent identity for "this exact
-- generation attempt failed" -- forcing a synthetic id in would either
-- collide (blocking a legitimate second failed attempt on the same query)
-- or defeat the intended idempotency semantics entirely. A distinct
-- function keeps both idempotency contracts honest. `kind = 'refund'` is
-- already a valid `coin_ledger.kind` (20260828000000) and was never used
-- until now.
create or replace function public.refund_coins(p_user_id uuid, p_amount bigint, p_module text, p_reason text default null)
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

  insert into public.wallets (user_id, balance)
  values (p_user_id, 0)
  on conflict (user_id) do nothing;

  update public.wallets
  set balance = balance + p_amount, updated_at = now()
  where user_id = p_user_id
  returning balance into v_balance;

  -- p_module ties the ledger row back to which module's burn this undoes.
  -- p_reason goes into `metadata` (already jsonb on this table, unused by
  -- every other writer) so the audit trail actually records WHY -- CLAUDE.md
  -- "U-Coin ledger audit compliance" treats coin_ledger as the append-only
  -- audit record, and a refund with no reason attached would defeat that.
  insert into public.coin_ledger (user_id, amount, kind, module, balance_after, metadata)
  values (p_user_id, p_amount, 'refund', p_module, v_balance,
    case when p_reason is not null then jsonb_build_object('reason', p_reason) else null end);

  return v_balance;
end;
$$;

-- service_role only -- callable exclusively from the server's admin client
-- after a paid call has genuinely failed, never from a user's own session
-- (which would turn this into an unlimited self-refund exploit).
revoke all on function public.refund_coins(uuid, bigint, text, text) from public, anon, authenticated;
grant execute on function public.refund_coins(uuid, bigint, text, text) to service_role;
