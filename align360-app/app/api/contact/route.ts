import { NextRequest, NextResponse } from 'next/server';
import { hubspotUpsertContact, splitName } from '@/lib/hubspot';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Body = {
  name?: string; email?: string; company?: string; teamSize?: string; message?: string;
  /** Find Your Fit adds these. All optional, so existing callers are unaffected. */
  audience?: string; title?: string; source?: string;
};

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
  const audience = clean(body.audience, 60);
  const jobTitle = clean(body.title, 120);
  // Only a known-good source tag is ever sent. align360_source is a custom HubSpot
  // property and may be an enumeration, so an unrecognised value would be rejected.
  const source = body.source === 'find_your_fit' ? 'find_your_fit' : 'enterprise_contact';
  // Message: keep line breaks, normalize CRLF, cap length.
  const message = (body.message || '').replace(/\r\n?/g, '\n').trim().slice(0, 4000);
  const { firstname, lastname } = splitName(name);

  // Tier 1 — HubSpot DEFAULT properties only, so the lead ALWAYS lands (an unknown
  // property 400s the whole upsert; these are guaranteed to exist).
  await hubspotUpsertContact(email, {
    firstname, lastname,
    company: company || undefined,
    jobtitle: jobTitle || undefined,
    lifecyclestage: 'lead',
  });

  // Tier 2 — best-effort enrichment, each isolated so a misconfigured property only
  // loses that one field. `message` is a HubSpot default form property; align360_source
  // is our existing custom property (values already in use elsewhere).
  // The audience goes in `message` as well as the source tag, because `message` is a
  // HubSpot DEFAULT property and always lands. If align360_source turns out to be an
  // enumeration that rejects 'find_your_fit', the segmentation is still captured here.
  const detail = [
    message,
    audience ? `Audience: ${audience}` : '',
    teamSize ? `Organization size: ${teamSize}` : '',
    source === 'find_your_fit'
      ? 'Source: Align360 Find Your Fit page'
      : 'Source: Align360 pricing page — Enterprise / team inquiry',
  ].filter(Boolean).join('\n');
  await Promise.all([
    detail ? hubspotUpsertContact(email, { message: detail }) : Promise.resolve(),
    hubspotUpsertContact(email, { align360_source: source }),
  ]);

  return NextResponse.json({ ok: true });
}
