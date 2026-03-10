import { NextRequest } from 'next/server';
import { requireApiAuth, jsonResponse, errorResponse } from '@/lib/api-auth';
import { mem0GetAll, mem0Write, mem0Update, mem0Delete } from '@/lib/memory/mem0-client';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  try {
    const memories = await mem0GetAll(user.id);
    return jsonResponse({
      memory: memories.map(m => ({
        id: m.id,
        content: m.memory || m.content || '',
        domain: m.domain || 'general',
        importance: m.importance || 0.5,
        source: (m.metadata as Record<string, unknown>)?.source || 'chat',
        page_path: (m.metadata as Record<string, unknown>)?.page_path || null,
        temporal: (m.metadata as Record<string, unknown>)?.temporal || 'permanent',
        created_at: m.created_at,
        updated_at: m.updated_at,
      })),
    });
  } catch (err) {
    console.error('[memory] GET failed:', err);
    return jsonResponse({ memory: [] });
  }
}

export async function POST(request: NextRequest) {
  const { user, error } = await requireApiAuth();
  if (error) return error;
  const body = await request.json();
  // Support both old {key, value} and new {content} formats
  const content = body.content || (body.key && body.value ? `${body.key}: ${body.value}` : null);
  if (!content) return errorResponse('content is required', 400);
  await mem0Write(user.id, content, {
    domain: body.domain || body.category || 'general',
    source: 'user_input',
    importance: 0.8,
    metadata: body.page_path ? { page_path: body.page_path } : undefined,
  });
  return jsonResponse({ ok: true });
}

export async function PATCH(request: NextRequest) {
  const { user, error } = await requireApiAuth();
  if (error) return error;
  const { id, content, domain, importance, page_path } = await request.json();
  if (!id) return errorResponse('id required', 400);
  await mem0Update(id, {
    ...(content !== undefined ? { content } : {}),
    ...(importance !== undefined ? { importance } : {}),
    ...(domain !== undefined ? { domain } : {}),
    ...(page_path !== undefined ? { page_path } : {}),
  });
  return jsonResponse({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const { user, error } = await requireApiAuth();
  if (error) return error;
  const { key, id } = await request.json();
  if (id) {
    await mem0Delete(id);
  } else if (key) {
    // Semantic search for the key, delete best match
    const { mem0Search } = await import('@/lib/memory/mem0-client');
    const results = await mem0Search(key, user.id, { limit: 1, threshold: 0.3 });
    if (results.length > 0) {
      await mem0Delete(results[0].id);
    }
  } else {
    return errorResponse('key or id required', 400);
  }
  return jsonResponse({ ok: true });
}
