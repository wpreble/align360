import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Routes reachable without a Supabase user session. Everything else requires login.
// /admin has its OWN auth (lib/admin/auth) and self-gates, so it must be exempt from
// the Supabase user gate here — otherwise it would bounce admins to the app login.
const PUBLIC_PREFIXES = ['/login', '/signup', '/auth', '/api/stripe/webhook', '/discover', '/for', '/admin', '/api/admin', '/pricing', '/contact', '/api/contact', '/faq', '/enterprise', '/find-your-fit'];
const PUBLIC_EXACT = ['/']; // the marketing landing page

function isPublic(path: string): boolean {
  if (PUBLIC_EXACT.includes(path)) return true;
  return PUBLIC_PREFIXES.some((p) => path === p || path.startsWith(p + '/'));
}

/**
 * Refresh the Supabase session on every request and gate non-public routes.
 * If Supabase env is not configured yet, this is a no-op so the app still runs.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return response; // not provisioned → don't gate

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // IMPORTANT: getUser() must run to refresh the token cookie.
  const { data: { user } } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  if (!user && !isPublic(path)) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = '/login';
    redirect.searchParams.set('next', path);
    return NextResponse.redirect(redirect);
  }

  return response;
}
