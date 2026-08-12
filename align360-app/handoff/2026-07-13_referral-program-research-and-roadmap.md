# Referral program — research + roadmap
_For Will's ask (2026-07-13): "easiest way to start immediately with lightest lift, then best path to full robust referral program with actual payouts later." Alpha reward = credits, not money._

## TL;DR / recommendation
- **Start with a house-built v0** (staged this branch): every account gets a readable referral code + `align360.io/join?ref=CODE` link, attribution captured server-side, reward = **credits** granted when the referred user finishes their **first assessment**. It's a ~1–2 day build on top of the credit + Supabase auth systems you already have. Building this yourself is trivially cheaper than any tool and needs no money movement.
- **When you add real cash payouts (v1), do NOT build the payout plumbing** — adopt **Rewardful** (Stripe-native, ~$49–99/mo). It saves 3–4 weeks of Stripe Connect + tax + fraud work and is the industry default at your scale.
- **Design v0 so it can hand off to Rewardful later** (see "Build-vs-buy"). The v0 credit engine stays useful even after Rewardful runs the cash side, because credits ≠ money and Rewardful only handles money.

---

## ⚠️ Reconciliation with Samuel's spec (Slack pull, 2026-07-13)
**Samuel already wrote a referral program spec** (`Referral_Align notes.html` / `align360_referral_growth_program.docx`, DM'd to Will 7/10; he said "let your agent do the job for now"). It's a two-phase design — my v0 does **not** contradict it, it's the alpha-appropriate front end of it. Mapping:

| Samuel's spec | My plan | Note |
|---|---|---|
| **Phase 1 (Day 60–90):** referrer gets 1 free month; referred gets 20% off first month; no cash | **v1** | Requires a **paid tier** — can't run in alpha (alpha is free). |
| **Phase 2:** 20–25% commission, dormant behind a flag; triggers MRR>$50K + legal | **v2 → Rewardful** | Maps cleanly onto Rewardful's commission engine. |
| Refer-gates: paid + 30 days + **Conviction Score + Value Score** generated + opt-in | v1 gate | Alpha has no paid tier, so v0 relaxes this (see below). |
| Attribution: 30-day cookie, click→signup→paid, **GHL events** (referral_click→signup→converted→vested) | v0 has cookie+attribution; **GHL events = v1** | GHL = GoHighLevel; add the event emits at v1. |
| "CreditBalance auto-applied to billing" | ⚠️ **ambiguity** | Samuel's "credit" = *billing credit toward subscription*; Will's "usage credits" (Slack 7/10) = *AI metering credits* (what v0 grants). **Must reconcile — on needs list.** |

**Why v0 diverges from Samuel's Phase 1, and why that's correct:** alpha is **free** (no subscriptions), so "paid subscriber" gates, "1 free month," and "20% off first month" have nothing to attach to yet. Will's Slack direction — **"Easiest would be credits to start… you get more usage credits"** — is the deliberate alpha simplification. v0 = usage-credit reward, relaxed gate. Samuel's full gated/discount/commission design is the v1→v2 target and the roadmap below now mirrors it.

**The one thing to confirm before v0 ships:** does "credits" mean **usage credits** (v0 as built — Will's words) or **account/billing credit** (Samuel's doc)? Different systems. Flagged on the needs list.

---

## v0 — staged this branch (`feat/referral-program-v0`)
**Reward is credits, attribution is single-event (first assessment complete), money is not involved.** Nothing is applied or shipped — migration is staged, code is reviewable.

### What's built
- **`supabase/migrations/0010_referrals.sql`** (staged, NOT applied):
  - `referral_codes(user_id, code, custom, created_at)` — one readable code per account.
  - `referrals(id, referrer_user_id, referred_user_id, code_used, status, reward_credits, note, attributed_at, qualified_at, rewarded_at)` — status enum `pending / qualified / rewarded / voided`, one attribution per referred user (`referred_user_id unique`).
  - RLS: users read only their own code + referrals they made; all writes go through 4 `SECURITY DEFINER` functions (`referral_ensure_code`, `referral_set_custom_code`, `referral_attribute`, `referral_qualify_and_reward`). The reward grants into the existing `credit_balances.credits_topup` pool, reusing the idempotent pattern from `0009_topup_ledger.sql` — so the reward shows in the current "(+N)" balance UI with zero new balance plumbing, and replays never double-credit.
- **`lib/referral.ts`** (pure, no side effects): deterministic `referralCode(name, userId)` → e.g. `SAM-8F3K` (initials + 4-char Crockford base32 from a sha256 of the user id), `isValidCustomSlug` (3–20 chars, reserved-word blocklist so a slug can't shadow a route), `referralUrl`, `sharePrefill`.

### What's specified but NOT yet wired (deliberately — touches the live signup path; implement + verify next)
These are small and precise; I stopped short of wiring them blind because they mutate account creation and need a running-DB verification pass:
1. **Capture** — in `middleware.ts` (already runs on all routes), read `?ref=` on any landing hit and set a signed, httpOnly `a360_ref` cookie (30-day expiry). Never trust client state.
2. **Attribute** — in `app/auth/callback/route.ts` (where Supabase signups land), after the user row exists: call `referral_ensure_code(user, referralCode(name, user.id))` for the new user, and if the `a360_ref` cookie is present call `referral_attribute(user.id, cookieCode)` then clear the cookie.
3. **Qualify + reward** — in the first-assessment completion path (the profile/clarity generate route or wherever completion is recorded), call `referral_qualify_and_reward(referred_user_id, REWARD_CREDITS, ALPHA_FREE_ALLOWANCE)`. Idempotent, so it's safe to call on every completion.
4. **UI** — a "Your referrals" card on the account/dashboard shell (`app/_components/Shell.tsx` already shows the credit balance): code + `/join?ref=` link, copy button, share/email button (uses `sharePrefill`), and counts of pending/qualified/rewarded from a `select` on `referrals`. Optional one-time custom-slug field calling `referral_set_custom_code`.

### Decisions Samuel needs before v0 ships (added to his needs list)
1. **Reward size** — credits per qualified referral (`REWARD_CREDITS`). For scale: alpha allowance is **588 credits/mo**; a report costs a few credits. Suggest **100–250 credits/referral** as a meaningful-but-not-abusable grant. Samuel to set.
2. **Custom slug** — allow user-set slugs in alpha (one-time, no changes), or auto-code only for now? (Auto-only is the lighter lift.)
3. **Qualification event** — confirm **first assessment completed** = qualified. Alternatives: account created (too farmable), or a lighter "onboarding complete." Recommend first-assessment.

---

## Roadmap — v1 → v3 ("best path to full robust payouts later")

**v1 — real money (post-alpha).** Referrer earns a cash cut of the referred user's **first purchase** (SaaS norm: **20–30%** of first payment, or a flat $X). This is where you stop building: adopt **Rewardful** — it plugs into your existing Stripe, tracks referred subscriptions, and handles referrer payouts. What v1 needs regardless of build/buy: a **referrer payout account** (Stripe Connect Express if built in-house; Rewardful uses PayPal/Wise), a **T&C page**, and **US 1099 tax handling** above the threshold. Keep the v0 **credit** reward as a second, non-cash tier (e.g. credits for signups, cash for purchases).

**v2 — multi-tier / gamification.** Tiered rates (higher % for top referrers), leaderboards, milestone unlocks. New concerns: **FTC endorsement rules** — active promoters become "endorsers" and need disclosure; add an affiliate-disclosure requirement to the T&C. Rewardful supports tiered commissions; leaderboards you'd build on top.

**v3 — mature program.** Per-campaign custom links, cookie attribution windows, refund/chargeback clawbacks, custom per-referrer commission rules, a partner dashboard. At this point you're running a partner program, not a referral perk — **buy** (PartnerStack for agency/reseller partners, or stay on Rewardful/Tolt if it's still self-serve affiliates). Building this in-house is a multi-month commitment that isn't your core product.

---

## Comparable products
Approximate published pricing — **verify current tiers before committing** (SaaS pricing shifts; figures from 2026 comparison articles below).

| Tool | Best for | Approx. price @ your scale | Payouts | Build effort |
|---|---|---|---|---|
| **Rewardful** | Early/mid SaaS on Stripe | ~$49–149/mo, public pricing | via PayPal/Wise | Low — Stripe-native, hours to set up |
| **Tolt** | Early-stage SaaS, first program | ~$69 basic / $99 growth (auto-payout +2%) / $199 pro | auto (Stripe-based) | Low |
| **FirstPromoter** | Subscription businesses | revenue-capped tiers | yes | Low–med |
| **LinkMink** | Most Stripe-focused, cheapest | ~$39/mo | yes | Low |
| **PartnerStack** | Late-stage, agencies/resellers | demo-gated, substantially pricier | yes | Med — partner-program grade |
| **ReferralHero / Refersion / Impact** | Consumer referral / large affiliate networks | mid–high | yes | Med–high |

**Pick for Align360:** **Rewardful** at v1 (Stripe-native, right price, right stage). Revisit **PartnerStack** only if a reseller/agency channel appears at v3.

---

## Fraud considerations
- **v0 (basic, already mitigated):** single-event qualification is **first assessment complete**, not signup — raises the cost of farming. One attribution per referred user (DB unique). Self-referral blocked in `referral_attribute`. Credits (not cash) means fraud upside is low in alpha.
- **v1+ (cash):** add same-user detection (email/device/IP heuristics), a **hold window** before payout, and **refund/chargeback clawback** (void the referral, reverse the reward). Rewardful covers refund clawback.
- **v3:** device fingerprinting + cohort/velocity analysis for sockpuppet rings.

## Legal / tax (US)
- **1099** — paying referrers cash triggers IRS reporting; **1099-K/1099-NEC** thresholds apply above the annual limit. Rewardful/PayPal/Wise assist but you (the payer) own the obligation. Not a v0 concern (credits aren't income at grant).
- **Endorsement disclosure (FTC)** — once referrers actively promote, they're endorsers; require an affiliate-disclosure acknowledgment (v2).
- **Coaching/advice framing** — Align360 outputs are development/coaching, not regulated financial/therapeutic advice; keep referral marketing copy aligned with that positioning. No RIA angle unless the product changes.
- **T&C page** — needed at v1 (cash), not v0.

## Build-vs-buy call per stage
- **v0 (credits): BUILD** — trivial on your existing credit + auth stack; no money, no tax, no vendor. ✅ done this branch.
- **v1 (cash payouts): BUY (Rewardful)** — saves 3–4 weeks of Connect + tax + refund-clawback plumbing. Building Stripe Connect payouts in-house is the expensive mistake to avoid.
- **v2 (tiers/gamification): HYBRID** — Rewardful for commissions/payouts, build leaderboards/gamification on top.
- **v3 (partner program): BUY (PartnerStack)** — only if a reseller/agency channel emerges.

## Decision — v0 is throwaway (Will, 2026-07-13)
Will chose **throwaway**: v0 exists to run the alpha credit-referral, and we **port to Rewardful at v1** rather than grow v0 into a permanent house system. Implications:
- **Keep v0 minimal** — don't over-invest. The staged schema/lib are already lean; do not add house infrastructure (payout logic, tiers, dashboards) that Rewardful will replace.
- **Lean toward auto-code only** for alpha (skip the custom-slug path unless Samuel wants it) — less to throw away. `referral_set_custom_code` stays in the migration but the UI field is optional/deferrable.
- At v1, migrate the notion of "who referred whom" into Rewardful's tracking; the v0 `referrals` table becomes historical.
- Credits granted in v0 are already spent/consumed in-app, so nothing needs to migrate on the reward side.

---
### Sources
- [Top 10 Rewardful Alternatives 2026 — Partnero](https://www.partnero.com/articles/top-10-rewardful-alternatives)
- [Best Rewardful Alternatives 2026 — Affonso](https://affonso.io/blog/rewardful-alternatives)
- [Best Tolt Alternatives for SaaS 2026 — FirstPromoter](https://firstpromoter.com/blog/best-tolt-alternatives)
- [PartnerStack vs Rewardful — FirstPromoter](https://firstpromoter.com/compare/partnerstack-vs-rewardful)
- [Best Affiliate Software for SaaS 2026 — Hamster Garage](https://www.hamstergarage.com/article/best-affiliate-software-for-saas)
