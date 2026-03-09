/**
 * OAuth Provider Configurations
 * Supports Google, Slack, Notion, GitHub, Microsoft, Linear, Discord, Zoom,
 * Twitter/X, HubSpot, Jira, Figma, and Reddit OAuth flows
 */

export type OAuthProvider = 'google' | 'slack' | 'notion' | 'github' | 'microsoft' | 'linear' | 'discord' | 'zoom' | 'twitter' | 'hubspot' | 'jira' | 'figma' | 'reddit';

export interface ProviderConfig {
  name: string;
  authUrl: string;
  tokenUrl: string;
  clientIdEnvVar: string;
  clientSecretEnvVar: string;
  defaultScopes: string[];
  useBasicAuth?: boolean;
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
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/gmail.compose',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/spreadsheets',
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
      'channels:history',
      'chat:write',
      'files:read',
      'files:write',
      'users:read',
      'users:read.email',
      'reactions:read',
      'reactions:write',
    ],
  },
  notion: {
    name: 'Notion',
    authUrl: 'https://api.notion.com/v1/oauth/authorize',
    tokenUrl: 'https://api.notion.com/v1/oauth/token',
    clientIdEnvVar: 'NOTION_CLIENT_ID',
    clientSecretEnvVar: 'NOTION_CLIENT_SECRET',
    defaultScopes: [],
    useBasicAuth: true,
    additionalAuthParams: {
      owner: 'user',
    },
  },
  github: {
    name: 'GitHub',
    authUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    clientIdEnvVar: 'GITHUB_CLIENT_ID',
    clientSecretEnvVar: 'GITHUB_CLIENT_SECRET',
    defaultScopes: ['repo', 'read:user', 'user:email', 'read:org', 'gist', 'workflow'],
  },
  microsoft: {
    name: 'Microsoft 365',
    authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    clientIdEnvVar: 'MICROSOFT_CLIENT_ID',
    clientSecretEnvVar: 'MICROSOFT_CLIENT_SECRET',
    defaultScopes: [
      'openid',
      'profile',
      'email',
      'Mail.Read',
      'Calendars.Read',
      'Files.Read',
      'offline_access',
    ],
  },
  linear: {
    name: 'Linear',
    authUrl: 'https://linear.app/oauth/authorize',
    tokenUrl: 'https://api.linear.app/oauth/token',
    clientIdEnvVar: 'LINEAR_CLIENT_ID',
    clientSecretEnvVar: 'LINEAR_CLIENT_SECRET',
    defaultScopes: ['read', 'write', 'issues:create', 'comments:create'],
  },
  discord: {
    name: 'Discord',
    authUrl: 'https://discord.com/api/oauth2/authorize',
    tokenUrl: 'https://discord.com/api/oauth2/token',
    clientIdEnvVar: 'DISCORD_CLIENT_ID',
    clientSecretEnvVar: 'DISCORD_CLIENT_SECRET',
    defaultScopes: ['identify', 'email', 'guilds', 'guilds.members.read', 'messages.read'],
    useBasicAuth: true,
  },
  zoom: {
    name: 'Zoom',
    authUrl: 'https://zoom.us/oauth/authorize',
    tokenUrl: 'https://zoom.us/oauth/token',
    clientIdEnvVar: 'ZOOM_CLIENT_ID',
    clientSecretEnvVar: 'ZOOM_CLIENT_SECRET',
    defaultScopes: ['meeting:read', 'meeting:write', 'user:read', 'recording:read'],
    useBasicAuth: true,
  },
  twitter: {
    name: 'Twitter/X',
    authUrl: 'https://twitter.com/i/oauth2/authorize',
    tokenUrl: 'https://api.twitter.com/2/oauth2/token',
    clientIdEnvVar: 'TWITTER_CLIENT_ID',
    clientSecretEnvVar: 'TWITTER_CLIENT_SECRET',
    defaultScopes: ['tweet.read', 'tweet.write', 'users.read', 'offline.access', 'dm.read', 'dm.write'],
    useBasicAuth: true,
    additionalAuthParams: {
      code_challenge_method: 'plain',
    },
  },
  hubspot: {
    name: 'HubSpot',
    authUrl: 'https://app.hubspot.com/oauth/authorize',
    tokenUrl: 'https://api.hubapi.com/oauth/v1/token',
    clientIdEnvVar: 'HUBSPOT_CLIENT_ID',
    clientSecretEnvVar: 'HUBSPOT_CLIENT_SECRET',
    defaultScopes: [
      'crm.objects.contacts.read',
      'crm.objects.deals.read',
      'crm.objects.companies.read',
    ],
  },
  jira: {
    name: 'Jira',
    authUrl: 'https://auth.atlassian.com/authorize',
    tokenUrl: 'https://auth.atlassian.com/oauth/token',
    clientIdEnvVar: 'JIRA_CLIENT_ID',
    clientSecretEnvVar: 'JIRA_CLIENT_SECRET',
    defaultScopes: ['read:jira-work', 'write:jira-work', 'read:jira-user', 'read:me'],
    additionalAuthParams: {
      audience: 'api.atlassian.com',
      prompt: 'consent',
    },
  },
  figma: {
    name: 'Figma',
    authUrl: 'https://www.figma.com/oauth',
    tokenUrl: 'https://www.figma.com/api/oauth/token',
    clientIdEnvVar: 'FIGMA_CLIENT_ID',
    clientSecretEnvVar: 'FIGMA_CLIENT_SECRET',
    defaultScopes: ['file_read', 'file_dev_resources:read', 'file_dev_resources:write'],
  },
  reddit: {
    name: 'Reddit',
    authUrl: 'https://www.reddit.com/api/v1/authorize',
    tokenUrl: 'https://www.reddit.com/api/v1/access_token',
    clientIdEnvVar: 'REDDIT_CLIENT_ID',
    clientSecretEnvVar: 'REDDIT_CLIENT_SECRET',
    defaultScopes: ['identity', 'read', 'history', 'submit', 'privatemessages'],
    useBasicAuth: true,
    additionalAuthParams: {
      duration: 'permanent',
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
  return provider in OAUTH_PROVIDERS;
}
