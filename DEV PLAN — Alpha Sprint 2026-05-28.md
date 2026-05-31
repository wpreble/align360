# Align360 — Dev Plan (Alpha Sprint)

*Author: Will · 2026-05-28 · For: dev team + coding agent · Status: live working doc*

This plan replaces the prior MasteryOS-centric brief. The alpha runs on **`align360-app/`** (the new Next.js app in this repo), not on the existing MasteryOS deployment. MasteryOS's open bugs (credit prompt interrupt, dark-mode default, narrow pane, hamburger break) are not in scope for this sprint — we are routing past them by shipping the alpha through the new app.

> **Note on Samuel's brief (`Align__Alpha Sprint Brief for Dev Team.docx`, 2026-05-27):** Samuel's brief frames every fix as "pull updates into MasteryOS." This dev plan supersedes that on the *where*: we ship through `align360-app/`, not MasteryOS. The brief's content decisions still hold — the $47 commitment filter (full refund on completing all three stage debriefs), the one-sprint/three-stage structure, the two P0 hard blocks (stale question sets, credit-prompt interrupt), and the 13 pilot questions. Those are the source of truth for the *offer* and *feedback*; this plan is the source of truth for the *build*.

---

## 0. Intake status — 2026-05-29

The alpha-sprint docs landed in the repo. Current state:

- **Tracked in repo (private):** this dev plan, the coding-agent brief, Samuel's `.docx` brief, and the three build-reference HTMLs at repo root (`align360 lead gen inline.html`, `samuel result realist.html`, `Samuel x Drew__Combined.html`). The screen recording `IMG_3966.MOV` is gitignored (heavy binary, not source).
- **`R&D/` is gitignored** — the descriptively-named reference originals (`Samuel — Combined in an AI-Era v2.html`, `Samuel — Realist result.html`, `Align360 — Lead gen inline.html`) live there but do **not** ship in the repo the coding agent clones. The root copies above are the tracked build-references. Keep them in sync if R&D originals change.
- **Heads-up:** the result HTMLs contain real participants' profile data (Samuel, Drew). Repo is private; keep it that way.

**Still blocking / owed before the coding agent starts step 4–5:**

1. **Amber's reference HTML is missing.** §3.4 and §8 referenced two "uploaded today" files (`remixed-0f4cf006.html`, `remixed-dd2ff89e.html`) — only Drew's exists (as `Samuel x Drew__Combined.html`). Amber's result HTML is not in the repo. Either supply it or drop Amber from the palette set for the alpha.
2. **The §6 open decisions are unanswered** (auth provider, hosting/domain, result-narrative JSON schema, palette map, post-result routing, LOI pricing sign-off). These gate steps 1, 4, and 5. One owner, one written answer each — per the brief's own rule.
3. **LOI timing inconsistency in Samuel's brief:** it says "one 30-day Alpha Sprint" but the refund condition reads "all three submissions within 15 days" and Stage 3 is "Days 11–15." Jason/Samuel to reconcile before the LOI goes out. Build-irrelevant; offer-relevant.

---

## 0.1 Scope revision — 2026-05-29 (Will)

This revision **supersedes the lean cuts in §4** where they conflict. The alpha is no longer "auth → Q1 → result → done." It is a small but real app with a persistent shell. Where §4 below says "no chat in UI," "no chat-with-your-profile," "no multi-step navigation" — those are **reversed** by this section. Everything else in §4 still stands (no payment, no B3/Onboarding runners, no admin panel, no notification emails, light-mode only).

**App shell — three-panel chat-centric layout (revised 2026-05-31, per Will + the MasteryOS reference).** Supersedes the earlier "two tabs" idea. CSS grid: collapsible left sidebar · center chat · collapsible right "Insight Engine" panel — ported from `Demo/align360-demo.html`.

