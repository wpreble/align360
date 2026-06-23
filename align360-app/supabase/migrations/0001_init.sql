-- Align360 — Phase 1: accounts + per-user app data.
-- Apply in the Supabase SQL editor, or `supabase db push`. Idempotent-ish; safe to
-- re-run on a fresh project. Orgs + billing tables arrive in later migrations.

-- ── Profiles (1:1 with auth.users) ──────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  is_platform_admin boolean not null default false,  -- super-admin flag
  stripe_customer_id text,                            -- personal billing (Phase 3)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

drop policy if exists "profiles_self_select" on public.profiles;
create policy "profiles_self_select" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_self_update" on public.profiles;
create policy "profiles_self_update" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);
-- No public insert policy: profiles are created by the signup trigger below.

-- Auto-create a profile when a user signs up (security definer to bypass RLS).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Generic updated_at bumper.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

-- ── Per-user app data (migrated from localStorage align360:*) ────────────────
create table if not exists public.onboarding (
  user_id uuid primary key references auth.users(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.assessment_answers (
  user_id uuid not null references auth.users(id) on delete cascade,
  slug text not null,
  answers jsonb not null default '{}'::jsonb,
  completed_at timestamptz not null default now(),
  primary key (user_id, slug)
);

create table if not exists public.reports (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,                  -- 'combined' | 'clarity'
  slug text not null default '',       -- '' for combined; the clarity slug otherwise
  scores jsonb,
  narrative jsonb,
  generated_at timestamptz not null default now(),
  primary key (user_id, kind, slug)
);

create table if not exists public.chats (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  messages jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- Own-row RLS for every app-data table.
alter table public.onboarding enable row level security;
alter table public.assessment_answers enable row level security;
alter table public.reports enable row level security;
alter table public.chats enable row level security;

drop policy if exists "onboarding_own" on public.onboarding;
create policy "onboarding_own" on public.onboarding
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "answers_own" on public.assessment_answers;
create policy "answers_own" on public.assessment_answers
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "reports_own" on public.reports;
create policy "reports_own" on public.reports
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "chats_own" on public.chats;
create policy "chats_own" on public.chats
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- updated_at triggers
drop trigger if exists t_profiles_touch on public.profiles;
create trigger t_profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists t_onboarding_touch on public.onboarding;
create trigger t_onboarding_touch before update on public.onboarding
  for each row execute function public.touch_updated_at();

drop trigger if exists t_chats_touch on public.chats;
create trigger t_chats_touch before update on public.chats
  for each row execute function public.touch_updated_at();
