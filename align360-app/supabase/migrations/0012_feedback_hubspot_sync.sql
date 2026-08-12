-- Feedback → HubSpot mirror bookkeeping. STAGED — apply with 0011 already in place.
--
-- Dual-write design: Supabase is the source of truth (0011 insert, transactional);
-- HubSpot is a best-effort mirror. These columns make the mirror DURABLE instead of
-- fire-and-forget: a row is stamped only after HubSpot accepts it, so anything with
-- hubspot_synced_at IS NULL is by definition pending/failed and the backfill script
-- (scripts/backfill-feedback-to-hubspot.ts) doubles as the retry queue. No separate
-- queue table needed — the feedback table IS the queue (serverless-safe: an
-- in-memory retry dies with the invocation; a nullable column does not).
--
-- Columns are written by the service role only (lib/hubspot-feedback.ts); the RLS
-- posture from 0011 is unchanged (insert-own, no client select/update).

alter table public.feedback add column if not exists hubspot_synced_at timestamptz;
alter table public.feedback add column if not exists hubspot_note_id   text;  -- note engagement id (timeline mirror)
alter table public.feedback add column if not exists hubspot_object_id text;  -- custom-object record id (table mirror), when configured

-- The retry scan: unsynced rows, oldest first.
create index if not exists feedback_unsynced_idx on public.feedback (created_at)
  where hubspot_synced_at is null;

-- 0011 deliberately had NO select policy. The route now inserts with RETURNING
-- (it needs the new row's id to key the HubSpot mirror), and under RLS RETURNING
-- requires select on the returned row. Narrowest possible relaxation: a user may
-- select only their OWN feedback rows. Cross-user reads remain service-role only
-- (the /admin dashboard), unchanged.
drop policy if exists feedback_select_own on public.feedback;
create policy feedback_select_own on public.feedback
  for select using (user_id = auth.uid());
