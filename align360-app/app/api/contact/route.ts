import { NextRequest, NextResponse } from 'next/server';
import { hubspotUpsertContact, splitName } from '@/lib/hubspot';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Body = { name?: string; email?: string; company?: string; teamSize?: string; message?: string };

// Single-line fields: collapse all whitespace (incl. newlines/tabs) to spaces, trim, cap length.
const clean = (s: string | undefined, max: number) => (s || '').replace(/\s+/g, ' ').trim().slice(0, max);

/**
 * Enterprise / "talk to us" contact form → HubSpot. Public (no auth). Fail-open:
 * with no HUBSPOT_TOKEN or a HubSpot hiccup, still returns ok so the UX never
 * breaks — the submission is simply not recorded. Captures the lead in two tiers
 * so an unknown enrichment property can never drop the whole contact.
 */
export async function POST(req: NextRequest) {
  let body: Body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400 }); }

  const email = clean(body.email, 160).toLowerCase();
  if (!email.includes('@') || email.length < 5) {
    return NextResponse.json({ error: 'Please enter a valid work email.' }, { status: 400 });
  }
  const name = clean(body.name, 120);
  const company = clean(body.company, 160);
  const teamSize = clean(body.teamSize, 40);
  // Message: keep line breaks, normalize CRLF, cap length.
  const message = (body.message || '').replace(/\r\n?/g, '\n').trim().slice(0, 4000);
  const { firstname, lastname } = splitName(name);

  // Tier 1 — HubSpot DEFAULT properties only, so the lead ALWAYS lands (an unknown
  // property 400s the whole upsert; these are guaranteed to exist).
  await hubspotUpsertContact(email, {
    firstname, lastname,
    company: company || undefined,
    lifecyclestage: 'lead',
  });

  // Tier 2 — best-effort enrichment, each isolated so a misconfigured property only
  // loses that one field. `message` is a HubSpot default form property; align360_source
  // is our existing custom property (values already in use elsewhere).
  const detail = [
    message,
    teamSize ? `Team size: ${teamSize}` : '',
    'Source: Align360 pricing page — Enterprise / team inquiry',
  ].filter(Boolean).join('\n');
  await Promise.all([
    detail ? hubspotUpsertContact(email, { message: detail }) : Promise.resolve(),
    hubspotUpsertContact(email, { align360_source: 'enterprise_contact' }),
  ]);

  return NextResponse.json({ ok: true });
}
