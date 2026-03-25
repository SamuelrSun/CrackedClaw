export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireBrainAuth } from '@/lib/brain-api-auth';
import { jsonResponse, errorResponse } from '@/lib/api-auth';
import { createAdminClient } from '@/lib/supabase/admin';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireBrainAuth(request);
    if ('error' in auth) return auth.error;

    const { id } = await params;
    const userId = auth.user.id;
    const supabase = createAdminClient();

    const { error: dbError } = await supabase
      .from('memories')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (dbError) {
      console.error('[api/brain/v1/memories/[id]] delete error:', dbError);
      return errorResponse('Failed to delete memory', 500);
    }

    return jsonResponse({ ok: true });
  } catch (err) {
    console.error('[api/brain/v1/memories/[id]] error:', err);
    return errorResponse('Internal server error', 500);
  }
}
