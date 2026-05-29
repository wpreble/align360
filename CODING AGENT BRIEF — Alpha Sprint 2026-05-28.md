# Coding Agent Brief — Align360 Alpha Sprint

*Author: Will · 2026-05-28 · For: the coding agent that will implement this sprint*

---

## Read these first, in this order

1. `DEV PLAN — Alpha Sprint 2026-05-28.md` (this folder) — full context, scope, sequence, what NOT to build.
2. `Align__Alpha Sprint Brief for Dev Team.docx` (this folder) — Samuel's decisions on pricing, stages, and his P0 blockers.
3. `align360-app/README.md` — current state of the app you'll be building into.
4. `AI Model/System Prompt.md` and `AI Model/Standing Rules.md` — the live AI brain. Don't modify; read.
5. `Assessments/Wiring for Impact.md`, `Orientation for Impact.md`, `Rejection Gift Finder.md` — the three question banks you'll be parsing.
6. The reference HTMLs listed in the dev plan §8 — the visual/structural target for the result page.

If anything in this brief contradicts the dev plan, the dev plan wins. This brief is the operational layer on top of it.

---

## What you're building

A Next.js app that lets a participant:

1. Land on `alpha.align360.io`, see a brief intro, click "Begin".
2. Take three assessments back-to-back in a Typeform-style click-through (one question per screen, animated, mobile-tight, progress bar). Under 10 minutes total.
3. After Q1 of the first assessment, get prompted for email → magic link → account created → progress preserved.
4. See a polished, color-coded combined profile result page (matching the reference HTMLs in the dev plan §8) that includes an AI-Era Intelligence section.
5. Log out, come back later, log in, and find their result intact.
6. Generate a private share link that another logged-in user can view read-only.

That's the whole product. Nothing else.

---

## Where to build

**Build into `align360-app/`.** It's a Next.js 14 App Router project, TypeScript, deployed to Vercel. Auth and persistence don't exist yet — you'll add them.

**Do not** modify or extend MasteryOS, the legacy `Demo/align360-demo.html`, or anything in `R&D/`. Those are reference and historical.

**Do not** rewrite or refactor `lib/system-prompt.ts` or `app/api/chat/route.ts`. They're correct as-is. You'll reuse the loader pattern for the new narrative-generation route.

---

## Stack additions (use exactly these)

- **Auth + DB:** Supabase. Use `@supabase/ssr` for server-side session handling in App Router. Magic-link email auth only — no password, no OAuth providers for the alpha.
- **AI:** Continue using the existing `openai` SDK pattern from `app/api/chat/route.ts`. Add a new route `app/api/profile/generate/route.ts` for narrative generation.
- **Styling:** Continue with plain CSS + Align360 brand tokens (no Tailwind). The reference HTMLs use Cormorant Garamond + Cinzel + Crimson Pro from Google Fonts — load them in `app/layout.tsx`.
- **State:** React hooks only. No Redux, no Zustand. Assessment state is mostly server-persisted; client only holds the current question + the user's choice for that question.
- **Animations:** CSS transitions, matching the lead-gen HTML's `cubic-bezier(.16,1,.3,1)` curves. No Framer Motion.

If you find yourself wanting to add a library not listed here, stop and put a question in the Open Questions section of the dev plan.

---

## Build order — work through these in sequence

Don't start step N+1 until step N is reviewed and merged. The dependencies between auth, persistence, and the assessment runner will create rework if you parallelize.

### Step 1 — Supabase setup

- Create the Supabase project (or use the existing one if Will has provisioned it — check `.env.local` for `NEXT_PUBLIC_SUPABASE_URL`).
- Tables per dev plan §3.2: `assessment_responses`, `profile_snapshots`. `users` is managed by Supabase Auth.
- RLS policies: a user can read/write only their own rows. `profile_snapshots` is also readable by anyone holding a valid `share_id` (use a separate policy keyed on `share_id IS NOT NULL`).
- Add `lib/supabase-client.ts` and `lib/supabase-server.ts` per the standard SSR pattern.
- Magic-link auth pages: `app/auth/sign-in/page.tsx` (email input → send link), `app/auth/callback/route.ts` (handle Supabase callback).

