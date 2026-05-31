# align360-app

The new Next.js app for Align360. Vercel-ready. Replaces the demo HTML once feature parity lands.

## Stack

- Next.js 14 (App Router) + TypeScript
- OpenAI (server-side via `/api/chat` route — key never reaches the browser)
- Plain CSS with Align360 brand tokens (no Tailwind — same palette as `Demo/align360-demo.html`)

## Setup

```bash
cd align360-app
npm install

# .env.local: either copy from .env.example, or symlink to the workspace .env.local:
ln -s ../.env.local .env.local

npm run dev
```

Open http://localhost:3000.

## Environment

| Var | Default | Notes |
|---|---|---|
| `OPENAI_API_KEY` | — | Required. Set in `.env.local` (gitignored). |
| `OPENAI_MODEL` | `gpt-5.5` | Reasoning model — calls use `max_completion_tokens` (not `max_tokens`) and default temperature. |

## How the system prompt works

`lib/system-prompt.ts` reads these files at **request time** from the workspace root:

- `AI Model/System Prompt.md`
- `AI Model/Standing Rules.md`
- `AI Model/Knowledge File — Part 1.md`
- `AI Model/Knowledge File — Part 2.md`

Edit those files and the change takes effect on the next message — no rebuild. When v6.3 lands, just drop it into `System Prompt.md`.

`next.config.js` is configured with `outputFileTracingIncludes` so the same loader works on Vercel (the AI Model + Assessments folders ship with the serverless function).

## UI requirements baked in (per 2026-05-25 Will feedback)

- **Light mode default** (no flash of dark, no toggling required).
- **Wider reading + input column** — max 768px, scaling to 880px on ≥1280px screens. Matches ChatGPT/Claude proportions.
- **Window scrollbar, not pane scrollbar** — `body` is the scroll container.
- **Static input at bottom** on all screen sizes. Fixed positioning; doesn't move with content scroll.
- **No replaying welcome tour** — opening message renders once per session, no modal/onboarding loop.
- **Persistent IP notice footer** — per `AI Model/Standing Rules.md`. Year auto-resolves.
- **Mobile-tight header** — wordmark sits cleanly, no menu overlap.

## Roadmap — Alpha Sprint (current)

**The authoritative plan is `../DEV PLAN — Alpha Sprint 2026-05-28.md` and `../CODING AGENT BRIEF — Alpha Sprint 2026-05-28.md` at the repo root. Read those before building. They override the roadmap notes here.**

What Phase 1 (this commit) delivers: a minimal chat shell — light-mode default, wide pane, static input, OpenAI wired via `/api/chat`, system prompt loaded live from `AI Model/*.md`.

What the alpha sprint adds, in build order (per the dev plan §5 / brief):

1. **Supabase** auth (magic-link only) + persistence (`assessment_responses`, `profile_snapshots`).
2. **Typeform-style assessment runners** — `/assessment/[slug]` for `wiring`, `orientation`, `rejection-gift`. One question per screen, parsed from `Assessments/*.md` at request time. Reference feel: `../align360 lead gen inline.html`.
3. **Combined profile result page** — `/result` + `/result/[share_id]`. Converts the reference HTMLs to a React component; sections per dev plan §3.4 (incl. the AI-Era Intelligence block).
4. **AI narrative generation** — `app/api/profile/generate/route.ts`, server-side, cached to `profile_snapshots.payload_json`.
5. **Private share links**.

### Explicitly OUT of scope for the alpha (do not build — superseded my earlier Phase-2 notes)

Onboarding flow (auth → straight into Wiring Q1), 3-panel chat shell, theme toggle / dark mode, streaming, chat-with-your-profile, in-product payment/credit gate, B3 + Onboarding + Daily Check-In runners, admin panel, notification emails. See dev plan §4 and the brief's "say no to all of them" list.

## Deploy

1. Repo is on GitHub (private): `wpreble/align360`.
2. In Vercel: import the repo. Set **Root Directory** to `align360-app`. Framework auto-detects as Next.js.
3. Env vars: `OPENAI_API_KEY`, `OPENAI_MODEL` (`gpt-5.5` — used for both chat and profile generation), plus the Supabase + Resend vars once auth lands (see the brief's Environment section).
4. Domain target: `alpha.align360.io` once DNS is added.
