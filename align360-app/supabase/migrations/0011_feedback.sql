-- In-app feedback capture. A signed-in user submits freeform feedback from the
-- app sidebar; the row is theirs to write, and only the service role (the /admin
-- dashboard) can read across users. Mirrors the app's best-effort, own-writes-only
-- RLS pattern. No dependency on other migrations — apply anytime.

create table if not exists public.feedback (
  id         bigint generated always as identity primary key,
  user_id    uuid references auth.users(id) on delete set null,
  email      text,
  message    text not null,
  path       text,                       -- app route the feedback was sent from
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists feedback_created_idx on public.feedback (created_at desc);

alter table public.feedback enable row level security;

-- A signed-in user may insert only their OWN feedback. There is deliberately NO
-- select policy, so no client can read anyone's feedback; the /admin dashboard
-- reads it with the service role, which bypasses RLS.
drop policy if exists feedback_insert_own on public.feedback;
create policy feedback_insert_own on public.feedback
  for insert with check (user_id = auth.uid());
