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
