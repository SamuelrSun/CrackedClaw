/**
 * OAuth Provider Configurations
 * Supports Google, Slack, and Notion OAuth flows
 */

export type OAuthProvider = 'google' | 'slack' | 'notion';

export interface ProviderConfig {
  name: string;
  authUrl: string;
  tokenUrl: string;
  clientIdEnvVar: string;
  clientSecretEnvVar: string;
  defaultScopes: string[];
  // Notion uses Basic auth for token exchange
  useBasicAuth?: boolean;
  // Additional auth params required by the provider
  additionalAuthParams?: Record<string, string>;
}

export const OAUTH_PROVIDERS: Record<OAuthProvider, ProviderConfig> = {
  google: {
    name: 'Google',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    clientIdEnvVar: 'GOOGLE_CLIENT_ID',
    clientSecretEnvVar: 'GOOGLE_CLIENT_SECRET',
    defaultScopes: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ],
    additionalAuthParams: {
      access_type: 'offline',
      prompt: 'consent',
    },
  },
  slack: {
    name: 'Slack',
    authUrl: 'https://slack.com/oauth/v2/authorize',
    tokenUrl: 'https://slack.com/api/oauth.v2.access',
    clientIdEnvVar: 'SLACK_CLIENT_ID',
    clientSecretEnvVar: 'SLACK_CLIENT_SECRET',
    defaultScopes: [
      'channels:read',
      'chat:write',
      'users:read',
      'users:read.email',
    ],
  },
  notion: {
    name: 'Notion',
    authUrl: 'https://api.notion.com/v1/oauth/authorize',
    tokenUrl: 'https://api.notion.com/v1/oauth/token',
    clientIdEnvVar: 'NOTION_CLIENT_ID',
    clientSecretEnvVar: 'NOTION_CLIENT_SECRET',
    defaultScopes: [], // Notion doesn't use traditional scopes
    useBasicAuth: true,
    additionalAuthParams: {
      owner: 'user',
    },
  },
};

/**
 * Get provider credentials from environment variables
 */
export function getProviderCredentials(provider: OAuthProvider): { clientId: string; clientSecret: string } | null {
  const config = OAUTH_PROVIDERS[provider];
  const clientId = process.env[config.clientIdEnvVar];
  const clientSecret = process.env[config.clientSecretEnvVar];
  
  if (!clientId || !clientSecret) {
    console.error(`Missing credentials for ${provider}: ${config.clientIdEnvVar} or ${config.clientSecretEnvVar}`);
    return null;
  }
  
  return { clientId, clientSecret };
}

/**
 * Check if a provider is properly configured
 */
export function isProviderConfigured(provider: OAuthProvider): boolean {
  return getProviderCredentials(provider) !== null;
}

/**
 * Get the callback URL for OAuth
 */
export function getCallbackUrl(): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}` 
    : 'http://localhost:3000');
  return `${baseUrl}/api/integrations/oauth/callback`;
}

/**
 * Validate provider string
 */
export function isValidProvider(provider: string): provider is OAuthProvider {
  return ['google', 'slack', 'notion'].includes(provider);
}
