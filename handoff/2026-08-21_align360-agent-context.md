# Align360 — full context handoff

**Written:** 2026-08-21
**Repo:** `~/Documents/Claude/Projects/Samuel NGU`, app in `align360-app/`
**Branch:** `feat/admin-portal-visibility` (this is the working branch; it is what gets pushed to `main`)
**Live:** https://align360.io

Everything below was verified in-session against the code or a live API, not recalled. Where something is unverified it says so.

---

## 0. Read this before you touch anything

Five traps in this repo have each cost hours. They are not obvious and they all fail *silently*.

### 0.1 `git push` does NOT deploy. Deploys are CLI-only.
The Vercel project has **no Git integration**. Pushing to `main` deploys nothing. Every deploy is:

```bash
cd "~/Documents/Claude/Projects/Samuel NGU"   # repo ROOT, not align360-app/
vercel deploy --prod --yes
```

Root Directory is set to `align360-app`, so running from *inside* `align360-app/` makes Vercel look for `align360-app/align360-app` and fail. The repo root needs its `.vercel` link (already there) and `.vercelignore` (already there). Without the ignore file the upload is ~220MB and trips the 100MB per-file limit on a stray `IMG_3966.MOV` and on `next-swc` in node_modules. **Do not add a blanket `*.pdf` rule**: `align360-app/public/resources/*.pdf` are served assets.

### 0.2 `/admin` must be exempted in TWO unrelated gates
- `lib/supabase/middleware.ts` → `PUBLIC_PREFIXES` (server-side Supabase gate)
- `app/_components/Shell.tsx` → `BARE_PREFIXES` (client-side onboarding + paywall gate)

Missing the second is silent server-side: `/admin` returns 200 and then the client redirects to `/onboarding`. This shipped broken and made the portal unreachable for anyone who was not already an onboarded paying user. If `/admin` bounces, check `BARE_PREFIXES` first.

### 0.3 The Stripe account is SHARED with other businesses
`STRIPE_SECRET_KEY` is the Ascendance platform account, which also bills **AI Agents as a Service**, **AI Application Hosting & Maintence**, and **Website Hosting** (these are ReWomen and similar, confirmed separate products, not Align360).

An unscoped `stripe.subscriptions.list()` returns all of them with a 200 and no error. That produced a reported MRR of **$8,033** when Align360's real MRR is **$100.00/mo** (4 subs x $25).

Every admin Stripe read must go through `lib/admin/data.ts`, which applies:
- `connectedOptions()` from `lib/stripe/client.ts`
- a brand filter on product `metadata.brand === 'Align360'` (stamped by `scripts/stripe-setup-products.ts`)

Excluded revenue is counted and named in the UI, never dropped silently. **Never quote an MRR figure without decomposing it** via `GET /api/admin/subscriptions` (superadmin).

Also note `STRIPE_CONNECTED_ACCOUNT_ID` is **unset in production**, so Stripe Connect is inert and no application fee is actually charged despite `STRIPE_APPLICATION_FEE_PERCENT=50`. The Revenue split panel is a manual calculation and says so.

### 0.4 `ADMIN_USERS` is a Vercel *Sensitive* var and cannot be read back
Not by the dashboard, not by `vercel env pull` (returns empty strings for every var). You cannot look up who has admin access or recover a password (scrypt hashes). The only route to a known state is re-provisioning:

```bash
npx tsx scripts/provision-admin.ts --generate
```

It prints each password once plus the full JSON. **The output REPLACES the whole array**, so anyone omitted loses access. Currently provisioned: `wllprbl@gmail.com` (superadmin), `samuel@align360.io` (admin), `drewcline168@gmail.com` (admin).

### 0.5 If `next build` fails at require time, reinstall node_modules, do not debug app code
Symptoms seen on 2026-08-21, both at exit 1 before anything compiled:

```
unhandledRejection TypeError: _lrucache.default is not a constructor
    at next/dist/server/require.js:46
unhandledRejection TypeError: polyfills is not a function
    at graceful-fs/graceful-fs.js:104
```

Two unrelated packages failing the same way (a module that should export a function exporting something else) means the dependency tree is damaged, not that app code is broken. Reinstalling one package just moves the error to the next victim. The fix is:

```bash
rm -rf node_modules .next && npm ci
```

That restored a clean `BUILD_EXIT=0`. Suspected origin is an `npm install` interrupted while this machine was loaded. **Production was never affected**: Vercel installs fresh from `package-lock.json` on every deploy, which is why deploys kept succeeding while local builds failed.

### 0.6 Do not grep build output for failures
Verification in this session used `npm run build | grep -E "✓ Compiled|Failed|error"`. Lowercase `error` does **not** match `TypeError:`, so that filter was structurally incapable of surfacing the failure above, and builds were reported green while exiting 1. Always capture the real exit code:

```bash
npm run build > /tmp/build.log 2>&1; echo "EXIT=$?"; tail -20 /tmp/build.log
```