1. **Left sidebar (collapsible)** — brand, primary nav (Align360 AI, Resource Library, Tools, Journal & Notes, User Resource Gallery — only Align360 AI/chat is live; the rest are "soon" stubs), Chat History (stub until persistence), theme toggle + settings + IP notice at the foot.
2. **Center — Align360 AI chat** (`/`, the existing `/api/chat`). Welcome screen + suggestion chips; the assessment runner and result page render here too. Once a user has a profile, **it's injected into the chat context** so the assistant is personalized.
3. **Right — Insight Engine (collapsible)** — "DesignSuite" group listing the seven tools. The three active assessments (Wiring, Orientation, Rejection Gift) launch the Typeform runner in the center; the other four are "soon". Global Notes stub. Plus a "Preview a sample profile" link.

On completion the runner → AI processing → combined profile result page (reference-HTML format) → PDF + (once Supabase lands) saved to the account.

**On signup:** route the user straight into the Align tab with Wiring for Impact as the first call-to-action (per Samuel: Wiring is the mandatory first experience). They land in the product *doing the thing*, not on a dashboard.

**Quizzes are FULL-LENGTH (resolves §0 / prior 36-vs-15 conflict).** Will's decision: use the complete question banks, not the short extracts. v6.4 prompt §12/§13 ("full 36-question Wiring, Q1–Q36, never shorten") is **correct and stays**. Each assessment runs its full set sourced from the Knowledge File.

> **⚠ NEW HARD BLOCKER (was hidden by the old "match Assessments/*.md exactly" criterion):** the full banks are **not in the repo**. `Assessments/Wiring for Impact.md` is a 19-question extract (header says 15); `AI Model/Knowledge File — Part 1.md` is a **placeholder**. The full 36-Q Wiring set (and the full Orientation / Rejection Gift sets) live in the Knowledge File Samuel says he sent to Will + posted on Slack — they have not landed here. **Build cannot satisfy "full-length quizzes" until those banks are dropped into `Assessments/` (or the Knowledge File).** This replaces criterion #1's "match the .md exactly" with "match the *full* banks once supplied." Structure/runner/result-page/PDF/persistence/chat-injection can all be built now against the current short files as placeholders (the loader reads `.md` at request time, so swapping in the full banks is a content drop, no rebuild).

**Result delivery — additions:**

- **PDF download** of the combined profile result, with IP notice per `AI Model/Standing Rules.md` (Standing Rules already mandate the notice on PDF exports). Server-rendered from the same result component.
- Result **persists to the user's account** (already planned via `profile_snapshots`) and is re-openable from the Align tab.

**The integration loop (new, important):** after AI processing generates the profile, that profile becomes part of the assistant's knowledge base. Mechanism: extend the chat route to pull the signed-in user's latest `profile_snapshots.payload_json` (and optionally their raw `assessment_responses`) and append it as personalization context on top of `buildSystemPrompt()`. Reuses the existing loader pattern — no new infra. This is the payoff: the assessments don't just produce a page, they make Align360 AI *know you*.

**Build-order impact:** add an app-shell/nav step before the runner, a PDF-export step after the result page, and a chat-personalization step after snapshot generation. I'll renumber §5/§ brief build order in the same pass once you confirm this section captures it.

---

## 1. Where we are — the honest read

**The frameworks are validated.** Drew, Amber, Samuel, and the B3 team have all confirmed the assessments produce real signal. Miriam asked to sign the LOI on the basis of her result. Jason's bucket 02 (manual IP validation) is effectively green from a content standpoint — what isn't proven is the *delivery*.

**The delivery is blocked.** Samuel's 2026-05-27 pushback on the alpha-sprint-brief was correct: he can't run the product cold in MasteryOS because the question sets are stale, a credit prompt interrupts the flow, and the one-question-at-a-time UI is disengaging. Per Jason's primitive map, this is a B04 (tech platform) gate failure — "beta ready" was never defined as a binary list, so there's no falsifiable checkpoint to hit.

**What this sprint does.** Define "beta ready" as a binary list. Ship the smallest product that clears it. Get Samuel through it cold. Hand the alpha to B3 with an offer that matches what the product actually delivers.

