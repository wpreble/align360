import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ALPHA_FREE_ALLOWANCE } from '@/lib/credits';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// The signed-in user's credit balance for the current period. Best-effort:
// returns available:false (rather than erroring) if not signed in or the credit
// RPCs are not provisioned yet, so the UI degrades quietly.
export async function GET() {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ available: false, signedIn: false });
    const { data, error } = await supabase.rpc('credit_status', { p_allowance: ALPHA_FREE_ALLOWANCE });
    const row = Array.isArray(data) ? data[0] : data;
    if (error || !row) return NextResponse.json({ available: false, signedIn: true });
    return NextResponse.json({
      available: true,
      signedIn: true,
      granted: row.granted,
      used: row.used,
      remaining: row.remaining,
      periodEnd: row.period_end,
    });
  } catch {
    return NextResponse.json({ available: false });
  }
}
