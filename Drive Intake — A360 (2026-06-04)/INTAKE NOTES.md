# Drive Intake — A360 folder (2026-06-04 upload)

*Captured by Will via Claude, 2026-06-05 · Companion to `DEV PLAN — Alpha Sprint 2026-05-28.md`*

On 2026-06-04 Samuel uploaded a substantial new set of mockups, the interaction spec, and the first reference outputs for two new assessments (Impact Readiness, Value Spectrum) into Google Drive. This doc captures **what's there, what we pulled local, what's still in Drive, and — most importantly — the architectural intel that supersedes parts of the existing dev plan.**

---

## 1. Where the originals live in Drive

**Google Drive path:** `My Drive / War Room / VENTURES / zsecondary / A360`

**Drive folder URL:** https://drive.google.com/drive/folders/1EQkVfN_vrZr-HFEyPItjIeQDNLjo1JjN

**Drive folder ID:** `1EQkVfN_vrZr-HFEyPItjIeQDNLjo1JjN` *(use this with the Drive MCP `parentId` filter to re-pull)*

Five subfolders + 18 root-level HTMLs. Subfolder IDs:

| Subfolder | ID |
|---|---|
| Branding | `1JTVDupSjNYKr2TFon4LkJ3ramOaevwRR` |
| Interact with A360 | `17JGBe27eSGU4WIxeKNDrIrTMsXjG0Uzl` |
| Landing Pages + Onboarding | `1QIgg-oAErXE6D6heDSJnu594Bhvj8Ap8` |
| Clarity Layer Results | `1x6py37ofuPsY0eg0RrIuMzswgc7L9bnh` |
| Primary User Model Results | `1ybk7f0RD3SoGQ_O1f1NXL7xMDobqLBkj` |

Drive is the canonical source for Samuel's working artifacts now. The local repo is a curated mirror for the build path; for everything else, go to Drive.

---

## 2. What's pulled local (in this folder)

Saved during 2026-06-05 intake — 9 HTMLs:

```
Drive Intake — A360 (2026-06-04)/
├── INTAKE NOTES.md                                                     ← you are here
├── A360_Differentiator Onepager.html
├── A360_Family360 Dashboard.html
├── A360_Individual (Simple view of Home Page).html
├── A360_Strategic Planning (Vertical).html
├── Align Health (Vertical).html
├── Interact with A360/
│   └── align360_interaction_spec.html                                  ★★ canonical spec
├── Landing Pages + Onboarding/
│   └── Samuel Ngu (Update Crownedbowman personal website).html
└── Primary User Model Results/
    ├── 3. Samuel_Primary User Model Results with AI-Era Combo.html
    └── 5. Sam x Drew_Combined Results.html
```

These nine are enough to ground the build. The rest are inspiration / variants and can stay in Drive.

## 3. What's still only in Drive (not pulled local)

If a coding-agent task needs one of these, pull it on demand using the Drive MCP and the ID below.

**Pull-on-demand list (★ = high priority if you need it for the alpha build):**

Root-level mockups still in Drive:
- ★ `1Q3f83QAMuzGVoB-LZEnMEX_PHGhWkFCD` — A360_Individual Dashboard (Advanced View of Homepage and Preferred)
- ★ `1RqoOZCBp9HS7_XIvrzQjT2ZWB4vGWvmU` — A360_Indivudal (User Model Page)
- ★ `1VsF8-0h7kixJ84HV_DXHD8VdpiAjjmca` — A360_Individual (Chat)
- `1pYclMW9CZXZAcRfaUCQdGzu4s7mVSZZ8` — A360_Individual (Life Journey)
- `1REmITE87udXADpaHYJu3vdgFMIDper2T` — A360_Individual (Alignment View)
- `1DDG01a4_Yj1knHDPgcZfbyWWhM8mgnyI` — A360_Enterprise Dashboard
- `1MC_ZVgWW4zdpBrFcpY6LADu2K7y2nB13` — A360_Enterprise to individual
- `1jFYbn-XH1YlugT-3NQy73aL-LrtYr-KW` — A360 Enteprise__Consent Request
- `16pA6W9moImyNvcfKv3SdNAmoy7vxKQxx` — A360_Health (Vertical)  *(have a similar one local)*
- `1F7NQ-4-QgrK0CkvG2bPtSO_W5TCnJMoj` — A360_Multicontext (one person, diff context)
- `1kOvRG0cKKwFb52DOQn5cqdjuNH39Brzj` — A360_Mobile App (Idea)
- `1i-yxJ8xYHXAtz-PpNxmXH27UW4MI_E05` — A360_family360 invite
- `1-Vzx2N1l4yk6p3AmeIrNti_In4SqaQMO` — A360 Coach_dashboard

