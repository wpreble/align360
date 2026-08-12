import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/guard';
import { align360CustomerIds, loadSnapshot, wantsFresh } from '@/lib/admin/data';
import { getStripe, stripeConfigured, connectedOptions, connectScoped } from '@/lib/stripe/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DAY = 86_400;

/**
 * Trend lines: signups per week, net revenue per month, and cumulative paying
 * customers. The old portal had no charts at all and collapsed an entire date
 * range into five scalars, so there was no way to see whether anything was
 * moving.
 *
 * Revenue buckets come from the same balance-transaction walk the payouts route
 * uses, just bucketed instead of summed. This is requireAdmin, not superadmin:
 * revenue over time is operating visibility. Only the Ascendance split stays
 * restricted.
 *
 * ?months=N controls the revenue window (default 12, max 36).
 */
export async function GET(req: Request) {
  const gate = requireAdmin();
  if (gate instanceof NextResponse) return gate;

  const { searchParams } = new URL(req.url);
  const months = Math.min(36, Math.max(1, Number(searchParams.get('months')) || 12));

  try {
    const snap = await loadSnapshot(wantsFresh(req));

    // ── Signups per week (last 26 weeks) ────────────────────────────────────
    const WEEKS = 26;
    const now = new Date();
    // Anchor to the most recent Monday so buckets are stable across the day.
    const anchor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    anchor.setUTCDate(anchor.getUTCDate() - ((anchor.getUTCDay() + 6) % 7));

    const weekly = Array.from({ length: WEEKS }, (_, i) => {
      const start = new Date(anchor);
      start.setUTCDate(start.getUTCDate() - (WEEKS - 1 - i) * 7);
      return { week: start.toISOString().slice(0, 10), start: start.getTime(), signups: 0 };
    });
    const firstWeekStart = weekly[0].start;
    for (const u of snap.users) {
      const t = new Date(u.created_at).getTime();
      if (t < firstWeekStart) continue;
      const idx = Math.min(WEEKS - 1, Math.floor((t - firstWeekStart) / (7 * DAY * 1000)));
      if (idx >= 0) weekly[idx].signups += 1;
    }

    // Cumulative signups gives the growth curve; the weekly bars give the rate.
    const before = snap.users.filter((u) => new Date(u.created_at).getTime() < firstWeekStart).length;
    let running = before;
    const weeklyOut = weekly.map((w) => {
      running += w.signups;
      return { week: w.week, signups: w.signups, cumulative: running };
    });

    // ── Net revenue per month ───────────────────────────────────────────────
    const monthKeys: string[] = [];
    const cursor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(cursor);
      d.setUTCMonth(d.getUTCMonth() - i);
      monthKeys.push(d.toISOString().slice(0, 7));
    }
    const revenueByMonth = new Map(monthKeys.map((k) => [k, { grossCents: 0, netCents: 0, charges: 0 }]));

    const windowStart = new Date(cursor);
    windowStart.setUTCMonth(windowStart.getUTCMonth() - (months - 1));
    const gte = Math.floor(windowStart.getTime() / 1000);

    let revenueAvailable = false;
    let revenueTruncated = false;
    let currency = 'usd';
    let revenueError: string | null = null;
    let otherGrossCents = 0;

    if (stripeConfigured) {
      try {
        // Attribute money movement to Align360 by the source charge's customer.
        // Without this the chart shows every product line billing through this
        // Stripe account, which is how a $100/mo business rendered as $5k/mo.
        const mine = await align360CustomerIds(wantsFresh(req)).catch(() => new Set<string>());
        const CAP = 10_000;
        let seen = 0;
        for await (const txn of getStripe().balanceTransactions.list(
          { created: { gte }, limit: 100, expand: ['data.source'] },
          connectedOptions(),
        )) {
          const t = txn.type;
          if (t !== 'charge' && t !== 'payment' && t !== 'refund' && t !== 'payment_refund') continue;
          if (txn.currency) currency = txn.currency;

          const src = txn.source && typeof txn.source === 'object' ? (txn.source as { customer?: string | { id: string } }) : null;
          const custId = typeof src?.customer === 'string' ? src.customer : src?.customer?.id ?? null;
          if (!custId || !mine.has(custId)) {
            if (t === 'charge' || t === 'payment') otherGrossCents += txn.amount;
            continue;
          }
          const key = new Date(txn.created * 1000).toISOString().slice(0, 7);
          const bucket = revenueByMonth.get(key);
          if (bucket) {
            bucket.netCents += txn.net;
            if (t === 'charge' || t === 'payment') { bucket.grossCents += txn.amount; bucket.charges += 1; }
            else bucket.grossCents += txn.amount; // refunds carry a negative amount
          }
          if (++seen >= CAP) { revenueTruncated = true; break; }
        }
        revenueAvailable = true;
      } catch (e) {
        revenueError = e instanceof Error ? e.message : 'revenue series unavailable';
      }
    }

    return NextResponse.json({
      signupsWeekly: weeklyOut,
      revenueMonthly: monthKeys.map((k) => ({ month: k, ...revenueByMonth.get(k)! })),
      currency,
      revenueAvailable,
      revenueTruncated,
      otherGrossCents,
      connectScoped,
      revenueError,
      months,
      generatedAt: snap.generatedAt,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'timeseries failed' }, { status: 502 });
  }
}
