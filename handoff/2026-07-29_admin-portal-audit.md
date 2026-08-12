# Admin portal audit: can Drew and Samuel see paying vs. non-paying users live?

> **STATUS UPDATE 2026-08-10:** the gaps below have been built on branch `feat/admin-portal-visibility`.
> See [`align360-app/docs/admin-portal.md`](../align360-app/docs/admin-portal.md) for the runbook and
> the "What was fixed" section at the bottom of this file. The audit body is left unedited as the
> record of what the portal looked like before. **One item is still open and only Will can close it:**
> confirming `ADMIN_USERS` in Vercel actually contains Drew and Samuel.


**Audited:** 2026-08-10 (filename date per request)
**Scope:** read-only code audit. No prod Stripe or Supabase queries were run. No code changed.
**Repo state audited:** branch `feat/hubspot-feedback-sync` @ `5e34aae`, which is identical to `origin/main` (0 commits ahead, 0 behind). Working tree has uncommitted admin changes; those are called out separately because they are **not deployed**.

---

## TL;DR

**RED.**

An admin portal exists and is genuinely live (no caching), but it is a founder's revenue-split calculator, not a customer-visibility tool: it shows four aggregate tiles, a revenue-split panel, the 10 most recent signups, and a flat list of active Stripe subscriptions. There is **no unified user list, no payment state per user, no search, no drilldown, and no way to answer "is this person paying?"** for anyone outside the last 10 signups. Two separate risks compound this: the Stripe query is capped at 100 subscriptions with no pagination (silent MRR undercount above that), and whether Drew and Samuel can log in at all cannot be determined from the repo, since access lives entirely in a Vercel env var.

---

## Where the admin portal lives

| Piece | Path |
|---|---|
| Route (server) | [align360-app/app/admin/page.tsx](align360-app/app/admin/page.tsx) |
| Dashboard UI (client) | [align360-app/app/admin/AdminDashboard.tsx](align360-app/app/admin/AdminDashboard.tsx) |
| Login page | [align360-app/app/admin/login/page.tsx](align360-app/app/admin/login/page.tsx) |
| Styles | [align360-app/app/admin/admin.css](align360-app/app/admin/admin.css) |
| Auth primitives | [align360-app/lib/admin/auth.ts](align360-app/lib/admin/auth.ts) |
| Route guard | [align360-app/lib/admin/guard.ts](align360-app/lib/admin/guard.ts) |
| Metrics API | [align360-app/app/api/admin/metrics/route.ts](align360-app/app/api/admin/metrics/route.ts) |
| Payouts API | [align360-app/app/api/admin/payouts/route.ts](align360-app/app/api/admin/payouts/route.ts) |
| Feedback API | [align360-app/app/api/admin/feedback/route.ts](align360-app/app/api/admin/feedback/route.ts) |
| Login / logout API | [align360-app/app/api/admin/login/route.ts](align360-app/app/api/admin/login/route.ts), [logout/route.ts](align360-app/app/api/admin/logout/route.ts) |
| HubSpot health (uncommitted) | [align360-app/app/api/admin/hubspot-status/route.ts](align360-app/app/api/admin/hubspot-status/route.ts) |
| Provisioning script (uncommitted) | [align360-app/scripts/provision-admin.ts](align360-app/scripts/provision-admin.ts) |

**Public URL:** `https://<app>/admin`, login at `/admin/login`.

`/admin` and `/api/admin` are explicitly exempted from the Supabase user gate at [lib/supabase/middleware.ts:6](align360-app/lib/supabase/middleware.ts:6), because admin auth is a separate system. There is **no link to `/admin` anywhere in the app UI** (grep for `href="/admin"` returns nothing outside the admin tree itself). Drew and Samuel would have to be told the URL.

There is no `/dashboard`, `/founders`, `/team`, or `/portal` route. `app/org/` exists but is the **customer-facing** org management page, not a founder view.

### Deployed vs. working tree (important)

