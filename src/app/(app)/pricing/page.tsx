import { PricingPageClient } from './client';

export const dynamic = 'force-dynamic';

export default async function PricingPage() {
  let currentPlan = 'free';
  let isSubscribed = false;

  try {
    // Dynamic import to avoid crashes if Supabase env vars aren't set
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const { createAdminClient } = await import('@/lib/supabase/admin');
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
    // If not logged in or env missing, show public pricing with defaults
  }

  return <PricingPageClient currentPlan={currentPlan} isSubscribed={isSubscribed} />;
}
