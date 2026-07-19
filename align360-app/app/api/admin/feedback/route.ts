import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/guard';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Recent in-app feedback for the admin dashboard. Service-role read (bypasses RLS);
// gated by the separate admin session, not the app's user auth.
export async function GET() {
  const gate = requireAdmin();
  if (gate instanceof NextResponse) return gate;
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('feedback')
      .select('id, email, message, path, created_at')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) return NextResponse.json({ items: [], error: error.message });
    return NextResponse.json({ items: data ?? [] });
  } catch (e) {
    return NextResponse.json({ items: [], error: e instanceof Error ? e.message : 'feedback load failed' }, { status: 502 });
  }
}