The working tree contains an uncommitted rewrite of the admin surface introducing a `superadmin` / `admin` role split (7 files, +195/-136). It is **not on `origin/main` and therefore not in production.**

- **Deployed today:** one flat admin role. Anyone in `ADMIN_USERS` sees everything: signups, paying customers, MRR, revenue split, feedback.
- **Working tree, if shipped as written:** `admin` role sees **feedback only**. Signups, paying customers, MRR, and revenue split all become `superadmin`-only ([lib/admin/guard.ts:21](align360-app/lib/admin/guard.ts:21), [AdminDashboard.tsx:99](align360-app/app/admin/AdminDashboard.tsx:99)). The uncommitted roster assigns Samuel and Drew `role: 'admin'`.

Shipping that branch as-is would **reduce** Drew's and Samuel's visibility to zero customer data. Flagging as a decision, not a bug.

The feature matrix below audits the **deployed** version.

---

## Feature matrix

| Capability | Verdict | Evidence |
|---|---|---|
| **User list: lists every user** | **NO** | `metrics/route.ts:26` fetches `per_page=10&page=1` and then `.slice(0, 10)`. Only the 10 most recent signups are ever returned. Total count comes from the `x-total-count` header as a bare number. |
| **User list: filterable / searchable** | **NO** | No search input, no filter control anywhere in `AdminDashboard.tsx`. |
| **User list: sortable** | **NO** | Tables are static `<thead>` markup; no click handlers, no sort state. |
| **Payment state per user (paid/trial/free/churned/downgraded)** | **NO** | Two disjoint tables that are never joined: "Recent signups" (Supabase auth emails) and "Active paying customers" (Stripe customer emails). Nothing marks a signup as paying. Trial, churned, and downgraded states are structurally absent: `subscriptions.list({ status: 'active' })` (`metrics/route.ts:47`) excludes `trialing`, `past_due`, `canceled`, and `unpaid`. |
| **Subscription details: plan** | **PARTIAL** | The "Plan" column renders `s.interval` (`AdminDashboard.tsx:189`), i.e. "month" or "year". The actual product/tier (Individual vs. Team) is never fetched or shown. |
| **Subscription details: MRR contribution** | **YES** | Per-row `monthlyCents` via `toMonthlyCents()`, correctly normalizing day/week/month/year intervals and quantity (`metrics/route.ts:10-20`). |
| **Subscription details: next-billing date** | **NO** | `current_period_end` exists in the local schema (`0002_billing.sql`) but is never read, and the Stripe mapper does not select it. |
| **Subscription details: payment failures** | **NO** | `past_due` / `unpaid` subs are filtered out before they reach the UI. No failed-invoice surface at all. |
| **Aggregate: total users** | **YES** | "Signups" tile, from the `x-total-count` header. Renders `—` if the header is absent. |
| **Aggregate: paying users count** | **PARTIAL** | "Paying customers" tile = `subs.data.length`, but see the 100-cap issue below. Correct only under 100 active subs. |
| **Aggregate: MRR** | **PARTIAL** | Same 100-cap truncation. Also excludes `trialing` and `past_due` revenue. |
| **Aggregate: ARR** | **PARTIAL** | Literally `MRR × 12` (`AdminDashboard.tsx:123`). Inherits every MRR caveat. |
| **Aggregate: churn rate** | **NO** | Not computed anywhere. Canceled subs are never fetched. |
| **Aggregate: trial-to-paid conversion** | **NO** | Trials are never fetched. |
| **Time-series: signups over time** | **NO** | Zero charts in the codebase. No date-bucketed query. |
| **Time-series: revenue over time** | **NO** | The Revenue split panel takes a date range but collapses the whole window into five scalars (gross, fees, refunds, net, count). No per-day or per-month series. |
| **Time-series: cohort retention** | **NO** | Not instrumented. |
| **User activity: last login** | **NO** | Supabase returns `last_sign_in_at`; the mapper at `metrics/route.ts:36` drops it, keeping only email, `created_at`, and provider. |
| **User activity: assessment completions** | **NO** | `assessment_answers`, `onboarding`, and `reports` tables all exist and are queried elsewhere in the app. **No admin route touches any of them.** |
| **User activity: engagement signals** | **NO** | `chats`, `usage_events`, `credit_balances` exist. None are read by admin. |
| **Drilldown: click a user for full history** | **NO** | No per-user route exists. Table rows are inert `<td>` elements. |

