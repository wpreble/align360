// New-account signups are CLOSED by default as a safety guard: the app currently
// runs in Stripe test mode and a link could be shared accidentally. Existing users
// can always sign in. To OPEN signups (e.g. at launch), set
// NEXT_PUBLIC_ALLOW_SIGNUPS=true in the environment.
//
// NOTE: this is an app-level guard covering the in-app signup surface. OAuth and
// magic-link providers can still auto-create an account at the Supabase layer the
// first time a brand-new user authenticates. For an authoritative backstop, also
// turn OFF "Allow new users to sign up" in the Supabase dashboard (Authentication →
// Sign In / Providers). That setting blocks all new-account creation while still
// letting existing users sign in.
export const SIGNUPS_OPEN = process.env.NEXT_PUBLIC_ALLOW_SIGNUPS === 'true';
