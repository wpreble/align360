# B3 Wellness — Daily Check-In

*3 questions  ·  ~60 seconds  ·  Taken each morning  ·  Distinct flow from baseline*

Design note:  The daily check-in is a micro-pulse — one question per domain cluster. It does not re-establish the baseline. It detects drift from baseline and updates the day-type output. If a user is 7+ days in, pattern detection activates and weekly summaries are generated. The daily check-in must feel different from the baseline — shorter, faster, no scoring language shown to user.


### Q1

> Right now — how settled or activated does your body feel?

- **A.** Tight and activated — stress is present and my body is holding it  →  Score: 1
- **B.** A bit tense — manageable but I notice it  →  Score: 2
- **C.** Neutral — neither stressed nor fully at ease  →  Score: 3
- **D.** Settled — I feel grounded and relatively calm  →  Score: 4
- **E.** Easy — my body feels open and at rest  →  Score: 5

> **Dev note: Maps to: Emotional Regulation + Environment combined proxy. Flags if score is 2+ points below baseline average for those domains.**


### Q2

> How does your physical energy feel right now?

- **A.** Very low — I'm running on empty today  →  Score: 1
- **B.** Low — less than I'd like but I can function  →  Score: 2
- **C.** Moderate — enough for the day ahead  →  Score: 3
- **D.** Good — I feel physically capable and ready  →  Score: 4
- **E.** High — I feel strong and energized  →  Score: 5

> **Dev note: Maps to: Physical Body + Exercise combined proxy. If score ≤ 2 and yesterday was also ≤ 2, trigger recovery recommendation.**


### Q3

> How clear and focused does your thinking feel this morning?

- **A.** Foggy or scattered — hard to think clearly today  →  Score: 1
- **B.** Dull — more effort than usual to hold focus  →  Score: 2
- **C.** Functional — clear enough for routine work  →  Score: 3
- **D.** Sharp — thinking feels engaged and focused  →  Score: 4
- **E.** Very sharp — I feel mentally alive and clear today  →  Score: 5

> **Dev note: Maps to: Mental Clarity + Gut & Diet combined proxy. Score ≤ 2 suppresses high-complexity AI recommendations for the session.**


### Q4 — Effort Value

*Section: "One more" (added from ProScan Addendum, 2026-05-23). No internal section header shown to user.*

> Whatever is demanding your energy today — does it feel worth it?

- **A.** Yes — I am choosing this willingly and what is on the other side justifies the cost.   →  Effort value: 5 — positive pressure, forward-planning permitted
- **B.** Mostly yes — I believe in the direction but I am watching the pace.   →  Effort value: 4 — note for pattern tracking; sustainable pacing emphasis
- **C.** Not sure — I am moving but I have lost clarity on whether this direction is right.   →  Effort value: 3 — direction examination before action; pause on goal-setting
- **D.** Mostly no — the drain does not feel proportionate to what is returning from it.   →  Effort value: 2 — distress signal active; output framing removed
- **E.** No — what is draining me today does not feel worth it at all.   →  Effort value: 1 — full stabilization mode; no planning, no recommendations, one grounding question only

> **Dev note:  Store as DAILY_EFFORT_VALUE (1–5). This score modifies ALL B3-based recommendations for the session. Score 4–5: standard or stretch framing permitted. Score 3: clarity questions before action. Score 2: distress framing — acknowledge, do not plan. Score 1: full stabilization protocol. Three consecutive Score 1 days: CSM alert flag activates.**


## Daily score calculation

Logic

Average Q1 + Q2 + Q3 ÷ 3

Produces a single daily score. Day type assigned using same A/B/C thresholds as baseline.

Score drift detection

If daily average is 0.8+ below 7-day baseline average, flag and surface recovery recommendation.

Pattern activation (Day 7+)

Weekly summary generated. Most volatile domain identified. Trend direction noted (improving / stable / declining).

Override rule

If Q1 (nervous system) scores 1 for 3 consecutive days, escalate: suggest the user pause high-output commitments.

Align360  ·  Assessment Questions  ·  Onboarding + B3  ·  Dev Reference

Confidential  ·  Not for distribution