**What this sprint does not do.** Build the persistent OS layer, the 28-day return loop, Career Navigator (Phase 1), DesignSuite workspace, billing/credit gating, or any feature that lives past the alpha debrief. Per the hub: *"Every hour spent on platform features for unvalidated IP is manufacturing evidence for something that might not be true."* The IP is now validated; the delivery is not. Build only what proves the delivery.

---

## 2. The binary "beta ready" gate

Per Jason's bucket 04 articulation: every item passes the stranger test. A stranger with no project context can answer yes/no to each by looking at the deployed app. When all eleven are green, Samuel runs cold; if his cold run produces no new P0 issues, the gate closes and B3 contact unlocks.

| # | Beta-ready criterion | How a stranger verifies |
|---|---|---|
| 1 | The three User Model assessments (Wiring, Orientation, Rejection Gift) match the working versions in `Assessments/*.md` exactly — wording, options, and gift-type tags | Open `/assessment/wiring` etc., compare each question against the .md file. Any drift = fail. |
| 2 | Each assessment runs as a Typeform-style click-through — one question per screen, animated transitions, progress bar, visual momentum, mobile-tight | Take an assessment on a fresh phone. Compare feel against `align360 lead gen inline.html` (reference). |
| 3 | A participant can complete all three User Model assessments in under 10 minutes from a cold start | Time it with a stopwatch on a participant who has never seen it. |
| 4 | No interruption (credit, paywall, modal, redirect) appears at any point between starting Q1 and seeing the full combined profile | Run the full flow. If anything but the assessment screens and the result page renders, fail. |
| 5 | The combined profile result page renders in the production format from `R&D/2026-05-23 — Current source of truth/Reference outputs & marketing/` — same fonts, dark theme, color-coded sections, AI-Era Intelligence section included | Open the rendered result, side-by-side with `Samuel — Combined in an AI-Era v2.html`. If structure or feel diverges, fail. |
| 6 | A participant can create an account before starting (email + password, or magic link), and their assessment results persist to their account | Create an account, take the flow, log out, log back in, find the result. |
| 7 | A participant can return after 24h, log in, and re-open their full profile result from the same URL — no data loss, no broken state | Wait a day. Log in. Click the result. |
| 8 | The IP notice (per `AI Model/Standing Rules.md`) renders on the assessment runner, the result page, and any printable/exportable version | Inspect each surface. Year auto-resolves. |
| 9 | The result page works on mobile (375px viewport) — no horizontal scroll, no text clipping, readable typography, animations don't break layout | Open the result on an iPhone-sized viewport. |
| 10 | A participant can share the result via a private link (auth-gated, not public) — for the B3 team to view each other's results during debrief | Generate a share link, open in incognito after logging in as another user, verify access. |
| 11 | The app is deployed at a stable URL (Vercel preview or production), not localhost, not behind a tunnel | Visit the URL from another network. |

**Definition of done for this sprint:** all 11 green + Samuel's cold-run punchlist clears + Jason's LOI sign-off on the offer doc.

---

## 3. Build scope (what `align360-app/` needs to deliver)

The existing `align360-app/` is a minimal Next.js chat shell — light mode, wide pane, static input, OpenAI wired in. Auth, assessments, result rendering, and persistence do not exist yet. This sprint adds all four.

### 3.1 Auth + session

