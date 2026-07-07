import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { hubspotUpsertContact, splitName } from '@/lib/hubspot';

// OAuth + email-confirmation landing: exchange the code for a session, then
// redirect into the app (or back to the originating page via ?next=).
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  // Same-origin relative paths only — blocks open-redirect via ?next=//evil.com or an absolute URL.
  const rawNext = searchParams.get('next') || '/insights';
  const next = /^\/(?!\/)/.test(rawNext) ? rawNext : '/insights';

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Best-effort CRM capture: every Google / email-confirmed signup + login becomes
      // a HubSpot contact. No lifecyclestage here, so a returning customer is never
      // downgraded (paid conversion stamps 'customer' via the Stripe webhook).
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.email) {
          await hubspotUpsertContact(user.email, {
            ...splitName(user.user_metadata?.full_name || user.user_metadata?.name),
            align360_source: 'app_signup',
          });
        }
      } catch { /* never block auth */ }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }
  return NextResponse.redirect(`${origin}/login?error=auth`);
}
