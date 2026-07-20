import { createClient } from '@/lib/supabase/server';
import { isTeamEmail } from '@/lib/admin';

export type AccessStatus = { enforce: boolean; access: boolean; admin: boolean; team?: boolean; plan: string; signedIn: boolean };

const ACTIVE = ['active', 'trialing'];

/**
 * Whether the signed-in user may use the paid app surface (chat, assessments,
 * reports). access = internal admin OR an active personal subscription OR
 * membership in an org with an active sub. `enforce` mirrors BILLING_ENABLED so
 * callers only paywall when it's on. Fails OPEN (access:true) so a glitch never
 * locks people out. Server-only: reads the request's Supabase auth cookie via
 * lib/supabase/server, so call this from within a route handler's own request
 * context (a direct function call, not a self-fetch).
 *
 * Shared by GET /api/access/status (client polling) and the AI-serving routes
 * (chat, assessment/clarity/profile generate) as the authoritative server-side
 * paywall gate — the client-side checks (lib/access-context.tsx) are UX only.
 */
export async function getAccessStatus(): Promise<AccessStatus> {
  const enforce = process.env.BILLING_ENABLED === 'true';
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { enforce, access: false, admin: false, plan: 'none', signedIn: false };

    if (isTeamEmail(user.email)) return { enforce, access: true, admin: true, team: true, plan: 'team', signedIn: true };

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
    return { enforce, access, admin: false, plan, signedIn: true };
  } catch {
    return { enforce: false, access: true, admin: false, plan: 'none', signedIn: true };
  }
}
