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
 * LIVE mode (go-live, 2026-07-01): a sk_live_ key additionally requires the
 * explicit --live flag, so an accidental live run stays impossible:
 *   STRIPE_SECRET_KEY=sk_live_... STRIPE_CONNECTED_ACCOUNT_ID=acct_... \
 *     npx tsx scripts/stripe-setup-products.ts --live            (dry run)
 *   STRIPE_SECRET_KEY=sk_live_... STRIPE_CONNECTED_ACCOUNT_ID=acct_... \
 *     npx tsx scripts/stripe-setup-products.ts --live --confirm  (create)
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
  if (!key) throw new Error('STRIPE_SECRET_KEY is required.');
  const live = process.argv.includes('--live');
  if (key.startsWith('sk_live_') && !live) {
    throw new Error('LIVE key detected. Re-run with the explicit --live flag to operate on live mode.');
  }
  if (live && !key.startsWith('sk_live_')) {
    throw new Error('--live was passed but the key is not a sk_live_ key.');
  }
  const confirm = process.argv.includes('--confirm');

  const stripe = new Stripe(key);
  if (live) console.log('*** LIVE MODE ***');
  // Direct Charges → create on the connected account when set; otherwise create on
  // the platform account (test/dev before Samuel has connected). Idempotent per account.
  const opts: Stripe.RequestOptions = acct ? { stripeAccount: acct } : {};

  console.log(`${confirm ? 'APPLYING' : 'DRY RUN'} on ${acct ? `connected account ${acct}` : 'the PLATFORM account (no STRIPE_CONNECTED_ACCOUNT_ID set)'}\n`);
  for (const t of TIERS) {
    const found = await stripe.prices.list({ lookup_keys: [t.lookupKey], active: true, limit: 1 }, opts);
    if (found.data.length) {
      const p = found.data[0];
      const productId = typeof p.product === 'string' ? p.product : p.product.id;
      const price = `$${(p.unit_amount ?? 0) / 100}/${t.interval}${t.perSeat ? '/seat' : ''}`;
      // Stripe prices are immutable: on an amount change, create a NEW price and
      // move the lookup key onto it (transfer_lookup_key), then deactivate the old
      // one. Existing subscriptions keep billing on the old (now-inactive) price;
      // new checkouts pick up the new amount via the lookup key.
      if (p.unit_amount !== t.amountCents) {
        const target = `$${t.amountCents / 100}/${t.interval}${t.perSeat ? '/seat' : ''}`;
        if (!confirm) {
          console.log(`↻ would reprice  ${t.lookupKey}  ${price} → ${target}`);
          continue;
        }
        const np = await stripe.prices.create(
          {
            product: productId,
            unit_amount: t.amountCents,
            currency: 'usd',
            recurring: { interval: t.interval, usage_type: 'licensed' },
            lookup_key: t.lookupKey,
            transfer_lookup_key: true,
          },
          opts,
        );
        await stripe.prices.update(p.id, { active: false }, opts);
        await stripe.products.update(
          productId,
          { name: t.productName, description: t.description, images: [BRAND_IMAGE], statement_descriptor: 'ALIGN360', metadata: { brand: 'Align360', tier: t.key } },
          opts,
        );
        console.log(`↻ repriced  ${t.lookupKey}  ${price} → ${target}  (new ${np.id}, old ${p.id} deactivated)`);
        continue;
      }
      if (confirm) {
        // Idempotently (re)apply ALIGN branding to the existing product.
        await stripe.products.update(
          productId,
          { name: t.productName, description: t.description, images: [BRAND_IMAGE], statement_descriptor: 'ALIGN360', metadata: { brand: 'Align360', tier: t.key } },
          opts,
        );
        console.log(`✓ exists  ${t.lookupKey} → ${p.id}  (${price}, ALIGN branding applied)`);
      } else {
        console.log(`✓ exists  ${t.lookupKey} → ${p.id}  (${price}, would apply ALIGN branding)`);
      }
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