- Email magic-link auth (Resend or Supabase Auth — pick one, prefer Supabase since we're also using it for persistence).
- Session persists across reloads and devices via secure HTTP-only cookies.
- Anonymous-to-authenticated handoff: a participant can start the first assessment cold and we prompt for email *after* Q1 to bind the in-progress session to an account. No friction on the landing page.

### 3.2 Persistence (Supabase)

Three tables, minimal:

- `users` — managed by Supabase Auth.
- `assessment_responses` — `id, user_id, assessment_slug, question_id, choice_letter, gift_tag, created_at`. One row per answered question.
- `profile_snapshots` — `id, user_id, version, generated_at, payload_json, ip_notice_year`. The full computed profile (scores, gift type, narrative blocks, opportunity signals) at the moment of generation, frozen so re-renders are deterministic.

No `subscriptions`, no `credits`, no `billing` tables. The $47 commitment filter is collected out-of-band (Stripe Checkout link sent in the LOI) and tracked manually in a spreadsheet for the alpha. We will not gate access on payment in-product.

### 3.3 Three Typeform-style assessment runners

Routes: `/assessment/wiring`, `/assessment/orientation`, `/assessment/rejection-gift`.

Source of truth for questions: `Assessments/Wiring for Impact.md`, `Assessments/Orientation for Impact.md`, `Assessments/Rejection Gift Finder.md`. The runner parses these `.md` files at build time (or reads them at request time via the same loader as the system prompt) so editing the `.md` updates the live app.

Behavior:
- One question per screen, full viewport, Cormorant Garamond italic title, options below.
- Click an option → animate transition, advance to next question.
- Progress bar at top (e.g. "Q7 of 15"), with a row of dots underneath showing progress through the section.
- Back button per Typeform pattern (one screen back, preserves prior answer).
- Mobile-tight: input area at thumb level, no zoom required.
- Reference for feel: `align360 lead gen inline.html` (in the repo root). Reuse its CSS/interaction pattern; do not invent a new aesthetic.

After the third assessment (Rejection Gift) completes, the runner redirects to `/result` and the profile snapshot is generated.

### 3.4 Combined profile result page

Route: `/result` (logged-in user sees their own) and `/result/[share_id]` (private share).

Source of truth for layout and aesthetic: the reference HTMLs. **Tracked in repo (use these):** `Samuel x Drew__Combined.html` (Drew, combined AI-Era format) and `samuel result realist.html` (root). **In the gitignored `R&D/2026-05-23 — Current source of truth/Reference outputs & marketing/`** (originals, won't ship — copy in if you need them locally): `Samuel — Combined in an AI-Era v2.html` (master template), `Samuel — Realist result.html`. They all follow one template — convert it to a React component with props for the participant's data. **Note:** Amber's reference HTML (`remixed-dd2ff89e.html` in the old brief) is **not in the repo** — see §0 item 1. Build against the Drew + Samuel samples; treat Amber as a palette-only variant (hex values in the coding-agent brief §4 step 4) until her HTML is supplied.

Sections, in order (matching `Samuel — Combined in an AI-Era v2.html`):

1. **Hero** — name (italic), gift-type tagline ("The Steady of People and Truth"), three pillar mini-cards (Wiring / Orientation / Rejection result).
2. **Advantage Stack** — three rows, one per assessment, color-coded.
3. **Edge Declaration** — single-sentence synthesis pulled from the AI's interpretation of the combined profile.
4. **Pressure · Stress · Risk** — three cards across, behavioral patterns under pressure.
5. **True Riches Currency Map** — animated bars showing alignment across currency types.
6. **Opportunity Signals — 2022 Job Market** — legacy signals with AI-risk flags per signal (dark crimson-bordered block, "These signals are not wrong — they are incomplete." header).
7. **AI-Era Intelligence** — the new section per Samuel's 2026-05-24 governance refinement: thesis statement, three status cards (Rising / Holding if repositioned / Needs a pivot), Three Moves.
8. **Life Positioning Map** — numbered rows of structural positioning insights.
9. **What's Next** — four cards routing to phase-appropriate next steps (Life Alignment, B3 Wellness, Simulate Before Committing, Build Your Skill Map).
10. **IP notice footer** — per Standing Rules.

The AI-generated narrative content (edge declaration, opportunity signals, AI-era cards, what's next) is produced server-side via the same OpenAI route that powers `/api/chat`, using the system prompt from `AI Model/System Prompt.md` + the participant's raw answers as input. Cache the generated payload in `profile_snapshots.payload_json` so re-renders don't re-hit the model.

Color palette per profile: use the gift-type primary as accent. Drew (The Steady) → teal+gold+plum. Amber (different gift) → amber+cobalt+indigo. The component takes a palette key as prop.

### 3.5 Share link

`/result/[share_id]` — viewer must be logged in (any account), the snapshot is fetched read-only, IP notice present, no edit affordances. Generates a 12-char random `share_id` on first share, stored on `profile_snapshots`.

### 3.6 Standing Rules enforcement

- IP notice on every surface (assessment runner footer, result page footer, share-link view).
- System prompt loader continues to read `AI Model/*.md` at request time. Do not bake prompt content into code.
- Light mode default, no theme toggle this sprint.

---

## 4. Explicitly out of scope (do not build)

> **⚠ Read §0.1 first — it reverses three items below.** The 2026-05-29 revision puts the **AI Chat tab IN scope** and personalizes it with the user's profile, and replaces "auth → Q1 only" with a two-tab app shell (**Align** + **AI Chat**). The struck items below are kept for provenance but no longer bind.

The following will be tempting to bundle in. Don't. Each one falls in a later primitive bucket and will burn the sprint:

- **No B3 assessment runner**, no Onboarding assessment runner. Those collect data for Phase 1+ which doesn't exist yet. The .md files stay where they are; we will add their runners post-alpha.
- ~~**No chat-with-your-profile.**~~ **REVERSED by §0.1** — the AI Chat tab is in, and the profile is injected into its context. (Still no Daily Check-In, no journaling — that's the 28-day OS loop.)
- **No credit gate, no Stripe in-product, no paywall.** $47 collection is manual + out-of-band.
- **No theme toggle, no dark mode option.** Light only.
- ~~**No multi-step onboarding / auth → directly into Wiring Q1.**~~ **AMENDED by §0.1** — still no name/intent onboarding questions, but signup now lands in the **Align** tab with Wiring as the first CTA, not a bare Q1 screen. The two-tab shell is in scope.
- **No Career Navigator, DesignSuite workspace, 627 Figures, LegacyLab.** Phase 1+.
- **No admin panel.** Will and Sumit can read Supabase directly for the alpha.
- **No notification emails ("your profile is ready", "come back tomorrow")** — there's nothing to come back to.

If a coding agent suggests any of the above, decline and point at this section.

---

## 5. Sequence — do in this order

Each step is independent enough that it can ship and be reviewed before the next starts. Don't parallelize the early steps; the dependency on the question banks and on Supabase config will create rework.

1. **Wire Supabase.** Auth + the three tables in 3.2. Magic link working end-to-end. *Acceptance:* a real user can sign up, log in, log out, log back in.

2. **Build the assessment runner shell.** Generic component that takes a parsed question bank + handles state, progress, animations, back-button, persistence to `assessment_responses` after each answer. *Acceptance:* the Wiring assessment runs end-to-end with real data persistence. Look-and-feel matches the lead-gen HTML.

3. **Wire Orientation and Rejection Gift runners.** Same component, different question banks. *Acceptance:* a participant can complete all three back-to-back in under 10 minutes.

4. **Build the result page — static structure first.** Convert one of the reference HTMLs to a React component with hardcoded content. *Acceptance:* the rendered page is visually indistinguishable from the reference HTML at the same viewport.

5. **Wire the AI narrative generation.** Server route that takes a `user_id`, pulls their `assessment_responses`, calls OpenAI with the system prompt + raw answers, parses structured JSON output, writes to `profile_snapshots`. *Acceptance:* re-running on the same user produces a deterministic snapshot (cached); re-running on a different user produces appropriately different content.

6. **Wire the static structure to the snapshot.** The result page reads `profile_snapshots.payload_json` and fills slots. *Acceptance:* logging in as any user shows their own profile correctly.

7. **Add share link.** *Acceptance:* opening a share link in another browser, logged in as another user, shows the snapshot read-only.

8. **Samuel's cold run.** Will sends Samuel the deployed URL. Samuel completes the flow cold, no coaching. Punch list of issues in Slack within 48 hours.

9. **Fix the punch list.** Whatever Samuel hits.

10. **Re-test cold.** Samuel runs again, this time with the punch list cleared. If no new P0s surface, the beta-ready gate closes. Will tells Jason. LOI goes to B3.

---

## 6. Open decisions for Jason / Samuel / Will

These need answers before the coding agent starts step 1. If we wait until they surface mid-build, they create rework.

- **Auth provider.** Supabase Auth (free, integrated with our DB) vs. magic link via Resend (lighter, but DB is separate). *Recommendation:* Supabase, because we need persistence anyway.
- **Hosting.** The current `align360-app/` is Vercel-ready per its README. Confirm Vercel for the alpha, not align360.io / MasteryOS.
- **Domain.** Alpha runs at a subdomain (e.g. `alpha.align360.io`) or a Vercel preview URL? Either works. *Recommendation:* `alpha.align360.io`, kept gated, so the LOI can reference a clean URL.
- **Result narrative structure.** The reference HTMLs were hand-authored. To generate them at scale we need the AI to output structured JSON matching the section schema. *Owner:* Will. *Deadline:* before step 5. *Output:* a JSON schema + system-prompt addendum that produces it.
- **Color palette per gift type.** Six reference HTMLs imply at least four palettes (Drew teal/gold/plum, Amber amber/cobalt/indigo, Samuel-Realist, Samuel x Drew combined). We need a deterministic palette map keyed off gift type. *Owner:* Will + Chy. *Deadline:* before step 4.
- **What happens after the result?** The current "What's Next" cards in the reference HTMLs route to phases that don't exist. For the alpha, do they go to a "thank you, you'll hear from Samuel" page, or to placeholder coming-soon cards, or to an email sign-up for Phase 1 updates? *Recommendation:* placeholder cards with "coming after pilot" badges — honest, doesn't overpromise.
- **Samuel's pricing decision in the LOI** — $47 with full refund on completion, per Samuel's 2026-05-27 doc. Jason to sign off this is the version that goes to B3. *Owner:* Jason.

---

## 7. Risks and mitigations

- **The AI-generated narrative may not match the reference quality.** The reference HTMLs were hand-written. Mitigation: pin a known-good system prompt + few-shot examples in the snapshot generation route. Test with Samuel's, Drew's, and Amber's raw answers and compare against their hand-crafted versions before B3.
- **Samuel's cold run could surface a deeper issue (e.g. a question wording problem the team didn't catch).** Mitigation: keep the question banks in `.md` so a hot-fix is a one-line edit, no rebuild needed.
- **B3 participants may not have an existing account anywhere.** Mitigation: magic link, no password required.
- **The reference HTML aesthetic may not survive at smaller viewports.** Mitigation: step 4 explicitly tests at 375px before moving on.

---

## 8. Reference index — where the source of truth lives

| Need | File |
|---|---|
| Question banks (Wiring, Orientation, Rejection Gift) | `Assessments/Wiring for Impact.md` · `Orientation for Impact.md` · `Rejection Gift Finder.md` |
| System prompt + governance | `AI Model/System Prompt.md` |
| IP notice rules | `AI Model/Standing Rules.md` |
| Typeform-style interaction reference | `align360 lead gen inline.html` (repo root) |
| Combined profile result layout — master template (gitignored, R&D) | `R&D/2026-05-23 — Current source of truth/Reference outputs & marketing/Samuel — Combined in an AI-Era v2.html` |
| Combined profile result layout — tracked build-reference | `Samuel x Drew__Combined.html` (repo root, Drew). Amber HTML **missing** — see §0. |
| Single-gift result layout reference | `samuel result realist.html` (repo root, tracked) · original `…/Reference outputs & marketing/Samuel — Realist result.html` (gitignored) |
| AI-Era addendum (governs the AI-Era Intelligence section) | `R&D/2026-05-23 — Current source of truth/AI-Era Addendum.docx` |
| ProScan addendum (governs Effort Value / Shadow Mode) | `R&D/2026-05-23 — Current source of truth/ProScan Addendum.docx` |
| Samuel's pushback / sprint decisions | `Align__Alpha Sprint Brief for Dev Team.docx` (repo root) |
| Jason's framework | https://gtm.align360.io/hub · /primitive-map · /how-to-apply · /alpha-sprint-brief · /samuel-sprint |

---

*This doc lives in the Samuel NGU repo root. When something changes, update it here — don't fork it into Slack messages. The coding agent reads this file as ground truth.*
