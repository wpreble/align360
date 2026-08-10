import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/admin/guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// HubSpot sync health check, admin-gated. Exists because HUBSPOT_TOKEN is a
// Vercel SENSITIVE env var — unreadable outside the runtime — so scope problems
// are invisible from a dev machine and the fail-open mirror never surfaces them.
// This endpoint answers, from where the token actually lives:
//   1. Does the token exist, and which scopes does it carry? (introspection)
//   2. Are the feedback scopes present (notes write / custom objects read+write)?
//   3. Have any feedback notes ACTUALLY landed? (read-only notes search for the
//      "Align360 in-app feedback" marker written by lib/hubspot-feedback.ts)
//   4. Is HUBSPOT_FEEDBACK_OBJECT configured for the table mirror?
// Read-only against HubSpot — introspection + search create nothing.

const API = 'https://api.hubapi.com';

export async function GET() {
  const gate = requireSuperAdmin(); // token scopes/hub id are internal infra config
  if (gate instanceof NextResponse) return gate;

  const token = process.env.HUBSPOT_TOKEN;
  const feedbackObject = (process.env.HUBSPOT_FEEDBACK_OBJECT || '').trim() || null;
  if (!token) return NextResponse.json({ ok: false, tokenPresent: false, feedbackObject, error: 'HUBSPOT_TOKEN is not set in this environment.' });

  const out: Record<string, unknown> = { ok: true, tokenPresent: true, feedbackObject };
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  // 1+2) Token introspection → hub + exact scopes → feedback-scope verdicts.
  try {
    const res = await fetch(`${API}/oauth/v2/private-apps/get/access-token-info`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tokenKey: token }),
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const d = await res.json();
      const scopes: string[] = d?.scopes || [];
      out.hubId = d?.hubId ?? null;
      out.scopes = scopes.sort();
      out.scopeVerdict = {
        contacts: scopes.includes('crm.objects.contacts.write'),
        notesWrite: scopes.includes('crm.objects.notes.write'),
        customObjectsWrite: scopes.includes('crm.objects.custom.write'),
      };
      // The raw scopes list is included above — if a verdict looks wrong (HubSpot
      // occasionally renames scopes), eyeball `scopes` directly.
    } else {
      out.introspection = `HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`;
    }
  } catch (e) {
    out.introspection = e instanceof Error ? e.message : 'introspection failed';
  }

  // 3) Ground truth: has ANY feedback note actually landed? (read-only search)
  try {
    const res = await fetch(`${API}/crm/v3/objects/notes/search`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query: 'Align360 in-app feedback', limit: 5, properties: ['hs_timestamp'], sorts: [{ propertyName: 'hs_timestamp', direction: 'DESCENDING' }] }),
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const d = await res.json();
      out.feedbackNotes = { total: d?.total ?? 0, latest: d?.results?.[0]?.properties?.hs_timestamp ?? null };
    } else {
      // 403 here = the notes scope is missing → the live mirror has been failing silently.
      out.feedbackNotes = { error: `HTTP ${res.status}: ${(await res.text()).slice(0, 200)}` };
    }
  } catch (e) {
    out.feedbackNotes = { error: e instanceof Error ? e.message : 'notes search failed' };
  }

  // 4) Table mirror readiness: can we see custom object schemas (tier + scope probe)?
  try {
    const res = await fetch(`${API}/crm/v3/schemas`, { headers, signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const d = await res.json();
      out.customObjects = (d?.results || []).map((s: { fullyQualifiedName?: string; name?: string }) => s.fullyQualifiedName || s.name);
    } else {
      out.customObjects = `HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`;
    }
  } catch (e) {
    out.customObjects = e instanceof Error ? e.message : 'schemas read failed';
  }

  return NextResponse.json(out);
}
