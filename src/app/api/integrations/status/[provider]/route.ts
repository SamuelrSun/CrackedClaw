/**
 * GET /api/integrations/status/[provider]
 * Check if a specific provider is connected and return account info
 */

import { NextRequest } from 'next/server';
import { requireApiAuth, jsonResponse, errorResponse } from '@/lib/api-auth';
import { createClient } from '@/lib/supabase/server';
import { isValidProvider, OAUTH_PROVIDERS } from '@/lib/oauth/providers';
import { getValidTokens } from '@/lib/oauth/utils';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  const { provider } = await params;

  // Validate provider
  if (!isValidProvider(provider)) {
    return errorResponse(
      `Invalid provider. Supported: google, slack, notion`,
      400
    );
  }

  try {
    const supabase = await createClient();

    const { data: integration, error: dbError } = await supabase
      .from('user_integrations')
      .select('*')
      .eq('user_id', user.id)
      .eq('provider', provider)
      .single();

    if (dbError && dbError.code !== 'PGRST116') {
      // PGRST116 = no rows found, which is fine
      console.error('Failed to fetch integration status:', dbError);
      return errorResponse('Failed to fetch integration status', 500);
    }

    if (!integration) {
      return jsonResponse({
        connected: false,
        provider,
        providerName: OAUTH_PROVIDERS[provider].name,
      });
    }

    // Check if token is still valid (and refresh if needed for Google)
    let tokenStatus: 'valid' | 'expired' | 'refreshed' = 'valid';
    if (integration.expires_at) {
      const expiresAt = new Date(integration.expires_at).getTime();
      const now = Date.now();
      
      if (expiresAt < now) {
        // Try to refresh
        const refreshResult = await getValidTokens(user.id, provider);
        if (refreshResult?.refreshed) {
          tokenStatus = 'refreshed';
        } else if (!refreshResult) {
          tokenStatus = 'expired';
        }
      }
    }

    return jsonResponse({
      connected: integration.status === 'connected' && tokenStatus !== 'expired',
      provider,
      providerName: OAUTH_PROVIDERS[provider].name,
      status: tokenStatus === 'expired' ? 'expired' : integration.status,
      tokenStatus,
      account: {
        id: integration.account_id,
        email: integration.account_email,
        name: integration.account_name,
        picture: integration.account_picture,
        teamId: integration.team_id,
        teamName: integration.team_name,
      },
      connectedAt: integration.created_at,
      expiresAt: integration.expires_at,
      scopes: integration.scope?.split(/[,\s]+/).filter(Boolean) || [],
    });

  } catch (err) {
    console.error('Integration status error:', err);
    return errorResponse('An unexpected error occurred', 500);
  }
}
