export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    },
  });
}
import { requireBrainAuth } from '@/lib/brain-api-auth';
import { jsonResponse, errorResponse } from '@/lib/api-auth';
import { mem0GetCore, formatMemoriesForPrompt } from '@/lib/memory/mem0-client';
import { retrieveBrainContext } from '@/lib/brain/retriever/brain-retriever';
import { formatBrainContext } from '@/lib/brain/retriever/context-formatter';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireBrainAuth(request);
    if ('error' in auth) return auth.error;

    const userId = auth.user.id;

    const [criteria, coreMemories] = await Promise.all([
      retrieveBrainContext(userId, [], { maxCriteria: 20, includePersonality: true }),
      mem0GetCore(userId, { minImportance: 0.7, limit: 15 }),
    ]);

    const criteriaBlock = formatBrainContext(criteria);
    const memoriesBlock = formatMemoriesForPrompt(coreMemories);

    const formattedContext = [criteriaBlock, memoriesBlock].filter(Boolean).join('\n\n');

    return jsonResponse({
      formatted_context: formattedContext,
      criteria_count: criteria.length,
      memory_count: coreMemories.length,
    });
  } catch (err) {
    console.error('[api/brain/v1/context] error:', err);
    return errorResponse('Internal server error', 500);
  }
}
