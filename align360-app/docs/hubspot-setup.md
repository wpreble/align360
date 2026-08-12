# HubSpot feedback-table setup (runbook)

Feedback already mirrors as **notes on the contact timeline** (needs only `HUBSPOT_TOKEN`). To ALSO get the "table" view — one row per feedback in a HubSpot custom object — do this once:

1. **Check tier:** custom objects need an **Enterprise** hub (any of Marketing/Sales/Service/Ops). No Enterprise → skip; keep notes (or say the word and we pivot the table mirror to contact properties / a shared HubSpot list instead).
2. **Create the object:** Settings → Data Management → Objects → Custom objects → *Create* → name `App Feedback` (internal `app_feedback`). Note its **fullyQualifiedName** (looks like `p_app_feedback` or `2-12345678`).
3. **Add properties** (internal names must match exactly — the sync 400s on unknown properties and fails open):
   - `a360_feedback_id` — single-line text, **set "Require unique values"** (idempotency key = Supabase row id)
   - `a360_email` — single-line text
   - `a360_message` — multi-line text
   - `a360_path` — single-line text
   - `a360_submitted_at` — date picker (datetime)
4. **Token scopes:** the Private App token needs `crm.objects.contacts.read/write`, `crm.objects.notes.write`, and `crm.objects.custom.read` + `crm.objects.custom.write`. (Re-check the existing token — it was provisioned for contacts only; without note/custom scopes those mirrors 403 silently.)
5. **Env (Vercel):** set `HUBSPOT_FEEDBACK_OBJECT=<fullyQualifiedName from step 2>` alongside the existing `HUBSPOT_TOKEN`, redeploy.

Then run the backfill once (dry-run first) to mirror all pre-existing rows:

```bash
NEXT_PUBLIC_SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… HUBSPOT_TOKEN=… HUBSPOT_FEEDBACK_OBJECT=… npx tsx scripts/backfill-feedback-to-hubspot.ts
```

Add `--confirm` to apply. Re-runs are idempotent; it doubles as the retry job for any rows whose inline mirror failed (`hubspot_synced_at IS NULL`).
