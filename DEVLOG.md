# Align360 — DEVLOG

Running log of the Align360 app build. Newest section first. The app lives in `align360-app/` (Next.js 14, App Router, TypeScript). Repo: `github.com/wpreble/align360` (**public**).

---

## Assessment report PDF export fixed - was clipped to one page (2026-07-03)

PDF download on every results page is `window.print()` + a print stylesheet (browser "Save as PDF"; no library). The **combined-profile** (`/insights/profile`) and **clarity** (`/insights/clarity/[slug]`) reports print correctly: both import `result/profile.css`, whose `@media print` releases the app shell's one-screen clip (html/body `overflow:hidden` + `.center-col` = the `height:100dvh` scroll container -> `overflow:visible; height:auto`), hides chrome, and preserves the dark background via `print-color-adjust:exact`. The **assessment** reports (wiring/orientation/rejection) imported ONLY `report.css`, whose `@media print` hid the top bar and un-hid scroll-reveal blocks but did NOT release that clip - so their PDFs came out **clipped to a single page**.

Fix: mirrored profile.css's release into `report.css` `@media print` (`@page{margin:0}`; release html/body/`.app-layout`/`.center-col`; hide `.sidebar/.mobile-bar/...`; `.report{min-height:auto}`; `.report .chapter{page-break-inside:avoid}`; void `#070709` background + `print-color-adjust:exact`). Verified in-browser: applying the page's print rules to the wiring demo expands `documentElement.scrollHeight` **720px -> 5704px (~5 A4 pages)**, sidebar hidden, full-bleed dark preserved (print-simulated screenshot confirms). Profile + clarity independently confirmed to carry the `.center-col` release in print media.

Also set `.claude/launch.json` align360-test `autoPort:true` so the preview server runs on a free port when 3000 is taken by another project.

---

## Mobile-responsiveness audit + fixes (2026-07-03)

Full pass over the interface at phone widths (360-414px): a live sweep of every reachable page at 375px (zero horizontal overflow on landing, login, signup, onboarding, chat + drawer, assessment, insights, resources, frameworks, org, and the dense clarity report) PLUS a 7-dimension adversarial static audit (20 agents covering overflow, iOS input-zoom, touch targets, safe-area/dvh, grid collapse, overlays, word-break). Overflow, grid-collapse, and overlays came back clean, confirming the app is fundamentally well-built for mobile (viewportFit:cover, clamp() type, hamburger drawer, grid collapses at 600/700/760px). **12 real issues found and fixed; 3 audit findings rejected as false positives** (landing 100vh, two word-break claims that do not break at 390px).

Found in the live sweep:
- **`.org-err`** (org.css): a long error URL (Supabase/Stripe) could not wrap, forcing the page to 447px and clipping the Create button. Added `overflow-wrap:anywhere; word-break:break-word` (matches `.org-msg`).
- **`.ob-progress`** (globals.css): the 21 onboarding step-dots (262px) overflowed past the logo. Shrank dots/gap in the `@media(max-width:640px)` block so all 21 fit (`progRight` 387 -> 357).

Found + verified by the audit (all fixed):
- **iOS zoom-on-focus** (any input under 16px auto-zooms Safari): `.auth-input`, `.sub-input`, `.org-input` (incl. the role `<select>`), `.ch-edit` all bumped to 16px on mobile - matching the `.acct-field input` / `.ob-input` / `.composer-input` pattern already used elsewhere.
- **Safe-area / notch** (viewportFit:cover but ZERO `env(safe-area-inset-*)` in the codebase): the chat composer (`.chat-input-area`) and drawer footer (`.sidebar-foot`) sat under the home indicator. Added `calc(... + env(safe-area-inset-bottom))` to their bottom padding (0 on non-notched devices, so desktop unaffected).
- **Sub-44px touch targets**: remove-attachment x (`.attach-pill .x`, was ~14px) -> 32px hit area; org invite Copy link / Revoke (`.org-link`) -> 40px min-height; subscribe plan toggle (`.sub-seg-btn`, ~36px) -> 44px.
- **Word-break**: signed-in email in the account modal (`.acct-val`) could clip on long addresses -> `min-width:0; overflow-wrap:anywhere; word-break:break-word`.

Files: `app/globals.css`, `app/login/auth.css`, `app/subscribe/subscribe.css`, `app/org/org.css`. CSS-only; desktop unaffected (fixes scoped to mobile media queries or `env()` which resolves to 0 on desktop). Verified live/synthetically at 375px: computed input font-sizes now 16px, attach-x 32x32, `.acct-val` wraps, 0 overflow on all reachable pages, no compile errors.

---

## Internal team grandfathered to unlimited credits ("Team" classification) (2026-07-03)

Will: classify the founding team (Will, Samuel, Drew) as **Team** with **no credit limits** (grandfathered, unlimited). Reused the existing internal allowlist rather than a new plan.

- `lib/admin.ts`: renamed `ADMIN_EMAILS`/`isAdminEmail` to `TEAM_EMAILS`/`isTeamEmail` (the list already meant "internal team, unlimited + paywall bypass"). Added `drewcline168@gmail.com` (Drew) alongside `wllprbl@gmail.com` (Will). **Samuel is pending his Align360 sign-in email** (placeholder comment in the file) since it is not his crownedbowman/Workspace address by default and was not on record.
- Consumers updated: `lib/credit-metering.ts` (precheck returns unlimited, usage not metered), `app/api/access/status/route.ts` (now returns `plan: 'team', team: true`; `plan` is not consumed by the client, so this is a label only).
- `app/api/credits/status/route.ts`: new short-circuit returns `{ unlimited: true }` for team emails so the account panel shows **"Unlimited"** instead of a bounded ratio; `Shell.tsx` renders that and hides the Buy-credits row for team accounts.
- Mechanism is enforcement-agnostic: works whether `CREDITS_ENFORCED`/`BILLING_ENABLED` are on or off, so it stays correct when enforcement flips on. Server-side only, cannot be self-granted from the client. Typecheck clean.

---

## Settlement model confirmed: platform collects, manual payouts later (2026-07-02)

