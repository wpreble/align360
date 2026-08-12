import Stripe from 'stripe';
import { getStripe, stripeConfigured, connectedOptions, connectScoped } from '@/lib/stripe/client';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * Shared read layer for the admin portal.
 *
 * Why this exists: the original /api/admin/metrics fetched ONE page of Stripe
 * subscriptions (limit 100, no pagination) filtered to status 'active'. That
 * silently truncated MRR above 100 subscribers and made trials, failed payments,
 * and cancellations structurally invisible. Every admin route now goes through
 * here instead, so the fix lands once.
 *
 * Three sources, joined:
 *   1. Supabase auth users  (who signed up)      — GoTrue admin API, fully paged
 *   2. Stripe subscriptions (who pays)           — auto-paginated, ALL statuses
 *   3. public.stripe_customers (which is which)  — the reliable id-level join
 *
 * The customer→owner join goes through stripe_customers rather than matching on
 * email, because a Stripe customer can carry a different email than the auth
 * account, and org subscriptions have no user email at all. Email matching is
 * kept only as a fallback for customers created before that table was populated.
 *
 * NOTE: public.subscriptions is deliberately NOT read here. It is webhook-
 * maintained and has drifted from Stripe in the past; Stripe is treated as the
 * source of truth for anything billing-related.
 */

// ── Cache ───────────────────────────────────────────────────────────────────
// A full refresh is 1 Stripe page-walk + 1 GoTrue page-walk. Without a cache,
// every tab switch and every keystroke-triggered refetch would re-walk both.
// 60s TTL keeps the dashboard effectively live while collapsing bursts; every
// route accepts ?refresh=1 to bypass it, and the UI has explicit Refresh
// buttons wired to that. Serverless instances are ephemeral, so treat this as
// best-effort burst collapsing, not a guaranteed cache.
const TTL_MS = 60_000;
type CacheEntry<T> = { at: number; value: T };
const cache = new Map<string, CacheEntry<unknown>>();

async function cached<T>(key: string, fresh: boolean, load: () => Promise<T>): Promise<T> {
  if (!fresh) {
    const hit = cache.get(key) as CacheEntry<T> | undefined;
    if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
  }
  const value = await load();
  cache.set(key, { at: Date.now(), value });
  return value;
}

/**
 * Stripe customer ids that belong to Align360, derived from the brand-filtered
 * subscription list (all statuses, so past customers still attribute correctly).
 *
 * Money movement cannot be filtered by product the way subscriptions can: a
 * balance transaction points at a charge, not a price. Attributing by customer
 * is the cheap, reliable proxy while Align360 shares a Stripe account with other
 * product lines. Callers MUST report what they could not attribute rather than
 * dropping it, so a mis-attribution shows up instead of quietly shrinking revenue.
 */
export async function align360CustomerIds(fresh = false): Promise<Set<string>> {
  const { subs } = await listSubscriptions(fresh);
  return new Set(subs.map((s) => s.customerId).filter(Boolean));
}

/** True when the caller passed ?refresh=1 (or ?refresh=true). */
export function wantsFresh(req: Request): boolean {
  const v = new URL(req.url).searchParams.get('refresh');
  return v === '1' || v === 'true';
}

// Safety ceilings. Both are far above current scale; they exist so a runaway
// account can never hang a serverless function indefinitely. When either trips
// we set a `truncated` flag that the UI renders, rather than lying silently —
// which is exactly the failure mode of the code this replaces.
const MAX_USERS = 20_000;
const MAX_SUBS = 10_000;

// ── Supabase auth users ─────────────────────────────────────────────────────

export type AuthUser = {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  provider: string | null;
  confirmed: boolean;
};

export type AuthUsersResult = { users: AuthUser[]; truncated: boolean; available: boolean };

