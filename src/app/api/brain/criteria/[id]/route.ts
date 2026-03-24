/**
 * PATCH /api/brain/criteria/[id]  — Update criterion weight
 * DELETE /api/brain/criteria/[id] — Delete a criterion
 *
 * Both routes verify the criterion belongs to the requesting user.
 */

import { NextRequest } from 'next/server';
import { requireApiAuth, jsonResponse, errorResponse } from '@/lib/api-auth';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  const { id } = await params;

  try {
    const body = await request.json();
    const { weight } = body;

    if (typeof weight !== 'number' || weight < -1 || weight > 1) {
      return errorResponse('weight must be a number between -1 and 1', 400);
    }

    const supabase = createAdminClient();

    // Verify the criterion belongs to this user, then update
    const { data, error: updateError } = await supabase
      .from('memories')
      .update({ weight, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user.id)
      .eq('memory_type', 'criterion')
      .select('id')
      .single();

    if (updateError || !data) {
      return errorResponse('Criterion not found or update failed', 404);
    }

    return jsonResponse({ ok: true });
  } catch (err) {
    console.error('[api/brain/criteria/[id]] PATCH error:', err);
    return errorResponse('Failed to update criterion', 500);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  const { id } = await params;

  try {
    const supabase = createAdminClient();

    // Verify ownership and delete in one query
    const { error: deleteError, count } = await supabase
      .from('memories')
      .delete({ count: 'exact' })
      .eq('id', id)
      .eq('user_id', user.id)
      .eq('memory_type', 'criterion');

    if (deleteError) {
      console.error('[api/brain/criteria/[id]] DELETE error:', deleteError.message);
      return errorResponse('Failed to delete criterion', 500);
    }

    if ((count ?? 0) === 0) {
      return errorResponse('Criterion not found', 404);
    }

    return jsonResponse({ ok: true });
  } catch (err) {
    console.error('[api/brain/criteria/[id]] DELETE error:', err);
    return errorResponse('Failed to delete criterion', 500);
  }
}
