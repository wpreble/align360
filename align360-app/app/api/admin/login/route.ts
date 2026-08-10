import { NextResponse } from 'next/server';
import { verifyCredentials, createSessionToken, roleFor, ADMIN_COOKIE, adminConfigured } from '@/lib/admin/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!adminConfigured()) {
    return NextResponse.json({ error: 'Admin access is not configured.' }, { status: 503 });
  }
  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  const email = (body.email || '').trim().toLowerCase();
  const ok = verifyCredentials(email, body.password || '');
  // Generic error — never reveal whether the email exists.
  if (!ok) return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
  const role = roleFor(email) || 'admin'; // verifyCredentials already confirmed this email exists

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, createSessionToken(email, role), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 12 * 60 * 60,
  });
  return res;
}
