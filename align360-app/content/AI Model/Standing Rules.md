# Standing Rules — apply to all outputs

Standing rules that must be honored by every output the live AI produces and by every surface (web, demo, partner embeds, exports) where Align360 content appears. The system prompt should reference this file and enforce these rules globally.

When a rule is added or changed, version it the same way as the system prompt: working copy here, prior versions in `./Archive/` with a date suffix.

---

## IP / Copyright notice (added 2026-05-24)

Every output the platform generates, and every surface where Align360 assessments or AI outputs are displayed, must include the following IP notice:

> © [Year] Align360. All rights reserved. Reproduction or use of these assessments without written permission is prohibited.

**Where it must appear:**

- The platform UI itself (web app, demo, partner embeds) — persistent footer or unobtrusive fixed banner.
- Any document the AI generates and the user receives (assessment results, profile reports, summaries, exports). Place at the foot of the document or in a standard footer block.
- Any HTML / PDF / DOCX export.

**Implementation notes:**

- `[Year]` should resolve to the current year at render time (e.g. JavaScript `new Date().getFullYear()` for HTML; dynamic field for docx; system date for AI-generated text).
- For text/Markdown outputs, the notice should be at the end of the document as plain text — not styled away.
- For chat replies that produce *standalone deliverables* (a generated profile, a result report), include the notice in the deliverable itself, not at the bottom of every chat turn.
- The demo at `Demo/align360-demo.html` carries it as a fixed bottom-bar footer — same wording, year auto-resolved.

**Why this matters:** The assessments are proprietary intellectual property of Align360. The notice puts users and downstream readers on notice of that, which is a baseline requirement for protecting the IP in the assessments and the AI outputs derived from them.
