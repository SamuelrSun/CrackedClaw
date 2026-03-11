import { PricingPageClient } from './client';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function PricingPage() {
  let currentPlan = 'free';
  let isSubscribed = false;

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const adminClient = createAdminClient();
      const { data: org } = await adminClient
        .from('organizations')
        .select('plan, plan_status')
        .eq('owner_id', user.id)
        .single();

      if (org) {
        currentPlan = org.plan || 'free';
        isSubscribed = org.plan_status === 'active' && org.plan !== 'free';
      }
    }
  } catch {
    // If not logged in, show public pricing
  }

  return <PricingPageClient currentPlan={currentPlan} isSubscribed={isSubscribed} />;
}
