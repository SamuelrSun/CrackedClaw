/**
 * PATCH /api/brain/memories/[id] — Update memory content/domain
 * DELETE /api/brain/memories/[id] — Delete a memory
 */

import { NextRequest } from 'next/server';
import { requireApiAuth, jsonResponse, errorResponse } from '@/lib/api-auth';
import { mem0Update, mem0Delete } from '@/lib/memory/mem0-client';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireApiAuth();
  if (error) return error;

  const { id } = await params;

  try {
    const body = await request.json();

    await mem0Update(id, {
      ...(body.content !== undefined && { content: body.content }),
      ...(body.domain !== undefined && { domain: body.domain }),
    });

    return jsonResponse({ ok: true });
  } catch (err) {
    console.error('[api/brain/memories/[id]] PATCH error:', err);
    const message = err instanceof Error ? err.message : 'Failed to update memory';
    const status = message.includes('not found') ? 404 : 500;
    return errorResponse(message, status);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireApiAuth();
  if (error) return error;

  const { id } = await params;

  try {
    await mem0Delete(id);
    return jsonResponse({ ok: true });
  } catch (err) {
    console.error('[api/brain/memories/[id]] DELETE error:', err);
    const message = err instanceof Error ? err.message : 'Failed to delete memory';
    const status = message.includes('not found') ? 404 : 500;
    return errorResponse(message, status);
  }
}
