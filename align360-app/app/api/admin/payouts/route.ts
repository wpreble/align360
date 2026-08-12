import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/admin/guard';
import { getStripe, stripeConfigured, connectedOptions, connectScoped, connect } from '@/lib/stripe/client';
import { align360CustomerIds, wantsFresh } from '@/lib/admin/data';
import type Stripe from 'stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DAY = 86400;

// Parse a YYYY-MM-DD (or ISO) date to a unix-second boundary. endOfDay pushes to 23:59:59.
function toUnix(s: string | null, fallback: number, endOfDay = false): number {
  if (!s) return fallback;
  const d = new Date(s.length <= 10 ? `${s}T00:00:00Z` : s);
  if (isNaN(d.getTime())) return fallback;
  let t = Math.floor(d.getTime() / 1000);
  if (endOfDay) t += DAY - 1;
  return t;
}

export async function GET(req: Request) {
  const gate = requireSuperAdmin(); // revenue split — superadmin only
  if (gate instanceof NextResponse) return gate;
  if (!stripeConfigured) return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const now = Math.floor(Date.now() / 1000);
  const gte = toUnix(searchParams.get('start'), now - 30 * DAY, false);
  const lte = toUnix(searchParams.get('end'), now, true);
  if (gte > lte) return NextResponse.json({ error: 'start must be before end' }, { status: 400 });

  const stripe = getStripe();
  // Align360 bills via Direct Charges on the CONNECTED account. Reading without
  // this scope returns the platform's own revenue, which is a different business.
  const opts = connectedOptions();
  let grossCents = 0, feeCents = 0, netCents = 0, refundCents = 0, appFeeCents = 0, count = 0, capped = false;
  // Money on this Stripe account that could NOT be attributed to Align360 —
  // other product lines. Reported, never silently folded in or dropped.
  let otherGrossCents = 0, otherCount = 0;
  let currency = 'usd';
  let live: boolean | null = null;
  const mine = await align360CustomerIds(wantsFresh(req)).catch(() => new Set<string>());
  try {
    // BalanceTransaction has no `livemode` field, so probe mode from a charge (which
    // does). This reflects the key's mode, i.e. whether these figures are real money.
    const probe = await stripe.charges.list({ limit: 1 }, opts);
    live = probe.data[0] ? probe.data[0].livemode : null;

    const CAP = 5000;
    // Auto-paginate balance transactions in the window. `net` already nets out fees
    // and refunds, so summing net over income + refund types = true net revenue.
    for await (const txn of stripe.balanceTransactions.list(
      { created: { gte, lte }, limit: 100, expand: ['data.source'] },
      opts,
    )) {
      if (txn.currency) currency = txn.currency;
      const t = txn.type;

      // Attribute this movement to Align360 via the source charge's customer.
      // A balance transaction carries no product information, so this is the
      // only cheap join available while one Stripe account serves several lines.
      const src = txn.source && typeof txn.source === 'object' ? (txn.source as { customer?: string | { id: string } }) : null;
      const custId = typeof src?.customer === 'string' ? src.customer : src?.customer?.id ?? null;
      const isMine = !!custId && mine.has(custId);

      if (!isMine) {
        if (t === 'charge' || t === 'payment') { otherGrossCents += txn.amount; otherCount += 1; }
        continue;
      }

      if (t === 'charge' || t === 'payment') {
        grossCents += txn.amount;
        feeCents += txn.fee;
        netCents += txn.net;
        count += 1;
      } else if (t === 'refund' || t === 'payment_refund') {
        refundCents += txn.amount; // negative
        feeCents += txn.fee;
        netCents += txn.net;
      } else if (t === 'application_fee' || t === 'application_fee_refund') {
        // On the connected account the platform's cut leaves as its own negative
        // balance transaction. Excluding it (as this route used to) overstates
        // what Align360 actually keeps, and then the split panel below applies a
        // SECOND 50% on top of a cut Stripe already took.
        appFeeCents += txn.amount;
        netCents += txn.net;
      }
      if (count >= CAP) { capped = true; break; }
    }
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'payouts failed' }, { status: 502 });
  }

  return NextResponse.json({
    range: { start: gte, end: lte },
    currency,
    mode: live == null ? 'unknown' : live ? 'live' : 'test',
    count,
    capped,
    grossCents,
    feeCents,
    refundCents,
    appFeeCents,
    netCents,
    // Revenue on this Stripe account belonging to other product lines. Shown so
    // the panel can never again present someone else's gross as Align360's.
    other: { grossCents: otherGrossCents, count: otherCount },
    // Context the UI needs so the split is not applied twice.
    connectScoped,
    applicationFeePercent: connect.applicationFeePercent,
    generatedAt: Date.now(),
  });
}
