/**
 * GET /api/brain/criteria
 *
 * Returns all active brain criteria for the authenticated user.
 * Supports optional `domain` and `type` query params for filtering.
 */

import { NextRequest } from 'next/server';
import { requireApiAuth, jsonResponse, errorResponse } from '@/lib/api-auth';
import { loadBrainCriteria } from '@/lib/brain/brain-store';
import type { BrainContext, PreferenceType } from '@/lib/brain/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const domain = searchParams.get('domain');
    const type = searchParams.get('type') as PreferenceType | null;

    const context: BrainContext | undefined = domain ? { domain } : undefined;

    const criteria = await loadBrainCriteria(user.id, context, {
      limit: 200,
      minConfidence: 0,
      preferenceType: type || undefined,
    });

    return jsonResponse({ criteria });
  } catch (err) {
    console.error('[api/brain/criteria] error:', err);
    return errorResponse('Failed to load criteria', 500);
  }
}
