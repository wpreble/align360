import { NextResponse } from 'next/server';
import { getAdminEmail } from '@/lib/admin/auth';

/**
 * Gate an admin API route. Returns the admin email, or a 401 NextResponse to
 * return immediately. Usage:
 *   const gate = requireAdmin();
 *   if (gate instanceof NextResponse) return gate;
 */
export function requireAdmin(): string | NextResponse {
  const email = getAdminEmail();
  if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return email;
}
