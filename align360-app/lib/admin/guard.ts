import { NextResponse } from 'next/server';
import { getAdminSession, type AdminSession } from '@/lib/admin/auth';

/**
 * Gate an admin API route to ANY signed-in admin. Returns the session, or a 401
 * NextResponse to return immediately. Usage:
 *   const gate = requireAdmin();
 *   if (gate instanceof NextResponse) return gate;
 */
export function requireAdmin(): AdminSession | NextResponse {
  const session = getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return session;
}

/**
 * Gate an admin API route to 'superadmin' only.
 *
 * The line is drawn at OWNERSHIP data, not customer data. An 'admin' (Drew,
 * Samuel) can see every user, their payment state, MRR, orgs, and trends —
 * that is the entire point of the portal, and gating it made the dashboard
 * useless to the people who need it most. What stays superadmin-only is the
 * Ascendance/Align360 revenue SPLIT (/api/admin/payouts) and internal infra
 * config (/api/admin/hubspot-status), which are partnership terms rather than
 * operating metrics.
 *
 * A signed-in regular admin gets 403 (authenticated, just not permitted), not 401.
 */
export function requireSuperAdmin(): AdminSession | NextResponse {
  const gate = requireAdmin();
  if (gate instanceof NextResponse) return gate;
  if (gate.role !== 'superadmin') return NextResponse.json({ error: 'Forbidden — superadmin only' }, { status: 403 });
  return gate;
}