### Additional blind spots not in the original scope

- **Orgs and teams are invisible.** `organizations`, `organization_members`, `organization_invitations` are never queried by admin. A Team plan appears only as a Stripe subscription with `quantity: N`. You cannot see which org it is, who the members are, or how many of the purchased seats are actually assigned (`seat_assigned` in `0005_orgs.sql`).
- **The local `subscriptions` table is never read by admin.** Everything comes straight from the Stripe API. That sidesteps the known "Supabase subscriptions table is unreliable" problem, but it also means any non-Stripe access (comped accounts, manual grants) is invisible.
- **Referrals invisible.** `referrals`, `referral_codes` never queried.
- **Credits and top-ups invisible.** `credit_balances`, `credit_topups`, `usage_events` never queried.
- **`hubspot-status` has no UI.** The route exists (uncommitted) but nothing in `AdminDashboard.tsx` calls it. It is curl-only today.

### Correctness risk: the 100-subscription cap

`metrics/route.ts:47` calls `stripe.subscriptions.list({ status: 'active', limit: 100 })` with **no auto-pagination**. Above 100 active subscriptions, the paying-customer count, the MRR tile, the ARR tile, and the customer table all silently truncate, with no warning in the UI.

The payouts route does this correctly by contrast: it uses `for await (const txn of stripe.balanceTransactions.list(...))` to auto-paginate, caps at 5,000, and sets a `capped` flag the UI renders as `"count+ (capped)"` (`payouts/route.ts:44`, `AdminDashboard.tsx:151`). The metrics route has no equivalent.

I did not query prod, so I cannot confirm whether the live subscription count is above 100. Given prior context of roughly $8k MRR, this is worth verifying first: at Individual pricing, $8k MRR would imply a subscription count well past the cap, which would mean the MRR tile is currently understating real revenue.

---

## Access status for Drew and Samuel

**Verdict: UNKNOWN from code. Requires a Vercel env check.**

### How role-gating actually works

Not by Supabase role, not by email domain, not hardcoded in the repo. Admin identity lives entirely in the **`ADMIN_USERS` environment variable**:

1. `ADMIN_USERS` is a JSON array of `{ email, salt, hash, role? }`, scrypt-hashed passwords, parsed at [lib/admin/auth.ts:20](align360-app/lib/admin/auth.ts:20).
2. `/admin/login` posts email + password, verified constant-time against those hashes ([auth.ts:40](align360-app/lib/admin/auth.ts:40)).
3. On success, an HMAC-signed `a360_admin` cookie is set: httpOnly, secure, sameSite=lax, 12-hour TTL ([login/route.ts:24](align360-app/app/api/admin/login/route.ts:24)). Signed with `ADMIN_SESSION_SECRET`.
4. Every `/api/admin/*` route calls `requireAdmin()`, which verifies that cookie.
5. If `ADMIN_USERS` or `ADMIN_SESSION_SECRET` is missing, `/admin` renders "Admin access isn't configured in this environment yet."

Both vars are blank in `.env.example` and **absent entirely from the local `.env.local`**, so `/admin` is non-functional locally. The live values exist only in Vercel.

### What the repo does and does not tell us

The only in-repo evidence about who has access is the **uncommitted** `scripts/provision-admin.ts` roster:

| Email | Role in the roster |
|---|---|
| `wllprbl@gmail.com` | `superadmin` |
| `samuel@align360.io` | `admin` |
| `drewcline168@gmail.com` | `admin` |