**Acceptance:** I can sign up with an email, click the magic link, land on `/`, refresh, still be signed in. Sign out works. Sign back in from a fresh browser works.

### Step 2 — Assessment runner shell

- Build `app/assessment/[slug]/page.tsx` as a generic runner. `[slug]` is `wiring`, `orientation`, or `rejection-gift`.
- At request time, parse the corresponding `.md` from `Assessments/` (reuse the file-read pattern from `lib/system-prompt.ts`). Output: `{ assessmentTitle, sections: [{ name, questions: [{ id, prompt, options: [{ letter, text, giftTag }] }] }] }`.
- One question per screen. CSS-driven transitions on advance / back. Progress bar at top, row of dots underneath. Use the styles from `align360 lead gen inline.html` as your starting point — copy the relevant CSS into `app/globals.css` or a co-located stylesheet.
- After each answer is selected, POST to `app/api/assessment/answer/route.ts` which writes a row to `assessment_responses`. The next-question advance can be optimistic — don't block UX on the write.
- Anonymous start: if no session exists, allow Q1, then on Q2 attempt prompt for email. Bind the prior anonymous answer to the new user_id once the magic link is consumed. (Store the anon answer in `localStorage` keyed by a temp UUID; reconcile server-side on callback.)
- Back button per Typeform pattern.

**Acceptance:** Visit `/assessment/wiring` cold. Complete all 15 questions on mobile and desktop. Answers persist to Supabase. Look and feel matches `align360 lead gen inline.html` — same fonts, same animation curves, same option-card style.

### Step 3 — Orientation + Rejection Gift runners

Same component. New parsers if needed (the `.md` structures are nearly identical, but verify). Verify the gift-tag extraction for Rejection Gift — that's the column that drives the result-page color palette and headline.

After the third assessment's last question is answered, redirect to `/result/generating` which kicks off the profile snapshot.

**Acceptance:** A new participant can complete all three assessments back-to-back in one session in under 10 minutes. All ~39 answers in the DB. No interruptions, no modals, no payment screens.

### Step 4 — Result page static structure

