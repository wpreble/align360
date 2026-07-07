// Best-effort HubSpot CRM sync for the marketing pipeline (contacts → segmentation
// → email). Everything here is ENV-GATED (HUBSPOT_TOKEN) and FAILS OPEN: with no
// token, a network error, or a bad response, the calling flow (signup, checkout,
// webhook) proceeds untouched. Mirrors the credit-metering "best-effort" pattern —
// CRM sync must never break auth or billing.
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
    });
    if (!res.ok) {
      // Log without throwing so the caller (auth/checkout) is never affected.
      console.error('hubspot upsert failed:', res.status, (await res.text()).slice(0, 300));
    }
  } catch (e) {
    console.error('hubspot upsert error:', e instanceof Error ? e.message : e);
  }
}

/** Split a display name into HubSpot's firstname / lastname fields. */
export function splitName(full?: string | null): { firstname?: string; lastname?: string } {
  const n = (full || '').trim();
  if (!n) return {};
  const parts = n.split(/\s+/);
  return { firstname: parts[0], lastname: parts.slice(1).join(' ') || undefined };
}