/** Every auth user, fully paginated. `available: false` means Supabase env is absent. */
export async function listAuthUsers(fresh = false): Promise<AuthUsersResult> {
  return cached('authUsers', fresh, async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return { users: [], truncated: false, available: false };

    const PER_PAGE = 200;
    const users: AuthUser[] = [];
    let truncated = false;

    for (let page = 1; ; page++) {
      const res = await fetch(`${url}/auth/v1/admin/users?per_page=${PER_PAGE}&page=${page}`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`Supabase admin users: HTTP ${res.status}`);
      const data = await res.json().catch(() => ({}));
      const batch: unknown[] = Array.isArray(data?.users) ? data.users : [];

      for (const raw of batch) {
        const u = raw as {
          id: string;
          email?: string;
          created_at: string;
          last_sign_in_at?: string | null;
          confirmed_at?: string | null;
          email_confirmed_at?: string | null;
          app_metadata?: { provider?: string };
        };
        users.push({
          id: u.id,
          email: u.email || null,
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at ?? null,
          provider: u.app_metadata?.provider ?? null,
          confirmed: !!(u.confirmed_at || u.email_confirmed_at),
        });
      }

      if (batch.length < PER_PAGE) break;
      if (users.length >= MAX_USERS) { truncated = true; break; }
    }

    return { users, truncated, available: true };
  });
}

// ── Stripe subscriptions ────────────────────────────────────────────────────

export type SubStatus = Stripe.Subscription.Status;

export type SubRow = {
  id: string;
  customerId: string;
  customerEmail: string | null;
  status: SubStatus;
  /** Normalized monthly value in cents. Zero for statuses that are not billing. */
  monthlyCents: number;
  quantity: number;
  interval: string | null;
  /** Stripe product name when expandable, else the price nickname, else null. */
  planName: string | null;
  priceId: string | null;
  productId: string | null;
  created: number;
  currentPeriodEnd: number | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: number | null;
  trialEnd: number | null;
  livemode: boolean;
};

export type SubsResult = {
  /** Align360 subscriptions ONLY. See the brand filter below for why. */
  subs: SubRow[];
  truncated: boolean;
  available: boolean;
  livemode: boolean | null;
  /** False when STRIPE_CONNECTED_ACCOUNT_ID is unset. */
  connectScoped: boolean;
  /** What the brand filter removed: other product lines on the same Stripe
   *  account. Reported rather than silently dropped — silent exclusion is the
   *  same class of mistake as the silent inclusion this fixes. */
  excluded: { activeSubs: number; monthlyCents: number; products: string[] };
  /** False when no Align360-branded product could be identified at all, in
   *  which case NOTHING was filtered and the figures may include other lines. */
  brandFilterApplied: boolean;
};

/**
 * Is this Stripe product Align360's?
 *
 * scripts/stripe-setup-products.ts stamps every product it creates with
 * metadata { brand: 'Align360', tier }. That metadata is the authoritative
 * marker. Product name is a fallback for anything created before the metadata
 * existed or by hand in the dashboard.
 */
function isAlign360Product(p: Stripe.Product): boolean {
  const brand = (p.metadata?.brand || '').trim().toLowerCase();
  if (brand === 'align360') return true;
  return /^align\s*360/i.test((p.name || '').trim());
}

/** Normalize any Stripe recurring price to monthly cents. */
export function toMonthlyCents(unitAmount: number, interval: string, count: number, qty: number): number {
  const perPeriod = unitAmount * qty;
  const c = count || 1;
  switch (interval) {
    case 'day': return Math.round((perPeriod / c) * 30);
    case 'week': return Math.round((perPeriod / c) * (52 / 12));
    case 'year': return Math.round((perPeriod / c) / 12);
    case 'month':
    default: return Math.round(perPeriod / c);
  }
}

/** Statuses that represent live, paying revenue for MRR purposes. */
export const PAYING_STATUSES: SubStatus[] = ['active', 'past_due', 'unpaid'];

