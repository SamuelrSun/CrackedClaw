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
import { mem0Add, mem0Write } from '@/lib/memory/mem0-client';
import { getModelForTask } from '@/lib/ai/model-router';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireBrainAuth(request);
    if ('error' in auth) return auth.error;

    const body = await request.json();
    const { messages, session_id, title } = body as {
      messages?: Array<{ role: string; content: string }>;
      session_id?: string;
      title?: string;
    };

    // Validate messages
    if (!Array.isArray(messages) || messages.length < 2) {
      return errorResponse('messages array is required and must have at least 2 messages', 400);
    }

    for (const msg of messages) {
      if (!msg.role || typeof msg.role !== 'string' || !msg.content || typeof msg.content !== 'string') {
        return errorResponse('Each message must have role and content strings', 400);
      }
    }

    const userId = auth.user.id;

    // Generate summary using Claude
    const { meteredBackground } = await import('@/lib/ai/metered-client');

    const convoText = messages.map((m) => `${m.role}: ${m.content}`).join('\n');

    const response = await meteredBackground(
      {
        model: getModelForTask('extraction'),
        max_tokens: 512,
        system:
          'Summarize this conversation concisely. Focus on: key decisions made, facts learned about the user, tasks completed, and any preferences expressed. Keep it under 200 words.',
        messages: [{ role: 'user' as const, content: convoText }],
      },
      { userId, source: 'session_summary' },
    );

    const summary =
      response.content[0].type === 'text' ? response.content[0].text : '';

    // Store summary as a memory
    await mem0Write(userId, summary, {
      domain: 'session',
      importance: 0.6,
      source: 'session_summary',
      metadata: {
        ...(session_id ? { session_id } : {}),
        ...(title ? { title } : {}),
      },
    });

    // Extract individual facts from the conversation (fire-and-forget)
    void mem0Add(messages, userId).catch((err) => {
      console.error('[api/brain/v1/summarize] mem0Add failed:', err);
    });

    return jsonResponse({ ok: true, summary, facts_processed: true });
  } catch (err) {
    console.error('[api/brain/v1/summarize] error:', err);
    return errorResponse('Internal server error', 500);
  }
}
