# Slack pull — #aligndev + Samuel DM (through 2026-07-13)
_Workspace: ascendancestudio.slack.com. Pulled 2026-07-13. Read-only._

**Channels/DMs pulled:**
- `#aligndev` (private, `C0BH5HDUG3A`, created 2026-07-09 by Will) — full history (~4 days, 30 msgs).
- DM with **Samuel Ngu** (`U0BH5HP6L64`, askishmael@gmail.com, TZ America/Phoenix) — `D0BG50NMNPM`, full history.
- Also present: Drew (`U0BG50T8FGT`), Yerik Martinez (`U0BGJF90AJ0`).
- **No** `align360*` public channels exist; `#aligndev` is the only Align channel. No overlap with the prior Aaron/Ascendance-Ops pull.

---

## 🔴 Dev-actionable / directly affects in-flight work

### Referral program — Samuel already has a full spec (reconcile with my v0)
- **Samuel DM 7/10 23:32** dropped two referral docs: `align360_referral_growth_program.docx` (F0BGLJ2V44W) + `Referral_Align notes.html` (F0BHGTYG0TA). "I attached what I had written for referrals… I know you will be working on it over the weekend."
- **Samuel #aligndev 7/10 14:53** "do we have a referral link to add to our emails? …increases flywheel probability through fam/friends."
- **Will 7/10 14:54–15:38** "let me explore what it'll take / easy out-of-box systems" → **"i think an affiliate system where they get paid out something would be ideal, but a robust one will take work"** → **"Easiest would be credits to start"** → **"you get more usage credits etc."**
- **Samuel 7/10 14:56** "any benefit for early individual access? 30% discount? …if someone signs up your next month is free? too much though."
- **Samuel DM 7/11 23:04** "Succeed with — 1) individual benefit for pilot and 2) referral link?"
- **Samuel DM 7/11 17:11** "Just saw this. **Let your agent do the job for now**." ← Samuel greenlit the agent building this.

**Substance of Samuel's `Referral_Align notes.html` spec (extracted):**
- **Flywheel:** a referral from someone who can show their **Conviction Score** converts 3–5× a cold ad; every shared result card carries the referrer's code.
- **Refer-qualification gates (all 4):** (1) active paid subscriber, (2) 30+ days paying, (3) Layer 2 complete — **Conviction Score + Value Score both generated**, (4) program opt-in. Only then does the "Join the Referral Program" CTA appear.
- **Phase 1 (Day 60–90) — discounts, no cash:** referrer earns **1 free month** per paid conversion (Power Referrer 5+ → 2 free months from 6th); referred user gets **20% off first month**; enterprise **$500–$2,000** credit.
- **Phase 2 — commissions (dormant behind a flag):** triggers MRR>$50K + 6mo + legal (W-9/1099/attorney terms); **20% of first month** (25% Power).
- **Dev build (one build, two phases):** referral code gen, attribution (30-day cookie, click→signup→paid chain), CreditBalance auto-applied to billing, commission system behind config flag, referral dashboard, **GHL (GoHighLevel) events** referral_click→signup→converted→vested.

**Reconciliation → see the updated research/roadmap doc.** Short version: my v0 matches **Will's** "usage credits to start" (alpha-appropriate, since alpha is free — Samuel's "paid subscriber" gates and "free month" reward can't apply yet). Samuel's spec becomes the **v1 target** and I've aligned the roadmap to it (Phase 1 discounts = my v1, Phase 2 commissions = my v2, and it maps cleanly onto Rewardful). **Open ambiguity for Will+Samuel:** "credits" = *usage credits* (my v0, what Will said) vs *billing/account credit toward subscription* (Samuel's doc). Flagged in needs list.

### Currency map scoring + Faith→Conviction naming (resolves my Task-1 open items)
- **Will 7/10 18:50 (thread, 5 replies):** found Samuel's **True Riches Currency Framework** in the gov doc — confirms the currency map should be **deterministic from the 3 assessments** (wiring/orientation/rejection), NOT Value Spectrum. Framework has **7 currencies incl. Faith**; app shows 6 — Will to add Faith.
- **Samuel 7/10 21:03:** **"Faith will become conviction (non-faith centered and also market facing names). Sending you a doc shortly."** ← This is the "market phasing vs Christian" piece from my first task: the **Faith** currency renames to **Conviction** for market-facing/non-faith contexts.
- **Will DM 7/11 13:27:** "the **3.8 scoring map** is definitely what we needed" — but Samuel's map uses type names (creator, driver, pioneer, analyst) that don't match the app's (doer, explainer, integrator, enterpriser, wise observer). **Open Q (Will asked Samuel):** move the app to Samuel's new **8 type names**, or map app's current names onto his map? — *unanswered.*
- **Currency scoring source doc** is in the **Drive gov doc**, tagged on the "ascendance email" (Samuel 7/10 17:53 thread reply) — not in Slack. Needs Drive access.