Interact with A360:
- ★ `1HD3otZ4FMAIbfTfiyS1IsPoFRriCUQyp` — Competitive Moat and New Category

Landing Pages + Onboarding:
- ★ `1MqLn6dvbjvF-Wf-sYhvF7Bi51K1J8waD` — A360_Onboarding Idea (Primary User Model, Clarity Layer, and then Integrated)
- `1AJBhkrML_uoGQMuEGrEfY5mzaCfhnBa1` — Align Website_Mockup (using my results) *(1MB, heavy)*

Clarity Layer Results (NEW assessments — see §5):
- ★ `1KJIL4V0QtUBpDESV6YyJmUY9IvwWPaEs` — 1. Samuel_Impact Readiness Results
- ★ `19UL2FVIWVZmf2LLCyl6rfdf6X0sI-gSQ` — 2. Samuel__Value Spectrum Results
- ★ `1cJr2y3zyehCJU5X8G97GXtFTALTS-Jus` — 3. Integrated User Model = Primary User Model + Clarity Layer

Primary User Model Results (per-assessment Samuel reference outputs):
- ★ `1l8JyNfzurlTsRg2EfDkprsXiOX3m0fRI` — 1. Samuel_Wiring for Impact Results
- `1WssVYOoAKp5exOPCAEP_w4LOjPo-RztA` — 1.1. Samuel__WFI Results (variant)
- ★ `1SXsnuKHkgbzdAvOOdnAf5GsFu8Ie_mGM` — 2. Samuel__Orientation for Impact Results
- `1dpfoeKMplljFaLbPmAqO3Ux7s39ik6Z5` — 2.1. Samuel__OFI Results (variant)
- ★ `11EnaNjqF-Iv9lpd0ySH65CHQHhG4ZB-Z` — 3.1. Samuel__RGF Results
- `1b95TlK0XEhHKAlucO5JshTD7UgeC0PPO` — 4. Samuel_B3 Nervous System Results

Branding (binary assets, get on demand):
- `1i6LxKywHm6CQijTvkvhq1l7KFNfLxlUM` — Transparents.zip (32MB logo pack)
- `16c11XRq_ztdILZU9r8a6G7mITS6GKLAl` — A360 Brand Logo Package.pdf (7.7MB)

---

## 4. New vocabulary (introduced in this Drive batch)

The 2026-05-28 dev plan does not use these terms. They come from `align360_interaction_spec.html` and the Clarity Layer / Integrated User Model docs. **The build needs to adopt them.**

