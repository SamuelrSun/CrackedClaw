import { BillingPageClient } from './client';

export const dynamic = 'force-dynamic';

export default async function BillingPage() {
  let currentPlan = 'free';
  let isSubscribed = false;

  try {
    // Dynamic import to avoid crashes if Supabase env vars aren't set
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('plan, plan_status')
        .eq('id', user.id)
        .single();

      if (profile) {
        currentPlan = profile.plan || 'free';
        isSubscribed = profile.plan_status === 'active' && profile.plan !== 'free';
      }
    }
  } catch {
    // If not logged in or env missing, show public pricing with defaults
  }

  return <BillingPageClient currentPlan={currentPlan} isSubscribed={isSubscribed} />;
}
