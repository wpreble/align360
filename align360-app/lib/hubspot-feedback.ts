// Feedback → HubSpot mirror. Supabase is the source of truth (the 0011 insert);
// this module pushes one feedback row into HubSpot and stamps the row on success
// (0012 columns), making the mirror durable: anything left with
// hubspot_synced_at IS NULL is pending/failed, and the backfill script re-runs it.
//
// Two destinations, both env-gated and fail-open (same contract as lib/hubspot.ts):
//   1. NOTE on the contact's timeline — always, when HUBSPOT_TOKEN is set.
//   2. Row in a "table": a HubSpot CUSTOM OBJECT — additionally, when
//      HUBSPOT_FEEDBACK_OBJECT is set to the object's fullyQualifiedName
//      (e.g. "p_app_feedback" or "2-12345678"). See docs/hubspot-setup.md.
//      Idempotent via the a360_feedback_id property: we search before create, so
//      retries never double-write. The note path can, at worst, duplicate a note
//      if the success stamp itself fails (rare); the [a360-feedback #id] marker in
//      the note body keeps that auditable.
//
// Layering: mirrorFeedbackToHubspot() is PURE HubSpot (imports only lib/hubspot,
// plain fetch) so scripts/backfill-feedback-to-hubspot.ts can run it under tsx
// outside Next. syncFeedbackToHubspot() adds the Supabase stamp for the API route,
// lazy-importing the Next-coupled service client so the script never loads it.
//
// Never throws. A HubSpot outage must never fail or slow a user's feedback save
// beyond the bounded per-fetch timeouts.

import { hubspotAddNote, hubspotEnabled } from '@/lib/hubspot';

const API = 'https://api.hubapi.com';
const token = () => process.env.HUBSPOT_TOKEN;
const feedbackObject = () => (process.env.HUBSPOT_FEEDBACK_OBJECT || '').trim();

export type FeedbackRow = {
  id: number;
  email: string | null;
  message: string;
  path: string | null;
  created_at?: string | null;
};

/** Search the custom object for an existing record with this feedback id. */
async function findFeedbackObject(objectType: string, feedbackId: number): Promise<string | null> {
  const t = token();
  if (!t) return null;
  try {
    const res = await fetch(`${API}/crm/v3/objects/${encodeURIComponent(objectType)}/search`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filterGroups: [{ filters: [{ propertyName: 'a360_feedback_id', operator: 'EQ', value: String(feedbackId) }] }],
        properties: ['a360_feedback_id'],
        limit: 1,
      }),
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    return (await res.json())?.results?.[0]?.id ?? null;
  } catch {
    return null;
  }
}

/** Create the custom-object record for one feedback row. Returns its id, or null. */
async function createFeedbackObject(objectType: string, row: FeedbackRow): Promise<string | null> {
  const t = token();
  if (!t) return null;
  try {
    const res = await fetch(`${API}/crm/v3/objects/${encodeURIComponent(objectType)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        properties: {
          // Property internal names must exist on the object — docs/hubspot-setup.md.
          a360_feedback_id: String(row.id),                       // unique external id (idempotency key)
          a360_email: (row.email || '').trim().toLowerCase(),
          a360_message: row.message.slice(0, 65000),
          a360_path: row.path || '',
          a360_submitted_at: row.created_at || new Date().toISOString(),
        },
      }),
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) {
      console.error(`hubspot feedback object create failed (#${row.id}):`, res.status, (await res.text()).slice(0, 300));
      return null;
    }
    return (await res.json())?.id ?? null;
  } catch (e) {
    console.error(`hubspot feedback object error (#${row.id}):`, e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * Pure HubSpot mirror for one row: contact note (always) + custom-object record
 * (when HUBSPOT_FEEDBACK_OBJECT is set, search-first so it is idempotent).
 * Returns the created/found ids, or null when nothing landed. Never throws.
 */
export async function mirrorFeedbackToHubspot(row: FeedbackRow): Promise<{ noteId: string | null; objectId: string | null } | null> {
  if (!hubspotEnabled()) return null; // no token — nothing to mirror (row stays queued)

  const noteBody = `Align360 in-app feedback${row.path ? ` (from ${row.path})` : ''} [a360-feedback #${row.id}]:\n\n${row.message}`;
  const noteId = await hubspotAddNote(row.email, noteBody);

  let objectId: string | null = null;
  const objectType = feedbackObject();
  if (objectType) {
    objectId = await findFeedbackObject(objectType, row.id);
    if (!objectId) objectId = await createFeedbackObject(objectType, row);
  }

  if (!noteId && !objectId) {
    console.error(`hubspot feedback sync failed (#${row.id}) — will retry via backfill`);
    return null;
  }
  return { noteId, objectId };
}

/**
 * Route-facing sync: mirror + stamp the Supabase row on success (service role —
 * RLS has no client update path by design). Returns true when the row is synced.
 * Safe to call repeatedly: the stamp only ever moves null → set.
 */
export async function syncFeedbackToHubspot(row: FeedbackRow): Promise<boolean> {
  const ids = await mirrorFeedbackToHubspot(row);
  if (!ids) return false;

  try {
    // Lazy import keeps this module loadable outside Next (the backfill script).
    const { createServiceClient } = await import('@/lib/supabase/server');
    const db = createServiceClient();
    const { error } = await db
      .from('feedback')
      .update({
        hubspot_synced_at: new Date().toISOString(),
        ...(ids.noteId ? { hubspot_note_id: ids.noteId } : {}),
        ...(ids.objectId ? { hubspot_object_id: ids.objectId } : {}),
      })
      .eq('id', row.id)
      .is('hubspot_synced_at', null);
    if (error) console.error(`feedback sync stamp failed (#${row.id}):`, error.message);
    else console.log(`feedback #${row.id} synced to hubspot${ids.noteId ? ` note=${ids.noteId}` : ''}${ids.objectId ? ` object=${ids.objectId}` : ''}`);
  } catch (e) {
    console.error(`feedback sync stamp error (#${row.id}):`, e instanceof Error ? e.message : e);
  }
  return true;
}
