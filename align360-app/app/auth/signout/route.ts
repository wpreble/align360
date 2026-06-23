import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL('/login', request.url), { status: 303 });
}

// Sign-out must be POST only (state-changing). Reject GET so a stray <img>/link
// can't trigger it and a future refactor can't silently regress it to a GET.
export async function GET() {
  return NextResponse.json({ error: 'Use POST to sign out.' }, { status: 405 });
}
