import { requireApiAuth, jsonResponse } from '@/lib/api-auth';
import { createAdminClient } from '@/lib/supabase/admin';
export const dynamic = 'force-dynamic';

export async function GET() {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  const supabase = createAdminClient();
  const { data: org } = await supabase
    .from('organizations')
    .select('plan, plan_status, current_period_end, stripe_customer_id')
    .eq('owner_id', user.id)
    .single();

  return jsonResponse({ plan: org?.plan || 'free', status: org?.plan_status || 'active', periodEnd: org?.current_period_end });
}
