import { NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/api-auth';
import { stripe, PLANS } from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabase/admin';
export const dynamic = 'force-dynamic';

export async function POST() {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  const supabase = createAdminClient();

  const { data: org } = await supabase
    .from('organizations')
    .select('id, stripe_customer_id, plan')
    .eq('owner_id', user.id)
    .single();

  if (!org) return NextResponse.json({ error: 'No organization found' }, { status: 404 });
  if (org.plan === 'pro') return NextResponse.json({ error: 'Already on pro plan' }, { status: 400 });

  let customerId = org.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { user_id: user.id, org_id: org.id },
    });
    customerId = customer.id;
    await supabase.from('organizations').update({ stripe_customer_id: customerId }).eq('id', org.id);
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: PLANS.pro.priceId, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings?upgraded=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings?canceled=true`,
    metadata: { user_id: user.id, org_id: org.id },
  });

  return NextResponse.json({ url: session.url });
}
