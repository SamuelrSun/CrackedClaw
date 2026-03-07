/**
 * API routes for individual integrations
 * GET, PATCH, DELETE /api/integrations/[id]
 */

import { NextRequest } from 'next/server';
import { requireApiAuth, jsonResponse, errorResponse } from '@/lib/api-auth';
import { createClient } from '@/lib/supabase/server';
import { OAUTH_PROVIDERS, OAuthProvider, isValidProvider } from '@/lib/oauth/providers';

// GET /api/integrations/[id] - Get a single integration
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  const { id } = await params;
  const supabase = await createClient();

  const { data: integration, error: dbError } = await supabase
    .from('user_integrations')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (dbError || !integration) {
    return errorResponse('Integration not found', 404);
  }

  const provider = integration.provider as OAuthProvider;

  return jsonResponse({
    integration: {
      id: integration.id,
      provider,
      providerName: isValidProvider(provider) ? OAUTH_PROVIDERS[provider].name : provider,
      accountEmail: integration.account_email,
      accountName: integration.account_name,
      accountPicture: integration.account_picture,
      teamId: integration.team_id,
      teamName: integration.team_name,
      status: integration.status,
      connectedAt: integration.created_at,
      updatedAt: integration.updated_at,
      expiresAt: integration.expires_at,
      scopes: integration.scope?.split(/[,\s]+/).filter(Boolean) || [],
    },
  });
}

// PATCH /api/integrations/[id] - Update an integration (limited fields)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  const { id } = await params;
  const supabase = await createClient();

  // Verify ownership
  const { data: existing, error: fetchError } = await supabase
    .from('user_integrations')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (fetchError || !existing) {
    return errorResponse('Integration not found', 404);
  }

  try {
    const body = await request.json();

    // Only allow updating certain fields
    const allowedUpdates: Record<string, unknown> = {};
    if (body.status && ['connected', 'disconnected', 'error'].includes(body.status)) {
      allowedUpdates.status = body.status;
    }

    if (Object.keys(allowedUpdates).length === 0) {
      return errorResponse('No valid fields to update', 400);
    }

    allowedUpdates.updated_at = new Date().toISOString();

    const { data: updated, error: updateError } = await supabase
      .from('user_integrations')
      .update(allowedUpdates)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Failed to update integration:', updateError);
      return errorResponse('Failed to update integration', 500);
    }

    return jsonResponse({
      message: 'Integration updated',
      integration: updated,
    });

  } catch {
    return errorResponse('Invalid request body', 400);
  }
}

// DELETE /api/integrations/[id] - Disconnect/remove an integration
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  const { id } = await params;
  const supabase = await createClient();

  // Verify ownership and get integration
  const { data: existing, error: fetchError } = await supabase
    .from('user_integrations')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (fetchError || !existing) {
    return errorResponse('Integration not found', 404);
  }

  // Delete the integration (tokens and all)
  const { error: deleteError } = await supabase
    .from('user_integrations')
    .delete()
    .eq('id', id);

  if (deleteError) {
    console.error('Failed to delete integration:', deleteError);
    return errorResponse('Failed to delete integration', 500);
  }

  return jsonResponse({
    message: 'Integration disconnected',
    provider: existing.provider,
    accountEmail: existing.account_email,
  });
}
