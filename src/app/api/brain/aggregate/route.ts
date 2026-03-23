/**
 * POST /api/brain/aggregate
 *
 * Triggers brain pattern aggregation + criteria synthesis for the authenticated user.
 * Can be called manually or by a periodic job.
 */

import { requireApiAuth, jsonResponse, errorResponse } from '@/lib/api-auth';
import { createClient } from '@/lib/supabase/server';
import { runBrainAggregation } from '@/lib/brain/aggregator/runner';

export const dynamic = 'force-dynamic';

export async function POST() {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  try {
    // Check brain_enabled setting
    const supabase = await createClient();
    const { data: profile } = await supabase
      .from('profiles')
      .select('instance_settings')
      .eq('id', user.id)
      .single();

    const settings = (profile?.instance_settings as Record<string, unknown>) || {};
    const brainEnabled = (settings.brain_enabled as boolean) ?? true;

    if (!brainEnabled) {
      return errorResponse('Brain feature is not enabled', 403);
    }

    const result = await runBrainAggregation(user.id);

    return jsonResponse({
      success: true,
      ...result,
    });
  } catch (err) {
    console.error('[api/brain/aggregate] error:', err);
    return errorResponse('Aggregation failed', 500);
  }
}
