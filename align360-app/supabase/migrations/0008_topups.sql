-- Phase 3b: credit top-ups. A persistent purchased-credit pool (credits_topup)
-- that does NOT reset with the monthly allowance. AI charges consume the monthly
-- allowance first, then draw down the top-up pool. The pool is granted by the
-- Stripe webhook on a paid one-time top-up checkout (credit_grant_topup).
--
-- Apply AFTER 0003_credits.sql and 0007_credits_metering.sql.

alter table public.credit_balances
  add column if not exists credits_topup integer not null default 0;

-- credit_status return shape gains `topup`, so the function must be dropped and
-- recreated (Postgres cannot change an existing function's return type in place).
drop function if exists public.credit_status(integer);

-- remaining now = (monthly allowance left) + (persistent top-up pool). The monthly
-- reset preserves credits_topup because it is not in the conflict update set.
create or replace function public.credit_status(p_allowance integer)
returns table (granted integer, used integer, remaining integer, topup integer, period_end timestamptz)
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  ps timestamptz := date_trunc('month', now());
  pe timestamptz := date_trunc('month', now()) + interval '1 month';
  bal public.credit_balances;
begin
  if uid is null then return; end if;
  select * into bal from public.credit_balances where owner_type = 'user' and owner_id = uid;
  if not found or bal.period_end <= now() then
    insert into public.credit_balances (owner_type, owner_id, period_start, period_end, credits_granted, credits_used)
      values ('user', uid, ps, pe, p_allowance, 0)
    on conflict (owner_type, owner_id) do update
      set period_start = ps, period_end = pe, credits_granted = p_allowance, credits_used = 0, updated_at = now()
    returning * into bal;
  end if;
  return query select bal.credits_granted, bal.credits_used,
    greatest(0, bal.credits_granted - bal.credits_used) + coalesce(bal.credits_topup, 0),
    coalesce(bal.credits_topup, 0), bal.period_end;
end; $$;

-- credit_charge: consume the monthly allowance first; any overflow draws down the
-- top-up pool. Returns total remaining (monthly + top-up).
create or replace function public.credit_charge(
  p_allowance integer, p_feature text, p_model text,
  p_in integer, p_out integer, p_cost_micros bigint, p_credits integer
) returns integer
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  ps timestamptz := date_trunc('month', now());
  pe timestamptz := date_trunc('month', now()) + interval '1 month';
  bal public.credit_balances;
  c integer := greatest(0, coalesce(p_credits, 0));
  monthly_rem integer;
  rem integer;
begin
  if uid is null then return null; end if;
  select * into bal from public.credit_balances where owner_type = 'user' and owner_id = uid;
  if not found or bal.period_end <= now() then
    insert into public.credit_balances (owner_type, owner_id, period_start, period_end, credits_granted, credits_used)
      values ('user', uid, ps, pe, p_allowance, 0)
    on conflict (owner_type, owner_id) do update
      set period_start = ps, period_end = pe, credits_granted = p_allowance, credits_used = 0, updated_at = now()
    returning * into bal;
  end if;
  insert into public.usage_events (owner_type, owner_id, user_id, feature, model, input_tokens, output_tokens, cost_usd_micros, credits_charged)
    values ('user', uid, uid, p_feature, p_model, coalesce(p_in, 0), coalesce(p_out, 0), coalesce(p_cost_micros, 0), c);
  monthly_rem := greatest(0, bal.credits_granted - bal.credits_used);
  update public.credit_balances set
    credits_used = credits_used + least(c, monthly_rem),
    credits_topup = greatest(0, coalesce(credits_topup, 0) - greatest(0, c - monthly_rem)),
    updated_at = now()
  where owner_type = 'user' and owner_id = uid
  returning greatest(0, credits_granted - credits_used) + coalesce(credits_topup, 0) into rem;
  return rem;
end; $$;

-- credit_grant_topup: add purchased credits to the persistent pool. Called by the
-- Stripe webhook (service role). Creates the balance row if missing, seeding the
-- monthly allowance so the user keeps both pools.
create or replace function public.credit_grant_topup(
  p_owner_type text, p_owner_id uuid, p_credits integer, p_allowance integer
) returns integer
language plpgsql security definer set search_path = public as $$
declare
  ps timestamptz := date_trunc('month', now());
  pe timestamptz := date_trunc('month', now()) + interval '1 month';
  newtopup integer;
begin
  insert into public.credit_balances (owner_type, owner_id, period_start, period_end, credits_granted, credits_used, credits_topup)
    values (p_owner_type, p_owner_id, ps, pe, greatest(0, coalesce(p_allowance, 0)), 0, greatest(0, coalesce(p_credits, 0)))
  on conflict (owner_type, owner_id) do update
    set credits_topup = coalesce(public.credit_balances.credits_topup, 0) + greatest(0, coalesce(p_credits, 0)), updated_at = now()
  returning credits_topup into newtopup;
  return newtopup;
end; $$;

grant execute on function public.credit_status(integer) to authenticated;
grant execute on function public.credit_charge(integer, text, text, integer, integer, bigint, integer) to authenticated;
grant execute on function public.credit_grant_topup(text, uuid, integer, integer) to service_role;
