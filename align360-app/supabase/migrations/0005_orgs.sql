-- Phase 2: Organizations, members, invitations (seat-based B2B).
-- RLS uses SECURITY DEFINER helpers so policies that read organization_members
-- don't recurse. Org admins can read member assessment RESULTS (not chats).

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','member')),
  seat_assigned boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index if not exists org_members_user_idx on public.organization_members(user_id);

create table if not exists public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role text not null default 'member' check (role in ('admin','member')),
  token text not null unique default encode(gen_random_bytes(24),'hex'),
  invited_by uuid references auth.users(id) on delete set null,
  status text not null default 'pending' check (status in ('pending','accepted','revoked')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  expires_at timestamptz not null default (now() + interval '14 days')
);
create index if not exists org_invites_email_idx on public.organization_invitations(lower(email));
create index if not exists org_invites_org_idx on public.organization_invitations(org_id);

-- ── SECURITY DEFINER helpers (bypass RLS → no policy recursion) ──
create or replace function public.is_org_member(p_org uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists(select 1 from public.organization_members m where m.org_id = p_org and m.user_id = auth.uid());
$$;
create or replace function public.is_org_admin(p_org uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists(select 1 from public.organization_members m
    where m.org_id = p_org and m.user_id = auth.uid() and m.role in ('owner','admin'));
$$;
-- auth.uid() is owner/admin of an org that p_target also belongs to
create or replace function public.shares_admin_org(p_target uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists(
    select 1 from public.organization_members me
    join public.organization_members them on them.org_id = me.org_id
    where me.user_id = auth.uid() and me.role in ('owner','admin') and them.user_id = p_target
  );
$$;

-- ── RPCs that bootstrap membership (avoid the create/accept RLS chicken-egg) ──
create or replace function public.create_organization(p_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare new_id uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  insert into public.organizations (name, created_by) values (p_name, auth.uid()) returning id into new_id;
  insert into public.organization_members (org_id, user_id, role, seat_assigned)
    values (new_id, auth.uid(), 'owner', true);
  return new_id;
end; $$;

create or replace function public.accept_invitation(p_token text)
returns uuid language plpgsql security definer set search_path = public as $$
declare inv public.organization_invitations; uid uuid := auth.uid(); uemail text;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  select * into inv from public.organization_invitations
    where token = p_token and status = 'pending' and expires_at > now();
  if not found then raise exception 'invalid or expired invitation'; end if;
  select email into uemail from auth.users where id = uid;
  if lower(uemail) <> lower(inv.email) then raise exception 'invitation is for a different email'; end if;
  insert into public.organization_members (org_id, user_id, role, seat_assigned)
    values (inv.org_id, uid, inv.role, true)
    on conflict (org_id, user_id) do update set role = excluded.role, seat_assigned = true;
  update public.organization_invitations set status='accepted', accepted_at=now() where id = inv.id;
  return inv.org_id;
end; $$;

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.organization_invitations enable row level security;

drop policy if exists org_select on public.organizations;
create policy org_select on public.organizations for select using (public.is_org_member(id));
drop policy if exists org_insert on public.organizations;
create policy org_insert on public.organizations for insert with check (created_by = auth.uid());
drop policy if exists org_update on public.organizations;
create policy org_update on public.organizations for update using (public.is_org_admin(id)) with check (public.is_org_admin(id));

drop policy if exists orgmem_select on public.organization_members;
create policy orgmem_select on public.organization_members for select using (public.is_org_member(org_id));
drop policy if exists orgmem_admin_write on public.organization_members;
create policy orgmem_admin_write on public.organization_members for all using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));

drop policy if exists orginv_admin on public.organization_invitations;
create policy orginv_admin on public.organization_invitations for all using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));

-- Org owner/admin can read members' assessment RESULTS (results/insights only, not chats).
drop policy if exists reports_org_admin_read on public.reports;
create policy reports_org_admin_read on public.reports for select using (public.shares_admin_org(user_id));
drop policy if exists answers_org_admin_read on public.assessment_answers;
create policy answers_org_admin_read on public.assessment_answers for select using (public.shares_admin_org(user_id));

drop trigger if exists t_orgs_touch on public.organizations;
create trigger t_orgs_touch before update on public.organizations for each row execute function public.touch_updated_at();
