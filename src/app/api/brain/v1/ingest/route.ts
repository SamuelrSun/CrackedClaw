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
import { mem0Add } from '@/lib/memory/mem0-client';
import { collectBrainSignals } from '@/lib/brain/signals/collector';
import { runBrainAggregation } from '@/lib/brain/aggregator/runner';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireBrainAuth(request);
    if ('error' in auth) return auth.error;

    const body = await request.json();
    const { messages, session_id } = body as {
      messages?: Array<{ role: string; content: string }>;
      session_id?: string;
    };

    if (!Array.isArray(messages) || messages.length === 0) {
      return errorResponse('messages array is required and must not be empty', 400);
    }

    for (const msg of messages) {
      if (!msg.role || typeof msg.role !== 'string' || !msg.content || typeof msg.content !== 'string') {
        return errorResponse('Each message must have role and content strings', 400);
      }
    }

    const userId = auth.user.id;

    // Extract and store facts from messages
    await mem0Add(messages, userId);

    // Find last user and assistant messages for brain signal collection
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
    const lastAssistantMsg = [...messages].reverse().find((m) => m.role === 'assistant');

    if (lastUserMsg && lastAssistantMsg) {
      // Fire-and-forget: trigger the full brain learning pipeline
      void collectBrainSignals({
        userId,
        userMessage: lastUserMsg.content,
        aiMessage: lastAssistantMsg.content,
        sessionId: session_id,
        brainEnabled: true,
        source: auth.keyName ?? 'external',
      }).catch((err) => {
        console.error('[api/brain/v1/ingest] collectBrainSignals failed:', err);
      });
    }

    // Fire-and-forget: check if aggregation should run
    void runBrainAggregation(userId).catch(() => {});

    return jsonResponse({ ok: true, processed: true });
  } catch (err) {
    console.error('[api/brain/v1/ingest] error:', err);
    return errorResponse('Internal server error', 500);
  }
}
