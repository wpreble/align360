import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Server-side Supabase client (RSC, route handlers, server actions).
 * Anon key + the request's auth cookies, so RLS applies as the signed-in user.
 */
export function createClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          // setAll can throw when called from a Server Component (read-only).
          // Middleware refreshes the session, so this is safe to ignore there.
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            /* called from a Server Component; ignore */
          }
        },
      },
    },
  );
}

/**
 * Service-role client — bypasses RLS. SERVER-ONLY. Use exclusively in trusted
 * paths (Stripe webhooks, the super-admin panel, the localStorage migration).
 * Never import this into client code.
 */
export function createServiceClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll() { return []; }, setAll() {} } },
  );
}
