/**
 * DELETE /api/brain/forget — Hard-delete a memory fact.
 *
 * Auth: Brain API key (dpb_sk_...) or Supabase session
 * Rate limit: 30 req/min
 *
 * Request body:
 *   { id: string }
 *
 * Response:
 *   { id: string, deleted: boolean }
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireBrainAuth } from '@/lib/brain-api/auth';
import { checkRateLimit } from '@/lib/brain-api/rate-limit';
import { createAdminClient } from '@/lib/supabase/admin';
import { jsonResponse, errorResponse } from '@/lib/api-auth';
import type { ForgetRequest, ForgetResponse } from '@/lib/brain-api/types';

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    },
  });
}

export async function DELETE(request: NextRequest) {
  try {
    // --- Auth ---
    const auth = await requireBrainAuth(request);
    if ('error' in auth) return auth.error;
    const userId = auth.user.id;

    // --- Rate limit ---
    const rl = checkRateLimit(userId, 'forget');
    if (!rl.allowed) {
      const res = NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
      res.headers.set('Retry-After', String(rl.retryAfter));
      res.headers.set('Access-Control-Allow-Origin', '*');
      return res;
    }

    // --- Parse & validate input ---
    let body: ForgetRequest;
    try {
      body = await request.json();
    } catch {
      return errorResponse('Invalid JSON body', 400);
    }

    const { id } = body;

    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      return errorResponse('id is required', 400);
    }

    const supabase = createAdminClient();

    // --- Verify ownership, then delete ---
    // Single query: delete WHERE id AND user_id — ownership is implicit
    const { error: deleteError, count } = await supabase
      .from('memories')
      .delete({ count: 'exact' })
      .eq('id', id.trim())
      .eq('user_id', userId);

    if (deleteError) {
      console.error('[api/brain/forget] delete error:', deleteError);
      return errorResponse('Failed to delete memory', 500);
    }

    if ((count ?? 0) === 0) {
      return errorResponse('Memory not found', 404);
    }

    const response: ForgetResponse = { id: id.trim(), deleted: true };
    const res = jsonResponse(response);
    res.headers.set('Access-Control-Allow-Origin', '*');
    return res;
  } catch (err) {
    console.error('[api/brain/forget] error:', err);
    return errorResponse('Internal server error', 500);
  }
}
