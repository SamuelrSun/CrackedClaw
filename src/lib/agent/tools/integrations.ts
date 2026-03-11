import { createClient } from '@/lib/supabase/server';
import type { ToolDefinition, AgentContext } from '../runtime';

// Token refresh + fetch helper
// Supports multiple accounts per provider via optional accountId
async function getValidToken(userId: string, provider: string, accountId?: string): Promise<{ access_token: string; token_type?: string; scopes?: string[]; account_email?: string } | null> {
  const supabase = await createClient();
  let query = supabase
    .from('user_integrations')
    .select('id, account_email, access_token, refresh_token, token_expires_at, metadata')
    .eq('user_id', userId)
    .eq('provider', provider)
    .eq('status', 'connected');

  if (accountId) {
    // Specific account requested
    query = query.eq('id', accountId);
  }

  // Get all matching accounts (not .single())
  const { data } = await query.order('is_default', { ascending: false }).order('created_at', { ascending: true });

  if (!data || data.length === 0) return null;

  // Pick the requested account, or the first (default) one
  const account = data[0];
  if (!account?.access_token) return null;

  // Check if token needs refresh (within 5 min of expiry)
  const expiresAt = account.token_expires_at ? new Date(account.token_expires_at).getTime() : 0;
  if (expiresAt && expiresAt - Date.now() < 5 * 60 * 1000 && account.refresh_token) {
    const refreshed = await refreshOAuthToken(provider, account.refresh_token);
    if (refreshed) {
      await supabase.from('user_integrations').update({
        access_token: refreshed.access_token,
        token_expires_at: new Date(Date.now() + (refreshed.expires_in || 3600) * 1000).toISOString(),
        ...(refreshed.refresh_token ? { refresh_token: refreshed.refresh_token } : {}),
      }).eq('id', account.id);
      return { access_token: refreshed.access_token, account_email: account.account_email };
    }
  }

  return {
    access_token: account.access_token,
    scopes: (account.metadata as Record<string,unknown>)?.scopes as string[] | undefined,
    account_email: account.account_email,
  };
}

// Get all connected accounts for a provider (for multi-account support)
async function getAllAccountTokens(userId: string, provider: string): Promise<Array<{ id: string; account_email: string; access_token: string; scopes?: string[] }>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('user_integrations')
    .select('id, account_email, access_token, refresh_token, token_expires_at, metadata')
    .eq('user_id', userId)
    .eq('provider', provider)
    .eq('status', 'connected')
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true });

  if (!data || data.length === 0) return [];

  const results = [];
  for (const account of data) {
    if (!account.access_token) continue;

    // Refresh if needed
    const expiresAt = account.token_expires_at ? new Date(account.token_expires_at).getTime() : 0;
    let token = account.access_token;
    if (expiresAt && expiresAt - Date.now() < 5 * 60 * 1000 && account.refresh_token) {
      const refreshed = await refreshOAuthToken(provider, account.refresh_token);
      if (refreshed) {
        const supabase2 = await createClient();
        await supabase2.from('user_integrations').update({
          access_token: refreshed.access_token,
          token_expires_at: new Date(Date.now() + (refreshed.expires_in || 3600) * 1000).toISOString(),
          ...(refreshed.refresh_token ? { refresh_token: refreshed.refresh_token } : {}),
        }).eq('id', account.id);
        token = refreshed.access_token;
      }
    }

    results.push({
      id: account.id,
      account_email: account.account_email,
      access_token: token,
      scopes: (account.metadata as Record<string,unknown>)?.scopes as string[] | undefined,
    });
  }
  return results;
}

async function refreshOAuthToken(provider: string, refreshToken: string): Promise<{ access_token: string; refresh_token?: string; expires_in?: number } | null> {
  if (provider === 'google') {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });
    if (!res.ok) return null;
    return await res.json();
  }
  // Add Microsoft refresh here if needed
  return null;
}

export const getIntegrationTokenTool: ToolDefinition = {
  name: 'get_integration_token',
  description: 'Get an OAuth access token for a connected integration. Supports multiple accounts per provider — specify account_id or account_email to pick a specific one, or omit to get the default. Use list_integrations first to see all connected accounts.',
  input_schema: {
    type: 'object',
    properties: {
      provider: { type: 'string', description: 'Integration provider id (e.g. google, slack, notion, github, hubspot)' },
      account_id: { type: 'string', description: 'Optional: specific account ID (from list_integrations) to get token for' },
      account_email: { type: 'string', description: 'Optional: account email to match (e.g. "srwang@usc.edu")' },
      all_accounts: { type: 'boolean', description: 'If true, returns tokens for ALL connected accounts of this provider' },
    },
    required: ['provider'],
  },
  async execute(input: unknown, context: AgentContext): Promise<unknown> {
    const { provider, account_id, account_email, all_accounts } = input as {
      provider: string;
      account_id?: string;
      account_email?: string;
      all_accounts?: boolean;
    };

    // Return all accounts if requested
    if (all_accounts) {
      const accounts = await getAllAccountTokens(context.userId, provider);
      if (accounts.length === 0) {
        return { error: `No connected ${provider} integration found. The user needs to connect it first.`, connected: false };
      }
      return {
        connected: true,
        account_count: accounts.length,
        accounts: accounts.map(a => ({
          account_id: a.id,
          account_email: a.account_email,
          access_token: a.access_token,
          token_type: 'Bearer',
        })),
      };
    }

    // If account_email specified, find the matching account
    if (account_email) {
      const accounts = await getAllAccountTokens(context.userId, provider);
      const match = accounts.find(a => a.account_email?.toLowerCase() === account_email.toLowerCase());
      if (!match) {
        return {
          error: `No ${provider} account matching "${account_email}" found.`,
          connected: false,
          available_accounts: accounts.map(a => a.account_email),
        };
      }
      return {
        access_token: match.access_token,
        token_type: 'Bearer',
        account_email: match.account_email,
        account_id: match.id,
        connected: true,
      };
    }

    // Default: get specific account or first/default
    const result = await getValidToken(context.userId, provider, account_id);
    if (!result) {
      return { error: `No connected ${provider} integration found. The user needs to connect it first.`, connected: false };
    }
    return {
      access_token: result.access_token,
      token_type: result.token_type || 'Bearer',
      account_email: result.account_email,
      connected: true,
      hint: `Use this token in Authorization header: curl -H "Authorization: Bearer ${result.access_token.substring(0, 8)}..." <api_url>`,
    };
  },
};

