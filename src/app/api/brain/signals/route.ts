/**
 * GET /api/brain/signals
 *
 * Returns recent brain signals for the authenticated user.
 * Supports optional `domain`, `criterion_id`, and `limit` query params.
 */

import { NextRequest } from 'next/server';
import { requireApiAuth, jsonResponse, errorResponse } from '@/lib/api-auth';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const domain = searchParams.get('domain');
    const criterionId = searchParams.get('criterion_id');
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));

    const supabase = createAdminClient();

    let query = supabase
      .from('brain_signals')
      .select('id, signal_type, domain, subdomain, context, signal_data, session_id, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (domain) {
      query = query.eq('domain', domain);
    }

    // If criterion_id is provided, we filter signals that match the criterion's domain
    // (signal-level filtering by criterion is done client-side via keyword matching)
    if (criterionId) {
      // We don't have a direct criterion_id on signals, so this is informational
      // The client will do fine-grained filtering
    }

    const { data, error: queryError } = await query;

    if (queryError) {
      console.error('[api/brain/signals] query error:', queryError);
      return errorResponse('Failed to load signals', 500);
    }

    return jsonResponse({ signals: data || [] });
  } catch (err) {
    console.error('[api/brain/signals] error:', err);
    return errorResponse('Failed to load signals', 500);
  }
}
