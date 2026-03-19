import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/api-auth';
import { createClient } from '@/lib/supabase/server';
import { stripe, PRICE_IDS } from '@/lib/stripe';
import Stripe from 'stripe';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  const { plan } = await request.json();

  const priceId = PRICE_IDS[plan];
  if (!priceId) {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
  }

  const supabase = await createClient();

  // Get or create Stripe customer
  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id, email')
    .eq('id', user.id)
    .single();

  let customerId = profile?.stripe_customer_id;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: profile?.email || user.email,
      metadata: { user_id: user.id },
    });
    customerId = customer.id;

    await supabase
      .from('profiles')
      .update({ stripe_customer_id: customerId })
      .eq('id', user.id);
  }

  // Check if user already has an active subscription
  const existingSubs = await stripe.subscriptions.list({
    customer: customerId,
    status: 'active',
    limit: 1,
  });

  if (existingSubs.data.length > 0) {
    // Upgrade/downgrade existing subscription with proration
    const sub = existingSubs.data[0];
    const updatedSub = await stripe.subscriptions.update(sub.id, {
      items: [{ id: sub.items.data[0].id, price: priceId }],
      proration_behavior: 'create_prorations',
      payment_behavior: 'default_incomplete',
      expand: ['latest_invoice.payment_intent'],
    });

    const invoice = updatedSub.latest_invoice as Stripe.Invoice;
    const paymentIntent = invoice?.payment_intent as Stripe.PaymentIntent | null;

    // If the proration results in $0 or credit, no payment needed
    if (!paymentIntent || paymentIntent.status === 'succeeded') {
      await supabase
        .from('profiles')
        .update({
          plan,
          current_period_end: new Date(updatedSub.current_period_end * 1000).toISOString(),
        })
        .eq('id', user.id);

      return NextResponse.json({ success: true, plan });
    }

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      subscriptionId: updatedSub.id,
      plan,
      isUpgrade: true,
    });
  }

  // Create new subscription
  const subscription = await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
    payment_behavior: 'default_incomplete',
    payment_settings: {
      save_default_payment_method: 'on_subscription',
    },
    expand: ['latest_invoice.payment_intent'],
    metadata: { user_id: user.id, plan },
  });

  const invoice = subscription.latest_invoice as Stripe.Invoice;
  const paymentIntent = invoice?.payment_intent as Stripe.PaymentIntent | null;

  return NextResponse.json({
    clientSecret: paymentIntent?.client_secret,
    subscriptionId: subscription.id,
    plan,
    isUpgrade: false,
  });
}