/** Every subscription in every status, auto-paginated. */
export async function listSubscriptions(fresh = false): Promise<SubsResult> {
  return cached('subs', fresh, async () => {
    const empty = { activeSubs: 0, monthlyCents: 0, products: [] as string[] };
    if (!stripeConfigured) {
      return { subs: [], truncated: false, available: false, livemode: null, connectScoped, excluded: empty, brandFilterApplied: false };
    }
    const stripe = getStripe();
    // Scope to the connected account when Connect is configured. NOTE: this alone
    // is not sufficient — with STRIPE_CONNECTED_ACCOUNT_ID unset, Align360 shares
    // one Stripe account with other product lines, so the brand filter below is
    // what actually keeps someone else's revenue out of Align360's MRR.
    const opts = connectedOptions();

    // Products first: their metadata is what identifies a subscription as ours.
    const productNames = new Map<string, string>();
    const align360Products = new Set<string>();
    try {
      for await (const p of stripe.products.list({ limit: 100 }, opts)) {
        productNames.set(p.id, p.name);
        if (isAlign360Product(p)) align360Products.add(p.id);
      }
    } catch {
      /* leaves the filter un-appliable; flagged below rather than guessed at */
    }

    const subs: SubRow[] = [];
    let truncated = false;

    // status:'all' is the fix for trial / past_due / canceled invisibility.
    // The for-await form auto-paginates, which is the fix for the 100-sub cap.
    //
    // `data.items.data.price.product` is NOT expandable here: Stripe caps
    // expansion at 4 levels and that path is 5, which fails the whole request
    // with a 400. Product names are resolved from a separate products.list
    // below instead.
    for await (const s of stripe.subscriptions.list({
      status: 'all',
      limit: 100,
      expand: ['data.customer'],
    }, opts)) {
      const item = s.items?.data?.[0];
      const price = item?.price;
      const qty = item?.quantity || 1;
      const monthly = price?.unit_amount
        ? toMonthlyCents(price.unit_amount, price.recurring?.interval || 'month', price.recurring?.interval_count || 1, qty)
        : 0;

      const cust = s.customer && typeof s.customer === 'object' && !('deleted' in s.customer && s.customer.deleted)
        ? (s.customer as Stripe.Customer)
        : null;
      // Unexpanded, price.product is the product id string. Resolved to a name
      // after the walk; nickname is the fallback when the product is gone.
      const productId = typeof price?.product === 'string' ? price.product : price?.product?.id ?? null;

      subs.push({
        id: s.id,
        customerId: typeof s.customer === 'string' ? s.customer : s.customer?.id || '',
        customerEmail: cust?.email ?? null,
        status: s.status,
        monthlyCents: monthly,
        quantity: qty,
        interval: price?.recurring?.interval ?? null,
        planName: price?.nickname ?? null, // upgraded to the product name below
        priceId: price?.id ?? null,
        productId,
        created: s.created,
        // As of API 2025-xx (SDK v22) the billing period lives on the subscription
        // ITEM, not the subscription. Read it from the same item we price from,
        // falling back to the legacy top-level field for older API versions.
        currentPeriodEnd:
          item?.current_period_end ??
          (s as unknown as { current_period_end?: number }).current_period_end ??
          null,
        cancelAtPeriodEnd: !!s.cancel_at_period_end,
        canceledAt: s.canceled_at ?? null,
        trialEnd: s.trial_end ?? null,
        livemode: !!s.livemode,
      });

      if (subs.length >= MAX_SUBS) { truncated = true; break; }
    }

    // Upgrade the label from price nickname to real product name.
    for (const s of subs) {
      const name = s.productId ? productNames.get(s.productId) : undefined;
      if (name) s.planName = name;
    }

    // Split Align360's subscriptions from everything else billing through this
    // Stripe account. If no branded product was identified we do NOT filter —
    // reporting zero would be as wrong as reporting someone else's revenue.
    const brandFilterApplied = align360Products.size > 0;
    const mine = brandFilterApplied ? subs.filter((s) => s.productId && align360Products.has(s.productId)) : subs;
    const foreign = brandFilterApplied ? subs.filter((s) => !(s.productId && align360Products.has(s.productId))) : [];

    const foreignActive = foreign.filter((s) => s.status === 'active');
    const excluded = {
      activeSubs: foreignActive.length,
      monthlyCents: foreignActive.reduce((n, s) => n + s.monthlyCents, 0),
      products: Array.from(
        new Set(foreignActive.map((s) => (s.productId ? productNames.get(s.productId) ?? s.productId : '(unknown)'))),
      ).sort(),
    };

    return {
      subs: mine,
      truncated,
      available: true,
      livemode: subs.length ? subs[0].livemode : null,
      connectScoped,
      excluded,
      brandFilterApplied,
    };
  });
}

