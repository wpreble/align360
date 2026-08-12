/**
 * Unit checks for the admin snapshot join. Pure in-memory: no Stripe, no
 * Supabase, no network. Run with:
 *   npx tsx scripts/test-admin-snapshot.ts
 *
 * Covers the precedence rules that decide what each row says, because "is this
 * person paying?" is the question the whole portal exists to answer and getting
 * it subtly wrong is worse than not showing it.
 */
import { buildSnapshot, toMonthlyCents, type AuthUsersResult, type SubRow, type SubsResult, type CustomerOwner, type OrgTables } from '../lib/admin/data';

let failures = 0;
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) console.log(`  ok   ${name}`);
  else { console.log(`  FAIL ${name}\n         expected ${e}\n         actual   ${a}`); failures++; }
}

const NOW = Math.floor(Date.UTC(2026, 7, 10) / 1000);
const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

function user(n: number, email: string, created = '2026-01-01T00:00:00Z') {
  return { id: uid(n), email, created_at: created, last_sign_in_at: null, provider: 'email', confirmed: true };
}

function sub(over: Partial<SubRow> & Pick<SubRow, 'id' | 'customerId' | 'status'>): SubRow {
  return {
    customerEmail: null, monthlyCents: 2500, quantity: 1, interval: 'month', planName: 'Individual',
    priceId: 'price_1', productId: 'prod_1',
    created: NOW - 86400, currentPeriodEnd: NOW + 86400, cancelAtPeriodEnd: false,
    canceledAt: null, trialEnd: null, livemode: true, ...over,
  };
}

// ── Fixture ─────────────────────────────────────────────────────────────────
// 1 paying individual (joined by stripe_customers)
// 2 free signup, no billing at all
// 3 churned (canceled sub, still has an account)
// 4 trialing
// 5 paying but matched only by EMAIL (pre stripe_customers fallback)
// 6 org owner with an assigned seat on a paying org
// 7 org member with NO seat assigned  → still free
// 8 has BOTH a canceled and an active sub → active must win
const authUsers: AuthUsersResult = {
  available: true, truncated: false,
  users: [1, 2, 3, 4, 5, 6, 7, 8].map((n) => user(n, `u${n}@example.com`)),
};

const subs: SubsResult = {
  available: true, truncated: false, livemode: true,
  subs: [
    sub({ id: 'sub_1', customerId: 'cus_1', status: 'active' }),
    sub({ id: 'sub_3', customerId: 'cus_3', status: 'canceled', canceledAt: NOW - 3600, monthlyCents: 2500 }),
    sub({ id: 'sub_4', customerId: 'cus_4', status: 'trialing', trialEnd: NOW + 7 * 86400, monthlyCents: 2500 }),
    sub({ id: 'sub_5', customerId: 'cus_5', status: 'active', customerEmail: 'U5@Example.com' }),
    sub({ id: 'sub_org', customerId: 'cus_org', status: 'active', quantity: 10, monthlyCents: 19000, planName: 'Team' }),
    sub({ id: 'sub_8a', customerId: 'cus_8', status: 'canceled', canceledAt: NOW - 7200, created: NOW - 90000 }),
    sub({ id: 'sub_8b', customerId: 'cus_8', status: 'active', created: NOW - 1000 }),
  ],
};

// cus_5 deliberately absent → exercises the email fallback.
const owners = new Map<string, CustomerOwner>([
  ['cus_1', { ownerType: 'user', ownerId: uid(1) }],
  ['cus_3', { ownerType: 'user', ownerId: uid(3) }],
  ['cus_4', { ownerType: 'user', ownerId: uid(4) }],
  ['cus_8', { ownerType: 'user', ownerId: uid(8) }],
  ['cus_org', { ownerType: 'org', ownerId: 'org-1' }],
]);

const orgData: OrgTables = {
  orgs: [{ id: 'org-1', name: 'Acme Co', slug: 'acme', created_at: '2026-02-01T00:00:00Z' }],
  members: [
    { org_id: 'org-1', user_id: uid(6), role: 'owner', seat_assigned: true },
    { org_id: 'org-1', user_id: uid(7), role: 'member', seat_assigned: false },
  ],
  invites: [{ org_id: 'org-1', status: 'pending' }, { org_id: 'org-1', status: 'accepted' }],
};

const snap = buildSnapshot({ authUsers, subs, owners, orgData });
const byEmail = Object.fromEntries(snap.users.map((u) => [u.email, u]));

console.log('\nPayment state per user');
check('paying individual', byEmail['u1@example.com'].state, 'active');
check('free signup', byEmail['u2@example.com'].state, 'free');
check('churned', byEmail['u3@example.com'].state, 'canceled');
check('trialing', byEmail['u4@example.com'].state, 'trialing');
check('email-fallback match is case-insensitive', byEmail['u5@example.com'].state, 'active');
check('org owner with assigned seat', byEmail['u6@example.com'].state, 'org_seat');
check('org member without a seat stays free', byEmail['u7@example.com'].state, 'free');
check('active beats canceled for the same customer', byEmail['u8@example.com'].state, 'active');

console.log('\nRevenue attribution');
check('personal sub carries its MRR', byEmail['u1@example.com'].monthlyCents, 2500);
check('org seat does NOT double-count seat revenue', byEmail['u6@example.com'].monthlyCents, 0);
check('churned user contributes nothing', byEmail['u3@example.com'].monthlyCents, 0);
check('trial contributes nothing until it converts', byEmail['u4@example.com'].monthlyCents, 0);
check('org seat names its team', byEmail['u6@example.com'].orgName, 'Acme Co');

console.log('\nOrg seat math');
const org = snap.orgs[0];
check('seats purchased from Stripe quantity', org.seatsPurchased, 10);
check('seats assigned from members', org.seatsAssigned, 1);
check('member count', org.memberCount, 2);
check('pending invites only', org.pendingInvites, 1);
check('org MRR', org.monthlyCents, 19000);
check('org state', org.state, 'active');

console.log('\nInterval normalisation');
check('monthly passthrough', toMonthlyCents(2500, 'month', 1, 1), 2500);
check('annual divided by 12', toMonthlyCents(24000, 'year', 1, 1), 2000);
check('weekly scaled', toMonthlyCents(1000, 'week', 1, 1), 4333);
check('quantity multiplies', toMonthlyCents(1900, 'month', 1, 10), 19000);
check('interval_count divides', toMonthlyCents(5000, 'month', 2, 1), 2500);

console.log('\nAggregate sanity');
check('every auth user appears exactly once', snap.users.length, 8);
check('no truncation flags on a small fixture', snap.truncated, { users: false, subs: false });
check('stripe mode surfaces', snap.stripeMode, 'live');

console.log(failures ? `\n${failures} check(s) FAILED\n` : '\nAll checks passed\n');
process.exit(failures ? 1 : 0);
