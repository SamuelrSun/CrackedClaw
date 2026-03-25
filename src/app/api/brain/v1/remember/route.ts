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
import { mem0Write } from '@/lib/memory/mem0-client';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireBrainAuth(request);
    if ('error' in auth) return auth.error;

    const body = await request.json();
    const { content, domain, importance, source } = body as {
      content?: string;
      domain?: string;
      importance?: number;
      source?: string;
    };

    if (!content || typeof content !== 'string') {
      return errorResponse('content is required', 400);
    }

    const userId = auth.user.id;

    const memoryId = await mem0Write(userId, content, {
      domain,
      importance: importance ?? 0.7,
      source: source ?? auth.keyName ?? 'external',
    });

    return jsonResponse({ id: memoryId, ok: true });
  } catch (err) {
    console.error('[api/brain/v1/remember] error:', err);
    return errorResponse('Internal server error', 500);
  }
}
