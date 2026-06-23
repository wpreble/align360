# Supabase setup (Phase 1: accounts)

The app gates every route behind login once these env vars are set. Until then the
middleware is a no-op, so the app keeps running on localStorage as before.

## 1. Create the project (you)
1. supabase.com → New project. Pick a region close to your users. Save the DB password.
2. Project Settings → API. Copy into `align360-app/.env.local` (and Vercel env):
   - `NEXT_PUBLIC_SUPABASE_URL` = Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = anon public key
   - `SUPABASE_SERVICE_ROLE_KEY` = service_role key (SERVER ONLY — never client/commit)

## 2. Apply the schema
Open the SQL editor and run `migrations/0001_init.sql` (or `supabase db push` if you
use the CLI). Creates: `profiles` (+ auto-create trigger on signup), `onboarding`,
`assessment_answers`, `reports`, `chats`, all with own-row RLS.

## 3. Auth providers
Authentication → Providers:
- **Email**: enable. (Decide: confirm-email on/off for the alpha.)
- **Google**: enable, paste Google OAuth Client ID + Secret.

Google OAuth (Google Cloud Console → APIs & Services → Credentials → OAuth client, Web):
- Authorized redirect URI: `https://<PROJECT_REF>.supabase.co/auth/v1/callback`
- Authentication → URL Configuration in Supabase:
  - Site URL: `https://align360-app.vercel.app` (and `http://localhost:3000` for dev)
  - Redirect URLs: add `http://localhost:3000/**` and `https://align360-app.vercel.app/**`

## 4. Make yourself super admin (after first login)
`update public.profiles set is_platform_admin = true where email = 'wllprbl@gmail.com';`

Once the three env vars are in `.env.local`, tell me and I'll wire the login/signup/account
UI and the localStorage→account migration, then verify the full flow end-to-end.