### Bugs flagged by the team
- **Lead-gen pages still point to `align360.betaapp.io`** — Samuel 7/11 23:55 tested one, landed on `align360.betaapp.io/auth/signup?slug=align360-product`. Will posted 8 live `align360.io/discover/*` pages 7/12. **Verify the betaapp.io redirect is gone.** (Matches memory: score pages not fully ported.)
- **Google signup shows scammy name** — Drew 7/10: signing up via Google exposes a strange name "olgyser…/colgyser…" with access to his info. (= OAuth consent showing raw Supabase ref; already on needs list as infra.)
- **iOS signup can't scroll to finish** — Yerik 7/10. (DEVLOG says fixed 7/10; Yerik to reconfirm on device.)
- **Results %s flipping / order shuffling** — Drew 7/10. (DEVLOG says fixed 7/10 — gift scores locked, currency still LLM pending Samuel's map.)

## 🟡 Decisions needed from Samuel → added to needs list
- Currency "credits" ambiguity (usage vs billing credit); 8-type-name migration; Faith→Conviction rollout; the referral reward model for alpha.

## ⚪ Context (file, don't act)
- **Samuel 7/10 23:32:** governance docs consolidated under **"Core: Governance Docs"** in Drive: 0 build-sequence, 1 A360Gov/HumanOs/Pulse360 (formerly B3), 1.1 Dashboard specs, 2 Assessments Master, 3.1 Comprehendly. Plus `Knowledge Pack Bundle Addendum v1 1.docx` (F0BG6SY9A4F). **This is the current source of truth — supersedes older scattered docs.**
- Samuel renaming **B3 → Pulse360**; team won't work with "B3" naming going forward.
- **Welcome to Align YouTube playlist** (unlisted for pilots): youtube.com/playlist?list=PLR3StrcM2Ras — Samuel wants feedback.
- First paying customer 7/10 (arobinett@motorcargoexpress.com) on Samuel's birthday.
- Samuel's Apple laptop arrives Tue (was on iPad/phone — explains terse msgs).
- **Covering Prayer** doc (F0BGMKRUA0M) — personal/spiritual, Samuel prays daily over the team.

## ⚫ Skip (coordination noise)
- Join notifications, "w", birthday back-and-forth, biblegateway Psalm 118 link.

---

## File manifest (Slack file IDs — retrieve via slack_read_file)
| File | ID | Type | Load-bearing? | Saved locally |
|---|---|---|---|---|
| Referral_Align notes.html | F0BHGTYG0TA | html | ★ referral spec | substance extracted above + `slack-pulls/2026-07-13/` |
| align360_referral_growth_program.docx | F0BGLJ2V44W | docx | ★ referral spec (likely same, richer) | manifest only (binary) |
| Knowledge Pack Bundle Addendum v1 1.docx | F0BG6SY9A4F | docx | ★ gov/humanos knowledge | manifest only (binary) |
| Samuel User Model.MP4 | F0BGL66S1RQ | video 8.7MB | rubric walkthrough | manifest only (binary) |
| IMG_4260/4261/4262.jpg | F0BHGJ0D5FS / F0BG6SXF5FH / F0BGJUWC3M3 | img | Faith→Conviction handwritten notes | manifest only (binary) |
| Covering Prayer Align360 Ascendance.md | F0BGMKRUA0M | md | context | manifest only |
| Drew bug screenshot | F0BGQARKDC4 | img | google-signup bug | manifest only |
| Drew results screenshots | F0BGGR8GNRK / F0BGDSXK4UT | img | results-flip bug | manifest only |

**External links flagged (not authed into):**
- Drive **"Core: Governance Docs"** — the current source of truth (gov + HumanOS + currency scoring map + 3.8/8-type map). **Load-bearing — most open items resolve here.**
- YouTube pilot playlist PLR3StrcM2Ras (feedback requested).

**Note on binaries:** I did not base64-dump the docx/mp4/images this turn (heavy, not readable inline). They're manifested by Slack file ID for targeted retrieval. The two referral docx likely mirror the HTML whose substance is captured above; the currency scoring numbers live in the Drive gov doc, not these files.