That file's own header says admin users "were apparently hand-hashed once," and its passwords are `REPLACE_ME` placeholders. It is a **proposed re-provision, not a record of production state.** Treating it as evidence that Drew and Samuel currently have accounts would be a guess.

Two things follow:

- **Can they log in right now?** Unverifiable from code. Answer by opening Vercel → align360-app → Settings → Environment Variables → `ADMIN_USERS` (Production) and reading the `email` fields. That is a one-minute check and it is the blocking unknown.
- **If they can, what do they see today?** Everything, since deployed prod has no role split.
- **If the uncommitted branch ships,** both drop to `role: 'admin'` = feedback only, losing all revenue and customer visibility.

### Test path: Drew hits `/admin`

Tracing the deployed code with Drew as the actor:

1. `GET /admin` → middleware `isPublic('/admin')` returns true, so the Supabase user gate does not intercept. Drew does **not** need an Align360 user account.
2. `adminConfigured()` → true in prod (assuming both env vars are set).
3. `getAdminSession()` → null on first visit → `redirect('/admin/login')`.
4. Drew enters email + password → `verifyCredentials()` looks up his email in `ADMIN_USERS`.
   - **Present and password correct** → cookie set → full dashboard.
   - **Absent** → generic "Invalid email or password" (deliberately non-enumerating, so he cannot tell whether he lacks an account or mistyped).
5. Same path for Samuel.

Step 4 is the branch point, and its input is a Vercel env var. Note also that they need a **password**, which someone must have generated and delivered to them out of band. There is no signup, no password reset, and no "forgot password" flow anywhere in the admin surface.

### Note on `STRIPE_APPLICATION_FEE_PERCENT`

Worth correcting a carryover assumption: `STRIPE_APPLICATION_FEE_PERCENT=50` is **not** role-gating and has nothing to do with `/admin` access. It is Stripe Connect revenue-share configuration, consumed by [lib/billing/tiers.ts:11](align360-app/lib/billing/tiers.ts:11) and [lib/stripe/client.ts:23](align360-app/lib/stripe/client.ts:23). The Revenue split panel's "Ascendance %" is an independent client-side slider that just happens to default to `useState(50)` ([AdminDashboard.tsx:32](align360-app/app/admin/AdminDashboard.tsx:32)); it does not read that env var.

---

## Data freshness

**Fully live. No cache, no snapshot, no cron.**

| Aspect | Finding |
|---|---|
| Rendering | `export const dynamic = 'force-dynamic'` on the page and all data routes. Nothing is statically generated or ISR-cached. |
| Supabase reads | `cache: 'no-store'` on the GoTrue admin users call (`metrics/route.ts:28`). |
| Stripe reads | Direct API calls on every request. `subscriptions.list` and `balanceTransactions.list` hit Stripe live. |
| Snapshot / warehouse | None. No materialized table, no nightly job, no ETL. |
| Refresh mechanism | **Metrics and feedback: none.** Both fetch once in a `useEffect` with an empty-ish dependency array (`AdminDashboard.tsx:38-52`). To refresh the MRR tile you must reload the page. **Payouts: yes,** there is a "Refresh" button plus auto-refetch whenever the date range changes. |
| Rate-limit / timeout risk | Low today, real later. `subscriptions.list` is a single 100-item call, so it will never be slow, it will just be **wrong** past 100 subs. `balanceTransactions.list` auto-paginates up to 5,000 charges, which is up to 50 sequential Stripe round-trips; on an "All time" range at scale this will approach Vercel's serverless timeout. It is not cached, so every page load re-runs it. |

So "is it live?" is a clean YES. The problem is not staleness, it is that too little is being asked of the live sources.

---

## Top 5 gaps

Ranked by what blocks Drew and Samuel from operating self-serve.

