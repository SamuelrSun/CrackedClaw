import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabase/admin';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get('stripe-signature')!;

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const supabase = createAdminClient();

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as { metadata?: { org_id?: string }; subscription?: string };
    const orgId = session.metadata?.org_id;
    if (orgId && session.subscription) {
      const sub = await stripe.subscriptions.retrieve(session.subscription as string);
      await supabase.from('organizations').update({
        plan: 'pro',
        plan_status: 'active',
        stripe_subscription_id: sub.id,
        current_period_end: new Date((sub as unknown as { current_period_end: number }).current_period_end * 1000).toISOString(),
      }).eq('id', orgId);
    }
  }

  if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
    const sub = event.data.object as unknown as { id: string; status: string; current_period_end: number };
    const plan = event.type === 'customer.subscription.deleted' ? 'free' : 'pro';
    await supabase.from('organizations')
      .update({
        plan,
        plan_status: sub.status,
        stripe_subscription_id: sub.id,
        current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
      })
      .eq('stripe_subscription_id', sub.id);
  }

  return NextResponse.json({ received: true });
}
