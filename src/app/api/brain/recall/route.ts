/**
 * POST /api/brain/recall — Semantic search over the user's memories.
 *
 * Auth: Brain API key (dpb_sk_...) or Supabase session
 * Rate limit: 60 req/min
 *
 * Request body:
 *   { query: string, domain?: string, limit?: number }
 *
 * Response:
 *   { results: RecallResult[], count: number }
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireBrainAuth } from '@/lib/brain-api/auth';
import { checkRateLimit } from '@/lib/brain-api/rate-limit';
import { getEmbedding } from '@/lib/brain-api/embeddings';
import { createAdminClient } from '@/lib/supabase/admin';
import { jsonResponse, errorResponse } from '@/lib/api-auth';
import type { RecallRequest, RecallResult, RecallResponse } from '@/lib/brain-api/types';

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
    const rl = checkRateLimit(userId, 'recall');
    if (!rl.allowed) {
      const res = NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
      res.headers.set('Retry-After', String(rl.retryAfter));
      res.headers.set('Access-Control-Allow-Origin', '*');
      return res;
    }

    // --- Parse & validate input ---
    let body: RecallRequest;
    try {
      body = await request.json();
    } catch {
      return errorResponse('Invalid JSON body', 400);
    }

    const { query, domain, limit: rawLimit } = body;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return errorResponse('query is required and must be a non-empty string', 400);
    }

    const limit = Math.min(Math.max(1, rawLimit ?? 10), 50);

    // --- Embed query ---
    const embedding = await getEmbedding(query.trim());

    // --- pgvector similarity search ---
    const supabase = createAdminClient();

    interface MatchRow {
      id: string;
      content: string;
      domain: string;
      importance: number;
      metadata: Record<string, unknown> | null;
      created_at: string;
      similarity: number;
    }

    const { data, error: rpcError } = await supabase.rpc('match_memories', {
      query_embedding: embedding,
      match_user_id: userId,
      match_domain: domain ?? null,
      match_limit: limit,
      match_threshold: 0.4,
    });

    if (rpcError) {
      console.error('[api/brain/recall] pgvector search error:', rpcError);
      return errorResponse('Search failed', 500);
    }

    if (!data || data.length === 0) {
      const response: RecallResponse = { results: [], count: 0 };
      const res = jsonResponse(response);
      res.headers.set('Access-Control-Allow-Origin', '*');
      return res;
    }

    // Fetch full rows including metadata for source field
    const ids = (data as MatchRow[]).map((r) => r.id);
    const similarityMap = new Map<string, number>(
      (data as MatchRow[]).map((r) => [r.id, r.similarity]),
    );

    const { data: rows, error: rowsError } = await supabase
      .from('memories')
      .select('id, content, domain, importance, metadata, created_at')
      .in('id', ids)
      .eq('user_id', userId);

    if (rowsError) {
      console.error('[api/brain/recall] row fetch error:', rowsError);
      return errorResponse('Failed to load results', 500);
    }

    const results: RecallResult[] = (rows || [])
      .map((row) => {
        const meta = (row.metadata || {}) as Record<string, unknown>;
        return {
          id: row.id as string,
          content: (row.content as string) || '',
          domain: (row.domain as string) || 'general',
          similarity: similarityMap.get(row.id as string) ?? 0,
          importance: (row.importance as number) ?? 0.5,
          source: (meta.source as string) || undefined,
          created_at: row.created_at as string,
        };
      })
      .sort((a, b) => b.similarity - a.similarity);

    const response: RecallResponse = { results, count: results.length };
    const res = jsonResponse(response);
    res.headers.set('Access-Control-Allow-Origin', '*');
    return res;
  } catch (err) {
    console.error('[api/brain/recall] error:', err);
    return errorResponse('Internal server error', 500);
  }
}
