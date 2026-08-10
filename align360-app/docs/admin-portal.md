# Admin portal

Internal dashboard at **`/admin`**. Separate auth from the app's Supabase user accounts: you do NOT need an Align360 user account to sign in, and having one grants you nothing.

There is deliberately no link to `/admin` anywhere in the app UI. Send people the URL directly.

## What it shows

| Tab | Contents | Role |
|---|---|---|
| **Overview** | Total users, paying count, MRR, ARR, trials, failed payments, 30d churn, active-last-30d, user-base composition, signups per week, net revenue per month, team seat totals | admin |
| **Users** | Every signup with its payment state. Search by email, filter by state, sort by any column, paginate. Click a row for the full drilldown. | admin |
| **Teams** | Every organization with seats purchased vs. assigned, members, pending invitations | admin |
| **Feedback** | In-app feedback, searchable | admin |
| **Revenue split** | Ascendance / Align360 split over a date range | **superadmin** |

Overview cards for Paying, On trial, Payment failed, and Churn are clickable and jump to the Users tab pre-filtered.

### Payment states

| Badge | Meaning |
|---|---|
| **Paying** | Active Stripe subscription in their own name |
| **Team seat** | No personal subscription; holds an assigned seat in a paying org. Contributes $0 personally so team revenue is not double-counted |
| **Trial** | `trialing` subscription, not yet billed |
| **Payment failed** | `past_due` or `unpaid`. Revenue at risk, reported separately from MRR |
| **Churned** | Subscription cancelled; the account still exists |
| **Free** | Signed up, never subscribed |

A live personal subscription always beats an org seat. Among multiple subscriptions on one customer, active beats trialing beats churned.

## Roles

Set per account in the `ADMIN_USERS` env var.

- **`admin`** — everything except the revenue split. This is the full operating picture and is the right role for anyone running the business day to day.
- **`superadmin`** — adds the Ascendance/Align360 revenue split and HubSpot infra status.

The line is drawn at **ownership data, not customer data**. Gating customer visibility behind superadmin makes the portal useless to the people who need it most. Omitting `role` defaults to `admin`.

Enforced server-side in `lib/admin/guard.ts` (`requireAdmin` / `requireSuperAdmin`), not just hidden in the UI. A regular admin calling `/api/admin/payouts` gets 403.

## Provisioning an admin

Admin identity lives entirely in the **`ADMIN_USERS`** Vercel env var. There is no signup and no password reset: adding someone means regenerating that variable.

1. Generate the entry (prints only, never writes or deploys anything):

   ```bash
   npx tsx scripts/provision-admin.ts --one "person@example.com" "their-password" admin
   ```

   Or edit the `ROSTER` in `scripts/provision-admin.ts` and run it with no arguments to regenerate everyone at once.

2. Paste the JSON into Vercel → align360-app → Settings → Environment Variables → `ADMIN_USERS` (Production).

3. **Redeploy.** A running instance will not pick up the change otherwise.

4. Send the password over a secure channel. It is not recoverable: rotating it means regenerating the entry.

> **The output REPLACES the whole array.** Entries you leave out lose access. When adding one person, either use the full `ROSTER` or hand-merge the new object into the existing value.

`ADMIN_SESSION_SECRET` is a separate random 32-byte hex value that signs session cookies. Rotating it force-expires every live session; you do not need to touch it to add a user.

To check who currently has access, read the `email` fields of `ADMIN_USERS` in Vercel. Nothing in the repo records this.

## Data freshness

Everything is read live: Stripe for billing, the Supabase admin API for signups, Postgres for orgs and engagement. No snapshot, no cron, no warehouse.

A 60-second in-memory cache collapses bursts so switching tabs does not re-walk Stripe. Every tab has a **Refresh** button that bypasses it (`?refresh=1` on the API). Serverless instances are ephemeral, so treat the cache as best-effort burst collapsing rather than a guarantee.

Both page-walks carry safety ceilings: 20,000 users and 10,000 subscriptions. If either trips, the UI shows a warning banner saying the figures below are incomplete. It never silently truncates.

## Architecture

```
app/admin/
  page.tsx              server gate → login redirect
  AdminDashboard.tsx    tab shell
  OverviewTab.tsx       KPIs + charts
  UsersTab.tsx          list, search, filter, sort, paginate
  UserDrawer.tsx        per-user drilldown
  OrgsTab.tsx           teams + seat math
  RevenueTab.tsx        revenue split (superadmin)
  FeedbackTab.tsx
  ui.tsx                formatters, badges, inline-SVG charts
  types.ts

lib/admin/
  auth.ts               scrypt credentials, HMAC session cookie
  guard.ts              requireAdmin / requireSuperAdmin
  data.ts               the shared read layer — all joins live here

app/api/admin/
  metrics · users · users/[id] · orgs · timeseries · payouts · feedback · hubspot-status · login · logout
```

`lib/admin/data.ts` is the single source of truth for reads. Stripe subscriptions are auto-paginated across **all** statuses; the customer→owner join goes through `public.stripe_customers` (falling back to email matching for customers created before that table was populated).

`public.subscriptions` is deliberately **not** read. It is webhook-maintained and has drifted from Stripe before; Stripe is treated as authoritative for anything billing-related.

## Testing

```bash
npx tsx scripts/test-admin-snapshot.ts
```

Pure in-memory checks of the join precedence rules, revenue attribution, seat math, and interval normalisation. No network, no credentials.

## Gotcha: two gates, not one

`/admin` must be exempted in **two** places, and they are unrelated:

1. `lib/supabase/middleware.ts` → `PUBLIC_PREFIXES` (server-side Supabase session gate)
2. `app/_components/Shell.tsx` → `BARE_PREFIXES` (client-side onboarding + paywall gate)

Missing the second one is silent server-side: `/admin` returns 200 and then the client immediately redirects to `/onboarding`, because the admin has not personally completed onboarding. This shipped broken and is why the portal appeared unreachable. If `/admin` starts bouncing to `/onboarding` or `/subscribe`, check `BARE_PREFIXES` first.
