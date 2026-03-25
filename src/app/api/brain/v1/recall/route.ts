export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';

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
import { requireBrainAuth } from '@/lib/brain-api-auth';
import { jsonResponse, errorResponse } from '@/lib/api-auth';
import { mem0Search } from '@/lib/memory/mem0-client';
import { retrieveBrainContext } from '@/lib/brain/retriever/brain-retriever';
import { formatBrainContext } from '@/lib/brain/retriever/context-formatter';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireBrainAuth(request);
    if ('error' in auth) return auth.error;

    const body = await request.json();
    const { query, limit, domain } = body as {
      query?: string;
      limit?: number;
      domain?: string;
    };

    if (!query || typeof query !== 'string') {
      return errorResponse('query is required', 400);
    }

    const userId = auth.user.id;

    const [searchResults, criteria] = await Promise.all([
      mem0Search(query, userId, { limit: limit ?? 10, domain }),
      retrieveBrainContext(userId, [{ role: 'user', content: query }], {
        maxCriteria: limit || 10,
      }),
    ]);

    const memories = searchResults.map((m) => ({
      id: m.id,
      content: m.memory || m.content,
      domain: m.domain,
      importance: m.importance,
      similarity: m.similarity,
    }));

    const preferences = criteria.map((c) => ({
      id: c.id,
      description: c.description,
      domain: c.domain,
      weight: c.weight,
      preference_type: c.preference_type,
      confidence: c.confidence,
    }));

    return jsonResponse({
      memories,
      preferences,
      formatted_context: formatBrainContext(criteria),
    });
  } catch (err) {
    console.error('[api/brain/v1/recall] error:', err);
    return errorResponse('Internal server error', 500);
  }
}
