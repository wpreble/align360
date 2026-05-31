# Knowledge File — Part 1 (DesignSuite Assessments + Governance)

**Status:** Real index as of 2026-05-30 (was a placeholder awaiting v6.3). Assembled from the 2026-05-23 source-of-truth batch.
**Owner:** Will / Samuel

---

## What this file is

The working knowledge loaded into the live Align360 AI alongside the System Prompt and Standing Rules. It indexes the assessment frameworks and the governance addenda so the AI has the operative content it needs at request time.

## Assessment frameworks (DesignSuite — User Model)

The full question banks live as tracked markdown in `Assessments/`. **These are the source of truth for question wording, options, and gift-type tags.** Confirmed counts (per the AI-Era Addendum Part C — the assessments are deliberately fixed-size pre-market instruments):

| Assessment | Questions | File |
|---|---|---|
| Wiring for Impact | **15 core + 4 Section F (Compressed Mode) = 19** | `Assessments/Wiring for Impact.md` |
| Orientation for Impact | 12 | `Assessments/Orientation for Impact.md` |
| Rejection Gift Finder | 12 | `Assessments/Rejection Gift Finder.md` |
| Onboarding | 12 + 6 Section I (Current State) = 18 | `Assessments/Onboarding.md` |
| B3 Wellness Baseline | 18 | `Assessments/B3 Wellness Baseline.md` |
| B3 Daily Check-In | 3 + Q4 (Effort Value) | `Assessments/B3 Daily Check-In.md` |

> **There is no 36-question version of Wiring for Impact.** Any reference to "36 questions" is an error; the assessment is 15 core + 4 Section F. See `AI-Era Calibration Addendum.md` Part C.

**Wiring for Impact** maps 9 gifts: Realist, Supporter, Doer, Organizer, Explainer, Integrator, Enterpriser, Encourager, Wise Observer.
**Orientation for Impact** maps 5 types: Analytical, Relational, Practical, Strategic, Imaginative.
**Rejection Gift Finder** maps the gift categories surfaced in `Assessments/Rejection Gift Finder.md` (Insight/Abstract Questioner, Pattern Seer, etc.).

## Governance addenda (apply to interpretation, not to questions)

- **`AI-Era Calibration Addendum.md`** — DISRUPTION_POSTURE values, legacy-vs-AI-era signal rules, capability-vs-role distinction, §8.2 AI-Era Calibration Feedback Protocol. Governs the **AI-Era Intelligence** section of the combined profile result.
- **`ProScan Addendum.md`** — §5.1.1 Shadow Mode Capture (Wiring Section F), Current State Calibration Layer + Presence Gap Score (Onboarding Section I), §7.1 Effort Value Assessment (B3 Daily Q4), §8.1 Identity State Interpretation Protocol (Foundational Self vs. Current Self language governance).

The operational essence of both addenda is already encoded in System Prompt §14 (Background Systems). These files hold the granular detail (score tables, exact label formats, canonical statements) for when an output needs it.

## Still pending (not yet in the repo)

The full DesignSuite + Career Navigator *stacks* described in System Prompt §15 (Stacks 1–35: scoring/normalization math, confidence bands, the full Rejection Gift Finder multi-layer output spec, radar visual specs, Career Navigator tool knowledge) are **not** present. The alpha (3 user-model assessment runners + combined profile result page) does not require them — it needs the question banks (present) + the result template (in the reference HTMLs) + the addenda governance (present). Supply the full stacks when building beyond the alpha.
