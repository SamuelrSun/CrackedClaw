import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/api-auth';
import { stripe, PLANS, PlanSlug, getPriceId } from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabase/admin';
export const dynamic = 'force-dynamic';

const PAID_PLANS: PlanSlug[] = ['starter', 'pro', 'power', 'ultra'];

export async function POST(request: NextRequest) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  const supabase = createAdminClient();

  // Parse requested plan (default to 'pro' for backward compat)
  let requestedPlan: PlanSlug = 'pro';
  try {
    const body = await request.json();
    if (body.plan && PAID_PLANS.includes(body.plan as PlanSlug)) {
      requestedPlan = body.plan as PlanSlug;
    }
  } catch {
    // No body or malformed JSON — use default
  }

  const priceId = getPriceId(requestedPlan);
  if (!priceId) {
    return NextResponse.json({ error: `Price ID not configured for plan: ${requestedPlan}` }, { status: 500 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, stripe_customer_id, plan')
    .eq('id', user.id)
    .single();

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  if (profile.plan === requestedPlan) {
    return NextResponse.json({ error: `Already on ${requestedPlan} plan` }, { status: 400 });
  }

  let customerId = profile.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { user_id: user.id },
    });
    customerId = customer.id;
    await supabase.from('profiles').update({ stripe_customer_id: customerId }).eq('id', user.id);
  }

  // Check for an existing active subscription — upgrade it with pro-rating
  // instead of creating a new checkout session.
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('stripe_subscription_id')
    .eq('id', user.id)
    .single();

  if (existingProfile?.stripe_subscription_id) {
    try {
      const existingSub = await stripe.subscriptions.retrieve(existingProfile.stripe_subscription_id);
      const existingItemId = (existingSub as unknown as { items: { data: Array<{ id: string }> } }).items?.data?.[0]?.id;

      if (existingItemId && existingSub.status === 'active') {
        // Upgrade/downgrade existing subscription with proration
        await stripe.subscriptions.update(existingProfile.stripe_subscription_id, {
          items: [{ id: existingItemId, price: priceId }],
          proration_behavior: 'create_prorations',
        });

        // Update plan in DB immediately (webhook will also fire but this is faster)
        await supabase.from('profiles').update({ plan: requestedPlan }).eq('id', user.id);

        return NextResponse.json({ success: true, plan: requestedPlan });
      }
    } catch (subErr) {
      console.warn('[checkout] Could not upgrade existing subscription, falling back to checkout:', subErr);
    }
  }

  // No existing subscription — create new checkout session
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings?upgraded=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing?canceled=true`,
    metadata: { user_id: user.id, plan: requestedPlan },
  });

  return NextResponse.json({ url: session.url });
}