### 1. There is no per-user paid/unpaid answer (L, 12-20h)
The single most important question, "is this person paying?", cannot be answered for anyone outside the 10 most recent signups. Needs: a real user list joining Supabase auth to Stripe customers by email, with a payment-state column (paid / trialing / past_due / canceled / free), plus search, sort, and pagination. This is the gap that makes the portal not a portal.

### 2. Subscription coverage is truncated and status-blind (S-M, 4-8h)
Three fixes in one route: auto-paginate `subscriptions.list` (mirror the `for await` pattern already used in payouts) so MRR stops silently truncating at 100; stop filtering to `status: 'active'` so trials, failed payments, and cancellations become visible; and surface `current_period_end` and `cancel_at_period_end` so you can see next-billing and pending churn. Highest value per hour of anything here, and it also unlocks churn and trial-conversion metrics for free.

### 3. Access for Drew and Samuel is unconfirmed, and the pending branch would revoke it (S, 1-2h plus a decision)
Verify `ADMIN_USERS` in Vercel actually contains both of them; provision them via `scripts/provision-admin.ts` if not, and deliver passwords securely. Separately, decide the role model **before** merging the working-tree changes: as written, they demote Samuel and Drew to feedback-only. Either promote both to `superadmin`, or split finer (a role that sees customers and MRR but not the Ascendance revenue split). Also worth adding: a "forgot password" path or at minimum a documented rotation runbook, because today a lost password means Will hand-regenerates the env var.

### 4. Zero engagement data and no drilldown (M, 8-12h)
`onboarding`, `assessment_answers`, `reports`, `chats`, and `usage_events` are all populated and all invisible to admin. Add a `/admin/users/[id]` page showing last login, onboarding status, assessments completed, reports generated, credits consumed, and payment history. This is what turns "who paid" into "who is actually using it," which is usually the question that follows within a day.

### 5. Orgs, seats, and trend lines are all missing (M-L, 10-16h; splittable)
Two related pieces. **Orgs (M, 6-8h):** list organizations, seats purchased vs. seats assigned, members per org, pending invitations. Team revenue is currently a bare `quantity` number with no org attached. **Time-series (M, 6-8h):** signups per week and revenue per month as actual charts. The payouts endpoint already fetches every balance transaction with timestamps, so revenue-over-time is mostly a bucketing and rendering job on data already in hand.

### Runner-up (S, under 1h)
Add a refresh button to the metrics panel. Today the MRR tile is frozen at page load, which is a bad look on a dashboard that is otherwise genuinely live.

---

## Effort summary

| Gap | Size | Estimate |
|---|---|---|
| 1. Unified user list with payment state | L | 12-20h |
| 2. Fix subscription pagination and status coverage | S-M | 4-8h |
| 3. Confirm/provision access, settle the role model | S | 1-2h + decision |
| 4. Engagement data and per-user drilldown | M | 8-12h |
| 5a. Org and seat visibility | M | 6-8h |
| 5b. Time-series charts | M | 6-8h |
| Metrics refresh button | S | <1h |

Sequencing note: gap 2 is the cheapest and unblocks the metrics that gaps 1 and 5b depend on. Gap 3 is nearly free and is the only one that is currently blocking in the literal sense, since without it nobody can log in to see any of the rest.

---

## Cross-reference note

These gaps were derived **from the code alone**, independent of the parallel Drew Slack pull. They should be cross-referenced against Drew's actual stated asks before anything is prioritized. Will is doing that cross-ref.

## Open items requiring information outside the repo

1. **`ADMIN_USERS` contents in Vercel production.** The blocking unknown for the access question.
2. **Live active-subscription count in Stripe.** Determines whether the 100-cap is already corrupting the MRR figure today or is a future problem.
3. **Intent behind the uncommitted role split.** Was demoting Samuel and Drew to feedback-only deliberate (hiding the Ascendance revenue split from them), or a least-privilege default that was never reconciled against what they actually need?

---

# What was fixed (2026-08-10)

