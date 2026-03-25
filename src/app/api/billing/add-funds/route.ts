/**
 * POST /api/billing/add-funds
 * Creates a Stripe Checkout session for a one-time payment (wallet deposit).
 * Minimum: $5. Presets: $5, $10, $25, $50, $100.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/api-auth';
import { stripe } from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const MIN_AMOUNT = 5;
const MAX_AMOUNT = 500;

export async function POST(request: NextRequest) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  let amount: number;
  try {
    const body = await request.json();
    amount = Number(body.amount);
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!amount || amount < MIN_AMOUNT || amount > MAX_AMOUNT) {
    return NextResponse.json(
      { error: `Amount must be between $${MIN_AMOUNT} and $${MAX_AMOUNT}` },
      { status: 400 }
    );
  }

  // Round to 2 decimal places
  amount = Math.round(amount * 100) / 100;

  const supabase = createAdminClient();

  // Get or create Stripe customer
  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single();

  let customerId = profile?.stripe_customer_id;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { user_id: user.id },
    });
    customerId = customer.id;
    await supabase
      .from('profiles')
      .update({ stripe_customer_id: customerId })
      .eq('id', user.id);
  }

  // Create one-time payment checkout session
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: `Dopl Wallet — $${amount.toFixed(2)}`,
            description: 'Add funds to your Dopl balance',
          },
          unit_amount: Math.round(amount * 100), // Stripe uses cents
        },
        quantity: 1,
      },
    ],
    // Save payment method for auto-reload
    payment_intent_data: {
      setup_future_usage: 'off_session',
    },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing?funded=true&amount=${amount}`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing?canceled=true`,
    metadata: {
      user_id: user.id,
      type: 'wallet_deposit',
      amount: amount.toString(),
    },
  });

  return NextResponse.json({ url: session.url });
}
