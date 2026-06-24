-- Phase 3 scaffolding: Stripe billing tables. Polymorphic owner (user|org); no FK
-- to organizations yet (orgs land in Phase 2). Writes happen via the service role
-- (webhook), which bypasses RLS; clients get read-only own-row policies.

create table if not exists public.stripe_customers (
  id text primary key,                 -- Stripe customer id (cus_...)
  owner_type text not null check (owner_type in ('user','org')),
  owner_id uuid not null,
  created_at timestamptz not null default now(),
  unique (owner_type, owner_id)
);

create table if not exists public.subscriptions (
  id text primary key,                 -- Stripe subscription id (sub_...)
  stripe_customer_id text not null,
  owner_type text not null check (owner_type in ('user','org')),
  owner_id uuid not null,
  status text not null,                -- active | trialing | past_due | canceled | ...
  price_id text,
  quantity integer not null default 1, -- seats
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  updated_at timestamptz not null default now()
);
create index if not exists subscriptions_owner_idx on public.subscriptions (owner_type, owner_id);

create table if not exists public.stripe_events (
  id text primary key,                 -- Stripe event id (evt_...) — idempotency ledger
  type text,
  received_at timestamptz not null default now()
);

alter table public.stripe_customers enable row level security;
alter table public.subscriptions enable row level security;
alter table public.stripe_events enable row level security;  -- no policies = service-role only

drop policy if exists "subs_user_read" on public.subscriptions;
create policy "subs_user_read" on public.subscriptions
  for select using (owner_type = 'user' and owner_id = auth.uid());

drop policy if exists "cust_user_read" on public.stripe_customers;
create policy "cust_user_read" on public.stripe_customers
  for select using (owner_type = 'user' and owner_id = auth.uid());
-- Org-admin read policies for these are added with the org tables in Phase 2.