Branch: **`feat/admin-portal-visibility`**. Verdict moves from RED to **GREEN on capability**, and stays **blocked on one operational step** (item 1 above) that only Will can perform.

## A blocker the audit did not catch

Found while render-testing, and it is the most important item here. `/admin` has to be exempted in **two** independent gates:

1. `lib/supabase/middleware.ts` → `PUBLIC_PREFIXES` — was correct.
2. `app/_components/Shell.tsx` → `BARE_PREFIXES` — **was missing `/admin`**.

The consequence: the server returns `/admin` 200, then the client-side onboarding gate immediately fires `router.replace('/onboarding')` because the admin has not personally completed onboarding. The paywall gate would then push to `/subscribe`. Reproduced in a browser before the fix and confirmed resolved after.

This means the portal has been effectively unreachable for anyone who is not also a fully onboarded, paying Align360 user. No amount of `ADMIN_USERS` provisioning would have fixed it. Fixed in [Shell.tsx](../align360-app/app/_components/Shell.tsx).

## Feature matrix, re-scored

| Capability | Before | After | How |
|---|---|---|---|
| User list: every user | NO | **YES** | GoTrue admin API fully paginated |
| User list: searchable | NO | **YES** | Debounced email search |
| User list: sortable | NO | **YES** | Sort by email, status, MRR, last seen, signup date |
| Payment state per user | NO | **YES** | Six states on every row, joined via `stripe_customers` with email fallback |
| Subscription: plan | PARTIAL | **YES** | Real Stripe product name, not the billing interval |
| Subscription: MRR contribution | YES | **YES** | Unchanged, now correct past 100 subs |
| Subscription: next-billing date | NO | **YES** | Renews column + drilldown |
| Subscription: payment failures | NO | **YES** | `past_due`/`unpaid` surfaced with at-risk revenue |
| Aggregate: total users | YES | **YES** | Now a real count, not a response header |
| Aggregate: paying count | PARTIAL | **YES** | No longer truncates |
| Aggregate: MRR / ARR | PARTIAL | **YES** | No longer truncates |
| Aggregate: churn rate | NO | **YES** | Trailing 30d subscriber churn |
| Aggregate: trial-to-paid | NO | **YES** | Scored on resolved trials only, with n shown |
| Time-series: signups | NO | **YES** | 26 weeks, bars + cumulative line |
| Time-series: revenue | NO | **YES** | 12 months of net revenue |
| Cohort retention | NO | NO | Still not instrumented; deliberately out of scope |
| User activity: last login | NO | **YES** | Last-seen column + sort |
| User activity: assessments | NO | **YES** | Drilldown |
| User activity: engagement | NO | **YES** | Reports, chats, credits, usage by feature |
| Drilldown | NO | **YES** | Click any row |
| Orgs / seat utilisation | NO | **YES** | New Teams tab, purchased vs. assigned |
| Metrics refresh | NO | **YES** | Refresh on every tab |

The 100-subscription silent truncation is gone: Stripe is auto-paginated across all statuses, with a 10,000 ceiling that raises a visible banner rather than lying.

## Role model, settled

`admin` was going to mean feedback-only. It now means **everything except the Ascendance revenue split**. The line is ownership data, not customer data. Verified against the live API:

| Endpoint | `admin` | no session |
|---|---|---|
| metrics, users, orgs, timeseries, feedback | 200 | 401 |
| payouts, hubspot-status | **403** | 401 |

Drew and Samuel keep `role: 'admin'` and get the full operating picture.

## Verification performed

- `tsc --noEmit` clean; production build compiles; all 12 admin routes register.
- `scripts/test-admin-snapshot.ts` — 27 in-memory checks of join precedence, revenue attribution (org seats do not double-count), seat math, and interval normalisation. All pass.
- Browser: logged into a throwaway local admin account, walked Overview / Users / Teams, no console errors, degradation banners correct.
- API: role gating confirmed by curl as tabulated above; input validation returns 400 on a malformed user id.

