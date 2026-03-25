export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireBrainAuth } from '@/lib/brain-api-auth';
import { jsonResponse, errorResponse } from '@/lib/api-auth';
import { updateCriterionWeight } from '@/lib/brain/brain-store';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireBrainAuth(request);
    if ('error' in auth) return auth.error;

    const { id } = await params;
    const userId = auth.user.id;

    const body = await request.json();
    const { weight_delta } = body as { weight_delta?: number };

    if (typeof weight_delta !== 'number' || weight_delta < -1 || weight_delta > 1) {
      return errorResponse('weight_delta must be a number between -1 and 1', 400);
    }

    await updateCriterionWeight(userId, id, weight_delta);

    return jsonResponse({ ok: true });
  } catch (err) {
    console.error('[api/brain/v1/preferences/[id]] error:', err);
    return errorResponse('Internal server error', 500);
  }
}
