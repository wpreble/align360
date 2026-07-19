-- Referral program v0 (alpha: credits, not money). STAGED — do not apply yet.
-- Every account gets a readable referral code. A referred user who completes their
-- FIRST assessment "qualifies" the referral, which grants credits to the referrer's
-- persistent top-up pool (credit_balances.credits_topup) so the reward shows up in
-- the existing "(+N)" balance UI with no new balance plumbing.
--
-- Mirrors the 0009 credit_grant_topup idempotency pattern: all writes go through
-- SECURITY DEFINER functions; a unique attribution row per referred user prevents
-- double-crediting. Apply AFTER 0009_topup_ledger.sql.

-- One code per user. `code` is the readable public slug (e.g. 'SAM-8F3K').
create table if not exists public.referral_codes (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  code       text not null unique,
  custom     boolean not null default false,   -- true once the user sets their own (alpha: one-time, no changes)
  created_at timestamptz not null default now()
);
-- Case-insensitive lookup so /join?ref=sam-8f3k resolves the same as SAM-8F3K.
create unique index if not exists referral_codes_code_lower_idx on public.referral_codes (lower(code));

-- One attribution row per referred user. status: pending → qualified → rewarded (or voided).
create table if not exists public.referrals (
  id                bigint generated always as identity primary key,
  referrer_user_id  uuid not null references auth.users(id) on delete cascade,
  referred_user_id  uuid unique references auth.users(id) on delete set null, -- a user can be referred once
  code_used         text not null,
  status            text not null default 'pending'
                      check (status in ('pending','qualified','rewarded','voided')),
  reward_credits    integer not null default 0,
  note              text,
  attributed_at     timestamptz not null default now(),
  qualified_at      timestamptz,
  rewarded_at       timestamptz
);
create index if not exists referrals_referrer_idx on public.referrals (referrer_user_id, status);

alter table public.referral_codes enable row level security;
alter table public.referrals enable row level security;

-- Users read their own code and the referrals they made. All writes are service-role
-- only (via the SECURITY DEFINER functions below) — never trust the client for attribution.
drop policy if exists referral_codes_read on public.referral_codes;
create policy referral_codes_read on public.referral_codes
  for select using (user_id = auth.uid());

drop policy if exists referrals_referrer_read on public.referrals;
create policy referrals_referrer_read on public.referrals
  for select using (referrer_user_id = auth.uid());

-- ── Functions ───────────────────────────────────────────────────────────────

-- Idempotently ensure a user has a referral code. Pass the pre-generated slug
-- (lib/referral.ts referralCode()); on a rare collision the caller retries with a
-- new suffix. Returns the user's current code.
create or replace function public.referral_ensure_code(p_user_id uuid, p_code text)
returns text language plpgsql security definer set search_path = public as $$
declare existing text;
begin
  select code into existing from public.referral_codes where user_id = p_user_id;
  if existing is not null then return existing; end if;
  insert into public.referral_codes (user_id, code) values (p_user_id, p_code)
    on conflict (user_id) do nothing;
  select code into existing from public.referral_codes where user_id = p_user_id;
  return existing;
end; $$;

-- Let a user set a custom slug ONCE (alpha rule). Returns true on success, false if
-- taken or the user already customized. Slug validity is enforced in the app layer.
create or replace function public.referral_set_custom_code(p_user_id uuid, p_code text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.referral_codes where lower(code) = lower(p_code) and user_id <> p_user_id)
    then return false; end if;
  update public.referral_codes set code = p_code, custom = true
    where user_id = p_user_id and custom = false;
  return found;
end; $$;

-- Attribute a newly-created referred user to the referrer that owns p_code. No-op on
-- self-referral, unknown code, or if the referred user was already attributed.
create or replace function public.referral_attribute(p_referred_user_id uuid, p_code text)
returns void language plpgsql security definer set search_path = public as $$
declare ref uuid;
begin
  select user_id into ref from public.referral_codes where lower(code) = lower(p_code);
  if ref is null or ref = p_referred_user_id then return; end if;
  insert into public.referrals (referrer_user_id, referred_user_id, code_used, status)
    values (ref, p_referred_user_id, p_code, 'pending')
  on conflict (referred_user_id) do nothing;
end; $$;

-- Qualify + reward: called when the referred user completes their first assessment.
-- Flips pending→rewarded and grants p_credits to the referrer's persistent top-up
-- pool. Idempotent: only a still-pending row is rewarded, so replays never double-grant.
create or replace function public.referral_qualify_and_reward(
  p_referred_user_id uuid, p_credits integer, p_allowance integer
) returns void language plpgsql security definer set search_path = public as $$
declare r_referrer uuid;
  ps timestamptz := date_trunc('month', now());
  pe timestamptz := date_trunc('month', now()) + interval '1 month';
begin
  update public.referrals
    set status = 'rewarded', reward_credits = greatest(0, coalesce(p_credits,0)),
        qualified_at = now(), rewarded_at = now()
    where referred_user_id = p_referred_user_id and status = 'pending'
    returning referrer_user_id into r_referrer;
  if r_referrer is null then return; end if;          -- not pending → already handled, or no referral
  insert into public.credit_balances (owner_type, owner_id, period_start, period_end, credits_granted, credits_used, credits_topup)
    values ('user', r_referrer, ps, pe, greatest(0, coalesce(p_allowance,0)), 0, greatest(0, coalesce(p_credits,0)))
  on conflict (owner_type, owner_id) do update
    set credits_topup = coalesce(public.credit_balances.credits_topup, 0) + greatest(0, coalesce(p_credits,0)),
        updated_at = now();
end; $$;

grant execute on function public.referral_ensure_code(uuid, text)                 to service_role;
grant execute on function public.referral_set_custom_code(uuid, text)             to service_role;
grant execute on function public.referral_attribute(uuid, text)                   to service_role;
grant execute on function public.referral_qualify_and_reward(uuid, integer, integer) to service_role;
