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
| `OPENAI_MODEL` | `gpt-4o-mini` | Swap to `gpt-4o` for better quality, higher cost. |

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

## What's NOT here yet (Phase 2)

- Multi-step onboarding (the demo's name/intent/wiring flow)
- 3-panel chat shell (sidebar + Insight Engine panel)
- Theme toggle UI
- Assessment runners (Wiring for Impact, Orientation, Rejection Gift Finder, B3)
- Auth + session persistence
- Streaming responses

These were intentionally deferred so Phase 1 is small, reviewable, and shippable.

## Deploy

1. Push the repo to GitHub (private).
2. In Vercel: import the repo. Set **Root Directory** to `align360-app`. Framework auto-detects as Next.js.
3. Env vars: `OPENAI_API_KEY`, optionally `OPENAI_MODEL`.
4. Deploy.
