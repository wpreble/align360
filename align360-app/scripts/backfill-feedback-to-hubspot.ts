/**
 * Backfill / retry: mirror every unsynced Supabase feedback row to HubSpot.
 *
 * The feedback table IS the queue: rows with hubspot_synced_at IS NULL (0012) are
 * pending — whether they predate the mirror, were saved while HubSpot was down, or
 * were saved before 0012 was applied. Idempotent: the custom-object path dedupes by
 * a360_feedback_id (search-first), the stamp only moves null → set, and already-
 * stamped rows are never selected. Safe to run repeatedly (cron-able as the retry job).
 *
 * Uses mirrorFeedbackToHubspot (pure fetch, no Next imports) and stamps rows with
 * its own supabase-js service client, so it runs under plain tsx.
 *
 * Dry run (default — lists what it would sync, calls NOTHING on HubSpot):
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... HUBSPOT_TOKEN=... \
 *     npx tsx scripts/backfill-feedback-to-hubspot.ts
 *
 * Apply:
 *   ... npx tsx scripts/backfill-feedback-to-hubspot.ts --confirm
 *
 * Optional: HUBSPOT_FEEDBACK_OBJECT=<fullyQualifiedName> additionally writes the
 * custom-object "table" rows (docs/hubspot-setup.md). Without it, notes only.
 */
import { createClient } from '@supabase/supabase-js';
import { mirrorFeedbackToHubspot, type FeedbackRow } from '../lib/hubspot-feedback';

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  if (!process.env.HUBSPOT_TOKEN) throw new Error('HUBSPOT_TOKEN is required (mirror destination).');
  const confirm = process.argv.includes('--confirm');

  const db = createClient(url, key, { auth: { persistSession: false } });
  const { data: rows, error } = await db
    .from('feedback')
    .select('id, email, message, path, created_at')
    .is('hubspot_synced_at', null)
    .order('created_at', { ascending: true });
  if (error) throw new Error(`read failed: ${error.message}`);

  const pending = (rows || []) as FeedbackRow[];
  console.log(`${confirm ? 'SYNCING' : 'DRY RUN'} — ${pending.length} unsynced feedback row(s)${process.env.HUBSPOT_FEEDBACK_OBJECT ? ` (note + object ${process.env.HUBSPOT_FEEDBACK_OBJECT})` : ' (note only — HUBSPOT_FEEDBACK_OBJECT unset)'}\n`);

  let ok = 0, failed = 0;
  for (const row of pending) {
    const who = (row.email || 'no-email').slice(0, 40);
    if (!confirm) {
      console.log(`~ would sync  #${row.id}  ${who}  "${row.message.slice(0, 60).replace(/\n/g, ' ')}…"`);
      continue;
    }
    const ids = await mirrorFeedbackToHubspot(row);
    if (ids) {
      const { error: stampErr } = await db
        .from('feedback')
        .update({
          hubspot_synced_at: new Date().toISOString(),
          ...(ids.noteId ? { hubspot_note_id: ids.noteId } : {}),
          ...(ids.objectId ? { hubspot_object_id: ids.objectId } : {}),
        })
        .eq('id', row.id)
        .is('hubspot_synced_at', null);
      if (stampErr) console.log(`! synced but stamp failed  #${row.id}  ${who}  (${stampErr.message})`);
      else { ok++; console.log(`✓ synced  #${row.id}  ${who}${ids.objectId ? `  object=${ids.objectId}` : ''}${ids.noteId ? `  note=${ids.noteId}` : ''}`); }
    } else {
      failed++;
      console.log(`✗ failed  #${row.id}  ${who}  (left queued for next run)`);
    }
    // Gentle pacing — HubSpot free/starter rate limits are ~100 req / 10s.
    await new Promise((r) => setTimeout(r, 250));
  }

  console.log(`\n${confirm ? `Done. ${ok} synced, ${failed} failed (re-run to retry).` : 'Dry run only — re-run with --confirm to sync.'}`);
}

main().catch((e) => {
  console.error('FAILED:', e instanceof Error ? e.message : e);
  process.exit(1);
});
