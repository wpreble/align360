-- Phase 3b.1: idempotent top-up grants keyed by the Stripe checkout session, so a
-- top-up can be granted by EITHER the webhook OR a reconcile-from-Stripe sync
-- without ever double-granting. Apply AFTER 0008_topups.sql.

create table if not exists public.credit_topups (
  session_id text primary key,           -- Stripe checkout session id (idempotency key)
  owner_type text not null,
  owner_id uuid not null,
  credits integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.credit_topups enable row level security;
-- No policies: writes happen only via the SECURITY DEFINER function / service role.

-- credit_grant_topup gains a session id (first arg) for idempotency; drop the
-- previous 4-arg version from 0008.
drop function if exists public.credit_grant_topup(text, uuid, integer, integer);

create or replace function public.credit_grant_topup(
  p_session_id text, p_owner_type text, p_owner_id uuid, p_credits integer, p_allowance integer
) returns integer
language plpgsql security definer set search_path = public as $$
declare
  ps timestamptz := date_trunc('month', now());
  pe timestamptz := date_trunc('month', now()) + interval '1 month';
  claimed text;
  newtopup integer;
begin
  -- Claim this checkout session exactly once (idempotency across webhook + sync).
  insert into public.credit_topups (session_id, owner_type, owner_id, credits)
    values (p_session_id, p_owner_type, p_owner_id, greatest(0, coalesce(p_credits, 0)))
  on conflict (session_id) do nothing
  returning session_id into claimed;
  if claimed is null then
    -- Already granted for this session; return the current pool, no double-credit.
    select coalesce(credits_topup, 0) into newtopup
      from public.credit_balances where owner_type = p_owner_type and owner_id = p_owner_id;
    return coalesce(newtopup, 0);
  end if;
  insert into public.credit_balances (owner_type, owner_id, period_start, period_end, credits_granted, credits_used, credits_topup)
    values (p_owner_type, p_owner_id, ps, pe, greatest(0, coalesce(p_allowance, 0)), 0, greatest(0, coalesce(p_credits, 0)))
  on conflict (owner_type, owner_id) do update
    set credits_topup = coalesce(public.credit_balances.credits_topup, 0) + greatest(0, coalesce(p_credits, 0)), updated_at = now()
  returning credits_topup into newtopup;
  return newtopup;
end; $$;

grant execute on function public.credit_grant_topup(text, text, uuid, integer, integer) to service_role;
