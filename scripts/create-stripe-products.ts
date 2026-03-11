// Run with: npx tsx scripts/create-stripe-products.ts
// Make sure STRIPE_SECRET_KEY is set in your environment or .env.local

import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-02-25.clover' as Parameters<typeof Stripe>[1]['apiVersion'],
});

async function main() {
  console.log('Creating CrackedClaw Stripe products...\n');

  // Create product
  const product = await stripe.products.create({
    name: 'CrackedClaw Subscription',
    description: 'AI assistant plans for CrackedClaw',
  });
  console.log('Product created:', product.id);

  // Create prices
  const starter = await stripe.prices.create({
    product: product.id,
    unit_amount: 2000, // $20
    currency: 'usd',
    recurring: { interval: 'month' },
    nickname: 'Starter',
  });

  const pro = await stripe.prices.create({
    product: product.id,
    unit_amount: 5000, // $50
    currency: 'usd',
    recurring: { interval: 'month' },
    nickname: 'Pro',
  });

  const power = await stripe.prices.create({
    product: product.id,
    unit_amount: 10000, // $100
    currency: 'usd',
    recurring: { interval: 'month' },
    nickname: 'Power',
  });

  console.log('\n✅ Add these to your .env.local:\n');
  console.log(`STRIPE_STARTER_PRICE_ID=${starter.id}`);
  console.log(`STRIPE_PRO_PRICE_ID=${pro.id}`);
  console.log(`STRIPE_POWER_PRICE_ID=${power.id}`);
  console.log('\nDone!');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
