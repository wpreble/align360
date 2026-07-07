import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { hubspotUpsertContact, splitName } from '@/lib/hubspot';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Best-effort CRM capture for the auth flows that DON'T pass through /auth/callback:
 * email+password signup with no email confirmation (session issued immediately) and
 * email+password login. Google / email-confirmed signups already run through the
 * callback, so those don't need this.
 *
 * SECURITY: the email comes ONLY from the server-side Supabase session cookie —
 * never from the request body — so a caller can only ever upsert their own
 * authenticated address. No body is read at all. No session → silent no-op.
 *
 * Best-effort like the rest of the CRM layer: never throws, always 200, so it can't
 * break the login/signup UX even if HubSpot is down.
 */
export async function POST() {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.email) {
      await hubspotUpsertContact(user.email, {
        ...splitName(user.user_metadata?.full_name || user.user_metadata?.name),
        align360_source: 'app_signup',
      });
    }
  } catch {
    /* never surface auth or CRM errors to the client */
  }
  return NextResponse.json({ ok: true });
}