Will: the Connect 50/50 split is deferred indefinitely (not just until Samuel's live onboarding). Operating model for now: **Ascendance collects 100% on the platform account; Samuel is paid out manually, later, after AI costs are subtracted.** No code change needed (already platform mode).

For whoever runs the first settlement, the data is all captured:
- **Revenue**: Stripe (live) — MUST filter to Align360 products only (the ascendance.one account is shared with other business lines): products carry `metadata.brand = 'Align360'`; subscriptions carry `metadata.owner_type/owner_id`. Net of refunds + Stripe processing fees.
- **AI costs**: every metered AI call records actual cost as `cost_micros` (plus feature/model/tokens) via the `credit_charge` RPC (`lib/credit-metering.ts` → Supabase). Period AI cost = SUM(cost_micros)/1e6. Top-up purchases already carry margin (`USD_PER_CREDIT_SELL`).
- **Open at first settlement**: the exact split base (e.g. 50% of net-after-AI-costs vs another formula) — decide with Samuel then. A `scripts/settlement-report.ts` can be built when the first payout approaches.

---

## Individual pilot repriced $49 → $25 (2026-07-02, after go-live)

Will: the pilot individual price is **$25/mo** (decision from the LOI thread with Samuel; supersedes the one-pager's $49 that the code was built from). Org stays $19/seat.

- `lib/billing/tiers.ts` 4900 → 2500 (+ provenance comment); `app/subscribe/page.tsx` displays $25.
- **Credits allowance HELD at 588** (`lib/credits.ts` comment): the 12% guardrail formula would drop it to 300 at $25, which would silently shrink every alpha user's AI allowance (ALPHA_FREE_ALLOWANCE derives from it). Held at the $49-equivalent (~24% AI share at $25, GLM keeps it cheap); flip to `monthlyCreditsForPlan(2500)` if margins demand. WILL'S CALL.
- `scripts/stripe-setup-products.ts` now REPRICES on amount mismatch: creates the new price with `transfer_lookup_key: true`, deactivates the old one, refreshes branding (existing subscriptions keep billing on their old price; new checkouts get the new amount). Ran on TEST (new `price_1Tob8pBLDgd8WUrQvoiAw8j3`) and LIVE (new `price_1TolSOBLDgd8WUrQemjKWCVI`, old `price_1ToaY6...dWCYoYuU` deactivated); live verified via API: individual $25 active, org $19 active. Reprice-before-deploy ordering so no window showed a lower price than Stripe charged.

---

## Scoring rubric LOCKED + measurement parity with Samuel's canonical results (2026-07-02)

Samuel's email: app results differ from his original Claude results on the same answers. Diagnosed (hand-scored his exact answers through our engine + read the gov-doc scoring rubric), then locked a canonical rubric behind a permanent parity test.

**Root cause.** Impact Readiness + Value Spectrum overall scores already matched (deterministic 0/3/7/10; 86 Convicted + 92 Authentic Rockstar). WFI/OFI/RGF diverged because his originals were **LLM-judgment-scored** — the gov-doc rubric is written for a 1-5 Likert instrument, not the multiple-choice format, so the original Claude session improvised numbers no formula (or re-run) can reproduce (e.g. "Organizer 78 primary" when the raw tally favors Realist). Fix = agree one repeatable rubric, not chase the old numbers. Detail in memory `align360-pending-samuel-feedback.md`.

**Canonical rubric encoded (approved — Will on #1; Samuel by email "yes for both" on #2/#3):**
- **#1 Wiring leader scale 88 → 78** (Samuel's standard), in BOTH engines so surfaces agree: `report-scoring.ts` `rankStrength` (dim cutoff rescaled 50→44) and `scoring.ts` `rank(wCounts, 78)` (combined profile).
- **#2 Compound-tag weights**: secondary gift 0.6 → **0.5** (gov doc: 50%), both engines. **Confidence bands** now gov-doc: Blended Primary at gap ≤ 5, Clear Primary at gap ≥ 7 (`report-scoring.ts`; orientation `blended` 8 → 5).
- **#3 Rejection story archetype** now derives from the user's own **film-narrative-arc answer** (its category tag), not the overall primary — so Samuel's Perspective-primary result correctly carries "The Misunderstood Visionary" (from his Creativity film-arc pick). Falls back to the primary-category map when Q11 is unanswered.
- **Domain-tile rounding fix** (`clarity-scoring.ts` `clamp100` → round-half-to-even): the deployed `Math.round` turned Samuel's 92.5 IR domains into **93** and 77.5 into 78; his canonical shows **92 / 78**. Banker's rounding is the only simple rule reproducing both (92.5→92, 77.5→78). A real IR domain-tile discrepancy the overall-only check had missed; overall/AI-Era unaffected (no .5 values).

**Locked with a parity test** — `align360-app/scripts/parity-check.ts` runs Samuel's exact answers through all five assessments and asserts the canonical numbers (Wiring Realist 78 / Doer 59 / Organizer 59 / … Clear Primary, both engines identical; Orientation Builder 42 / Truth-Seeker 38 Blended; RGF Perspective 44 / "Paradigm Challenger" / "Misunderstood Visionary"; IR 86 Convicted, domains 92/92/92/78/75, AI-Era 94; VS 92 Authentic Rockstar). Green. Any future engine change that breaks parity fails loudly (`npx tsx scripts/parity-check.ts`). tsc + production build pass.

**Still open (non-blocking):** the Doer/Organizer 59-tie secondary NAME (both engines agree on numbers; tie-break rule unspecified) and 4 answer→tag deltas vs Samuel's refined-questions doc (WFI Q4-A, Q12-C; OFI Q6-A, Q11-E — content-file tags, a separate audit). NOTE: reports cache client-side — Samuel must tap **Regenerate** to see new numbers on an existing report.

---

## Stripe IS LIVE: platform-mode go-live executed (2026-07-02)

Align360 can now take real money. Executed on the **ascendance.one platform account** (`acct_1GbCOoBLDgd8WUrQ`) in PLATFORM mode (no Connect: live mode has zero connected accounts; Samuel's is test-only). Secrets hygiene: the live sk was never typed, displayed, or logged — every step piped it from Will's clipboard (`$(pbpaste)`) or from a shredded scratch file.

- **Live products created** via `scripts/stripe-setup-products.ts --live --confirm`: `a360_individual_monthly` → `price_1ToaY6BLDgd8WUrQdWCYoYuU` ($49/mo, product `prod_UoCyVMx5daNiad`) and `a360_org_pilot_seat_monthly` → `price_1ToaY6BLDgd8WUrQbqM15hXD` ($19/seat/mo, product `prod_UoCyzkiuEFVi4V`), both with ALIGN branding (mark image, `ALIGN360` statement descriptor). Account-level branding deliberately untouched (shared services account, 22+ unrelated products).
- **Live webhook endpoint** `we_1ToafEBLDgd8WUrQAAg6V8P9` → `https://align360-app.vercel.app/api/stripe/webhook`, enabled, 4 events (checkout.session.completed + customer.subscription.created/updated/deleted).
- **Vercel env split by environment** (old single Preview+Production records were sensitive/unpullable, so they were rebuilt): **Production** = live sk + live pk + live whsec; **Preview** = test sk + test pk restored from `.env.local` (preview whsec intentionally dropped — it was inert, webhooks only ever pointed at prod; recreate a test endpoint if preview webhook testing is ever needed). Preview adds required the Vercel REST API (CLI `env add <name> preview` demands an interactive branch answer). `STRIPE_CONNECTED_ACCOUNT_ID` stays UNSET in prod → checkout code runs platform charges, no application fee.
- **Deployed**: empty commit `b7c65e2` → fresh Production build (pk is build-inlined) → ● Ready; site 200, auth gating intact.
- **Remaining human steps**: (1) Will: one real $49 checkout end-to-end, then refund it in the dashboard. (2) Re-confirm pilot pricing against the Jun-29 LOI before first org sale. (3) MIGRATION TO THE 50/50 SPLIT: Samuel must complete LIVE Connect onboarding on Ascendance; then set `STRIPE_CONNECTED_ACCOUNT_ID` (+ fee percent) in Vercel prod, re-run the setup script `--live --confirm` against his account (Direct Charges = objects live on the connected account), and redeploy. Until then Samuel's share settles out-of-band.

---

## Final QA pass + Stripe go-live prep (2026-07-01)

Pre-launch sweep before switching Stripe to live. Fixes:

- **Chat no longer promises 19 Wiring questions.** Q16-19 / Section F were removed from the live assessment on 2026-06-26, but the AI content still instructed 19: `System Prompt.md` §12.2 + §13 (now 15, with an explicit "do not administer" note), `Knowledge File — Part 1.md` count table + 36-question note, `AI-Era Calibration Addendum.md` Part C (both mentions), and `ProScan Addendum.md` §5.1.1 (marked **DORMANT**, spec retained). This was visible in Samuel's chat snippets ("19 questions, 15 core + 4 about how you operate under pressure").
- **Orientation naming corrected in the Knowledge File**: the five orientations are **Truth-Seeker / Builder / Explainer / Supporter / Starter** (per the assessment file + `lib/report-scoring.ts`); the stale "Analytical/Relational/Practical/Strategic/Imaginative" list is marked obsolete. NOTE: Samuel's DesignSuite collateral PDF still shows the old list — flagged to Will (his collateral, not app code).
- Removed `content/AI Model/Chat Delivery Style 2.md` (untracked byte-identical duplicate of the first-pass voice layer, superseded by Samuel's brief; git history retains it at `e71dca7`).
- **Stripe go-live enabled in tooling**: `scripts/stripe-setup-products.ts` now accepts sk_live_ keys behind an explicit `--live` flag (still refuses live without it; dry-run stays the default). `.env.example` updated: live keys are sanctioned (2026-07-01) and belong in Vercel only. Pricing confirmed against the latest reachable source (`align360_alpha_pilot_onepager`, 2026-06, encoded in `lib/billing/tiers.ts` commit ff4836b): **Individual $49/mo** (public $99 later, alpha grandfathered), **Team Alpha Pilot $19/seat/mo, min 5 seats**; sales-led commercial tiers ($3k-$10k flat + seats, Founders Circle $35/seat) stay invoice-based, not self-serve. The Jun-29 LOI lives in Will's direct thread with Samuel (not reachable from tooling) — pricing to be re-confirmed against it before/at first org invoice.

---

## Results-page rubric alignment: anti-drift lock + Value Spectrum 8-stage ladder + Conviction mini-row (2026-07-01)

Samuel: the results pages weren't following the rubric, and the same answers yielded different results. Diagnosed by diffing the app against the hand-built Drive templates (folder `15UbTRCB8-uj-WOBe0plhFK76w9RT-FYa`), then aligned:

- **Anti-drift lock** (`lib/storage.ts` `hashAnswers`; `app/insights/clarity/[slug]/page.tsx`; `app/insights/profile/page.tsx`): reports now cache keyed by a hash of the answers that produced them. Identical answers always return the same first-generated report (retaking with the same answers no longer yields a new narrative); changed answers invalidate and regenerate. Root cause of "same answers, different results" was the LLM narrative + the ~100%-generated combined profile regenerating on first-visit / Regenerate / cleared storage / new device — the *scores* were always deterministic. (Full cross-device determinism still needs server-side report storage; that's the localStorage→cloud track.)
- **Impact Readiness hero** (`ClarityReport.tsx` + `clarity.css`): domains now render as **%** and a **Primary Gap n/10** tile was added (amber accent), matching the template. This is the previously-parked "conviction mini-row"; scoped to impact-readiness (Value Spectrum frames its lows as "refinements").
- **Value Spectrum 8-stage ladder** (`lib/clarity-scoring.ts` + `ClarityReport.tsx`): the ladder now renders the template's 8 narrative stages (Inferiority Complex → Impostor Pattern → … → Authentic Rockstar) instead of the 5 numeric bands. Added `ladderNow` (current node index) decoupled from `level.index`: Impact Readiness tracks the band index with Impact as a goal node (`progressionGoal: true`); Value Spectrum places the score across the 8 stages (~12.5 pts each, so 92 → Authentic Rockstar). The headline level still comes from the 5 bands (no regression).
- Bands confirmed: the app's canonical 20-pt bands are correct; the Drive HTML mockups' inline JS thresholds were looser (app wins).
- Verified: tsc + production build pass. Live visual pending the deploy (local dev port was occupied by another process).
- **Deferred (need Samuel's spec / narrative-prompt work):** Value Spectrum's "refinements (the four 7s)" section framing + the "perfect score" highlight when a dimension hits 100; and deterministic scaffolding for the combined profile (its Drive "Full User Model" spec was too large to fully extract this pass).

---

## Chat voice: fold in Samuel's Master Chief prompt brief (prose-first) (2026-06-30)

Samuel sent a formal "Master Chief System Prompt Brief" (6 blocks). Folded it into the chat-only voice layer (`content/AI Model/Chat Delivery Style.md`), building on the 2026-06-29 pass. Main upgrade: a hard **format prohibition** — default to natural prose, NO bullets / numbered lists / bold headers / sub-labels unless the user explicitly asks. (The first pass reduced verbosity but GLM still emitted bulleted "decks"; this kills that.) Also tightened per his blocks: capability-gap = one-sentence acknowledgment + a single recommendation (no options menu); user-model grounding names the specific fields (Conviction Score, Wiring, Value Spectrum, Release Threshold, active tensions); closing = at most one earned question. Verified against Samuel's Before/After benchmark via the GLM A/B — casual 116 tok, decision 210 tok, "Run Impact Pathways" 299 tok — all pure prose, one closing question, grounded in the profile, one-sentence gap ack.

Also adopted Samuel's Block 1 name: in chat the assistant is now **Master Chief** (the AI intelligence layer of Align360). Set in the chat layer only, so report/profile generation keeps the "Align360" identity from `System Prompt.md` §1. Behavior is unchanged; it is a persona name.

---

## Chat precision: concise chat-only voice layer + GLM-vs-OpenAI A/B (2026-06-29)

Samuel's chat feedback: primitive, too chatty / lacks precision, jargon, "not connected to user model." Root-cause diagnosis is in memory `align360-chat-precision.md`; this entry is the build. Scope was the **chat conversationally** (per Will: "I understand the results page stuff, I meant the chat").

- **Chat-only voice layer** (`content/AI Model/Chat Delivery Style.md`, read by `lib/system-prompt.ts` `chatDeliveryStyle()`, appended in `app/api/chat/route.ts` after the base prompt and before the user profile): lead with the answer; match length to the message; drop the mandatory 5-element Context/Insight/Options/Tradeoffs/Reflection structure for ordinary turns; no closing reflective-question ritual; plain language (bans invented jargon like "clarity broker" / "Grounded Visionary"); and NEVER narrate backend/tool status (no "not loaded" / "still being built"). Applied to chat ONLY — report/profile generation is untouched, so nothing there regresses.
- **Param tuning** (`lib/ai.ts` `genParams` gains an optional `temperature`; the chat call is now `maxTokens 1500` (was 3000) + `temperature 0.5`). Temperature is applied on the OpenRouter/GLM path only — gpt-5.5 rejects non-default temperature, so the OpenAI/attachment path is left untouched.
- **GLM-vs-OpenAI A/B (real calls, local keys).** GLM 5.2 is NOT the bottleneck; the old prompt was. Old GLM: 510-722 completion tokens, 13-28s, forced report structure. New GLM (with the layer): casual 202 tok / 5s, job-decision 426 tok, "Run Impact Pathways" 416 tok with zero backend narration. GLM-new matches gpt-5.5 on quality and beats it on latency, so we keep GLM 5.2 (margins + open-source preference).
- Verified: tsc + production build pass; a live GLM run confirms the new voice and the "Run Impact Pathways" backend-leak fix.
- Not in this build (chat was the priority): the results-page jargon in `lib/profile.ts` / `lib/clarity.ts` (the "Evocative Two-Word Archetype" / "evocative" headline instructions) stays for the separate results-page A360 track. The chat layer already bans that jargon in conversation.

---

## Align to A360 standard: progression ladder rubric + 4-card profile sections (2026-06-27)

The two *unambiguous* items from Samuel's standard mockups (where the target was exact). Commit `444bb1e`, live.

- **Impact-Readiness progression ladder** (`lib/clarity-scoring.ts` + `app/insights/clarity/[slug]/_components/ClarityReport.tsx` + `app/insights/clarity/clarity.css`): the ladder strip now reads **Insecurity → Awareness → Clarity → Alignment → Conviction → Impact**, with Impact as a dark "goal" node. Implemented via a new `progression` array on the impact-readiness config that drives the ladder display, *decoupled* from the scoring `bands` that drive the headline level — so a score of 86 still reads "Convicted" (no headline regression) while the strip shows the noun stages. Verified live: all-D answers render the exact 6-node ladder, Conviction as "now", Impact as the dark goal.
- **Combined-profile card counts** (`lib/profile.ts`, `PROFILE_SCHEMA_B`): legacy / AI-era / irreplaceable bumped 3 → **4** so the AI-era opportunity list and the capabilities 2×2 fill out (no empty 4th cell). Renderers already map all items; the grid is 2-col. Not live-verified (GLM-generated; GLM is loose on exact counts — if a regen ever shows 3, we'll need stricter enforcement). `fallbackProfile` still carries 1 each (degraded path only).
- **Still parked** (need Samuel's spec/files, do NOT guess): the Clarity **conviction mini-row** (his standard shows ~4 domains with percentages + a PRIMARY GAP (n/10) tile; ours shows 6 domains without %), and the **broader 1-7 deliverable comparison** vs the A360 standard. Tracked in memory `align360-pending-samuel-feedback.md`.

---

## Wiring Q16-19 removal + loader/onboarding polish + pending Samuel feedback (2026-06-26)

- **Wiring for Impact → 15 questions** (`content/Assessments/Wiring for Impact.md`): removed Section F (Compressed Mode Detection, Q16-19) + its governance section per Samuel; header already said 15; scoring uses only Q1-15 gift tags. Verified the runner shows "1 of 15". His one prioritized ask — he's retaking.
- **Report loader fixes**: the orbit animation only showed on result pages because `.genx`/`.gen-pulse` lived in `result/profile.css`; the per-assessment report page imports only `report.css`. Moved the shared loader styles to `globals.css` (loaded everywhere) so `GenLoader` animates on the report page too, desktop + mobile. (Earlier: `.report`/`.report-gen` set to `width:100%` so the loader stops collapsing to a narrow strip.)
- **Onboarding first read**: bigger, more readable type (heading 40px, lead/second paragraph both 23px with the second italic instead of small/secondary), bigger primary-wiring card (fills width, name 58px), name capitalized.
- **PENDING — Samuel's "align to the A360 standard" pass (1-7)**: parked until he sends the consolidated list + reference files. Tracked in memory `align360-pending-samuel-feedback.md`. (UPDATE 2026-06-27, see entry above: the two unambiguous items — the Impact-Readiness progression rubric and the combined-profile 4-card sections — shipped in `444bb1e`. Still parked: the Clarity conviction mini-row domains/percentages/PRIMARY GAP, and the full 1-7 comparison.)

---

## Fix chat file/image upload under GLM (attachment-aware model routing) (2026-06-26)

Uploading an image or PDF in chat 502'd ("the assistant could not complete that request"). Root cause: chat runs on GLM via OpenRouter (`CHAT_MODEL=z-ai/glm-5.2`), but images are sent as `image_url` and PDFs as an OpenAI Files `file_id` — GLM/OpenRouter can read neither (server log: `400 You uploaded an unsupported image`).

- **`app/api/chat/route.ts`**: detect whether any message carries an `image_url`/`file` part. If so AND `OPENAI_API_KEY` is set, route that request to OpenAI (`OPENAI_MODEL`, gpt-5.5) which supports vision + the Files API; text-only chat stays on cheap GLM. If no OpenAI key, the GLM path now FLATTENS attachment parts to the text plus a short note ("attached an image you can't view — ask them to describe it") instead of 502ing.
- Verified live against the real keys: text-only → GLM returns fine; a canvas-generated image → routed to gpt-5.5, which read the image and returned its text. DOCX/plain-text uploads were already inline text (unaffected).
- **Requires `OPENAI_API_KEY` in Vercel** for image/PDF analysis to actually work (it's the vision/Files provider); without it, attachments degrade gracefully rather than erroring.
- Streaming note: yes, OpenRouter/GLM support SSE streaming (`stream:true`); the app currently awaits the full response. Adding token streaming is a separate enhancement (route returns a stream; client consumes it) — not done here.

---

## Organization signup flow + report header bar fix (2026-06-26)

- **Org signup**: `/subscribe` now has an Individual vs Organization choice (segmented control). Individual = the existing $49 checkout. Organization opens a longer form (org name, contact name, work email, seat stepper with a live `$19 × seats /month` total, min 5), then `createOrg(name)` (existing `create_organization` RPC, makes you the owner) → `/api/stripe/checkout` `mode:'org'` with `{orgId, seats, contactName, contactEmail}` → Stripe → success lands on `/org/[id]` to invite the team and assign seats.
- **Checkout route**: the org branch now sets the Stripe customer's name/email from the contact fields (control-char stripped).
- **`/api/stripe/sync`** now reconciles ORG subscriptions too (orgs the user owns/admins), not just personal — so org access self-heals from Stripe without the webhook, same as individuals.
- **Report header bar**: replaced the right-bunched toolbar with a sticky bar — Back (← Insights) on the LEFT, Regenerate/PDF on the right — that stays clear of the app sidebar. (Earlier same-day: fixed the generation loader collapsing to a narrow strip — `.report`/`.report-gen` are now `width:100%`, since `margin:0 auto` on a flex item shrinks it to content.)
- Verified: tsc + production build pass. The org form + paywall render only for an authenticated, unsubscribed session (middleware-gated), so the visual is user-verified on deploy; the report header bar was verified live (back on the left at the report's left edge, clear of the sidebar).

---

## Credit top-ups self-heal without the webhook (2026-06-25)

Made buying credits work even with no Stripe webhook configured, mirroring the subscription sync.

- **`0009_topup_ledger.sql`** (new, apply after 0008): `credit_topups` ledger keyed by Stripe checkout session id; `credit_grant_topup` gains `p_session_id` as the first arg and claims each session once (insert-on-conflict-do-nothing), so the webhook AND a reconcile sync can both call it without double-granting.
- **`app/api/stripe/sync-credits/route.ts`** (new): lists the user's Stripe checkout sessions, and for each PAID `kind=topup` session calls the idempotent grant. No webhook needed.
- **Webhook**: top-up grant now passes `p_session_id` (shares the ledger idempotency with the sync).
- **Shell**: reconciles top-ups via `/api/stripe/sync-credits` on return from checkout (`?topup=success`) and whenever the account menu opens (covers "paid, closed the tab"), then refreshes the balance.
- Verified: tsc + build pass. Full purchase still user-tested on deploy. **Apply 0007 + 0008 + 0009** in Supabase for credits to work.

---

## Fix subscribe loop (subscribed → bounced back to /subscribe) + sign-out redesign (2026-06-25)

- **Subscribe loop**: access was gated on a local `subscriptions` row that only the Stripe webhook writes, so a completed checkout whose webhook had not landed (or was unconfigured) left the user bounced back to `/subscribe`. Made activation authoritative:
  - **`app/api/stripe/sync/route.ts`** (new): for the signed-in user, looks up their Stripe customer (written synchronously at checkout) and pulls live subscriptions directly from Stripe, upserting them into `subscriptions`. Returns the resulting access. No webhook dependency.
  - **Subscribe page**: on load, calls `/api/stripe/sync` first (then `/api/access/status`); redirects into the app if access is granted, with a brief "Checking your account" state so subscribers never see the paywall flash. This self-heals an already-stuck subscription.
  - **Shell billing gate**: before redirecting to `/subscribe`, reconciles via `/api/stripe/sync` and only paywalls if still no access — so the post-checkout redirect lands in the app instead of bouncing.
  - **`access/status`**: switched the user-subscription lookup from `.maybeSingle()` (throws on >1 row) to an array + `some(active)`, robust to re-subscribes.
  - The webhook stays as the source of truth for ongoing status changes.
- **Sign-out UX**: moved sign-out out of the buried middle-of-list row into a distinct, icon-labeled button in the account-menu footer next to Done (danger-tinted on hover); shows "Sign in" when signed out. New `.acct-foot` / `.acct-signout` styles.

---

## Credit top-ups — buy more credits in test mode (2026-06-25)

Built the "buy credits" purchase flow (was missing — only subscription checkout existed). One-time Stripe `payment` checkout → webhook grants credits to a persistent pool that does NOT reset with the monthly allowance.

- **`supabase/migrations/0008_topups.sql`** (new, MUST be applied in the Supabase SQL editor, after 0003 + 0007): adds `credit_balances.credits_topup`; rewrites `credit_status` (remaining = monthly-left + top-up pool; returns `topup`; must drop/recreate since the return shape changed) and `credit_charge` (consumes the monthly allowance first, overflow draws down the top-up pool; the monthly reset preserves the pool); adds `credit_grant_topup(owner_type, owner_id, credits, allowance)` (SECURITY DEFINER, granted to service_role) called by the webhook.
- **`lib/credits.ts`**: `CREDIT_PACKS = [500, 1500, 5000]` (at $0.03/credit → $15/$45/$150) + `isValidPack`.
- **`app/api/stripe/topup/route.ts`** (new): auth'd `payment`-mode checkout with inline `price_data`, reuses/creates the Stripe customer, metadata `{kind:'topup', owner_id, credits}`, success/cancel back to `/chat?topup=…`.
- **`app/api/stripe/webhook/route.ts`**: `checkout.session.completed` now branches — a paid `topup` session calls `credit_grant_topup`; otherwise the existing subscription path. Idempotent via the `stripe_events` dedupe.
- **`app/api/credits/status/route.ts`**: returns `topup`. **Shell** account menu: "Buy credits" (signed-in only) expands a pack chooser → posts to the top-up route → redirects to Stripe; the monthly-credits row shows `(+N)` for the pool; balance re-fetches on `?topup=success`.
- Verified: tsc + production build pass; account modal renders cleanly (Buy credits is correctly hidden when signed-out). **Manual steps to make it live-functional:** apply 0007 + 0008 in Supabase; ensure Stripe **test** keys + a webhook sending `checkout.session.completed` (+ `STRIPE_WEBHOOK_SECRET`) are set in Vercel. Full purchase flow is user-tested on the deployed app (Stripe + auth can't run in the local headless preview).

---

## Chat polish — AI avatar, copy button, table overflow, mid-generation chat switch, themed loader (2026-06-25)

- **AI message layout** (`app/chat/page.tsx`): assistant messages now render as a row of [Align360 logo avatar] + [bubble + actions]. The typing indicator gets the same avatar. New `.msg-row.ai` / `.msg-avatar` / `.msg-col` / `.msg-actions` styles in `globals.css`. The avatar reuses `<AlignMark/>` (fig on light, white on dark).
- **Copy button**: each AI response has a Copy control (clipboard API with an `execCommand` fallback so it works in restricted contexts) that flips to "Copied" for 1.6s.
- **Markdown tables no longer clip** (`lib/markdown.ts` + `globals.css`): tables are wrapped in `.md-table-wrap` (`overflow-x:auto`), cells wrap (`white-space:normal` instead of `nowrap`), and the message column is `min-width:0` so a wide table scrolls inside the bubble instead of overflowing the page. Verified live with a 3-column long-cell table + list + bold.
- **Switching chats mid-generation** no longer leaves the new chat stuck "thinking": added `pendingIdRef` (the chat id with an in-flight response). `sendText`'s `finally` clears it regardless of which chat you're viewing, and the chat-switch effect recomputes `sending = (pendingIdRef === loadedChatId)` — so a non-generating chat shows an enabled composer and no spinner, and returning to the generating chat shows the spinner until it resolves (its response is persisted either way).
- **Loader light/dark** (`app/result/profile.css`): the shared `.result-gen` surface was hardcoded dark (`#0D0A14`); it now follows the app theme (`var(--bg-body)` / `var(--text-secondary)`), and `.genx-msg` inherits its container color. The always-dark immersive reports keep their own dark `.report-gen`. Verified light (bg `#F4F2F3`, dark text) and dark (bg `#110319`, light text).
- Verified via the local preview (GLM live): avatar, copy, table wrap/fit, and the themed loader in both modes. The mid-generation switch fix is verified by logic/trace (the headless preview reports `innerWidth:0` and does not perform client-side `<Link>` navigation, so the exact UI repro could not run there).

---

## Per-assessment dark immersive reports — Wiring / Orientation / Rejection Gift (2026-06-25)

Each of the three CORE assessments now has its own full result page, separate from the combined profile, rebuilt natively from the Drive reference designs (`feelinglikechocolate` HTML: `1. Samuel__WFI REsults.html`, `1.2. OFI`, `1.3. RGF`). Dark, immersive, scroll-driven, with a **distinct color world per assessment** (Wiring = gold, Orientation = teal/blue ocean, Rejection = plum nebula). User-chosen direction ("dark immersive, per-color"). The combined profile stays separate at `/insights/profile`.

- **`lib/report-scoring.ts`** (new): deterministic scoring for ranked-tag assessments. Wiring → 9 gifts strength-scaled (leader ≈ 88); Orientation → 5 orientations share-scaled (sums ≈ 100); Rejection → 5 gift CATEGORIES (share) + a dominant SIGNATURE TRAIT (tag parts that are not one of the 5 categories and not a wiring gift) + story-archetype hint. Confidence bands, answered/total, `answersNarrative()` for the prompt. Tag tally restricted per universe so strays (e.g. `Doer` in an orientation compound tag) are excluded.
- **`lib/report.ts`** (new): three narrative shapes (Wiring/Orientation/Rejection), per-assessment AI schemas, deterministic fallbacks, and `mergeNarrative()` (model-over-fallback, fixed-length lists rebuilt by index so partial/thin JSON can never blank a section). `REPORT_CONFIG` (eyebrow roman, completion step, accent). Client-safe (only `import type` from report-scoring, so it never drags `node:fs` into the bundle).
- **`app/api/assessment/generate/route.ts`** (new): POST {slug,name,answers,demo?} → score → GLM (REPORT_MODEL via OpenRouter, reasoning off, ~one retry on empty) → merge over fallback → `deepStripDashes`. 402 on out-of-credits, fallback when no key. Added to `next.config.js` tracing. Name sanitized for control chars **and** em/en dashes (house style).
- **`app/insights/assessment/[slug]/`** (new): client page shell (loading/generating/empty/unknown/error, in-flight dedupe, localStorage cache `align360:report:<slug>`) + `report.css` (one themeable dark sheet, every selector scoped under `.report`, per-color via `[data-assessment]`) + renderers `WiringReport` / `OrientationReport` / `RejectionReport` + shared `report-bits` (reveal-on-scroll, bar-grow, PSR trio, completion tracker, chrome). Reuses the app's existing Cormorant/Cinzel/Crimson fonts.
- **Wiring**: `storage.ts` report cache (`get/set/clearAssessmentReport`); `Runner.tsx` core finish clears the cached report + combined profile and routes to `/insights/assessment/<slug>`; Insights core cards link to the per-assessment report (combined profile still reached via the hero CTA).
- **Verified live** (GLM): all three render with real generated content + correct per-color theming, on desktop and mobile (radar labels fit, grids collapse). Routing, completion tracker (33/66/100 + "View combined profile" at 100%), controls, and the reveal animations all work.
- **Adversarial review** (multi-agent workflow, 4 dimensions → verify): fixed the 6 confirmed real issues — index keys on AI-generated string arrays (energy tags, advantage envs, starfield), the name sanitizer not stripping em/en dashes, the rejection-parallels merge borrowing a mismatched fallback by index, and the no-key/error fallback paths bypassing `deepStripDashes`. Spawned a follow-up to apply the same name/fallback dash fix to the older clarity + profile routes.
- **NOT done**: the new per-assessment reports cache to localStorage only (not yet cloud-synced like clarity/combined); the Orientation "Wiring × Orientation" matrix is AI-written, not yet cross-referenced against the user's actual wiring scores.

---

## Clarity Layer appended to the combined profile (2026-06-08)

Integrated the Clarity Layer results into the full identity report. A new `ClarityLayerSummary` is appended below `CombinedProfile` on `/insights/profile`: for each Clarity assessment the user has **completed**, a card shows its score (Conviction/Value Score, color-coded by band), level, and domain mini-scores, linking to the full report. Assessments that are not done simply do not appear, so completed ones "pop in" as they are finished. Styled in `clarity.css` with the profile's Black Cherry Fig palette so it blends with the dark document. Reads `getClarityAnswers`/`getClarityReport` from storage (client-only, no scoring on the client), refreshes on `STORE_EVENT`. Verified: combined profile + appended Impact Readiness card (86 Convicted) render together, no console errors, build passes.

Possible follow-up: also feed completed Clarity scores into the chat context (`buildProfileContext`) so the AI knows them, not just the report.

---

## Clarity Layer scored result reports + AI analysis (2026-06-08)

Built the full scored-result pipeline for the two Clarity Layer assessments, mirroring the existing combined-profile architecture (deterministic scores → gpt-5.5 narrative → result page).

- **`lib/clarity-scoring.ts`** (new): deterministic numeric scoring. Option points (0/3/7/10) → sub-scores (0-10) → domain + overall scores (0-100, clamped), five-band level ladders (Impact Readiness: Insecure→Convicted; Value Spectrum: Inferiority Complex→Authentic Rockstar), AI-Era subset (Impact Readiness only), primary gap (lowest sub), strengths (subs at 10). `isClaritySlug()`. Verified: all-A=0/Insecure, all-D=100/Convicted, partial answers score unanswered as 0.
- **`lib/clarity.ts`** (new): `ClarityNarrative` type, `claritySchema(scores)` (interpolated labels JSON-escaped), `fallbackClarityNarrative()` so the report renders with no API key.
- **`app/api/clarity/generate/route.ts`** (new): POST {slug,name,answers,demo?} → score, gpt-5.5 (json_object, reasoning_effort low, ~45s), **field-by-field merge** over the fallback (`mergeNarrative`) that rebuilds domains/subs from the authoritative score labels so a partial/label-drifted model response can never blank a section. deepStripDashes, fallback-safe. Added to `next.config.js` outputFileTracingIncludes.
- **`app/insights/clarity/[slug]/`** (new): result page (cache via `getClarityReport`/`setClarityReport`, else generate) + `ClarityReport` component + `clarity.css` (self-contained palette, adapted from the Drive report). Sections: score hero + progression ladder, domain cards with color-coded sub-bars, granular signals with per-signal AI insight, primary-gap card (with the practice that closes it), strengths, AI-Era card (omitted for Value Spectrum), severity/source/velocity diagnostic, CTA. Headline rendered via `dangerouslySetInnerHTML` is sanitized to allow only `<em>`. Partial-answer banner when answered < total.
- **Wiring**: `storage.ts` clarity report cache + `clearClarityReport`; `Runner.tsx` routes Clarity finishes to `/insights/clarity/<slug>` and clears that report (leaves the core profile untouched); Insights Clarity cards show "View result →" (+ Retake) when done.
- **Verified live**: Impact Readiness 50/100 "Discovering" (with AI-Era 88) and Value Spectrum 47/100 "Emerging Worth" (no AI-Era) both render fully with real gpt-5.5 analysis; merge confirmed to produce complete narratives; no console errors; production build passes.
- **Adversarial review**: ran a multi-agent review workflow over the new code (4 dimensions → verify). Fixed the confirmed real issues: the shallow-merge data-loss bug (the big one), `bandFor` out-of-range mapping to the wrong band, unescaped schema labels, headline XSS surface, AI-Era regex breadth, name length, partial-answer UX. Consciously skipped the non-issues it flagged (prompt-injection via answers — answers are fixed A/B/C/D options mapping to our authored text, not free input; retake race; answer-ID validation — already safe).
- **NOT done**: these reports are standalone per-assessment; they do not yet feed the combined gift profile or a cross-assessment "integrated" view (the Drive "Integrated User Model" docs). Future work if wanted.

---

## Clarity Layer assessments — Impact Readiness + Value Spectrum (2026-06-08)

Added the **Clarity Layer**: two new takeable assessments in a separate section of the Insights tab, sourced from Drive (canonical docx "ALIGN360 — Assessment Question Bank — Impact Readiness · Value Spectrum", file id `1RA6-MVYMu_P8ObLDe3WO__cZwLuyTBTL`).

- **Question banks** (`content/Assessments/Impact Readiness.md`, `Value Spectrum.md`). Impact Readiness = 20 Qs across 5 domains (Identity, Capability, Rejection, Direction, Belonging); Value Spectrum = 15 Qs across 5 dimensions (Self-Worth Baseline, Boundary Intelligence, Comparison Immunity, Value Expression, Identity Ownership). Each option carries its point value as the tag (`→ 0/3/7/10`, A/B/C/D). Em dashes converted to house style. Transcribed verbatim from the docx; Samuel's highlighted answers ignored (neutral bank).
- **`lib/assessments.ts`**: added `CLARITY_LAYER` registry + `ALL_ASSESSMENTS` (core + clarity); `slugToFile` now resolves from `ALL_ASSESSMENTS`, so `/assessment/impact-readiness` and `/assessment/value-spectrum` route automatically. Added `listClarityLayer()`.
- **`lib/storage.ts`**: added `CLARITY_SLUGS` + `getClarityAnswers()` (via shared `readAnswerSet`). Deliberately kept OUT of `getAnswers()`/`hasAnyAnswers()` so Clarity Layer completions do NOT trigger the core combined-profile generation (different scoring model).
- **`app/insights/page.tsx`**: new "Clarity Layer" section below the core Assessments list, same stretched-link card pattern + completion count. Cards take/retake the runner (`/assessment/<slug>`).
- **Verified**: both banks parse (20/15 Qs, every Q has prompt + 4 options, scores 0/3/7/10); production build passes; dev server shows both Insights sections and the Impact Readiness runner renders "1 of 20" with the full question above 4 clean options; no console errors.
- **NOT built yet (follow-up):** the scored results pages. These assessments produce a **Conviction Score** (Impact Readiness) and **Value Score** (Value Spectrum), 0-100 with named bands (Insecure/Uncertain/Discovering/Aligning/Convicted; Inferiority/Comparison Loop/Emerging/Confident/Authentic Rockstar). Drive has elaborate HTML result reports per assessment (`1KJIL4V0…` Impact, `19UL2FVI…` Value) that can become the in-app results view. Right now answers are stored but no score/result page is generated for them.

---

## Repo public + handoff hygiene (2026-06-08)

**Repo is now PUBLIC.** `github.com/wpreble/align360` was switched private → public by Will (verified `visibility: PUBLIC`, anon fetch returns HTTP 200). Pre-flight secret scan of full git history was clean: only `.env.example` templates ever committed, no `sk-` keys anywhere, `.gitignore` correctly excludes `.env`/`.env.*`. The live `OPENAI_API_KEY` lives only in Vercel env, never in git. NOTE: public now exposes `align360-app/content/` (Samuel's assessment banks, gift mappings, AI model/system-prompt files) — that's the product IP; flagged to Will, he proceeded knowingly.

**Assessment question label kicker — decided: NO.** The runner shows `q.prompt || q.label` (full scenario question only). Considered adding the short label ("Crisis scenario") back as a small kicker/eyebrow above the question. Decision: **leave as-is (prompt only)** — the section name already sits above the question (a kicker would be a third stacked line), and Qs 16–19 have no label in the source, so a kicker would render inconsistently across the bank. No code change.

**Internal `.agent/` plan/state convention added (local only).** Created `.agent/` at the repo root (PLAN.md, STATE.json, DECISIONS.md, RESULTS/, agent-onboarding.md) so context survives compaction across sessions. **`.agent/` is git-ignored** (added to `.gitignore`) — it's internal scaffolding and must not land in the now-public repo. Authoritative project history remains this `DEVLOG.md` plus the in-repo `DEV PLAN`/`CODING AGENT BRIEF`; `.agent/` defers to those and is supplemental.

**State at handoff:** prompt-render fix is live and verified (commit `7ba19ff`, deploy `align360-6im87paki` Ready). Working tree clean, local == `origin/main`. No open code tasks. Optional/unstarted: README polish + LICENSE for the public repo (Will did not request; without a LICENSE the code is visible but not reusable).

---

## Post-deploy polish — onboarding, frameworks, account, contrast, prompts (2026-06-05)

Live and auto-deploying on **https://align360-app.vercel.app** (every push to `main` ships). All of the below is committed + deployed.

**Canonical onboarding (19 questions).** Replaced my placeholder questions with the authoritative spec from `content/Assessments/Onboarding.md` — Sections A–I (why here, wiring, life rhythm, decision/AI-style, what shaped you, connection, faith gate, building toward, + 6 Current-State Calibration Qs incl. distress flag & disruption posture). `lib/onboarding.ts` holds the questions + a per-answer **signal map**; **`buildOnboardingContext` feeds each chosen answer's behavior signal to the AI** (tone, faith level, routing, distress). Synthesis is index-based (can't drift from option text). Options render as a full-width vertical list (sentences). 19 Qs ≈ 5 min — if testers find it long, trim Section I to the 2–3 highest-impact Qs.

**Frameworks page (new nav).** `/frameworks` lists the full system from the Knowledge File (System Prompt §15): DesignSuite + Career Navigator **live**, Integrate360 / 627 Figures / LegacyLab **locked (coming soon)**, each with its own accent (`--fwa`). Click rules: the 3 DesignSuite assessments → runner / Insights (take-or-view); every other live tool → `/chat?run=<name>`; locked families are non-interactive. Nav is now Chat / Insights / **Frameworks** / Resources. **Resources is now a pure content library** (Watch + Guides poster cards; the duplicate Frameworks section was removed).

**Per-framework + per-result color system.** Landing framework cards: DesignSuite = fig-rose, Career Navigator = teal (top bar + tag + bullets). Resources posters re-colored to match (assessment fig / guided teal / video violet / doc sapphire). This complements the per-gift profile tinting.

**Account & Settings panel (`Shell.tsx`).** Footer no longer shows a "Set your name" input — it shows the user's name + avatar as a button that opens an Account & Settings modal: editable display name, Account items (Profile / Plan & billing / Sign in–up — "Soon"), Preferences (Appearance theme toggle, Notifications "Soon"), and **Reset my data** (`resetAll()` wipes all `align360:*` localStorage → fresh start; with a "data is local to this device" note). NOTE: all state is still **localStorage, per-browser** — no DB, nothing shared between testers.

**Report numbers + controls contrast.** The big numerals were hairline (`font-weight:200`) in a mid accent → read like the background. Now weight 500–600 in the bright `--gold2` accent (sig/cr/gift percentages, opp scores); decorative numerals lifted; floating Back/Regenerate/Download controls made solid with bright text (Download uses a concrete fill since the toolbar sits outside `.profile-doc`).

**Whole assessment card clickable.** Insights-hub assessment cards use a stretched cover-link (entire card navigates), with Retake layered above. Hover lift added.

**No em dashes (house style).** All authored copy cleaned; plus a render-time strip — `stripDashes()` in `lib/markdown.ts` (chat) and a deep-strip of the generated profile in `/api/profile/generate` — so even model-written prose has none.

**Samuel founder photo.** `public/brand/samuel.png` in the landing founder section (via `FounderAvatar`, falls back to the mark).

**Assessment question prompts FIXED (this was a real bug).** The runner showed only the question *label* ("Crisis scenario"), not the actual scenario *prompt* ("Your team just discovered a critical error…"). Root cause: `parseAssessment`'s `flushPrompt()` ran on **every** option line and unconditionally set `curQ.prompt = promptParts.join(' ')`; after option A flushed the captured prompt, options B–E re-flushed an empty buffer → overwrote it to `""`. Affected every question in all assessments. Fix: `flushPrompt` now only writes when `promptParts.length`. Verified via `tsx`: all 19 wiring Qs (and orientation/rejection) now carry their prompt; the runner renders the full scenario above the answers. Note the runner shows `q.prompt || q.label` (prompt only); the short label is no longer displayed — add it back as a small kicker if desired.

**Mobile pass.** Walked every route at 375px (landing, onboarding, chat, frameworks, resources, insights hub, the dark report, runner): no horizontal overflow; grids collapse to 1col; report controls fit (mobile top bar hidden on the profile); onboarding ✓ no longer overlaps option text.

**Pending / next:** custom domain `alpha.align360.io`; wire onboarding signals into profile *generation* (currently fed to chat context); real accounts (Supabase) behind the "Soon" items; full assessment banks from Samuel; Next 16 upgrade (npm audit wants it; deferred as a breaking migration).

---

## Deployed to Vercel (2026-06-04)

Live (public): **https://align360-app.vercel.app**. Verified end-to-end — public landing + live gpt-5.5 profile generation (`generated:true`), which also proves the in-app content (system prompt + assessments) is traced/read correctly on Vercel.

- App made **self-contained**: `AI Model/` + `Assessments/` moved into `align360-app/content/`; read paths + `outputFileTracingIncludes` updated. No more `../` dependency.
- Fixed build: `/api/chat` now instantiates OpenAI lazily (was module-scope → threw at build with no key).
- Vercel project `align360-app` (team wprebles-projects), **rootDirectory = `align360-app`**, framework Next.js. Env: `OPENAI_API_KEY` + `OPENAI_MODEL=gpt-5.5` (Production).
- **GitHub auto-deploy connected** — pushes to `main` ship automatically. Manual CLI deploys, if ever needed, must run from the repo root (rootDirectory builds the subdir).
- Note: Deployment Protection is off (site is public). Next: custom domain `alpha.align360.io`.

---

## Profile readability redesign + per-result color (2026-06-03)

Will: "text still wayyy too small on the results pages… keep the direction but redesign; different colors for different results could be cool." Done both.

- **Readability redesign (`app/result/profile.css`).** Found + fixed a real bug: the readability override targeted `.opp-ai-why`, a class that doesn't exist — the actual opportunity descriptions are `.opp-why`, so they'd been stuck at 12px the whole time. Bumped the whole document: body/description copy 12–14px → **16.5px** (`.opp-why` 15.5px), hero desc 18 → 20px, section intros 17px, sub-headings (opp titles, psr/ac/am headings) → 20px, gift names 13 → 15px + percentages → 20px + bars 1px → 2px, and stepped the tiny Cinzel labels up so nothing's microscopic. Same luxe direction, just legible.
- **Per-result accent (`CombinedProfile.tsx` + `profile.css`).** The document now re-tints to the reader's primary wiring gift — 9 jewel tones (Realist→amber, Doer→garnet, Supporter→teal, Organizer→sapphire, Explainer→citrine, Integrator→emerald, Enterpriser→copper, Encourager→coral, Wise Observer→amethyst), fig/rose fallback. Driven by inline `--gold`/`--gold2`/`--goldd`/`--hero-glow` CSS vars set from `scores.wiring.primary`; retints eyebrows, rules, percentages, pills, the hero glow, and the top gift bar. Verified: Wise Observer profile renders amethyst end-to-end. No two profiles look the same now.

Build clean; no mobile overflow.

---

## Landing page + IA expansion (2026-06-03)

Big feature pass: a real marketing landing page, app re-homed behind it, an Insights hub, smarter Resources, and a favicon. Production build clean (15 routes). Verified visually desktop + mobile.

**Routing — landing is now the main page.** `/` = brand-forward marketing landing (full-bleed, ungated). The app moved to `/chat`; `/insights`, `/insights/profile`, `/resources`, `/assessment/[slug]`, `/onboarding` unchanged. Shell treats `/` like onboarding (no chrome, no gate); nav "Chat" → `/chat`; chat history + new-chat links → `/chat?...`; onboarding finish → `/chat`; `/align` legacy redirect → `/chat`; runner "back from Q1" → `/resources`. Only two refs ever treated `/` as chat, so the move was low-risk. **Login is intentionally skipped for the alpha** — every landing CTA enters at `/chat`, which gates new users into onboarding ("discover your wiring").

**Landing page (`app/page.tsx` + `app/landing.css`).** Dark Black-Cherry-Fig, Cormorant display / Jost labels / Crimson Pro body, real ALIGN mark. Copy adapted + sharpened from align360.io: hero "Put out the fires. Then become one." → problem (5 life domains) → two pillars (who you are / what you do) → how it works (Minutes / 30 / 90 days) → what's included (DesignSuite + Career Navigator) → outcomes → "not another personality test" compare table → founder (Samuel Ngu) → final CTA → footer. `.lp` owns its own scroll region (the app shell sets `body{overflow:hidden}`). Mobile: nav collapses to logo + Log In; all grids → 1col; no horizontal overflow.

**Insights hub (fixes "Back just goes to chat").** `/insights` is now a hub (light app theme): combined-profile card (archetype + "View full profile"), per-assessment status (Completed / Not started → View result / Take it), `1/3 complete` counter, onboarding preliminary read when empty. The full luxe document moved to **`/insights/profile`** with a **"← Insights"** back button (returns to the hub, not chat) + Regenerate + Download PDF.

**Resources behavior.** Assessments: completed → `/insights/profile` ("View result"), else → the runner ("Start"). All non-assessment DesignSuite/Career-Navigator tools are now clickable and launch a guided chat: `/chat?run=<Name>` → new chat auto-sends "Run <Name>" → the AI runs the framework conversationally (verified live; it uses the user's name + profile). Completion state read from localStorage + live `STORE_EVENT`.

**`?run=` chat launch.** `ChatInner` reads `?run=`, starts a fresh chat, auto-sends once (per-value ref guard). Made StrictMode-safe: when `?run=` is present the chat-load effect doesn't reset state (it was clobbering `idRef` on StrictMode's double-invoke, dropping the in-flight reply from the view). No `history.replaceState` (it fought Next's router and blanked the view).

**Favicon.** `app/icon.png` + `app/apple-icon.png` generated from the white mark on a rounded fig tile; Next auto-detects them. Metadata title/description sharpened.

**Confirmed:** all three assessments run end-to-end — Wiring (19), Orientation (12), Rejection Gift (12) — same generic runner, all feed scoring + the combined profile + model context.

> Changes are in the working tree, not yet committed.

---

## QA + Insights optimization pass (2026-06-03)

Full end-to-end walkthrough with visual verification (Preview MCP, desktop + mobile). Everything works; fixed three real bugs found along the way, plus a cosmetic one. Production build clean (12 routes, no type errors).

**Verified working:** onboarding (11 steps → synthesis → gate → personalized chat welcome) · chat with gpt-5.5 (markdown **tables** render clean, AI uses onboarding context) · file uploads (PDF → Files API `file_id` → gpt-5.5 reads it natively, confirmed live; text inline; images vision) · chat history (persist / collapse / load) · assessment runner (all 19 Wiring Qs) → answers saved → profile regenerates → Insights · Resources accordion + Start links → `/assessment/<slug>` · nav (Chat/Insights/Resources).

**Bugs fixed this pass:**
1. **Assessment data loss (`lib/assessments.ts`)** — Wiring Q16–Q19 use bare `### Q16` headers (no `— label`); the header regex *required* a separator, so it fell back to per-section renumbering and the 4 compressed-mode questions got IDs `q1`–`q4`, **colliding with Section A and silently overwriting 4 answers** (19 asked → 15 saved). Made the separator/label optional: `/^Q?(\d+)\s*(?:[—\-–:]\s*(.*))?$/`. Now 19/19 persist. (Orientation/Rejection were already clean.)
2. **Gift-tally pollution (`lib/scoring.ts`)** — Section F diagnostic tags (`Compressed pattern:`, `Activation condition:`, `Recovery mode:`, `Self-awareness:`) were being counted as gift votes. Canonical gifts never contain a colon, so: skip any `giftTag` containing `:` before tallying. Profile now ranks only the 9 real gifts (verified: Wise Observer 88% … Integrator 8%, no junk rows).
3. **Mobile Insights control collision (`app/globals.css`)** — the fixed floating Back + Regenerate/Download toolbar (z-index 40/41) overlapped the sticky app top bar, hiding the hamburger and crowding the logo. On mobile, when the profile is showing, hide the redundant top bar: `.center-col:has(.profile-doc) .mobile-bar { display:none }`. The floating controls become the page's controls (matches the "floating back button to get out" intent).
4. **Cosmetic (`app/onboarding/page.tsx`)** — stray space before the comma in the summary read ("confusion , with" → "confusion, with").

**Insights audit notes:** fonts (Cormorant Garamond display + Cinzel labels) load and render correctly — earlier `document.fonts.check` false was a load-timing artifact. No horizontal overflow on mobile; multi-column grids collapse to 1col < 700px. `@media print` (full-page PDF, chrome hidden) intact.

**Left as-is (not bugs):** Career Navigator carries an ACTIVE badge but all 7 tools show SOON (no broken Start — product/labeling call) · AI appends an IP/copyright footer to chat replies (system-prompt v6.4 behavior) · desktop toolbar can transiently overlap a full-width row at one scroll position (standard fixed-toolbar tradeoff).

> Changes are in the working tree, not yet committed.

---

## Current state (as of 2026-06-03)

A working, branded, single-user alpha — **localStorage-backed, no accounts yet**. Runs locally; not deployed.

### Architecture / IA
- **Three-panel-less shell** (`app/_components/Shell.tsx`): collapsible left sidebar + center content. Right "Insight Engine" panel was removed per Will.
- **Left sidebar:** ALIGN logo → nav (**Chat / Insights / Resources**) → **Chat History** as its own scrolling section → foot pinned at bottom (name field = account, theme toggle, account/settings gear stub, © copyright).
- **Gating:** first-time users are redirected to `/onboarding`; once onboarded they reach the app. Onboarding renders full-bleed (no shell chrome).
- **Routes:** `/` (Chat), `/insights` (profile), `/resources` (frameworks), `/onboarding`, `/assessment/[slug]` (runner). `/chat`, `/align`, `/assessments`, `/result` redirect to their new homes.

### Features
- **Onboarding** (`app/onboarding/page.tsx`, `lib/onboarding.ts`): 11-step intake (name, intent, 3 wiring signals, recharge, decision style, growth, connection, faith, curiosity) → synthesized "first read" (preliminary gift hypothesis + growth read + comms adaptation). Saved to localStorage; name populates the sidebar.
- **Chat** (`app/page.tsx`): gpt-5.5 via `/api/chat`. Personalized welcome (greets by name + onboarding read). Markdown rendering incl. **tables** (`lib/markdown.ts`, custom, XSS-safe). Animated thinking dots. **Composer**: textarea on top, controls row below (attach `+`, voice mic placeholder, send) + char counter — stacks for full-width mobile. **File uploads** (see below). Chat **history** persisted to localStorage (sessions, new/load/delete), synced to the sidebar via a `STORE_EVENT`.
- **Assessment → AI awareness:** completing an assessment saves answers + clears the stale profile; Insights regenerates; the chat injects the profile/onboarding signals into the system prompt so the AI knows the user from message one.
- **Assessments** (`app/assessment/[slug]/`): Typeform-style runner reading the real `Assessments/*.md` banks at request time (`lib/assessments.ts`). Three live: Wiring (15+4=19), Orientation (12), Rejection Gift (12). Launchable from Resources.
- **Insights** (`app/insights/page.tsx` + `app/result/_components/CombinedProfile.tsx`): dark luxe combined-profile document generated by `/api/profile/generate`. Saved profile / generate-from-answers / onboarding preliminary read / empty states. Floating **← Back** (exits to Chat) + **Regenerate** + **Download PDF**.
- **Resources** (`app/resources/page.tsx`): frameworks accordion — DesignSuite + Career Navigator active (DesignSuite expands to the 3 assessments), Integrate360 / 627 Figures / LegacyLab preview.

### File uploads (all through the OpenAI API — verified)
- Images → vision (`image_url`). PDF → `/api/upload` → OpenAI Files API → `file_id` → `{type:'file'}` content part (gpt-5.5 reads PDFs natively). DOCX → `mammoth` server-side text extraction → inline. Text files → inline.
- Hardened: magic-byte validation, 25MB cap, stale-`file_id` graceful retry (strips dead file parts), safe error parsing, truncation markers.

### AI / model
- **gpt-5.5 for everything** (`OPENAI_MODEL`). It's a reasoning model: use `max_completion_tokens` (not `max_tokens`), no custom temperature, `reasoning_effort: 'low'`.
- Profile generation runs as **two parallel halves** (identity + market/AI-era), merged with defensive per-half parsing → ~27s (was ~67s single-call). Deterministic `fallbackProfile()` if the API fails.
- System prompt assembled at request time from `AI Model/*.md` (`lib/system-prompt.ts`) — editing those files updates the live app with no rebuild.

### Brand
- **ALIGN**, "Black Cherry Fig" system: fig `#4E0230`, Rich Obsidian `#110319`, Soft Stone `#DBDCDB`, Pure White. (Note: the earlier brand PDF said fig `#2A122E`; the logo pack's `#4E0230` won and the app matches the logo.)
- Real logo marks from `Transparents.zip` → `align360-app/public/brand/align-mark-{fig,white}.png` (trimmed tight to ink; source in `Brand/Logos/`). `<AlignMark/>` swaps fig↔white by theme.
- Type: **Inter** (UI), **Jost** (wordmark + uppercase labels — geometric, echoes the logo), Cormorant Garamond (display serif), Crimson Pro (reading). Sharper, reduced corner radii per the brand direction.

### Verification discipline
Every UI change is verified **visually via the Preview tool** (screenshots at desktop + mobile), not just `next build` + curl — after a CSS grid bug (the drawer-scrim) shipped unseen because curl can't catch layout. Production build is run before each commit.

---

## Pending / not yet built (the real gaps)
1. **Supabase** — accounts, durable cross-device persistence, real chat history, share links. Everything is localStorage today. This is the next unlock; needs `NEXT_PUBLIC_SUPABASE_URL` + anon + service-role keys.
2. **Full assessment banks** — the repo `Assessments/*.md` are the 5/23 extracts (Wiring 19, etc.). Samuel's updated/full versions ("on Slack") never landed; the Knowledge File is still a partial index. `AI Model/Knowledge File — Part 1.md` lists what's missing.
3. **Career Navigator tools** — listed in Resources but no runners (no question content yet).
4. **Deploy** — Vercel, root dir `align360-app`, env vars; target `alpha.align360.io`. Note: Next 14.2.5 has a flagged security advisory — bump before prod.
5. **Minor:** uploaded PDFs accumulate in OpenAI Files storage (no cleanup job); the missing Amber reference HTML for the result palette.

## Run / env
```bash
cd align360-app && npm install && npm run dev   # → http://localhost:3000
```
`.env.local` (gitignored, symlinked from repo root): `OPENAI_API_KEY`, `OPENAI_MODEL=gpt-5.5`. Ground-truth docs: `DEV PLAN — Alpha Sprint 2026-05-28.md`, `CODING AGENT BRIEF — …`, `Brand/ALIGN Brand Guidelines.pdf`.

---

## Build timeline (commits)
- `3f1b1d3` scaffold + IP-versioned content · `09c4f23` v6.4 system prompt · `54d8869`/`8a1a9f1` fold in alpha-sprint dev plan + scope revision · `fab9a5b` next.config fix
- `00f3064` ingest addenda → tracked md; fix erroneous "36-question" count · `98b2ed3` alpha spine (shell + runner) · `3b08dd1` combined profile + AI narrative + PDF · `021a3b8` switch to gpt-5.5 + reasoning-model params
- `f9669dd` three-panel shell · `048f853` rebrand to ALIGN + assessments tab + image input + mobile · `53bbbeb` markdown + thinking dots + wider column · `6e51586` full-vision minimalist 3-tab rebuild · `fa40ddc` polish (instant history, floating toolbar)
- `f7de30b` real file uploads (PDF/DOCX/image/text) · `3d2edc3` harden uploads · `fa1ab99` name capture + remove dead Nav · `352965f` fix broken desktop layout + gen 67s→27s
- `c86b8b8` restore onboarding + gate + feed AI · `59541f6` personalized welcome + Insights preliminary read · `d5f3d77` real ALIGN logo marks + fig token · `2286c4e` sharper type / less roundedness · `c2bd911` fix tiny logo (tight trim) · `a7f83ea` markdown tables
- `7bb48c2` profile readability + sidebar restructure · `ffdf539` stacked chat composer · `8b0e21f` Insights floating Back + full-page PDF
