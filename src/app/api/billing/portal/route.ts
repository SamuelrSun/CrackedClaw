import { NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/api-auth';
import { stripe } from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabase/admin';
export const dynamic = 'force-dynamic';

export async function POST() {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  const supabase = createAdminClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single();

  if (!profile?.stripe_customer_id) {
    return NextResponse.json({ error: 'No billing account found' }, { status: 404 });
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: profile.stripe_customer_id,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings`,
  });

  return NextResponse.json({ url: session.url });
}
