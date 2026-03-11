import { NextRequest } from 'next/server';
import { requireApiAuth, jsonResponse, errorResponse } from '@/lib/api-auth';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// PATCH /api/integrations/accounts/:id — set as default
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  const { id } = await params;
  const body = await request.json();
  const supabase = await createClient();

  if (body.is_default === true) {
    // Get the integration's provider
    const { data: integration } = await supabase
      .from('user_integrations')
      .select('provider')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (!integration) return errorResponse('Account not found', 404);

    // Unset all defaults for this provider
    await supabase
      .from('user_integrations')
      .update({ is_default: false })
      .eq('user_id', user.id)
      .eq('provider', integration.provider);

    // Set this one as default
    await supabase
      .from('user_integrations')
      .update({ is_default: true, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user.id);
  }

  return jsonResponse({ success: true });
}

// DELETE /api/integrations/accounts/:id — disconnect this account
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  const { id } = await params;
  const supabase = await createClient();

  // Get info before deleting
  const { data: integration } = await supabase
    .from('user_integrations')
    .select('provider, is_default')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (!integration) return errorResponse('Account not found', 404);

  // Delete the integration
  await supabase
    .from('user_integrations')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  // If it was the default, promote the next one
  if (integration.is_default) {
    const { data: next } = await supabase
      .from('user_integrations')
      .select('id')
      .eq('user_id', user.id)
      .eq('provider', integration.provider)
      .eq('status', 'connected')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (next) {
      await supabase
        .from('user_integrations')
        .update({ is_default: true })
        .eq('id', next.id);
    }
  }

  return jsonResponse({ success: true });
}
