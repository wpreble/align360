import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { hubspotAddNote } from '@/lib/hubspot';

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

  const { error } = await supabase.from('feedback').insert({ user_id: user.id, email, message, path, user_agent: userAgent });
  if (error) {
    console.error('feedback insert failed:', error.message);
    return NextResponse.json({ error: 'Could not save your feedback. Please try again.' }, { status: 500 });
  }

  // Mirror to HubSpot as a note on the contact (best-effort; the save already succeeded).
  try {
    await hubspotAddNote(email, `Align360 in-app feedback${path ? ` (from ${path})` : ''}:\n\n${message}`);
  } catch { /* best-effort */ }

  return NextResponse.json({ ok: true });
}
