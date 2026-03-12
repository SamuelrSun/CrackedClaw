import { requireApiAuth, jsonResponse } from '@/lib/api-auth';
import { createAdminClient } from '@/lib/supabase/admin';
export const dynamic = 'force-dynamic';

export async function GET() {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  const supabase = createAdminClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select('plan, plan_status, current_period_end, stripe_customer_id')
    .eq('id', user.id)
    .single();

  return jsonResponse({
    plan: profile?.plan || 'free',
    status: profile?.plan_status || 'active',
    periodEnd: profile?.current_period_end,
  });
}
