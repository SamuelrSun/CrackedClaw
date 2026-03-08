import { NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/api-auth';
import { stripe } from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabase/admin';
export const dynamic = 'force-dynamic';

export async function POST() {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  const supabase = createAdminClient();
  const { data: org } = await supabase
    .from('organizations')
    .select('stripe_customer_id')
    .eq('owner_id', user.id)
    .single();

  if (!org?.stripe_customer_id) {
    return NextResponse.json({ error: 'No billing account found' }, { status: 404 });
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: org.stripe_customer_id,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings`,
  });

  return NextResponse.json({ url: session.url });
}