| Term | What it means |
|---|---|
| **Primary User Model** | The three original assessments together: Wiring for Impact (WFI) + Orientation for Impact (OFI) + Rejection Gift Finder (RGF). Distinct *compute path* from Clarity Layer. |
| **Clarity Layer** | The two new assessments: **Impact Readiness (IR)** and **Value Spectrum (VS)**. Renders/scores independently of Primary User Model. |
| **Integrated User Model** | Primary + Clarity fused into a single profile. This is the synthesis view; the dev plan's "combined profile" maps onto this. |
| **PersonaContext** | Object loaded **before every assistant reply**, containing the user's IR, VS, WFI, OFI, RGF, Life Season, and `currentDayState`. R1 in the interaction spec: required pre-reply. |
| **NarrativeEntry** | Qualitative log: `ConvictionEvent`, `Lesson`, `TurningPoint`, `RhythmObservation`. Persists meaning, not scores. |
| **Semantic Bridge** | The cross-scope rule. Meaning travels between Individual / Family / Coach / Enterprise scopes; **raw scores never do.** |
| **rhythmOS.currentDayState** | One of `{A, B, C}` — the daily-state hint from B3 check-ins. |
| **AmplificationLayer** | Six-layer architecture: **Foundation → Wellness → Behavioral → DiagnosticOS → StrategyOS → Agent**. |
| **Life Season** | One of five: Discovery / Healing / Building / Expansion / Legacy. |
| **AI-Era Readiness** | Composite metric (Samuel = 94%) derived from WFI archetype × OFI orientation × RGF pattern × IR Conviction × VS Value. Not a raw assessment — a synthesis. |
| **AlignmentDelta** | The primitive that diffs two Integrated User Models (Sam x Drew uses this; Family360 + Enterprise share it). |
| **ContextLens** | One person rendered through different role lenses (parent / founder / coachee). Not in dev plan. |
| **Master Chief** (individual) / **Mr. JC** (enterprise) | Internal codenames for the two product personas. **Don't put these in customer-facing copy or in coding-agent instructions without context** — they're product-team shorthand. |

---

## 5. The Clarity Layer — what's new about the assessment count

The dev plan's beta-ready criterion #1 says "the three User Model assessments (Wiring, Orientation, Rejection Gift)." That **stays correct for what gets built in the alpha** — Samuel's pushback brief still defines the alpha pilot around those three. But the architecture above them now formalizes:

- **Primary User Model = WFI + OFI + RGF** (these three, what we're building runners for)
- **Clarity Layer = IR + VS** (these two — Impact Readiness, Value Spectrum)
- **B3 = Wellness check-in, READ-ONLY to scoring engines** (R3 in the spec: B3 mutates `currentDayState` + NarrativeLayer only — never IR/VS/WFI/OFI/RGF scores)
- **Integrated User Model = Primary + Clarity, fused**

For the alpha sprint this means:

1. **Don't build runners for IR or VS in the alpha.** Out of scope. Reference outputs exist (Samuel's Impact Readiness + Value Spectrum) but the question banks for these aren't in the repo yet and aren't required to clear the alpha gate.
2. **The result page is a Primary User Model render** with the AI-Era Intelligence section. It does *not* claim to be the Integrated User Model. The Integrated view layers on IR + VS — that's post-alpha.
3. **The data model should anticipate the Clarity Layer.** When the time comes, IR and VS results need to slot in next to WFI/OFI/RGF without restructuring `profile_snapshots`. Reasonable: `payload_json` already covers it; the schema is forward-compatible. Just don't paint ourselves into a corner naming-wise — rename `profile_snapshots.assessment_slug` semantics to allow `'primary'` vs `'clarity'` grouping later.
4. **The terminology in the result page UI should hedge.** Don't say "Your full profile" — say "Your Primary User Model Profile" or just "Your Profile (Phase 1)". Anything that implies completeness is a promise we can't keep until the Clarity Layer ships.

---

## 6. The interaction spec — load-bearing rules (R1–R8)

From `align360_interaction_spec.html`. These are non-negotiable behavior contracts for any assistant/agent that touches user data. **The current `align360-app/api/chat/route.ts` does not enforce most of these yet.** Adding them is post-alpha unless an alpha tester surfaces a violation.

