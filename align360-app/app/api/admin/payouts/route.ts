import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/guard';
import { getStripe, stripeConfigured } from '@/lib/stripe/client';

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
  const gate = requireAdmin();
  if (gate instanceof NextResponse) return gate;
  if (!stripeConfigured) return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const now = Math.floor(Date.now() / 1000);
  const gte = toUnix(searchParams.get('start'), now - 30 * DAY, false);
  const lte = toUnix(searchParams.get('end'), now, true);
  if (gte > lte) return NextResponse.json({ error: 'start must be before end' }, { status: 400 });

  const stripe = getStripe();
  let grossCents = 0, feeCents = 0, netCents = 0, refundCents = 0, count = 0, capped = false;
  let currency = 'usd';
  let live: boolean | null = null;
  try {
    // BalanceTransaction has no `livemode` field, so probe mode from a charge (which
    // does). This reflects the key's mode, i.e. whether these figures are real money.
    const probe = await stripe.charges.list({ limit: 1 });
    live = probe.data[0] ? probe.data[0].livemode : null;

    const CAP = 5000;
    // Auto-paginate balance transactions in the window. `net` already nets out fees
    // and refunds, so summing net over income + refund types = true net revenue.
    for await (const txn of stripe.balanceTransactions.list({ created: { gte, lte }, limit: 100 })) {
      if (txn.currency) currency = txn.currency;
      const t = txn.type;
      if (t === 'charge' || t === 'payment') {
        grossCents += txn.amount;
        feeCents += txn.fee;
        netCents += txn.net;
        count += 1;
      } else if (t === 'refund' || t === 'payment_refund') {
        refundCents += txn.amount; // negative
        feeCents += txn.fee;
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
    netCents,
    generatedAt: Date.now(),
  });
}
