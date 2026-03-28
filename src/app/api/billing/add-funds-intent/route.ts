/**
 * POST /api/billing/add-funds-intent
 * Creates a Stripe PaymentIntent for an inline wallet top-up (Elements-based flow).
 * Returns clientSecret so the frontend can render <PaymentElement />.
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

  // Create a PaymentIntent for the inline Elements flow
  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(amount * 100), // Stripe uses cents
    currency: 'usd',
    customer: customerId,
    // Save the payment method for future auto-reload
    setup_future_usage: 'off_session',
    metadata: {
      user_id: user.id,
      type: 'wallet_deposit',
      amount: amount.toString(),
    },
    description: `Dopl Wallet — $${amount.toFixed(2)}`,
  });

  return NextResponse.json({ clientSecret: paymentIntent.client_secret });
}