| Rule | What it says | Alpha relevance |
|---|---|---|
| **R1** | PersonaContext must be loaded before every assistant reply. | Post-alpha (chat isn't in the alpha UI). |
| **R3** | B3 check-in NEVER mutates IR/VS/Primary scores — only `currentDayState` + NarrativeLayer. | Post-alpha (no B3 runner in alpha). Bake this constraint into the data model regardless. |
| **R4** | ConvictionEvents require **explicit user confirmation** before persisting. | Post-alpha. Worth tracking. |
| **R7** | Sub-scores restricted to `{0, 3, 7, 10}`; the primary gap = the sub-score of value **3**. | **Alpha-relevant** if any sub-score rendering happens. The reference HTMLs do show this. |
| R2, R5, R6, R8 | *(not pulled into the summary — re-read the spec when these become load-bearing)* | — |

---

## 7. Architectural contradictions with the current dev plan

These are the diffs between the current dev plan (2026-05-28, with Will's revisions through 2026-05-31) and what the interaction spec actually says. None of them break the alpha, but the dev plan should be updated.

1. **"DesignSuite" framing.** Dev plan §0.1 calls the right-panel group "DesignSuite" listing seven tools. The interaction spec instead organizes everything under the six AmplificationLayers (Foundation → Wellness → Behavioral → DiagnosticOS → StrategyOS → Agent). The seven tools likely map *into* those layers. **Action:** keep the DesignSuite label for the alpha right-panel UI (it's what Samuel and Jason use externally), but in code/data, group by AmplificationLayer.

2. **B3 in the chat context-injection.** Dev plan §0.1 ("The integration loop") says "extend the chat route to pull the signed-in user's latest profile snapshot and append it as personalization context." Per R3 in the spec, B3 inputs flow into PersonaContext but never mutate scores. **Action:** when the chat-personalization step ships, the loader must use PersonaContext shape, not just `profile_snapshots.payload_json`. For the alpha (no chat in UI) this is moot.

3. **AI-Era Readiness compute location.** The dev plan implies the AI-Era Intelligence section is generated alongside the rest of the profile narrative in one OpenAI call. The reference output suggests AI-Era Readiness is its own composite tied to DiagnosticOS layer outputs. **Action:** for the alpha, generate it inline with the rest of the narrative. Refactor to its own compute when DiagnosticOS layer is real.

4. **Assessment slug naming.** Dev plan §3.2 uses `assessment_slug` values like `wiring`, `orientation`, `rejection-gift`. The new architecture suggests grouping: `primary:wiring`, `primary:orientation`, `primary:rejection-gift`, `clarity:impact-readiness`, `clarity:value-spectrum`, `wellness:b3-baseline`, `wellness:b3-daily`. **Action:** use the grouped slug from day 1. Cheap to add; expensive to migrate later.

5. **Result page label.** Dev plan §3.4 calls the output the "Combined profile result page." Better: "Primary User Model Profile" or "Profile (Phase 1)". See §5 above.

6. **Reference outputs in the build.** Dev plan §3.4 points at `Samuel x Drew__Combined.html` and `samuel result realist.html` in the repo root. The new reference at `Drive Intake — A360 (2026-06-04)/Primary User Model Results/3. Samuel_Primary User Model Results with AI-Era Combo.html` is **more up-to-date** — it includes the AI-Era Readiness composite (94%) and the Life Season rendering, which the older reference does not. **Action:** make this the primary template the React component is converted from.

---

## 8. Cleanup notes

The intake folder contains two empty test artifacts left by a download-tool retry: `_test.txt`, `_test2.txt`, `A360_Differentiator Onepager.html.b64`, `A360_Individual (Simple view of Home Page).html.b64`. They're zero or near-zero bytes and harmless; delete on next folder housekeeping pass (workspace bash couldn't remove them in the intake session due to a permission quirk).

---

## 9. Quick re-pull recipe

To re-pull a Drive file by ID (if the coding agent or a future intake needs it):

```
mcp tool: mcp__3dc3b639-b3a8-4f4f-8b72-6178e60818a2__download_file_content
args:    { fileId: "<the ID from §3 above>" }
result:  { content: <base64>, id, mimeType, title }
```

Decode the base64 and write to the appropriate subfolder of `Drive Intake — A360 (2026-06-04)/`. Update §2 and §3 in this doc when you pull more local.

For batch re-pulls, write a small Python helper rather than handling them one-by-one inline — the base64 will blow your context.
