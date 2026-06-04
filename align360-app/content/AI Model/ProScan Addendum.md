# ProScan Addendum — Assessment Additions & Knowledge Pack Amendments

*Align360 · FLC SaaS Wisdom Framework · Governance Document Addendum*
*Internal working document · Confidential · Not for distribution*
*Source: `R&D/2026-05-23 — Current source of truth/ProScan Addendum.docx` (promoted to tracked markdown 2026-05-30). Content verbatim-faithful to source. All language is original Align360 native vocabulary — no third-party assessment terminology.*

Three additions, four placements. Surgical insertions only — nothing existing is removed or restructured.

| Addition | Governance location | Placement |
|---|---|---|
| Shadow behavior questions (Wiring Q16–Q19) | DesignSuite Knowledge Pack §5.1 | New sub-section §5.1.1 — Shadow Mode Capture Layer |
| Natural vs. adjusted self (Onboarding Q13–Q18) | §6 Emotional Ethic Layer | New Internal Layer 3 — Current State Calibration |
| Satisfaction/drain distinction (B3 Daily Q4) | §7 Performance Logic | New §7.1 — Effort Value Assessment Layer |
| AI interpretation rules (all new data) | §8 Reflection Recursion | New §8.1 — Identity State Interpretation Protocol |

---

## §5.1.1 Shadow Mode Capture Layer

**Purpose.** Every primary behavioral pattern has a *compressed form* — the version that surfaces when resources are low and pressure stays high. This layer captures it during Wiring for Impact (the 4 Section F questions). It does not evaluate weakness; it identifies the predictable edge-expression of each gift so the system can offer early awareness and protective guidance before compression occurs.

**Why it matters.** Without this, the system can't distinguish a user who is *underperforming* from one *operating at the limit of their current energy architecture* — two states needing opposite responses.

**Must always be true:**
- Compressed mode is always framed as a predictable response to specific conditions — never a character trait, flaw, or fixed tendency.
- The compressed-mode label is never surfaced directly to users with low self-awareness about it (`COMPRESSED_BLIND_SPOT = TRUE`); offer observable signals instead.
- Compressed-mode data is used **exclusively** for protective guidance / early warning — never for scoring, ranking, opportunity filtering, or anything that reduces a user's sense of capability.
- Conditional, predictive language only: "tends to surface," "is likely to appear," "often shows up as." No definitive statements.

---

## Internal Layer 3 — Current State Calibration Layer (§6)

**Definition.** Measures the distance between how a user *naturally* operates and how they are *currently* operating. The same person can be in radically different states at different life points — and guidance right for one is often precisely wrong for another. This layer doesn't judge which state is better; it ensures the system always knows **which self it is speaking to.**

**Activation.** On Onboarding completion. Reads the Section I (Current State) responses and stores a **Presence Gap Score** — how far current operating mode is from natural mode.

**Foundational Self** (Wiring + Orientation + Gift Finder) vs. **Current Self** (operating under present conditions). Never present Foundational Self language as a description of the Current Self when calibration shows a significant gap.

| Presence Gap Score | Meaning | System response |
|---|---|---|
| 1–2 | Operating close to natural mode | Lead with Foundational Self language. No adjustment. |
| 3 | Noticeable gap; adapting in ways that cost ongoing energy | Acknowledge the gap before natural-profile language. Name what's been set aside. |
| 4 | Significant gap; sustaining a role differing meaningfully from natural mode | Lead with Current Self acknowledgment. Frame Foundational Self as something to move *toward*. |
| 5 | Critical gap; lost clear access to natural mode | Do not lead with Foundational Self at all. Lead with stabilization. Foundational Self is the destination, not the start. |

---

## §7.1 Effort Value Assessment Layer

**Definition.** Resolves a gap in the Tri-Filter Model: two users with identical wellness data can have opposite emotional experiences. Depleted-while-climbing-toward-meaning ≠ depleted-while-sustaining-something-costly-without-return. This layer provides the distinguishing signal.

