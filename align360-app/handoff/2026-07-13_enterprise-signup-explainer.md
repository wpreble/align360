# Enterprise signup — what's going on (diagnosis + response)
_2026-07-13. Answers Samuel's 7/13 question: "how do enterprises sign up directly… I tried with a different email and it did not work. I don't see where I can pay for an enterprise." Verified against code + live site._

## Bottom line (3 sentences)
Align360 has three tiers on a live public `/pricing` page: Individual ($25, self-serve), Team ($19/seat, 5–25, self-serve at `/signup/team`), and **Enterprise (25+), which is intentionally "Contact us" → emails samuel@align360.io — sales-led, no self-serve checkout by design.** So "I can't pay for enterprise directly" is **correct and intended**, not a bug. The real defect is a **UX routing gap**: the enterprise lead-gen pages Samuel sends in outreach point their CTAs at *individual* `/signup`, so recipients never reach `/pricing` where the Enterprise "Contact us" and Team options actually live.

---

## Current state — how signup actually works today (verified live, logged-out)
| Tier | Price | Entry point | CTA target | Reachable logged-out? |
|---|---|---|---|---|
| Individual | $25/mo | `/pricing` "Start free" | `/chat` → `/login?next=/chat` | Login-gated (sign up then in) |
| **Team** | $19/seat, **5–25**, min 5 | `/pricing` "Set up your team" | **`/signup/team`** | ✅ 200 public |
| **Enterprise** | **Custom, 25+, annual** (SSO, security review, custom terms) | `/pricing` "Contact us" | **`mailto:samuel@align360.io`** | ✅ (mailto) |

- `/pricing` → **200 public** (verified). `/signup/team` → **200 public**. `/chat` and `/subscribe` → **redirect to /login** (gated).
- **Team self-serve flow:** `/signup/team` → create org (`lib/orgs.ts:10` `create_organization` RPC) → Stripe checkout for N seats (`app/api/stripe/checkout/route.ts`, `mode:'org'`, min 5) → org dashboard `/org/[id]` → buy/assign seats + invite.
- **Enterprise flow:** `/pricing` Enterprise card → `mailto:samuel@align360.io` (`app/pricing/page.tsx:12-14`). Explicit design intent in code: *"Enterprise (25+) is sales-led — a direct line, not self-serve checkout"* and `lib/billing/tiers.ts:5-9`: the commercial tiers (SMB/Mid/Enterprise, $3k–$10k/mo, annual, 25–150 seats) *"are SALES-LED and handled via Stripe Invoices/Quotes, not self-serve checkout — not created here."*

**So: enterprises sign up by contacting Samuel (the mailto), who runs the sales-led / LOI onboarding and provisions them** — either as a Team org (buy seats + assign) or via a Stripe Invoice/Quote. That is the intended path.

---

## Diagnosed issues (firm verdicts)

### 1. "I don't see where I can pay for an enterprise" → **MISSING FEATURE, BY DESIGN. Not a bug.**
Self-serve enterprise checkout does not exist and was deliberately excluded (`lib/billing/tiers.ts:5-9`, `app/pricing/page.tsx:12`). Enterprise = Contact us → sales-led. **Answer, not a fix:** tell enterprise prospects to use the Contact-us line; provision them manually. Building self-serve enterprise checkout is a v1 decision (below), not a this-week fix.

### 2. "How do enterprises sign up directly… tried with a different email and it did not work" → **USER ERROR + real UX ROUTING GAP.**
The enterprise path exists (`/pricing` → Contact us) but Samuel's own funnel never surfaces it. The **enterprise lead-gen pages route their CTAs to individual `/signup`**, not `/pricing`:
- `content/landing/workforce-intelligence.html:90` — "See the enterprise dashboard →" → `href="/signup"`
- `content/landing/workforce-intelligence.html:143` — "Book a dashboard walkthrough" (enterprise, "$5,000–$10,000/mo") but the button → `/signup`
- `content/landing/csuite.html` — C-suite page CTAs → `/signup`
So a prospect (or Samuel testing) lands on an enterprise page, gets sent to *individual* signup, makes an individual account, and correctly finds no enterprise/pay option there. **This is the single most likely cause of his "it did not work."**
**Minimum fix (this week):** repoint the enterprise/team lead-gen CTAs from `/signup` → `/pricing` (canonical entry with Team self-serve + Enterprise contact). ~3–6 one-line edits across `csuite.html` + `workforce-intelligence.html` (+ `coach-intelligence.html` if team-oriented). Leave the individual pages (career-clarity, wiring/value/conviction-score) on `/signup`. **Effort: ~15 min.** *(Target confirmed as `/pricing` unless Samuel wants the mailto or a dedicated intake form — needs-list item.)*