### 0.7 Stripe SDK v22 gotchas
- `current_period_end` moved from the Subscription to the subscription **item**. Read `item.current_period_end` with a fallback.
- Expansion is capped at **4 levels**. `data.items.data.price.product` is 5 and 400s the whole request. Product names come from a separate `products.list()` pass mapped by id.

---

## 1. Environment problems live right now

| Problem | Detail |
|---|---|
| **git push is broken** | `osxkeychain` holds nothing for github.com, `gh` token is invalid, only SSH key is `Replit.pub` and `ssh -T git@github.com` gets `Permission denied`. Fix is `gh auth login -h github.com && gh auth setup-git`, which needs a browser. **Will has been asked to run it.** |
| **Machine is heavily loaded** | `tsc --noEmit` takes 4+ minutes. `git log -3` times out at 90s. Run long checks with `run_in_background: true`. |
| **Another session may be live in this repo** | On 2026-08-21 a second Claude session was running `git blame` against `scripts/deploy.sh` and `src/lib/production-deploy-harness.test.ts`, **neither of which exists in this repo**. Two sessions contending for one git index produced repeated hangs and stale `.git/index.lock` files. |

### Stale `index.lock`
`git commit` killed by a timeout leaves `.git/index.lock` behind, and every later git write then fails with "Another git process seems to be running". Before deleting it, **check for live git WRITE operations**:

```bash
ps aux | grep -E "bin/git (commit|merge|rebase|am)"
```

Match on `bin/git`, not bare `git`. A bare pattern also matches the *shell wrapper* whose command line contains the string "git commit", so it reports a live write on your own command and always looks unsafe. Verified: the bare form produced exactly that false positive here.

`git log` / `git blame` / `git status` reads do not hold `index.lock`, so their presence is not a reason to keep it. But if another session is mid-commit, deleting the lock can corrupt its index. Check first, then `rm -f .git/index.lock`.

Because git writes are slow and hang here, prefer:
```bash
git commit -F /tmp/msg.txt          # message from a file, not a heredoc
```
run with `run_in_background: true`, then confirm with `git log --oneline -1`. A timed-out commit often leaves the files **staged but uncommitted**, so always verify rather than assuming it failed cleanly.

---

## 2. What shipped recently (all deployed to production)

| Commit | What |
|---|---|
| `9a833d0` | Admin portal rebuild: Overview/Users/Teams/Feedback/Revenue tabs, full user list with payment state, per-user drilldown, seat math, trend charts. Fixed the `BARE_PREFIXES` bug that made `/admin` unreachable. Fixed silent MRR truncation (was `limit: 100`, no pagination, `status: 'active'` only). |
| `80eeda1` | `provision-admin.ts --generate` for fresh passwords. |
| `5f6d6ea` | Admin portal restyled onto the Black Cherry Fig brand. Also fixed a scroll bug: `globals.css` sets `html, body { overflow:hidden }` so `.adm` needs its own scroll container. |
| `b0d9932` | Fixed the Stripe 4-level expand limit that was 502ing every admin data route. Added repo-root `.vercelignore`. |
| `21c8fb2` | Scoped every admin Stripe read to the connected account. |
| `33eeb5d` | Brand filter so revenue is Align360-only. |
| `8268e6a` | Chat images route to an open-weights vision model via `IMAGE_MODEL`. |
| `116abb8` | PDFs extracted to text server-side with `pdf-parse`, so **no document reaches OpenAI**. |
| `56a6d58` | AI companion renamed Master Chief → **Khloee** (placeholder; Master Chief is a Halo trademark). |
| `930e2a2` | Clarity headline tier now reads off the progression ladder. **Committed but NOT pushed** (git creds). |

### AI routing as it stands
- `CHAT_MODEL` / `REPORT_MODEL` = `z-ai/glm-5.2` → OpenRouter
- `IMAGE_MODEL` = `google/gemma-3-27b-it` → OpenRouter (verified working against a real image)
- Documents → extracted to text server-side, never sent to a model provider as a file
- **OpenAI is out of the attachment path entirely.** `OPENAI_API_KEY` is still set but unused there.
- `deepseek/deepseek-v4-flash` **cannot do images** (`input_modalities: ['text']`). Check `input_modalities` on the OpenRouter models API before wiring any vision model.
- Charis (Covenant gateway) exists in `lib/ai.ts` but `CHARIS_API_KEY` is not in production, so it is inert.

---

## 3. Uncommitted work in progress

Confirmed by `git status` at time of writing. HEAD is `930e2a2`. Four files, all edited today, **not committed, not deployed**:

```
 M align360-app/app/landing.css
 M align360-app/app/page.tsx
 M align360-app/lib/clarity.ts
 M align360-app/lib/profile.ts
```


| File | Change |
|---|---|
| `lib/profile.ts` | Added a shared `VOICE` block and rewrote three field instructions that were manufacturing the AI-Era "language drift" Drew reported. |
| `lib/clarity.ts` | Same treatment: `"one evocative line"` → plain/specific, aiEra pinned to the person's own signals. |
| `app/page.tsx` | New Privacy & Security section (`#privacy`), plus four routes into `/contact` where there were none. |
| `app/landing.css` | `.lp-foot-link` styling for the new footer links. |