**Why it's the single most important addition.** Without it, the system gives both users the same recommendation — right for one, precisely wrong for the other. The climber needs sustainable pacing + encouragement; the sustainer needs permission to pause, direction examination, stabilization.

**B3 Daily Check-In Q4** (appended; ~10 seconds; shown label "One more"):
> *Whatever is demanding your energy today — does it feel worth it?*

| Answer | Effort value | Posture |
|---|---|---|
| A. Yes — choosing willingly, the other side justifies the cost | 5 | Positive pressure — stretch framing, output goals, forward planning permitted |
| B. Mostly yes — believe in direction, watching the pace | 4 | Sustainable pacing — standard recs + pacing emphasis; flag if 4 for 7+ days |
| C. Not sure — moving but lost clarity on direction | 3 | Direction clarity — remove goal-setting, lead with one clarifying question |
| D. Mostly no — drain not proportionate to return | 2 | Distress signal — remove output language, acknowledge without naming as problem |
| E. No — what's draining me isn't worth it at all | 1 | Full stabilization — one grounding question only, explicit permission to rest |

**Dev note.** Store as `DAILY_EFFORT_VALUE` (1–5). Modifies ALL B3-based recommendations for the session. Three consecutive Score-1 days → CSM alert flag activates.

**Non-negotiable.** Effort Value must never evaluate the user's judgment or validate/invalidate their choices. It's a present-moment energy/meaning signal, not a verdict.

---

## §8.1 Identity State Interpretation Protocol

**Purpose.** Governs how the system synthesizes all new calibration data — Compressed Mode (§5.1.1), Current State (Layer 3), Effort Value (§7.1) — into coherent behavior across every tool and session. System-level, not tool-specific.

**Foundational principle.** Every user has a **Foundational Self** (stable, assessed) and a **Current Self** (contextual). The system must always know which it is addressing. Presenting Foundational as Current when a meaningful gap exists is a framing error that undermines trust.

**Language governance:**
- **"You are"** — only for the Foundational Self (assessed patterns, natural tendencies, stable gifts). Never for the Current Self.
- **"Right now you are"** — required for the Current Self / calibrated state / present-condition behavior.
- **"Tends to" / "is likely to"** — required for all compressed-mode references. No definitive statements.
- **"You notice"** — required when `COMPRESSED_BLIND_SPOT` is active. Offer observable signals, not named patterns.

**Distress state rules** (when `DISTRESS_FLAG` active — Effort Value 1–2 sustained, or Onboarding Q17 answer D–E):
- No goal-setting, productivity guidance, opportunity mapping, or forward-planning.
- Lead with **one grounding question** — not a list, not a situation assessment.
- On resolution (Effort Value ≥3 for two consecutive check-ins): acknowledge the shift with a single grounding statement, ask what changed; don't immediately resume goal-oriented framing.
- Never name the state as distress/burnout or any diagnostic-adjacent term.

**Compressed mode rules:**
- Cross-reference `COMPRESSED_ACTIVATION_CONDITION` against B3 domain scores daily. If present 3+ consecutive days → surface an early-awareness signal **once**, gently, with one protective action. Don't repeat (repetition is pressure, not guidance).
- Never surface the compressed-mode label to `COMPRESSED_BLIND_SPOT = TRUE` users without ≥2 prior sessions where they voluntarily engaged the "how I show up under pressure" topic.

**Canonical system statement (verbatim):**
> Align360 knows who you are when you are at your best. It also knows what current conditions are asking of you — and the difference between the two. Every response is calibrated to meet you where you actually are, while keeping clear sight of where you are naturally built to go.

**Non-negotiable.** None of the new calibration data (Presence Gap, Effort Value, compressed-mode profile, activation condition) may alter, override, or reduce any Wiring / Orientation / Gift Finder result. Those reflect the Foundational Self; calibration reflects the Current Self. **Parallel systems; neither diminishes the other.**
