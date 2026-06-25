-- Phase 3a: credit metering RPCs. SECURITY DEFINER so the signed-in user can
-- read their status and record usage without the service-role key (writes to the
-- service-only credit_balances/usage_events tables happen inside the definer).
-- Per-user balances on a calendar-month period; allowance is passed by the app
-- (sized to the 12% AI-budget guardrail). Top-ups + org pooling arrive in 3b.

create or replace function public.credit_status(p_allowance integer)
returns table (granted integer, used integer, remaining integer, period_end timestamptz)
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
    greatest(0, bal.credits_granted - bal.credits_used), bal.period_end;
end; $$;

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
  rem integer;
begin
  if uid is null then return null; end if;
  select * into bal from public.credit_balances where owner_type = 'user' and owner_id = uid;
  if not found or bal.period_end <= now() then
    insert into public.credit_balances (owner_type, owner_id, period_start, period_end, credits_granted, credits_used)
      values ('user', uid, ps, pe, p_allowance, 0)
    on conflict (owner_type, owner_id) do update
      set period_start = ps, period_end = pe, credits_granted = p_allowance, credits_used = 0, updated_at = now();
  end if;
  insert into public.usage_events (owner_type, owner_id, user_id, feature, model, input_tokens, output_tokens, cost_usd_micros, credits_charged)
    values ('user', uid, uid, p_feature, p_model, coalesce(p_in, 0), coalesce(p_out, 0), coalesce(p_cost_micros, 0), greatest(0, coalesce(p_credits, 0)));
  update public.credit_balances
    set credits_used = credits_used + greatest(0, coalesce(p_credits, 0)), updated_at = now()
    where owner_type = 'user' and owner_id = uid
    returning greatest(0, credits_granted - credits_used) into rem;
  return rem;
end; $$;

grant execute on function public.credit_status(integer) to authenticated;
grant execute on function public.credit_charge(integer, text, text, integer, integer, bigint, integer) to authenticated;