// ── stripe_customers: customer id → owner (user | org) ──────────────────────

export type CustomerOwner = { ownerType: 'user' | 'org'; ownerId: string };

/** True once both Supabase env vars needed for service-role reads are present. */
export const supabaseConfigured = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

/** Map of Stripe customer id → owning user or org, from public.stripe_customers. */
export async function loadCustomerOwners(fresh = false): Promise<Map<string, CustomerOwner>> {
  return cached('customerOwners', fresh, async () => {
    const map = new Map<string, CustomerOwner>();
    if (!supabaseConfigured) return map;
    try {
      const supabase = createServiceClient();
      const { data, error } = await supabase.from('stripe_customers').select('id, owner_type, owner_id');
      if (error || !data) return map;
      for (const row of data as { id: string; owner_type: 'user' | 'org'; owner_id: string }[]) {
        map.set(row.id, { ownerType: row.owner_type, ownerId: row.owner_id });
      }
    } catch {
      /* table unreadable → fall back to email matching downstream */
    }
    return map;
  });
}

// ── The join ────────────────────────────────────────────────────────────────

/** Payment state for a user row, in precedence order. */
export type PaymentState = 'active' | 'trialing' | 'past_due' | 'canceled' | 'org_seat' | 'free';

const STATE_RANK: Record<PaymentState, number> = {
  active: 0, trialing: 1, past_due: 2, org_seat: 3, canceled: 4, free: 5,
};

export type UserRow = AuthUser & {
  state: PaymentState;
  /** Monthly cents this user personally contributes. Org seats attribute to the org, not the seat. */
  monthlyCents: number;
  planName: string | null;
  interval: string | null;
  quantity: number;
  currentPeriodEnd: number | null;
  cancelAtPeriodEnd: boolean;
  trialEnd: number | null;
  subId: string | null;
  /** Set when the user's access comes from an org seat rather than a personal sub. */
  orgId: string | null;
  orgName: string | null;
};

function stateFromStatus(status: SubStatus): PaymentState | null {
  switch (status) {
    case 'active': return 'active';
    case 'trialing': return 'trialing';
    case 'past_due':
    case 'unpaid': return 'past_due';
    case 'canceled':
    case 'incomplete_expired': return 'canceled';
    // 'incomplete' and 'paused' are not access-granting and not yet churn.
    default: return null;
  }
}

export type OrgRow = {
  id: string;
  name: string;
  slug: string | null;
  created_at: string;
  memberCount: number;
  seatsAssigned: number;
  /** Seats purchased on the org's Stripe subscription. */
  seatsPurchased: number;
  state: PaymentState;
  monthlyCents: number;
  planName: string | null;
  currentPeriodEnd: number | null;
  cancelAtPeriodEnd: boolean;
  pendingInvites: number;
};

export type Snapshot = {
  users: UserRow[];
  orgs: OrgRow[];
  subs: SubRow[];
  truncated: { users: boolean; subs: boolean };
  available: { supabase: boolean; stripe: boolean };
  stripeMode: 'live' | 'test' | 'unknown';
  /** False = Stripe reads hit the PLATFORM account. */
  connectScoped: boolean;
  /** Other product lines on the same Stripe account, kept out of Align360's numbers. */
  excluded: { activeSubs: number; monthlyCents: number; products: string[] };
  brandFilterApplied: boolean;
  generatedAt: number;
};