**A typecheck + build on these was still running when this was written and its result is not known.** Verify before committing.

### Why the AI-Era prompt change was needed
`PROFILE_SCHEMA_B` literally said `"aiNote":"<one line: what AI cannot do here>"`, run four times. All four cells came back in one rhythm:

> "AI optimizes within a frame; it cannot decide the frame itself is wrong."
> "AI extrapolates from existing data; it cannot envision what has no precedent."
> "AI generates content; it cannot generate the human conviction that makes others move."
> "AI accelerates execution for the resourceful; it cannot create the will to begin from zero."

The cards did the same with "AI can X, but you Y". The schema was naming the construction it wanted. That is fixed, but **it only affects new generations** — existing reports keep the old wording until regenerated.

---

## 4. Open work, roughly prioritized

1. **Regenerate Drew's Full Identity Profile.** He explicitly asked for the AI Readiness headings to be rerun. The prompt fix is in; his report needs to regenerate for him to see it. This is the fastest way to close the loop with him.
2. **Commit + deploy the four uncommitted files** once the build is confirmed green.
3. **Value Spectrum ladder — BLOCKED, do not decide unilaterally.** 5 scoring bands are spread across 8 ladder stages, so **Impostor Pattern, Value Aware and Authentic are unreachable** as a current position; they render but no score maps to them. Either collapse the ladder to 5 or subdivide the bands to 8. **Sam is rerunning the Value Spectrum scoring** and will send it, which may resolve this. Wait for it. See `lib/clarity-scoring.ts` `CONFIG['value-spectrum']`.
4. **Website, enterprise-first restructure.** The live site is entirely individual-first (`ENTER = '/chat'`, hero "Discover Your Wiring"). Samuel has a separate enterprise-first `0. A360_Ent First Website.html` (1.1MB) in Drive. That is a **rewrite, not an edit**, and should be scoped before starting.
5. **Should the assessments be closed on the site?** Samuel proposed closing them until onboarding + assessment + dashboard updates land. It switches off the only signup funnel. **Will has not answered. Do not do this without an explicit yes.**
6. **Marketing collateral** (designed PDF/PPT) from the enterprise one-pager + problem/opportunity map. Will told Samuel to use Claude for design and ChatGPT's image model for imagery.
7. **Voya deal blockers**: an API to Workday as system of record, and ~15 documented compliance items for third-party vendor sign-off. Samuel specced `2.0 API Integration Layer Spec` and `2.1 StrategyOS Enterprise Integration Requirements` in Drive on 8/16. **Neither has been read yet.**
8. **`STRIPE_CONNECTED_ACCOUNT_ID` decision**: activate Connect so the 50% application fee flows automatically, or drop the env var since it currently implies a fee that is not being charged.
9. Not built, flagged rather than skipped: cohort retention (needs event instrumentation), admin password reset (a lost password means regenerating the env var by hand), OCR for scanned PDFs (they now error with "probably a scan, paste the text").

---

## 5. Decisions owned by other people

| Item | Owner | Status |
|---|---|---|
| Value Spectrum ladder: 5 or 8 | Drew / Sam | Sam rerunning scoring |
| Identity Profile copy rewrites | Drew | Said no specific language wanted, just fix the drift |
| One unified assessment (collapse 5 into 1) | Team | Agreed in direction, structural, to be scoped on a call |
| Close assessments on site | Will | Unanswered |
| End-to-end build timeline | Will | Deferred to a call |
| Sovereign pricing | Will | Answered: private model access + verifiable privacy, roughly +$5k on the build |
| Case study discount | Will | Answered: decide internally per opportunity |

---

## 6. Team and comms

- **Slack workspace:** Ascendance Studio. Channel `#aligndev` (`C0BH5HDUG3A`).
- **Samuel Ngu** `U0BH5HP6L64` (`@askishmael`) — founder, doing enterprise outreach.
- **Drew** `U0BG50T8FGT` — product/assessment feedback.
- **Will** `U05GDA19Z32`.
- Will's Slack voice is lowercase-casual, keeps apostrophes, capitalises names, no bold headers or bullet symbols, no em dashes. **Draft messages and let Will approve before sending.**
- The Slack MCP **cannot upload files.** `mcp__claude-in-chrome__file_upload` fails with a `paths` validation error. Files have to be attached by hand.

---

## 7. Useful commands

```bash
# tests (fast, no network)
npx tsx scripts/test-admin-snapshot.ts     # 27 checks on the admin join logic
npx tsx scripts/test-clarity-labels.ts     # 592-combination headline/ladder invariant

# verify (SLOW on this machine, background it)
npx tsc --noEmit -p tsconfig.json
npm run build

# deploy (from repo ROOT)
vercel deploy --prod --yes

# admin API smoke test
# log in at POST /api/admin/login, then GET /api/admin/{metrics,users,orgs,timeseries,subscriptions}
```
