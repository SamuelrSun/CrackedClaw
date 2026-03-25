/**
 * POST /api/brain/remember — Store a single fact in the user's memory.
 *
 * Auth: Brain API key (dpb_sk_...) or Supabase session
 * Rate limit: 30 req/min
 *
 * Request body:
 *   { fact: string, domain?: string, source?: string }
 *
 * Response:
 *   { id: string | null, created: boolean }
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireBrainAuth } from '@/lib/brain-api/auth';
import { checkRateLimit } from '@/lib/brain-api/rate-limit';
import { jsonResponse, errorResponse } from '@/lib/api-auth';
import { mem0Write } from '@/lib/memory/mem0-client';
import type { RememberRequest, RememberResponse } from '@/lib/brain-api/types';

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    // --- Auth ---
    const auth = await requireBrainAuth(request);
    if ('error' in auth) return auth.error;
    const userId = auth.user.id;

    // --- Rate limit ---
    const rl = checkRateLimit(userId, 'remember');
    if (!rl.allowed) {
      const res = NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
      res.headers.set('Retry-After', String(rl.retryAfter));
      res.headers.set('Access-Control-Allow-Origin', '*');
      return res;
    }

    // --- Parse & validate input ---
    let body: RememberRequest;
    try {
      body = await request.json();
    } catch {
      return errorResponse('Invalid JSON body', 400);
    }

    const { fact, domain, source } = body;

    if (!fact || typeof fact !== 'string' || fact.trim().length === 0) {
      return errorResponse('fact is required and must be a non-empty string', 400);
    }

    if (fact.trim().length > 2000) {
      return errorResponse('fact must be 2000 characters or fewer', 400);
    }

    // --- Write to memory ---
    const id = await mem0Write(userId, fact.trim(), {
      domain,
      importance: 0.7,
      source: source ?? auth.keyName ?? 'brain_api',
      metadata: { memory_type: 'brain_fact' },
    });

    const response: RememberResponse = { id, created: true };
    const res = jsonResponse(response, 201);
    res.headers.set('Access-Control-Allow-Origin', '*');
    return res;
  } catch (err) {
    console.error('[api/brain/remember] error:', err);
    return errorResponse('Internal server error', 500);
  }
}