export type OrgTables = {
  orgs: { id: string; name: string; slug: string | null; created_at: string }[];
  members: { org_id: string; user_id: string; role: string; seat_assigned: boolean }[];
  invites: { org_id: string; status: string }[];
};

export type SnapshotInput = {
  authUsers: AuthUsersResult;
  subs: SubsResult;
  owners: Map<string, CustomerOwner>;
  orgData: OrgTables;
};

/**
 * The one query the whole portal is built on: every signup, joined to its
 * payment state, plus every org with its seat math.
 */
export async function loadSnapshot(fresh = false): Promise<Snapshot> {
  const [authRes, subsRes, owners] = await Promise.all([
    listAuthUsers(fresh),
    listSubscriptions(fresh),
    loadCustomerOwners(fresh),
  ]);

  // Org tables. Read defensively: an unconfigured environment or a missing table
  // should degrade the teams view and raise a banner, never 502 the dashboard.
  const orgData = await cached<OrgTables>('orgs', fresh, async () => {
    if (!supabaseConfigured) return { orgs: [], members: [], invites: [] };
    try {
      const supabase = createServiceClient();
      const [orgs, members, invites] = await Promise.all([
        supabase.from('organizations').select('id, name, slug, created_at'),
        supabase.from('organization_members').select('org_id, user_id, role, seat_assigned'),
        supabase.from('organization_invitations').select('org_id, status'),
      ]);
      return {
        orgs: (orgs.data ?? []) as OrgTables['orgs'],
        members: (members.data ?? []) as OrgTables['members'],
        invites: (invites.data ?? []) as OrgTables['invites'],
      };
    } catch {
      return { orgs: [], members: [], invites: [] };
    }
  });

  return buildSnapshot({ authUsers: authRes, subs: subsRes, owners, orgData });
}

/**
 * Pure join: fetched rows in, dashboard shapes out. Split from loadSnapshot so
 * the precedence rules (personal sub beats org seat, active beats trialing beats
 * churned) are testable without touching Stripe or Supabase.
 */
