import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/guard';
import { loadSnapshot, supabaseConfigured, wantsFresh } from '@/lib/admin/data';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Organizations with their seat math.
 *
 * Team revenue previously showed up only as a bare `quantity` column on a Stripe
 * row, with no way to tell which org it was, who the members are, or how many of
 * the purchased seats were actually assigned. Seats purchased vs. assigned is the
 * number that matters for expansion and for spotting a team that bought 25 and
 * onboarded 4.
 */
export async function GET(req: Request) {
  const gate = requireAdmin();
  if (gate instanceof NextResponse) return gate;

  try {
    const snap = await loadSnapshot(wantsFresh(req));

    // Member emails, resolved from the snapshot's auth users so we do not need a
    // second round trip per org.
    const emailById = new Map(snap.users.map((u) => [u.id, u.email]));
    const supabase = supabaseConfigured ? createServiceClient() : null;
    const { data: memberRows } = supabase
      ? await supabase.from('organization_members').select('org_id, user_id, role, seat_assigned')
      : { data: null };
    const { data: inviteRows } = supabase
      ? await supabase.from('organization_invitations').select('org_id, email, role, status, created_at, expires_at')
      : { data: null };

    const membersByOrg = new Map<string, { userId: string; email: string | null; role: string; seatAssigned: boolean }[]>();
    for (const m of (memberRows ?? []) as { org_id: string; user_id: string; role: string; seat_assigned: boolean }[]) {
      const list = membersByOrg.get(m.org_id) ?? [];
      list.push({ userId: m.user_id, email: emailById.get(m.user_id) ?? null, role: m.role, seatAssigned: m.seat_assigned });
      membersByOrg.set(m.org_id, list);
    }

    const invitesByOrg = new Map<string, { email: string; role: string; status: string; created_at: string; expires_at: string }[]>();
    for (const i of (inviteRows ?? []) as { org_id: string; email: string; role: string; status: string; created_at: string; expires_at: string }[]) {
      const list = invitesByOrg.get(i.org_id) ?? [];
      list.push({ email: i.email, role: i.role, status: i.status, created_at: i.created_at, expires_at: i.expires_at });
      invitesByOrg.set(i.org_id, list);
    }

    const items = snap.orgs
      .map((o) => ({
        ...o,
        // Negative when a team has onboarded fewer people than it pays for.
        seatsUnused: Math.max(0, o.seatsPurchased - o.seatsAssigned),
        members: (membersByOrg.get(o.id) ?? []).sort((a, b) => (a.email || '').localeCompare(b.email || '')),
        invitations: (invitesByOrg.get(o.id) ?? []).filter((i) => i.status === 'pending'),
      }))
      .sort((a, b) => b.monthlyCents - a.monthlyCents || a.name.localeCompare(b.name));

    return NextResponse.json({
      items,
      totals: {
        orgs: items.length,
        paying: items.filter((o) => o.state === 'active' || o.state === 'trialing').length,
        seatsPurchased: items.reduce((n, o) => n + o.seatsPurchased, 0),
        seatsAssigned: items.reduce((n, o) => n + o.seatsAssigned, 0),
        monthlyCents: items.reduce((n, o) => n + o.monthlyCents, 0),
      },
      truncated: snap.truncated,
      generatedAt: snap.generatedAt,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'orgs failed' }, { status: 502 });
  }
}
