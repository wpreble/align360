import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isAdminEmail } from '@/lib/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ACTIVE = ['active', 'trialing'];

// Whether the signed-in user may use the app. access = internal admin OR an
// active personal subscription OR membership in an org with an active sub.
// `enforce` mirrors BILLING_ENABLED so the client only paywalls when it's on.
// Fails OPEN (access:true) so a glitch never locks people out.
export async function GET() {
  const enforce = process.env.BILLING_ENABLED === 'true';
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ enforce, access: false, signedIn: false });

    if (isAdminEmail(user.email)) return NextResponse.json({ enforce, access: true, admin: true, plan: 'admin' });

    // Array (not maybeSingle): a user can have more than one subscription row
    // (e.g. re-subscribe after cancel), and maybeSingle throws on >1 row.
    const { data: subs } = await supabase
      .from('subscriptions')
      .select('status')
      .eq('owner_type', 'user').eq('owner_id', user.id);
    let access = (subs || []).some((s) => ACTIVE.includes(s.status));
    let plan = access ? 'individual' : 'none';

    if (!access) {
      const { data: mems } = await supabase.from('organization_members').select('org_id').eq('user_id', user.id);
      const orgIds = (mems || []).map((m) => m.org_id);
      if (orgIds.length) {
        const { data: orgSubs } = await supabase.from('subscriptions').select('status').eq('owner_type', 'org').in('owner_id', orgIds);
        if ((orgSubs || []).some((s) => ACTIVE.includes(s.status))) { access = true; plan = 'org'; }
      }
    }
    return NextResponse.json({ enforce, access, admin: false, plan });
  } catch {
    return NextResponse.json({ enforce: false, access: true });
  }
}