- Pick `R&D/2026-05-23 — Current source of truth/Reference outputs & marketing/Samuel — Combined in an AI-Era v2.html` as the master template. Open it in a browser and read it top to bottom.
- Convert to a React component `app/result/_components/CombinedProfile.tsx` with props that match the sections (see dev plan §3.4 for the section list). Use hardcoded prop values from Samuel's own profile for now — pull the strings directly from the reference HTML.
- The component must accept a `palette` prop with keys: `accent1`, `accent2`, `accent3`, used for the three pillar accents (Wiring / Orientation / Rejection). Derive palette from the gift type — start with these:
  - "The Steady" → teal (`#2ABAAA`) + gold (`#C8A96E`) + plum (`#9B59B6`).
  - "The Realist" → see `Samuel — Realist result.html` for the palette.
  - "The Reframer" (Amber's gift) → amber (`#D4881A`) + cobalt (`#2E6AC0`) + indigo (`#3030A0`).
  - Default for any unmapped gift → the teal/gold/plum set above.
- Add `Cormorant Garamond`, `Cinzel`, `Crimson Pro` to `app/layout.tsx`.
- All animations from the reference HTML (`fadeUp`, the progress meter fills, the pulse on the badge) — port them.
- IP notice footer per Standing Rules. Year auto-resolves.

**Acceptance:** Visit `/result` (hardcoded sample data). Side-by-side with the reference HTML at 1440px, 768px, and 375px viewports, the page is visually equivalent. Fonts loaded. Animations play once on entry. No layout breaks on mobile.

### Step 5 — Narrative generation route

- `app/api/profile/generate/route.ts`. POST takes `{ user_id }`. Server reads all `assessment_responses` for that user. Calls OpenAI with `buildSystemPrompt()` + a new user-turn payload that includes the raw answers and a structured-output instruction.
- Response schema (JSON): match the section list in dev plan §3.4. Every section the result page renders needs a corresponding key in the JSON.
- Write the result to `profile_snapshots.payload_json`. If a snapshot already exists for the user, return the cached one (do not regenerate; allow regeneration only via a separate route with an admin-only flag — not in alpha scope).
- Generation can take 10–30 seconds. Render `/result/generating` with a tasteful loading state in the reference's aesthetic (use the `pulse` animation already in the CSS).

**Acceptance:** Run on Samuel's own answers (the assessment data exists in `R&D/2026-05-23 — Current source of truth/`). The generated JSON, when fed into the result page component, produces a page meaningfully similar in content to `Samuel — Combined in an AI-Era v2.html`. Differences in exact wording are OK; structural correctness and tonal fit are required.

### Step 6 — Wire static structure to snapshot

- `app/result/page.tsx` (logged-in self-view): read the user's latest `profile_snapshots.payload_json`, pass into `<CombinedProfile />`. Handle states: no snapshot yet → redirect to `/assessment/wiring`. Snapshot generating → loading state. Snapshot ready → render.

**Acceptance:** Sign in as a user who completed the flow → see their result. Sign in as a different user → see theirs. No leakage between users.

### Step 7 — Share link

- Generate a `share_id` (12-char random base36) when the user clicks "Share" on their result page. Save to `profile_snapshots.share_id`. Display the URL `alpha.align360.io/result/[share_id]`.
- `app/result/[share_id]/page.tsx` — viewer must be signed in. Server-side fetch the snapshot by `share_id`. Render `<CombinedProfile />` read-only (no Share button, no edit affordances).

**Acceptance:** Sign in as User A → take assessments → share link. Sign in as User B in another browser → open share link → see User A's profile read-only. Signed-out user → redirect to sign-in.

### Step 8 — Stop. Tell Will.

When step 7 is green, deploy to `alpha.align360.io` and tell Will. Will sends Samuel the URL. Samuel runs cold. Do not start "polish" or "nice-to-haves" before Samuel's punch list comes back — almost certainly you'll be reworking some of what you'd polish.

---

## What "done" looks like for each layer (cribbed from Jason's articulation gate)

For each step above, before marking it done, ask:

- **Independence** — would Will and another reviewer independently agree it's done?
- **Specificity** — does it deliver the exact thing the acceptance line names, no more, no less?
- **Falsifiability** — could a stranger with no project context open it and answer yes/no?

If any of the three are no, it's not done. Don't escalate to the next step.

---

## Things that will tempt you — say no to all of them

- "Let me add a quick onboarding step that asks for name and goals before Q1." — No. Auth, then Q1.
- "Let me cache the question banks in-memory at startup." — No. Read at request time, same pattern as the system prompt loader. Editing the `.md` must take effect on the next request.
- "Let me add a payment screen since Samuel's brief mentions $47." — No. Out-of-band. The dev plan §4 is explicit.
- "Let me add a 'continue your assessment' email." — No. Persistence is enough.
- "Let me add a chat-with-your-profile feature since the chat infra already exists." — No. That's the Phase 2 OS layer. The chat API stays available but does not appear in the alpha UI.
- "Let me add a dark mode toggle." — No. Light only.
- "Let me build the Onboarding / B3 / Daily Check-In assessment runners since the .md files are already in `Assessments/`." — No. Post-alpha.
- "Let me build an admin dashboard so Samuel can see all participants." — No. Read the DB directly for the alpha.

---

## What to do if you hit something genuinely ambiguous

Add a question to the Open Questions section of the dev plan and Slack Will. Do not guess. The 2026-05-27 sprint cycle showed that "I'll just decide and we'll fix it later" produces exactly the kind of rework Jason's primitive map is designed to prevent. One owner per decision, one written answer, then move.

---

## Environment

Already in `align360-app/.env.example`:

```
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
```

You will need to add:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=                # optional, only if not using Supabase Auth's built-in email
```

For the alpha, `OPENAI_MODEL=gpt-4o` (not the `-mini`) is appropriate for narrative generation — quality matters more than per-snapshot cost. Cache snapshots so we pay once per user.

---

## Deploy

Same as the existing `align360-app/` README, with the added env vars above. Set the Vercel project's domain to `alpha.align360.io` once Will adds the DNS record.

---

*Last thing: the assessments and the profile output are the product right now. Everything else is scaffolding. Build like the scaffolding will be thrown away after the alpha — because most of it will.*
