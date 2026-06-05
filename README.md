# Samuel NGU / Align360 — Working Folder

This is Will's working folder for Align360, the AI-powered personal and professional development platform built by Feeling Like Chocolate (FLC), founded by Samuel Ngu.

The folder is organized into three top-level buckets, each with its own rules.

---

## Folder map

```
Samuel NGU/
├── DEV PLAN — Alpha Sprint 2026-05-28.md       ← ★ ACTIVE GROUND TRUTH for the build
├── CODING AGENT BRIEF — Alpha Sprint 2026-05-28.md  ← operational layer on the dev plan
├── Align__Alpha Sprint Brief for Dev Team.docx ← Samuel's offer/pricing/P0 decisions
├── *.html                                      ← tracked build-references (lead-gen, result samples)
│
├── align360-app/      ← Next.js app (Vercel-ready). The alpha ships HERE, not MasteryOS.
│
├── AI Model/          ← what actually feeds the live AI (current state only)
│   ├── Standing Rules.md    ← global rules every output must honor (e.g. IP notice)
│   └── Archive/             ← past versions of prompt + knowledge files
│
├── Assessments/       ← question banks (one clean .md per assessment)
│   └── Archive/       ← past versions of any question set
│
├── Demo/              ← reference HTML demo (open in browser; superseded by align360-app/)
│   └── Archive/       ← past demo versions
│
├── Drive Intake — A360 (2026-06-04)/  ← curated mirror of Samuel's 2026-06-04 Drive upload
│   ├── INTAKE NOTES.md                ← ★ vocabulary, R-rules, file index, dev-plan diff
│   ├── Interact with A360/
│   │   └── align360_interaction_spec.html  ← ★★ canonical interaction contract
│   ├── Landing Pages + Onboarding/
│   └── Primary User Model Results/
│
├── Project Log/       ← operational notes, Slack dumps, open-issues working docs  [gitignored]
│
└── R&D/               ← governance, addenda, supplementary research (by recency)  [gitignored]
    ├── 2026-05-23 — Current source of truth/
    │   └── Reference outputs & marketing/
    └── Pre-2026-05-23 — Earlier iterations/
```

## Canonical sources outside this repo

- **Google Drive — Samuel's working artifacts:** `My Drive / War Room / VENTURES / zsecondary / A360` · <https://drive.google.com/drive/folders/1EQkVfN_vrZr-HFEyPItjIeQDNLjo1JjN>. Mockups (individual / family / coach / enterprise / health / strategic planning / mobile), brand assets, full Samuel-and-Drew result samples, the `align360_interaction_spec.html` master spec, and the new Clarity Layer reference outputs (Impact Readiness, Value Spectrum, Integrated User Model). `Drive Intake — A360 (2026-06-04)/` is the build-relevant local subset; everything else stays in Drive. Re-pull recipe is in the intake notes §9.
- **Jason's framework (live site):** <https://gtm.align360.io/hub> · /primitive-map · /how-to-apply · /alpha-sprint-brief · /samuel-sprint
- **Slack:** workspace `masteryos` · primary channel `#align360`

## Repo scope

This folder is a private git repo. **What's tracked:** the alpha-sprint docs (root `.md` + Samuel's `.docx`), the build-reference `.html` files at root, `align360-app/`, `AI Model/`, `Assessments/`, `Demo/`. **What's not** (per `.gitignore`): `Project Log/` (PII), `R&D/` (large .docx, Samuel's IP — note the reference-HTML originals live here and are gitignored; tracked copies sit at repo root for the coding agent), `*.MOV` screen recordings, and any `.env*`.

The live system prompt is read by `align360-app/lib/system-prompt.ts` directly from `AI Model/*.md` at request time, so editing those files updates the running app on the next message.

## Active work

The current sprint is the **Align360 Alpha** — auth + three Typeform-style assessment runners + AI-generated combined profile result page + persistence + private share links, shipped through `align360-app/` and deployed to `alpha.align360.io`. **`DEV PLAN — Alpha Sprint 2026-05-28.md` is the ground truth** (see its §0 intake status for what's tracked, what's missing, and the open decisions). The coding agent reads the dev plan + brief before building.

---

## Conventions

### Working version vs. archive

Inside `AI Model/` and `Assessments/`, the **working version** has a clean filename (e.g. `System Prompt.md`). When superseded, it moves to the local `Archive/` folder with a version suffix (e.g. `System Prompt v6.2.md`). The working file is always the live source of truth.

### R&D is ordered by recency

R&D contains governance docs, addenda, audits, summaries, and any other supplementary research. Subfolders are prefixed by date so newer material sorts first. **The newest folder is the source of truth.** When older material conflicts with newer material, newer wins.

