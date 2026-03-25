/**
 * PATCH /api/brain/update — Update the content of an existing memory fact.
 *
 * Auth: Brain API key (dpb_sk_...) or Supabase session
 * Rate limit: 30 req/min
 *
 * Request body:
 *   { id: string, content: string }
 *
 * Response:
 *   { id: string, updated: boolean }
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireBrainAuth } from '@/lib/brain-api/auth';
import { checkRateLimit } from '@/lib/brain-api/rate-limit';
import { getEmbedding } from '@/lib/brain-api/embeddings';
import { createAdminClient } from '@/lib/supabase/admin';
import { jsonResponse, errorResponse } from '@/lib/api-auth';
import type { UpdateRequest, UpdateResponse } from '@/lib/brain-api/types';

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    },
  });
}

export async function PATCH(request: NextRequest) {
  try {
    // --- Auth ---
    const auth = await requireBrainAuth(request);
    if ('error' in auth) return auth.error;
    const userId = auth.user.id;

    // --- Rate limit ---
    const rl = checkRateLimit(userId, 'update');
    if (!rl.allowed) {
      const res = NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
      res.headers.set('Retry-After', String(rl.retryAfter));
      res.headers.set('Access-Control-Allow-Origin', '*');
      return res;
    }

    // --- Parse & validate input ---
    let body: UpdateRequest;
    try {
      body = await request.json();
    } catch {
      return errorResponse('Invalid JSON body', 400);
    }

    const { id, content } = body;

    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      return errorResponse('id is required', 400);
    }

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return errorResponse('content is required and must be a non-empty string', 400);
    }

    if (content.trim().length > 2000) {
      return errorResponse('content must be 2000 characters or fewer', 400);
    }

    const supabase = createAdminClient();

    // --- Verify ownership ---
    const { data: existing, error: fetchError } = await supabase
      .from('memories')
      .select('id')
      .eq('id', id.trim())
      .eq('user_id', userId)
      .maybeSingle();

    if (fetchError) {
      console.error('[api/brain/update] ownership check error:', fetchError);
      return errorResponse('Failed to look up memory', 500);
    }

    if (!existing) {
      return errorResponse('Memory not found', 404);
    }

    // --- Re-embed updated content ---
    const embedding = await getEmbedding(content.trim());

    // --- Update record ---
    const { error: updateError } = await supabase
      .from('memories')
      .update({
        content: content.trim(),
        embedding,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id.trim())
      .eq('user_id', userId);

    if (updateError) {
      console.error('[api/brain/update] update error:', updateError);
      return errorResponse('Failed to update memory', 500);
    }

    const response: UpdateResponse = { id: id.trim(), updated: true };
    const res = jsonResponse(response);
    res.headers.set('Access-Control-Allow-Origin', '*');
    return res;
  } catch (err) {
    console.error('[api/brain/update] error:', err);
    return errorResponse('Internal server error', 500);
  }
}
