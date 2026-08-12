// Best-effort HubSpot CRM sync for the marketing pipeline (contacts → segmentation
// → email). Everything here is ENV-GATED (HUBSPOT_TOKEN) and FAILS OPEN: with no
// token, a network error, a bad response, OR a slow/hung HubSpot, the calling flow
// (signup, checkout, webhook) proceeds untouched. Mirrors the credit-metering
// "best-effort" pattern — CRM sync must never break auth or billing.
//
// Latency matters as much as errors: several call sites AWAIT this before doing
// user-facing work (the checkout route before creating the Stripe session, the auth
// callback before redirecting, the webhook before returning 200 to Stripe). So the
// fetch is bounded by a short AbortSignal timeout — a degraded HubSpot can add a
// couple of seconds at most, never stall a request into a serverless 5xx.
//
// Runtime credential: a HubSpot Private App token (Settings → Integrations →
// Private Apps) with scopes `crm.objects.contacts.read` + `crm.objects.contacts.write`.
// Set it in Vercel as HUBSPOT_TOKEN. The MCP connection used during setup is a
// separate, chat-only credential and is NOT what the deployed app uses.

const API = 'https://api.hubapi.com';
const token = () => process.env.HUBSPOT_TOKEN;

/** true when a token is present, so callers can skip work entirely. */
export function hubspotEnabled(): boolean {
  return !!token();
}

type ContactProps = {
  firstname?: string;
  lastname?: string;
  // Standard HubSpot lifecycle stage — the native segmentation axis.
  // 'lead' for signups, 'customer' for paid. Omit to avoid moving a contact
  // backwards (e.g. don't stamp 'lead' on a returning customer's login).
  lifecyclestage?: 'subscriber' | 'lead' | 'marketingqualifiedlead' | 'customer' | string;
  // Custom HubSpot contact property (internal name `align360_source`, created in
  // the portal). Marks how a contact entered — 'app_signup' | 'org_checkout_lead'
  // | 'stripe_checkout'. Any value means "originated from Align360"; the paid/lead
  // split is carried by lifecyclestage, not this. MUST exist in HubSpot before we
  // send it — an unknown property 400s the whole upsert (and we fail open → no contact).
  align360_source?: 'app_signup' | 'org_checkout_lead' | 'stripe_checkout' | string;
  [k: string]: string | undefined;
};

/**
 * Create-or-update a contact by email (idempotent upsert). No-op without a token;
 * never throws. Empty/undefined props are dropped so we never blank an existing field.
 */
export async function hubspotUpsertContact(email: string | null | undefined, props: ContactProps = {}): Promise<void> {
  const t = token();
  if (!t) return;
  const addr = (email || '').trim().toLowerCase();
  if (!addr || !addr.includes('@')) return;

  const properties: Record<string, string> = { email: addr };
  for (const [k, v] of Object.entries(props)) {
    if (v != null && String(v).trim() !== '') properties[k] = String(v);
  }

  try {
    const res = await fetch(`${API}/crm/v3/objects/contacts/batch/upsert`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ inputs: [{ idProperty: 'email', id: addr, properties }] }),
      // Hard cap so a slow/hung HubSpot can never block an awaiting caller (checkout,
      // auth callback, webhook) into a serverless timeout. On abort, fetch rejects and
      // the catch below swallows it — fail open, same as any other error.
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) {
      // Log without throwing so the caller (auth/checkout) is never affected.
      console.error('hubspot upsert failed:', res.status, (await res.text()).slice(0, 300));
    }
  } catch (e) {
    // Includes AbortError/TimeoutError from the signal above — intentionally non-fatal.
    console.error('hubspot upsert error:', e instanceof Error ? e.message : e);
  }
}

/**
 * Attach a NOTE to a contact (by email), so in-app feedback shows on the person's
 * timeline in the CRM. No-op without a token; never throws. Resolves the contact id
 * (creating a bare contact if needed so the note always has something to attach to),
 * then posts a note associated to it. Bounded timeouts, same fail-open contract as
 * the upsert above — a HubSpot hiccup must never fail the feedback save.
 *
 * Returns the created note id, or null on any failure/no-op — callers that need a
 * durable success signal (the feedback sync stamp) key off a non-null return.
 */
export async function hubspotAddNote(email: string | null | undefined, body: string): Promise<string | null> {
  const t = token();
  if (!t) return null;
  const addr = (email || '').trim().toLowerCase();
  const text = (body || '').trim();
  if (!addr || !addr.includes('@') || !text) return null;
  const headers = { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' };

  const contactId = async (): Promise<string | null> => {
    try {
      const r = await fetch(`${API}/crm/v3/objects/contacts/${encodeURIComponent(addr)}?idProperty=email&properties=email`, { headers, signal: AbortSignal.timeout(3000) });
      if (r.ok) return (await r.json())?.id ?? null;
    } catch { /* fall through */ }
    return null;
  };

  try {
    let id = await contactId();
    if (!id) { await hubspotUpsertContact(addr); id = await contactId(); }
    if (!id) return null; // couldn't resolve a contact — feedback still lives in Supabase

    const res = await fetch(`${API}/crm/v3/objects/notes`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        properties: { hs_note_body: text.slice(0, 65000), hs_timestamp: new Date().toISOString() },
        // 202 = HubSpot-defined note→contact association.
        associations: [{ to: { id }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 202 }] }],
      }),
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) {
      console.error('hubspot note failed:', res.status, (await res.text()).slice(0, 300));
      return null;
    }
    return (await res.json())?.id ?? null;
  } catch (e) {
    console.error('hubspot note error:', e instanceof Error ? e.message : e);
    return null;
  }
}

/** Split a display name into HubSpot's firstname / lastname fields. */
export function splitName(full?: string | null): { firstname?: string; lastname?: string } {
  const n = (full || '').trim();
  if (!n) return {};
  const parts = n.split(/\s+/);
  return { firstname: parts[0], lastname: parts.slice(1).join(' ') || undefined };
}