Verification deliberately ran with Supabase and Stripe **unset**, so no live user data was read. The temporary env file used for this was deleted. The join logic is covered by the unit checks instead.

## Still open

**Confirm `ADMIN_USERS` in Vercel contains Drew and Samuel**, then redeploy. Everything above is inert until that is true. `scripts/provision-admin.ts` generates the entries; `docs/admin-portal.md` has the runbook. Note the output replaces the entire array, so include everyone who should keep access.

Not built, and flagged rather than silently skipped: cohort retention (needs event instrumentation that does not exist yet) and a password-reset flow for admins (today a lost password means regenerating the env var by hand).

---

# The revenue numbers were wrong (2026-08-12)

Caught by Will, not by me. I reported **$8,033 MRR** and called it consistent with expectations. It was not Align360's revenue at all.

**Actual Align360 MRR: $100.00/mo.** 4 active subscriptions at $25. ARR $1,200. ARPU $25.00.

## What happened

Align360 bills through the **same Stripe account as other product lines**. `STRIPE_CONNECTED_ACCOUNT_ID` is not set in production, so Stripe Connect is inert and everything shares one account. The admin dashboard counted every subscription on that account as Align360's:

| Product | Active subs | Monthly |
|---|---|---|
| AI Agents as a Service | 2 | $5,900.00 |
| AI Application Hosting & Maintence | 1 | $2,000.00 |
| Website Hosting | 1 | $33.00 |
| **Align360 · Individual** | **4** | **$100.00** |

96% of the reported MRR belonged to other businesses. The Revenue split panel was therefore proposing to split another company's gross revenue with Ascendance.

Payouts were contaminated the same way: the $14,531/30d and $55,146/2026 figures I reported are whole-account totals, not Align360's.

## Root cause, in two layers

1. **Wrong account.** Every billing path (`checkout`, `sync`, `sync-credits`, `topup`, `cancel-individual`, `stripe-setup-products`) passes `{ stripeAccount: connectedAccountId }`. Every admin read passed nothing. Stripe does not error on this; it returns different data with a 200. This predates the rewrite: the original `metrics` and `payouts` routes had the same omission. I carried it forward and presented its output as fact.
2. **Wrong discriminator.** Account scoping alone could not have fixed it, because with Connect inert there is only one account. The real discriminator is product identity.

## Fixes

- `connectedOptions()` in `lib/stripe/client.ts`, applied to every admin Stripe read (subscriptions, products, charges, balance transactions) across `data.ts`, `metrics`, `payouts`, `timeseries`, `users/[id]`.
- **Brand filter**: subscriptions match Align360 by product metadata `brand: 'Align360'`, which `stripe-setup-products.ts` stamps on creation, with a product-name fallback.
- **Exclusions are reported, never silent.** The UI names the excluded products and their total. Silently dropping revenue is the same class of error as silently including it.
- If no branded product can be identified, the filter is **not** applied and the UI says so, since reporting zero would be as wrong as reporting someone else's revenue.
- `payouts` now counts `application_fee` balance transactions. Excluding them overstated Align360's take, and the split panel then applied a second 50% on top of a cut Stripe had already taken.
- New superadmin `/api/admin/subscriptions`: per-subscription ledger with line items and product grouping, so any headline number can be decomposed to the rows behind it. This is what made the diagnosis take minutes.

## Lesson for this file

I verified the rewrite with Stripe unset locally, which is why both this and the expand-depth bug reached production. Empty-state verification proves rendering, not arithmetic. Any future change to revenue math must be checked against the live ledger and against a known-good external figure before it is reported as fact.

## Still open

`STRIPE_CONNECTED_ACCOUNT_ID` is unset in production. Decide whether Connect is meant to be active. If it is, Align360 billing should move to the connected account and the 50% application fee should flow automatically; if it is not, the Revenue split panel's manual 50% is the only split and the `STRIPE_APPLICATION_FEE_PERCENT=50` setting is misleading, since no application fee is actually being charged.
