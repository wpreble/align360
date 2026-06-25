/**
 * Idempotent Stripe product/price setup for Align360 (Direct Charges + Connect).
 *
 * Creates each TIER as a Product + recurring Price on Samuel's CONNECTED account
 * (Direct Charges => objects live on the connected account), keyed by lookup_key
 * so re-runs never duplicate. Ascendance keeps APPLICATION_FEE_PERCENT per sub
 * (set on the subscription at checkout, not here).
 *
 * Dry run (default — lists what it would do):
 *   STRIPE_SECRET_KEY=sk_test_... STRIPE_CONNECTED_ACCOUNT_ID=acct_... \
 *     npx tsx scripts/stripe-setup-products.ts
 *
 * Apply:
 *   STRIPE_SECRET_KEY=sk_test_... STRIPE_CONNECTED_ACCOUNT_ID=acct_... \
 *     npx tsx scripts/stripe-setup-products.ts --confirm
 *
 * Refuses to run against a live (sk_live_) key.
 */
import Stripe from 'stripe';
import { TIERS } from '../lib/billing/tiers';

// ALIGN brand image shown on the Stripe product / Checkout line item. The
// account-level Checkout logo + brand color are set in the Stripe Dashboard
// (Settings -> Branding); they can't be set via the API.
const BRAND_IMAGE = 'https://align360-app.vercel.app/brand/align-mark-fig.png';

async function main() {
  const key = process.env.STRIPE_SECRET_KEY;
  const acct = process.env.STRIPE_CONNECTED_ACCOUNT_ID;
  if (!key) throw new Error('STRIPE_SECRET_KEY is required (use a sk_test_ key).');
  if (key.startsWith('sk_live_')) throw new Error('Refusing to run against a LIVE key. Use sk_test_.');
  const confirm = process.argv.includes('--confirm');

  const stripe = new Stripe(key);
  // Direct Charges → create on the connected account when set; otherwise create on
  // the platform account (test/dev before Samuel has connected). Idempotent per account.
  const opts: Stripe.RequestOptions = acct ? { stripeAccount: acct } : {};

  console.log(`${confirm ? 'APPLYING' : 'DRY RUN'} on ${acct ? `connected account ${acct}` : 'the PLATFORM account (no STRIPE_CONNECTED_ACCOUNT_ID set)'}\n`);
  for (const t of TIERS) {
    const found = await stripe.prices.list({ lookup_keys: [t.lookupKey], active: true, limit: 1 }, opts);
    if (found.data.length) {
      const p = found.data[0];
      console.log(`✓ exists  ${t.lookupKey} → ${p.id}  ($${(p.unit_amount ?? 0) / 100}/${t.interval}${t.perSeat ? '/seat' : ''})`);
      continue;
    }
    if (!confirm) {
      console.log(`+ would create  ${t.lookupKey}  ($${t.amountCents / 100}/${t.interval}${t.perSeat ? '/seat' : ''})`);
      continue;
    }
    const product = await stripe.products.create(
      { name: t.productName, description: t.description, images: [BRAND_IMAGE], statement_descriptor: 'ALIGN360', metadata: { brand: 'Align360', tier: t.key } },
      opts,
    );
    const price = await stripe.prices.create(
      {
        product: product.id,
        unit_amount: t.amountCents,
        currency: 'usd',
        recurring: { interval: t.interval, usage_type: 'licensed' },
        lookup_key: t.lookupKey,
      },
      opts,
    );
    console.log(`+ created  ${t.lookupKey} → ${price.id}  (product ${product.id})`);
  }
  console.log(`\n${confirm ? 'Done.' : 'Dry run only — re-run with --confirm to create.'}`);
}

main().catch((e) => {
  console.error('FAILED:', e instanceof Error ? e.message : e);
  process.exit(1);
});
