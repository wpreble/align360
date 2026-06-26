-- Align360 credits + top-ups (combined, idempotent).
-- Paste this whole file into the Supabase SQL editor and Run.
-- Safe to re-run (create-if-not-exists / create-or-replace / drop-if-exists).

-- =====================================================================
-- migrations/0003_credits.sql
-- =====================================================================
-- Phase 3 scaffolding: credit system. AI usage is metered into an append-only
-- ledger (usage_events) and netted against a per-period allowance (credit_balances).
-- plans defines each tier's price + monthly credit grant. The super-admin panel
-- (Phase 4) aggregates usage_events for usage/revenue/margin dashboards.

create table if not exists public.plans (
  key text primary key,                -- 'individual' | 'team' | ...
  name text not null,
  price_cents integer not null,
  interval text not null default 'month',
  monthly_credits integer not null,    -- allowance, sized to the AI-budget guardrail
  stripe_price_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.credit_balances (
  owner_type text not null check (owner_type in ('user','org')),
  owner_id uuid not null,
  period_start timestamptz not null,
  period_end timestamptz not null,
  credits_granted integer not null default 0,
  credits_used integer not null default 0,  -- maintained from usage_events
  updated_at timestamptz not null default now(),
  primary key (owner_type, owner_id)
);

create table if not exists public.usage_events (
  id bigint generated always as identity primary key,
  owner_type text not null check (owner_type in ('user','org')),
  owner_id uuid not null,             -- the billed account (user or org)
  user_id uuid references auth.users(id) on delete set null, -- who triggered it
  feature text not null,              -- 'chat' | 'profile' | 'clarity' | ...
  model text,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cost_usd_micros bigint not null default 0, -- true provider cost, micro-USD
  credits_charged integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists usage_owner_idx on public.usage_events (owner_type, owner_id, created_at);
create index if not exists usage_user_idx on public.usage_events (user_id, created_at);

alter table public.plans enable row level security;
alter table public.credit_balances enable row level security;
alter table public.usage_events enable row level security;

-- Plans are public catalog data (read-only to everyone signed in).
drop policy if exists "plans_read" on public.plans;
create policy "plans_read" on public.plans for select using (true);

-- Users see their own balance + their own usage. Writes are service-role only.
drop policy if exists "balance_user_read" on public.credit_balances;
create policy "balance_user_read" on public.credit_balances
  for select using (owner_type = 'user' and owner_id = auth.uid());

drop policy if exists "usage_user_read" on public.usage_events;
create policy "usage_user_read" on public.usage_events
  for select using (owner_type = 'user' and owner_id = auth.uid());
-- Org-admin read + the super-admin all-access path are added in later phases.

-- =====================================================================
-- migrations/0007_credits_metering.sql
-- =====================================================================
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

-- =====================================================================
-- migrations/0008_topups.sql
-- =====================================================================
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

-- =====================================================================
-- migrations/0009_topup_ledger.sql
-- =====================================================================
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