When new R&D arrives:
- If it's newer than today's batch → create a new date-prefixed folder (e.g. `2026-06-XX — …/`) and demote `2026-05-23 — Current source of truth/` by renaming it.
- If it's an older iteration → drop it under `Pre-2026-05-23 — Earlier iterations/` in the appropriate subfolder.

### Filenames stay descriptive

No `(1) (2) (3)` suffixes from browser downloads. Rename on intake to something that says what the doc is.

---

## What's in each bucket

### AI Model/

The files that feed the live AI:

- **System Prompt.md** — current version (placeholder; v6.3 pending upload from Will)
- **Knowledge File — Part 1.md** — DesignSuite + Career Navigator (placeholder; v6.3 pending)
- **Knowledge File — Part 2.md** — future segments (placeholder)
- **Standing Rules.md** — global rules every output must honor (currently: IP / copyright notice on all outputs and UI surfaces). Versioned same as the system prompt.

When Will uploads v6.3, the placeholder gets replaced and the prior version moves to `Archive/` with the version suffix.

### Assessments/

One clean markdown file per assessment, extracted from the 2026-05-23 Refined Qs docs (originals preserved in R&D):

- **Wiring for Impact.md** — 15 Qs (Sections A–E) + 4 new Section F Qs (Compressed Mode Detection)
- **Orientation for Impact.md** — 12 Qs across 6 sections
- **Rejection Gift Finder.md** — 12 Qs across 6 sections
- **Onboarding.md** — 12 Qs (system-behavior mapping, not scored)
- **B3 Wellness Baseline.md** — 18 Qs across 6 domains
- **B3 Daily Check-In.md** — 3 Qs + new Q4 (Effort Value, from ProScan Addendum)

### Demo/

Working HTML demos of the product. Open in a browser to test.

- **align360-demo.html** — current full app demo (multi-step onboarding + three-panel chat shell with sidebar + Insight Engine, light/dark theme, Claude API wired in). Carries the IP notice as a fixed footer.

Older demos live in `R&D/Pre-2026-05-23 — Earlier iterations/Demo HTML/` for diff/reference.

### R&D/

#### `2026-05-23 — Current source of truth/`

Most recent material; overrides older docs on any conflict.

Top-level:

- **AI-Era Addendum.docx** — governance amendments for AI-era calibration; introduces DISRUPTION_POSTURE variable, AI-Era Calibration Feedback Protocol (Section 8.2), and amendments to Sections 5, 5.1, 5.5, and 7.
- **ProScan Addendum.docx** — Shadow Mode Capture Layer (5.1.1), Current State Calibration Layer (Section 6 Internal Layer 3), Effort Value Assessment Layer (7.1), Identity State Interpretation Protocol (8.1).
- **Refined Qs — User Model Assessments.docx** — source for Wiring, Orientation, Rejection Gift Finder. Extracted into `Assessments/`.
- **Refined Qs — B3 + Onboarding.docx** — source for Onboarding, B3 Baseline, B3 Daily Check-In. Extracted into `Assessments/`.

`Reference outputs & marketing/` subfolder:

- **Samuel — Combined in an AI-Era v2.html** — polished example output showing a full identity profile in the AI-era calibrated format. Reference for what the live system should produce.
- **Samuel — Realist result.html** — example single-result page for the Realist gift type.
- **Align360 — Lead gen inline.html** — inline lead-gen landing page.

#### `Pre-2026-05-23 — Earlier iterations/`

Older material. Useful for context but superseded where it conflicts with the current source of truth.

- **Governance/** — 10 numbered governance documents from the imported project knowledge: positioning, the FLC SaaS Wisdom Framework (foundational + at-a-glance), developer implementation checklist, governance regression test, Pathfinder homepage tool, Formation Resources knowledge pack, and a system architecture overview.
- **Segment Knowledge Packs/** — earlier knowledge packs for Career Navigator (v1 + v2) and DesignSuite.
- **Demo HTML/** — earlier interactive demo (`Align360 Onboarding Chat App v6.html`).
- **Career Navigator v4.1 thread (Nov 2025 - Apr 2026)/** — full deliverables from a past Career Navigator buildout thread that pre-dates the current Align360 v6.3 architecture. Includes the Career Navigator v4.1 system prompt + knowledge file, Phase 0/2 tools buildout, UX spec, tool audit, and summary. Useful as historical reference for how Career Navigator evolved into being one of the five segments under v6.3.

---

## Conflict resolution

If any older doc disagrees with newer material, **newer wins**. Specifically:

- Assessment question wording → trust `Assessments/` (extracted from 2026-05-23 source).
- Governance / architecture → trust `R&D/2026-05-23 — Current source of truth/` + (when uploaded) the live `AI Model/` files.
- Segment naming, phase structure, tool inventory → the current v6.3 architecture defines five segments (DesignSuite, Career Navigator, Integrate360, 627 Figures, LegacyLab). Older phase-numbered references in Earlier iterations have been superseded.