### 3. Team checkout may fail if the Stripe price isn't live → **POSSIBLE BUG (needs live-Stripe confirmation).**
Org/team checkout looks up price `a360_org_pilot_seat_monthly` (`app/api/stripe/checkout/route.ts:9,53`) and returns `"Price a360_org_pilot_seat_monthly not found — run scripts/stripe-setup-products.ts"` (`:55`) if it isn't set up on the connected account. If Samuel reached `/signup/team` and payment errored, this is why. **Check:** `npx tsx scripts/stripe-setup-products.ts --live` (dry-run) confirms whether the price exists on the live connected account. Can't verify from here (no live Stripe key). **Effort to fix if missing: ~5 min** (run the setup script with `--confirm`).

### 4. "Invite by email" doesn't email → **MINOR UX GAP (bug-ish labeling).**
Every surface says "invite by email" (`app/pricing/page.tsx:62`, `subscribe`, `org` page) but `createInvite` (`lib/orgs.ts:69-77`) only inserts an `organization_invitations` row + token; the admin must **manually copy/share the link** (`app/org/[id]/page.tsx:49` → *"Invite created. Share this link: …/invite/{token}"*). No email is sent. The invitee must also be signed in with the invited email to accept (`app/invite/[token]/page.tsx:34`). **Minimum fix:** relabel to "invite link" now; wire real invite emails at v1. Not the enterprise blocker. **Effort: relabel ~10 min; real emails ~half-day (needs an email provider).**

---

## Minimum viable enterprise signup this week
1. **Repoint enterprise lead-gen CTAs → `/pricing`** (issue #2). Unblocks Samuel's outreach: his enterprise emails now land people where the Enterprise "Contact us" + Team signup live.
2. **Confirm the Team Stripe price is live** (issue #3) so `/signup/team` checkout actually completes for 5–25 seat buyers.
3. **Keep Enterprise = Contact us** (mailto Samuel). Optionally swap the raw mailto for a short intake form (name, org, seats, timeline) → HubSpot, so leads are captured even if they don't finish the email. ~2–3 hrs.
That's a working funnel: enterprise → contact → sales-led; team → self-serve; individual → self-serve.

## Full v1 (roadmap, not now)
- **Self-serve enterprise checkout** *only if Samuel wants it* — most B2B keeps 25+ sales-led. If desired: annual Stripe price(s) per band, a "request access / start" flow, seat-count gating.
- **Real invite emails** (provider: Resend/Postmark) replacing copy-the-link.
- **SSO** (Google Workspace / SAML) — currently only listed as an Enterprise *feature* on `/pricing`; no implementation. Stub → v1.
- **Admin dashboard** beyond `/org/[id]` (usage, billing history, bulk invite/CSV).
- **LOI capture** integrated into the contact flow (Samuel's stated process: LOI → onboard → collect emails).

---

## Draft response for Samuel / Will to send back
> Enterprise signup is intentionally "Contact us," not a self-serve checkout — that's why you didn't find a "pay for enterprise" button. Here's the full picture:
> • **Individual ($25/mo)** and **Team ($19/seat, 5–25)** are self-serve at **align360.io/pricing** (Team → "Set up your team" → align360.io/signup/team).
> • **Enterprise (25+)** is the **"Contact us"** button on /pricing → it emails you (samuel@align360.io). That's the LOI/sales-led route: they email → you send the LOI → onboard → collect their people's emails → we provision seats.
> The reason it looked broken: the **enterprise lead-gen pages currently send people to individual signup**, not to /pricing — so you never saw the enterprise option. We're repointing those CTAs to /pricing now, and confirming the Team checkout price is live.
> **For your outreach today:** for enterprises, the email should say "reply here / book a call" (LOI route) — don't send a direct signup link, there isn't one for 25+. For small teams (5–25), you *can* send **align360.io/signup/team**.

---
_No code changed this turn (diagnosis only). Recommended fixes above are staged as descriptions; say the word and I'll ship #1 (CTA repoint) + relabel #4 on `feat/enterprise-signup-diagnosis`. Decisions for Samuel added to the needs list._
