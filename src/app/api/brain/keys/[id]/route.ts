/**
 * DELETE /api/brain/keys/:id — Revoke an API key
 * PATCH  /api/brain/keys/:id — Rename an API key
 */

import { NextRequest } from 'next/server';
import { requireApiAuth, jsonResponse, errorResponse } from '@/lib/api-auth';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  const { id } = await params;
  const admin = createAdminClient();

  const { error: updateErr, count } = await admin
    .from('brain_api_keys')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)
    .is('revoked_at', null);

  if (updateErr) {
    console.error('[api/brain/keys] revoke error:', updateErr);
    return errorResponse('Failed to revoke key', 500);
  }

  if (count === 0) {
    return errorResponse('Key not found', 404);
  }

  return jsonResponse({ ok: true });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  const { id } = await params;

  let name: string;
  try {
    const body = await request.json();
    name = body.name?.trim?.();
    if (!name) return errorResponse('name is required', 400);
    name = name.slice(0, 64);
  } catch {
    return errorResponse('Invalid JSON body', 400);
  }

  const admin = createAdminClient();

  const { error: updateErr, count } = await admin
    .from('brain_api_keys')
    .update({ name })
    .eq('id', id)
    .eq('user_id', user.id)
    .is('revoked_at', null);

  if (updateErr) {
    console.error('[api/brain/keys] rename error:', updateErr);
    return errorResponse('Failed to rename key', 500);
  }

  if (count === 0) {
    return errorResponse('Key not found', 404);
  }

  return jsonResponse({ ok: true });
}