export function buildSnapshot({ authUsers: authRes, subs: subsRes, owners, orgData }: SnapshotInput): Snapshot {
  // Index subs by the owner they belong to, and by lowercased customer email as
  // the pre-stripe_customers fallback.
  const subsByUser = new Map<string, SubRow[]>();
  const subsByOrg = new Map<string, SubRow[]>();
  const subsByEmail = new Map<string, SubRow[]>();
  for (const s of subsRes.subs) {
    const owner = owners.get(s.customerId);
    if (owner?.ownerType === 'user') push(subsByUser, owner.ownerId, s);
    else if (owner?.ownerType === 'org') push(subsByOrg, owner.ownerId, s);
    else if (s.customerEmail) push(subsByEmail, s.customerEmail.trim().toLowerCase(), s);
  }

  // Org rows first, so user rows can point at an org by name.
  const membersByOrg = new Map<string, typeof orgData.members>();
  const orgByUser = new Map<string, { id: string; name: string; seatAssigned: boolean }>();
  for (const m of orgData.members) push(membersByOrg, m.org_id, m);

  const orgs: OrgRow[] = orgData.orgs.map((o) => {
    const members = membersByOrg.get(o.id) ?? [];
    const best = bestSub(subsByOrg.get(o.id) ?? []);
    for (const m of members) orgByUser.set(m.user_id, { id: o.id, name: o.name, seatAssigned: m.seat_assigned });
    return {
      id: o.id,
      name: o.name,
      slug: o.slug,
      created_at: o.created_at,
      memberCount: members.length,
      seatsAssigned: members.filter((m) => m.seat_assigned).length,
      seatsPurchased: best?.quantity ?? 0,
      state: best ? stateFromStatus(best.status) ?? 'free' : 'free',
      monthlyCents: best && PAYING_STATUSES.includes(best.status) ? best.monthlyCents : 0,
      planName: best?.planName ?? null,
      currentPeriodEnd: best?.currentPeriodEnd ?? null,
      cancelAtPeriodEnd: best?.cancelAtPeriodEnd ?? false,
      pendingInvites: orgData.invites.filter((i) => i.org_id === o.id && i.status === 'pending').length,
    };
  });
  const orgStateById = new Map(orgs.map((o) => [o.id, o]));

  const users: UserRow[] = authRes.users.map((u) => {
    const email = u.email?.trim().toLowerCase() ?? '';
    const personal = bestSub([...(subsByUser.get(u.id) ?? []), ...(email ? subsByEmail.get(email) ?? [] : [])]);
    const personalState = personal ? stateFromStatus(personal.status) : null;

    // A live personal subscription always wins. Otherwise, if the user holds an
    // assigned seat in a paying org, they are covered by that org.
    if (personal && personalState && personalState !== 'canceled') {
      return {
        ...u,
        state: personalState,
        monthlyCents: PAYING_STATUSES.includes(personal.status) ? personal.monthlyCents : 0,
        planName: personal.planName,
        interval: personal.interval,
        quantity: personal.quantity,
        currentPeriodEnd: personal.currentPeriodEnd,
        cancelAtPeriodEnd: personal.cancelAtPeriodEnd,
        trialEnd: personal.trialEnd,
        subId: personal.id,
        orgId: null,
        orgName: null,
      };
    }

    const membership = orgByUser.get(u.id);
    const org = membership ? orgStateById.get(membership.id) : undefined;
    if (membership && org && membership.seatAssigned && (org.state === 'active' || org.state === 'trialing')) {
      return {
        ...u, state: 'org_seat', monthlyCents: 0, planName: org.planName, interval: null, quantity: 1,
        currentPeriodEnd: org.currentPeriodEnd, cancelAtPeriodEnd: org.cancelAtPeriodEnd, trialEnd: null,
        subId: null, orgId: org.id, orgName: org.name,
      };
    }

    return {
      ...u,
      state: personalState === 'canceled' ? 'canceled' : 'free',
      monthlyCents: 0,
      planName: personal?.planName ?? null,
      interval: personal?.interval ?? null,
      quantity: personal?.quantity ?? 0,
      currentPeriodEnd: personal?.currentPeriodEnd ?? null,
      cancelAtPeriodEnd: personal?.cancelAtPeriodEnd ?? false,
      trialEnd: null,
      subId: personal?.id ?? null,
      orgId: membership?.id ?? null,
      orgName: membership ? orgStateById.get(membership.id)?.name ?? null : null,
    };
  });

  return {
    users,
    orgs,
    subs: subsRes.subs,
    truncated: { users: authRes.truncated, subs: subsRes.truncated },
    available: { supabase: authRes.available, stripe: subsRes.available },
    stripeMode: subsRes.livemode == null ? 'unknown' : subsRes.livemode ? 'live' : 'test',
    connectScoped: subsRes.connectScoped,
    excluded: subsRes.excluded,
    brandFilterApplied: subsRes.brandFilterApplied,
    generatedAt: Date.now(),
  };
}

/** Highest-precedence subscription for an owner (active beats trialing beats canceled). */
function bestSub(subs: SubRow[]): SubRow | null {
  if (!subs.length) return null;
  return [...subs].sort((a, b) => {
    const ra = STATE_RANK[stateFromStatus(a.status) ?? 'free'];
    const rb = STATE_RANK[stateFromStatus(b.status) ?? 'free'];
    return ra !== rb ? ra - rb : b.created - a.created;
  })[0];
}

function push<K, V>(map: Map<K, V[]>, key: K, value: V) {
  const arr = map.get(key);
  if (arr) arr.push(value);
  else map.set(key, [value]);
}

export { stateFromStatus };
