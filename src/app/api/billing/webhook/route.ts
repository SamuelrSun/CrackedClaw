import { NextRequest, NextResponse } from 'next/server';
import { stripe, PRICE_IDS } from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabase/admin';
export const dynamic = 'force-dynamic';

/**
 * Map a Stripe price ID back to the plan slug.
 * Falls back to 'free' if not found.
 */
function getPlanSlugFromPriceId(priceId: string): string {
  for (const [slug, id] of Object.entries(PRICE_IDS)) {
    if (id === priceId) return slug;
  }
  return 'free';
}

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
    const session = event.data.object as {
      metadata?: { user_id?: string; org_id?: string; plan?: string };
      subscription?: string;
    };
    // Support both user_id (new) and org_id (legacy) in metadata
    const userId = session.metadata?.user_id || session.metadata?.org_id;
    if (userId && session.subscription) {
      const sub = await stripe.subscriptions.retrieve(session.subscription as string);
      const priceId = (sub as unknown as { items: { data: Array<{ price: { id: string } }> } }).items?.data?.[0]?.price?.id;
      const planSlug = priceId ? getPlanSlugFromPriceId(priceId) : (session.metadata?.plan || 'pro');

      await supabase.from('profiles').update({
        plan: planSlug,
        plan_status: 'active',
        stripe_subscription_id: sub.id,
        current_period_end: new Date((sub as unknown as { current_period_end: number }).current_period_end * 1000).toISOString(),
      }).eq('id', userId);
    }
  }

  if (event.type === 'customer.subscription.updated') {
    const sub = event.data.object as unknown as {
      id: string;
      status: string;
      current_period_end: number;
      items: { data: Array<{ price: { id: string } }> };
    };
    const priceId = sub.items?.data?.[0]?.price?.id;
    const planSlug = priceId ? getPlanSlugFromPriceId(priceId) : 'pro';

    await supabase.from('profiles')
      .update({
        plan: planSlug,
        plan_status: sub.status,
        stripe_subscription_id: sub.id,
        current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
      })
      .eq('stripe_subscription_id', sub.id);
  }

  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object as unknown as {
      id: string;
      status: string;
      current_period_end: number;
    };
    await supabase.from('profiles')
      .update({
        plan: 'free',
        plan_status: sub.status,
        stripe_subscription_id: sub.id,
        current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
      })
      .eq('stripe_subscription_id', sub.id);
  }

  return NextResponse.json({ received: true });
}
