# Align360 — DEVLOG

Running log of the Align360 app build. Newest section first. The app lives in `align360-app/` (Next.js 14, App Router, TypeScript). Repo: `github.com/wpreble/align360` (**public**).

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
