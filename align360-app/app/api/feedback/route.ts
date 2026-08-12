import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { syncFeedbackToHubspot } from '@/lib/hubspot-feedback';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Body = { message?: string; path?: string };

/**
 * In-app feedback → Supabase (source of truth) + a HubSpot note on the contact.
 * Requires a signed-in user (the button lives inside the authed app shell). The
 * insert runs as the user under RLS (feedback_insert_own); the HubSpot mirror is
 * best-effort and never fails the save.
 */
export async function POST(req: NextRequest) {
  let body: Body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400 }); }

  const message = (body.message || '').replace(/\r\n?/g, '\n').trim().slice(0, 4000);
  if (message.length < 2) return NextResponse.json({ error: 'Please add a little more detail.' }, { status: 400 });
  const path = (body.path || '').replace(/\s+/g, ' ').trim().slice(0, 200) || null;

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Please sign in to send feedback.' }, { status: 401 });

  const email = user.email ?? null;
  const userAgent = (req.headers.get('user-agent') || '').slice(0, 300) || null;

  // Insert with RETURNING so the mirror can key off the row id. RETURNING needs the
  // 0012 select-own policy; until that migration is applied, fall back to the bare
  // 0011 insert so a user's save NEVER depends on migration ordering — the skipped
  // mirror is picked up later by scripts/backfill-feedback-to-hubspot.ts.
  const values = { user_id: user.id, email, message, path, user_agent: userAgent };
  let row: { id: number; created_at: string } | null = null;
  const ins = await supabase.from('feedback').insert(values).select('id, created_at').single();
  if (ins.error || !ins.data) {
    const bare = await supabase.from('feedback').insert(values);
    if (bare.error) {
      console.error('feedback insert failed:', bare.error.message, '(returning path:', ins.error?.message, ')');
      return NextResponse.json({ error: 'Could not save your feedback. Please try again.' }, { status: 500 });
    }
    console.warn('feedback saved without RETURNING (apply 0012 for inline hubspot sync):', ins.error?.message);
  } else {
    row = ins.data as { id: number; created_at: string };
  }

  // Mirror to HubSpot (note + custom-object table when configured). Best-effort:
  // the Supabase save already succeeded and is the source of truth; on any HubSpot
  // failure the row keeps hubspot_synced_at NULL and the backfill script retries it.
  if (row) {
    try {
      await syncFeedbackToHubspot({ id: row.id, email, message, path, created_at: row.created_at });
    } catch { /* best-effort — never fail the save */ }
  }

  return NextResponse.json({ ok: true });
}