export const scanIntegrationTool: ToolDefinition = {
  name: 'scan_integration',
  description: 'Deep-scan a connected integration to build a comprehensive behavioral profile. Analyzes communication style, relationships, decision patterns, priorities, and more. Quick mode (~3 min) or deep mode (~12 min). Saves all insights to memory automatically.',
  input_schema: {
    type: 'object',
    properties: {
      provider: { type: 'string', description: 'Integration provider to scan (e.g. google)' },
      mode: { type: 'string', enum: ['quick', 'deep'], description: 'Scan mode: quick (~3min) or deep (~12min). Default: quick.' },
    },
    required: ['provider'],
  },
  async execute(input: unknown, context: AgentContext): Promise<unknown> {
    const { provider, mode: scanMode } = input as { provider: string; mode?: 'quick' | 'deep' };
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return { success: false, error: 'ANTHROPIC_API_KEY not configured' };
    try {
      const { runScan } = await import('@/lib/engine/v2');
      const onProgress = context.onToolProgress
        ? (evt: Record<string, unknown>) => context.onToolProgress!('scan_integration', evt)
        : undefined;
      const result = await runScan(
        context.userId,
        apiKey,
        scanMode || 'quick',
        onProgress as import('@/lib/engine/v2/types').ScanProgressCallback | undefined,
        provider === 'all' ? undefined : provider,
      );
      return {
        success: true,
        scanId: result.scanId,
        totalMemories: result.totalMemories,
        durationSeconds: Math.round(result.totalDurationMs / 1000),
        integrations: result.integrationResults.map((r: import('@/lib/engine/v2/types').IntegrationScanResult) => ({
          provider: r.provider,
          account: r.accountLabel,
          memories: r.memoriesCreated,
          error: r.error || null,
        })),
        synthesis: result.synthesis ? {
          crossInsights: result.synthesis.crossIntegrationInsights.length,
          workflowSuggestions: result.synthesis.workflowSuggestions.map((s: import('@/lib/engine/v2/types').WorkflowSuggestion) => ({
            name: s.name,
            description: s.description,
            trigger: s.trigger,
            integrations: s.integrations,
            estimatedTimeSaved: s.estimatedTimeSaved,
            priority: s.priority,
          })),
          userProfile: result.synthesis.userProfile?.substring(0, 500),
        } : null,
      };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  },
};

export const listIntegrationsTool: ToolDefinition = {
  name: 'list_integrations',
  description: 'List all connected integrations and accounts for the current user. Shows individual accounts (e.g. multiple Google accounts) with their emails and capabilities.',
  input_schema: {
    type: 'object',
    properties: {},
  },
  async execute(_input: unknown, context: AgentContext): Promise<unknown> {
    const supabase = await createClient();
    const { data } = await supabase
      .from('user_integrations')
      .select('id, provider, account_email, account_name, is_default, status, metadata, created_at')
      .eq('user_id', context.userId)
      .eq('status', 'connected')
      .order('provider')
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: true });

    if (!data || data.length === 0) {
      return { integrations: [], accounts: [], message: 'No integrations connected yet.' };
    }

    // Import registry to add capability info
    const { INTEGRATIONS } = await import('@/lib/integrations/registry');

    // Group by provider for summary
    const providerMap = new Map<string, typeof data>();
    for (const row of data) {
      const existing = providerMap.get(row.provider) || [];
      existing.push(row);
      providerMap.set(row.provider, existing);
    }

    const integrations = Array.from(providerMap.entries()).map(([provider, accounts]) => {
      const reg = INTEGRATIONS.find(r => r.id === provider);
      return {
        provider,
        name: reg?.name || provider,
        capabilities: reg?.capabilities || [],
        authType: reg?.authType || 'oauth',
        hasApi: reg?.hasApi ?? true,
        account_count: accounts.length,
        accounts: accounts.map(a => ({
          account_id: a.id,
          email: a.account_email,
          name: a.account_name,
          is_default: a.is_default ?? false,
          connected_at: a.created_at,
        })),
      };
    });

    // Also return a flat list of all accounts for easy reference
    const allAccounts = data.map(i => ({
      account_id: i.id,
      provider: i.provider,
      email: i.account_email,
      name: i.account_name,
      is_default: i.is_default ?? false,
    }));

    return { integrations, accounts: allAccounts };
  },
};
