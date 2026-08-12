import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/guard';
import { loadSnapshot, wantsFresh, type PaymentState, type UserRow } from '@/lib/admin/data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The unified user list: every signup with its payment state, searchable,
 * filterable, sortable, paginated.
 *
 * This is the gap the old dashboard could not fill at all — it showed the 10
 * most recent signups in one table and active Stripe customers in another,
 * with no join between them, so "is this person paying?" was unanswerable for
 * anyone else.
 *
 * Query params:
 *   q        free-text match on email (case-insensitive substring)
 *   state    comma-separated PaymentState filter, e.g. "active,trialing"
 *   sort     created | email | state | mrr | last_seen        (default created)
 *   dir      asc | desc                                        (default desc)
 *   page     1-based                                           (default 1)
 *   pageSize 1..200                                            (default 50)
 *   refresh  1 to bypass the 60s snapshot cache
 */

const SORTS = ['created', 'email', 'state', 'mrr', 'last_seen'] as const;
type Sort = (typeof SORTS)[number];

const STATE_ORDER: PaymentState[] = ['active', 'trialing', 'past_due', 'org_seat', 'canceled', 'free'];

export async function GET(req: Request) {
  const gate = requireAdmin();
  if (gate instanceof NextResponse) return gate;

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get('q') || '').trim().toLowerCase();
  const stateParam = (searchParams.get('state') || '').trim();
  const states = stateParam
    ? new Set(stateParam.split(',').map((s) => s.trim()).filter(Boolean) as PaymentState[])
    : null;
  const sort = (SORTS as readonly string[]).includes(searchParams.get('sort') || '')
    ? (searchParams.get('sort') as Sort)
    : 'created';
  const dir = searchParams.get('dir') === 'asc' ? 1 : -1;
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const pageSize = Math.min(200, Math.max(1, Number(searchParams.get('pageSize')) || 50));

  try {
    const snap = await loadSnapshot(wantsFresh(req));

    let rows = snap.users;
    if (q) rows = rows.filter((u) => (u.email || '').toLowerCase().includes(q) || u.id.toLowerCase() === q);
    if (states) rows = rows.filter((u) => states.has(u.state));

    const cmp: Record<Sort, (a: UserRow, b: UserRow) => number> = {
      created: (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      email: (a, b) => (a.email || '').localeCompare(b.email || ''),
      state: (a, b) => STATE_ORDER.indexOf(a.state) - STATE_ORDER.indexOf(b.state),
      mrr: (a, b) => a.monthlyCents - b.monthlyCents,
      last_seen: (a, b) =>
        new Date(a.last_sign_in_at || 0).getTime() - new Date(b.last_sign_in_at || 0).getTime(),
    };
    // `state` sorts by severity rank, which reads best ascending; flip so the
    // UI's default "desc" still puts active customers on top.
    const sorted = [...rows].sort((a, b) => cmp[sort](a, b) * (sort === 'state' ? -dir : dir));

    const total = sorted.length;
    const start = (page - 1) * pageSize;

    return NextResponse.json({
      items: sorted.slice(start, start + pageSize),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      unfilteredTotal: snap.users.length,
      truncated: snap.truncated,
      available: snap.available,
      stripeMode: snap.stripeMode,
      connectScoped: snap.connectScoped,
      generatedAt: snap.generatedAt,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'user list failed' }, { status: 502 });
  }
}
