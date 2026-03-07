/**
 * OAuth Utility Functions
 * Token exchange, state generation, and token management
 */

import { createClient } from '@/lib/supabase/server';
import { 
  OAUTH_PROVIDERS, 
  OAuthProvider, 
  getProviderCredentials, 
  getCallbackUrl 
} from './providers';

/**
 * Generate a secure random state token
 */
export function generateStateToken(): string {
  return crypto.randomUUID();
}

/**
 * Build the OAuth authorization URL for a provider
 */
export function buildAuthorizationUrl(
  provider: OAuthProvider,
  state: string,
  scopes?: string[]
): string | null {
  const config = OAUTH_PROVIDERS[provider];
  const credentials = getProviderCredentials(provider);
  
  if (!credentials) {
    return null;
  }
  
  const params = new URLSearchParams({
    client_id: credentials.clientId,
    redirect_uri: getCallbackUrl(),
    response_type: 'code',
    state,
  });
  
  // Add scopes (use custom or default)
  const scopeList = scopes?.length ? scopes : config.defaultScopes;
  if (scopeList.length > 0) {
    // Slack uses comma-separated scopes in 'scope' param
    // Google uses space-separated scopes in 'scope' param
    // Notion doesn't use scopes
    if (provider === 'slack') {
      params.set('scope', scopeList.join(','));
    } else if (provider === 'google') {
      params.set('scope', scopeList.join(' '));
    }
  }
  
  // Add provider-specific params
  if (config.additionalAuthParams) {
    Object.entries(config.additionalAuthParams).forEach(([key, value]) => {
      params.set(key, value);
    });
  }
  
  return `${config.authUrl}?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(
  provider: OAuthProvider,
  code: string
): Promise<OAuthTokenResponse | null> {
  const config = OAUTH_PROVIDERS[provider];
  const credentials = getProviderCredentials(provider);
  
  if (!credentials) {
    return null;
  }
  
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: getCallbackUrl(),
  });
  
  // Notion and some providers include client credentials in body
  if (!config.useBasicAuth) {
    body.set('client_id', credentials.clientId);
    body.set('client_secret', credentials.clientSecret);
  }
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
  };
  
  // Notion uses Basic auth for token exchange
  if (config.useBasicAuth) {
    const basicAuth = Buffer.from(
      `${credentials.clientId}:${credentials.clientSecret}`
    ).toString('base64');
    headers['Authorization'] = `Basic ${basicAuth}`;
    
    // Notion expects JSON body
    const jsonBody = JSON.stringify({
      grant_type: 'authorization_code',
      code,
      redirect_uri: getCallbackUrl(),
    });
    
    const response = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: jsonBody,
    });
    
    if (!response.ok) {
      console.error(`Token exchange failed for ${provider}:`, await response.text());
      return null;
    }
    
    return response.json();
  }
  
  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers,
    body: body.toString(),
  });
  
  if (!response.ok) {
    console.error(`Token exchange failed for ${provider}:`, await response.text());
    return null;
  }
  
  return response.json();
}

/**
 * Fetch user info from provider after OAuth
 */
export async function fetchUserInfo(
  provider: OAuthProvider,
  accessToken: string
): Promise<OAuthUserInfo | null> {
  try {
    switch (provider) {
      case 'google': {
        const response = await fetch(
          'https://www.googleapis.com/oauth2/v2/userinfo',
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (!response.ok) return null;
        const data = await response.json();
        return {
          id: data.id,
          email: data.email,
          name: data.name,
          picture: data.picture,
        };
      }
      
      case 'slack': {
        const response = await fetch(
          'https://slack.com/api/users.identity',
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (!response.ok) return null;
        const data = await response.json();
        if (!data.ok) return null;
        return {
          id: data.user?.id,
          email: data.user?.email,
          name: data.user?.name,
          picture: data.user?.image_72,
          teamId: data.team?.id,
          teamName: data.team?.name,
        };
      }
      
      case 'notion': {
        // Notion token response includes owner info directly
        // This should be called with the full token response
        return null; // Handled separately in callback
      }
      
      default:
        return null;
    }
  } catch (error) {
    console.error(`Failed to fetch user info for ${provider}:`, error);
    return null;
  }
}

/**
 * Create an OAuth flow record in the database
 */
export async function createOAuthFlow(
  userId: string,
  provider: OAuthProvider,
  state: string,
  scopes?: string[]
): Promise<boolean> {
  const supabase = await createClient();
  
  const { error } = await supabase
    .from('oauth_flows')
    .insert({
      user_id: userId,
      provider,
      state,
      status: 'pending',
      scopes: scopes || [],
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 min expiry
    });
  
  if (error) {
    console.error('Failed to create OAuth flow:', error);
    return false;
  }
  
  return true;
}

/**
 * Verify and retrieve an OAuth flow by state
 */
export async function verifyOAuthFlow(
  state: string
): Promise<OAuthFlowRecord | null> {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('oauth_flows')
    .select('*')
    .eq('state', state)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .single();
  
  if (error || !data) {
    console.error('OAuth flow verification failed:', error);
    return null;
  }
  
  return data as OAuthFlowRecord;
}

/**
 * Update OAuth flow status
 */
export async function updateOAuthFlowStatus(
  state: string,
  status: 'completed' | 'failed',
  errorMessage?: string
): Promise<boolean> {
  const supabase = await createClient();
  
  const { error } = await supabase
    .from('oauth_flows')
    .update({
      status,
      ...(errorMessage && { error_message: errorMessage }),
      completed_at: new Date().toISOString(),
    })
    .eq('state', state);
  
  if (error) {
    console.error('Failed to update OAuth flow:', error);
    return false;
  }
  
  return true;
}

/**
 * Store user integration tokens
 */
export async function storeUserIntegration(
  userId: string,
  provider: OAuthProvider,
  tokens: OAuthTokenResponse,
  userInfo: OAuthUserInfo | null
): Promise<string | null> {
  const supabase = await createClient();
  
  // Check for existing integration for this user/provider
  const { data: existing } = await supabase
    .from('user_integrations')
    .select('id')
    .eq('user_id', userId)
    .eq('provider', provider)
    .single();
  
  const integrationData = {
    user_id: userId,
    provider,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token || null,
    token_type: tokens.token_type || 'Bearer',
    expires_at: tokens.expires_in 
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : null,
    scope: tokens.scope || null,
    account_id: userInfo?.id || tokens.bot_user_id || null,
    account_email: userInfo?.email || null,
    account_name: userInfo?.name || tokens.workspace_name || null,
    account_picture: userInfo?.picture || null,
    team_id: userInfo?.teamId || tokens.team?.id || null,
    team_name: userInfo?.teamName || tokens.team?.name || null,
    status: 'connected',
    raw_response: JSON.stringify(tokens),
    updated_at: new Date().toISOString(),
  };
  
  if (existing) {
    // Update existing integration
    const { error } = await supabase
      .from('user_integrations')
      .update(integrationData)
      .eq('id', existing.id);
    
    if (error) {
      console.error('Failed to update integration:', error);
      return null;
    }
    return existing.id;
  } else {
    // Create new integration
    const { data, error } = await supabase
      .from('user_integrations')
      .insert({
        ...integrationData,
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    
    if (error) {
      console.error('Failed to store integration:', error);
      return null;
    }
    return data.id;
  }
}

/**
 * Refresh Google access token
 */
export async function refreshGoogleToken(
  refreshToken: string
): Promise<{ access_token: string; expires_in: number } | null> {
  const credentials = getProviderCredentials('google');
  if (!credentials) return null;
  
  const body = new URLSearchParams({
    client_id: credentials.clientId,
    client_secret: credentials.clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });
  
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  
  if (!response.ok) {
    console.error('Google token refresh failed:', await response.text());
    return null;
  }
  
  return response.json();
}

/**
 * Get and potentially refresh tokens for a user integration
 */
export async function getValidTokens(
  userId: string,
  provider: OAuthProvider
): Promise<{ accessToken: string; refreshed: boolean } | null> {
  const supabase = await createClient();
  
  const { data: integration, error } = await supabase
    .from('user_integrations')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', provider)
    .eq('status', 'connected')
    .single();
  
  if (error || !integration) {
    return null;
  }
  
  // Check if token needs refresh (Google only, with 5 min buffer)
  if (
    provider === 'google' &&
    integration.expires_at &&
    integration.refresh_token
  ) {
    const expiresAt = new Date(integration.expires_at).getTime();
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;
    
    if (expiresAt - now < fiveMinutes) {
      const refreshed = await refreshGoogleToken(integration.refresh_token);
      if (refreshed) {
        // Update stored token
        await supabase
          .from('user_integrations')
          .update({
            access_token: refreshed.access_token,
            expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', integration.id);
        
        return { accessToken: refreshed.access_token, refreshed: true };
      }
    }
  }
  
  return { accessToken: integration.access_token, refreshed: false };
}

// Type definitions
export interface OAuthTokenResponse {
  access_token: string;
  token_type?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  // Slack-specific
  ok?: boolean;
  authed_user?: { id: string; access_token?: string };
  team?: { id: string; name: string };
  bot_user_id?: string;
  // Notion-specific
  workspace_name?: string;
  workspace_id?: string;
  owner?: {
    type: string;
    user?: {
      id: string;
      name?: string;
      avatar_url?: string;
      person?: { email?: string };
    };
  };
}

export interface OAuthUserInfo {
  id?: string;
  email?: string;
  name?: string;
  picture?: string;
  teamId?: string;
  teamName?: string;
}

export interface OAuthFlowRecord {
  id: string;
  user_id: string;
  provider: OAuthProvider;
  state: string;
  status: 'pending' | 'completed' | 'failed';
  scopes?: string[];
  error_message?: string;
  created_at: string;
  expires_at: string;
  completed_at?: string;
}
