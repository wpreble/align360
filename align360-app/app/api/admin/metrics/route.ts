import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/guard';
import { loadSnapshot, wantsFresh } from '@/lib/admin/data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DAY_MS = 86_400_000;

/**
 * Aggregate business metrics. requireAdmin (not superadmin): knowing how many
 * customers there are and what they pay is the core reason the portal exists.
 * Only the Ascendance revenue SPLIT stays superadmin-only (see /api/admin/payouts).
 *
 * Every figure here derives from the full, paginated snapshot in lib/admin/data,
 * so MRR no longer truncates at 100 subscriptions and trials / failed payments /
 * cancellations are represented instead of filtered away.
 */
export async function GET(req: Request) {
  const gate = requireAdmin();
  if (gate instanceof NextResponse) return gate;

  try {
    const snap = await loadSnapshot(wantsFresh(req));
    const now = Date.now();
    const nowSec = Math.floor(now / 1000);

    // ── Revenue ─────────────────────────────────────────────────────────────
    // MRR counts only `active`. past_due/unpaid revenue is real but at risk, so
    // it is reported separately rather than inflating the headline number.
    let mrrCents = 0, atRiskCents = 0;
    let activeSubs = 0, trialingSubs = 0, pastDueSubs = 0, canceledSubs = 0;
    let canceled30 = 0, pendingCancel = 0;
    let trialsResolved = 0, trialsConverted = 0;

    for (const s of snap.subs) {
      switch (s.status) {
        case 'active':
          activeSubs += 1; mrrCents += s.monthlyCents;
          if (s.cancelAtPeriodEnd) pendingCancel += 1;
          break;
        case 'trialing':
          trialingSubs += 1;
          break;
        case 'past_due':
        case 'unpaid':
          pastDueSubs += 1; atRiskCents += s.monthlyCents;
          break;
        case 'canceled':
        case 'incomplete_expired':
          canceledSubs += 1;
          if (s.canceledAt && now - s.canceledAt * 1000 <= 30 * DAY_MS) canceled30 += 1;
          break;
        default:
          break; // incomplete / paused: not access-granting, not churn
      }

      // Trial-to-paid: only subs whose trial has actually ended can be scored.
      if (s.trialEnd && s.trialEnd < nowSec) {
        trialsResolved += 1;
        if (s.status === 'active' || s.status === 'past_due' || s.status === 'unpaid') trialsConverted += 1;
      }
    }

    // ── People ──────────────────────────────────────────────────────────────
    const byState = { active: 0, trialing: 0, past_due: 0, canceled: 0, org_seat: 0, free: 0 };
    let signups30 = 0, signups7 = 0, activeLast30 = 0;
    for (const u of snap.users) {
      byState[u.state] += 1;
      const created = new Date(u.created_at).getTime();
      if (now - created <= 30 * DAY_MS) signups30 += 1;
      if (now - created <= 7 * DAY_MS) signups7 += 1;
      if (u.last_sign_in_at && now - new Date(u.last_sign_in_at).getTime() <= 30 * DAY_MS) activeLast30 += 1;
    }
    const payingUsers = byState.active + byState.past_due + byState.org_seat;
    const totalUsers = snap.users.length;

    // Subscriber churn over the trailing 30 days: cancellations divided by the
    // population that could have cancelled (those still active plus those who left).
    const churnDenom = activeSubs + canceled30;
    const churn30Pct = churnDenom > 0 ? (canceled30 / churnDenom) * 100 : null;
    const trialConversionPct = trialsResolved > 0 ? (trialsConverted / trialsResolved) * 100 : null;

    return NextResponse.json({
      users: {
        total: totalUsers,
        paying: payingUsers,
        free: byState.free,
        byState,
        signups30,
        signups7,
        activeLast30,
      },
      revenue: {
        mrrCents,
        arrCents: mrrCents * 12,
        atRiskCents,
        arpuCents: payingUsers > 0 ? Math.round(mrrCents / payingUsers) : 0,
      },
      subscriptions: {
        active: activeSubs,
        trialing: trialingSubs,
        pastDue: pastDueSubs,
        canceled: canceledSubs,
        pendingCancel,
        canceled30,
      },
      rates: {
        churn30Pct,
        trialConversionPct,
        trialsResolved,
        paidSharePct: totalUsers > 0 ? (payingUsers / totalUsers) * 100 : null,
      },
      orgs: {
        total: snap.orgs.length,
        paying: snap.orgs.filter((o) => o.state === 'active' || o.state === 'trialing').length,
        seatsPurchased: snap.orgs.reduce((n, o) => n + o.seatsPurchased, 0),
        seatsAssigned: snap.orgs.reduce((n, o) => n + o.seatsAssigned, 0),
      },
      stripeMode: snap.stripeMode,
      connectScoped: snap.connectScoped,
      excluded: snap.excluded,
      brandFilterApplied: snap.brandFilterApplied,
      truncated: snap.truncated,
      available: snap.available,
      generatedAt: snap.generatedAt,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'metrics failed' }, { status: 502 });
  }
}
