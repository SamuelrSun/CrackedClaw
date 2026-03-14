/**
 * GET /api/integrations/status
 * Returns all connected integration providers for the current user
 */

import { requireApiAuth, jsonResponse, errorResponse } from '@/lib/api-auth';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  try {
    const supabase = await createClient();

    const { data: integrations, error: dbError } = await supabase
      .from('user_integrations')
      .select('provider, status')
      .eq('user_id', user.id)
      .eq('status', 'connected');

    if (dbError) {
      console.error('Failed to fetch integration statuses:', dbError);
      return errorResponse('Failed to fetch integration statuses', 500);
    }

    const connected = (integrations || []).map(i => i.provider);

    return jsonResponse({ connected });
  } catch (err) {
    console.error('Integration status error:', err);
    return errorResponse('An unexpected error occurred', 500);
  }
}
