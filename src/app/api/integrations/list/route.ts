/**
 * GET /api/integrations/list
 * Returns all connected integrations for the current user
 */

import { requireApiAuth, jsonResponse, errorResponse } from '@/lib/api-auth';
import { createClient } from '@/lib/supabase/server';
import { OAuthProvider, OAUTH_PROVIDERS } from '@/lib/oauth/providers';

interface UserIntegration {
  id: string;
  provider: OAuthProvider;
  account_id: string | null;
  account_email: string | null;
  account_name: string | null;
  account_picture: string | null;
  team_id: string | null;
  team_name: string | null;
  status: string;
  scope: string | null;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
}

interface IntegrationResponse {
  id: string;
  provider: OAuthProvider;
  providerName: string;
  accountEmail: string | null;
  accountName: string | null;
  accountPicture: string | null;
  teamName: string | null;
  status: 'connected' | 'disconnected' | 'error' | 'expired';
  connectedAt: string;
  scopes: string[];
  expiresAt: string | null;
}

export async function GET() {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  try {
    const supabase = await createClient();

    const { data: integrations, error: dbError } = await supabase
      .from('user_integrations')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (dbError) {
      console.error('Failed to fetch integrations:', dbError);
      return errorResponse('Failed to fetch integrations', 500);
    }

    // Transform to response format
    const transformedIntegrations: IntegrationResponse[] = (integrations || []).map(
      (integration: UserIntegration) => {
        // Determine status (check for expired tokens)
        let status: IntegrationResponse['status'] = integration.status as IntegrationResponse['status'];
        if (
          integration.expires_at &&
          new Date(integration.expires_at) < new Date()
        ) {
          status = 'expired';
        }

        // Parse scopes
        const scopes = integration.scope
          ? integration.scope.split(/[,\s]+/).filter(Boolean)
          : [];

        return {
          id: integration.id,
          provider: integration.provider,
          providerName: OAUTH_PROVIDERS[integration.provider]?.name || integration.provider,
          accountEmail: integration.account_email,
          accountName: integration.account_name,
          accountPicture: integration.account_picture,
          teamName: integration.team_name,
          status,
          connectedAt: integration.created_at,
          scopes,
          expiresAt: integration.expires_at,
        };
      }
    );

    return jsonResponse({
      integrations: transformedIntegrations,
      count: transformedIntegrations.length,
    });

  } catch (err) {
    console.error('List integrations error:', err);
    return errorResponse('An unexpected error occurred', 500);
  }
}
