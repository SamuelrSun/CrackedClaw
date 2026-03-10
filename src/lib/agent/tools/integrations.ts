import { createClient } from '@/lib/supabase/server';
import type { ToolDefinition, AgentContext } from '../runtime';

// Token refresh + fetch helper
async function getValidToken(userId: string, provider: string): Promise<{ access_token: string; token_type?: string; scopes?: string[] } | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('user_integrations')
    .select('access_token, refresh_token, token_expires_at, metadata')
    .eq('user_id', userId)
    .eq('provider', provider)
    .eq('status', 'connected')
    .single();

  if (!data?.access_token) return null;

  // Check if token needs refresh (within 5 min of expiry)
  const expiresAt = data.token_expires_at ? new Date(data.token_expires_at).getTime() : 0;
  if (expiresAt && expiresAt - Date.now() < 5 * 60 * 1000 && data.refresh_token) {
    const refreshed = await refreshOAuthToken(provider, data.refresh_token);
    if (refreshed) {
      await supabase.from('user_integrations').update({
        access_token: refreshed.access_token,
        token_expires_at: new Date(Date.now() + (refreshed.expires_in || 3600) * 1000).toISOString(),
        ...(refreshed.refresh_token ? { refresh_token: refreshed.refresh_token } : {}),
      }).eq('user_id', userId).eq('provider', provider);
      return { access_token: refreshed.access_token };
    }
  }

  return {
    access_token: data.access_token,
    scopes: (data.metadata as Record<string,unknown>)?.scopes as string[] | undefined,
  };
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
  description: 'Get an OAuth access token for a connected integration. Use this token with exec+curl to call any API. Returns null if not connected.',
  input_schema: {
    type: 'object',
    properties: {
      provider: { type: 'string', description: 'Integration provider id (e.g. google, slack, notion, github, hubspot)' },
    },
    required: ['provider'],
  },
  async execute(input: unknown, context: AgentContext): Promise<unknown> {
    const { provider, mode: scanMode } = input as { provider: string; mode?: 'quick' | 'deep' };
    const result = await getValidToken(context.userId, provider);
    if (!result) {
      return { error: `No connected ${provider} integration found. The user needs to connect it first.`, connected: false };
    }
    return {
      access_token: result.access_token,
      token_type: result.token_type || 'Bearer',
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
    const { provider, mode = 'quick' } = input as { provider: string; mode?: 'quick' | 'deep' };
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return { success: false, error: 'ANTHROPIC_API_KEY not configured' };
    try {
      const { runDeepAnalysis } = await import('@/lib/engine/engine');
      const onProgress = context.onToolProgress
        ? (evt: Record<string, unknown>) => context.onToolProgress!('scan_integration', evt)
        : undefined;
      const result = await runDeepAnalysis(context.userId, provider, apiKey, onProgress as import('@/lib/engine/types').ProgressCallback | undefined, mode);
      return {
        success: true,
        summary: result.summary,
        memoriesCreated: result.totalMemoriesCreated,
        entitiesFound: result.totalEntities,
        durationSeconds: Math.round(result.durationMs / 1000),
        accountEmail: result.accountEmail,
        automationSuggestions: (result.workflowSuggestions || []).slice(0, 5).map((s: { name: string; description: string; painScore: number; trigger: string; estimatedTimeSaved: string; priority: string }) => ({
          name: s.name,
          description: s.description,
          painScore: s.painScore,
          trigger: s.trigger,
          estimatedTimeSaved: s.estimatedTimeSaved,
          priority: s.priority,
        })),
        passes: result.passResults.map(p => ({
          name: p.passName,
          memories: p.memories.length,
          entities: p.entities.length,
        })),
      };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  },
};

export const listIntegrationsTool: ToolDefinition = {
  name: 'list_integrations',
  description: 'List all connected integrations for the current user with their capabilities.',
  input_schema: {
    type: 'object',
    properties: {},
  },
  async execute(_input: unknown, context: AgentContext): Promise<unknown> {
    const supabase = await createClient();
    const { data } = await supabase
      .from('user_integrations')
      .select('provider, status, metadata, connected_at')
      .eq('user_id', context.userId)
      .eq('status', 'connected');

    if (!data || data.length === 0) {
      return { integrations: [], message: 'No integrations connected yet.' };
    }

    // Import registry to add capability info
    const { INTEGRATIONS } = await import('@/lib/integrations/registry');

    return {
      integrations: data.map(i => {
        const reg = INTEGRATIONS.find(r => r.id === i.provider);
        return {
          provider: i.provider,
          name: reg?.name || i.provider,
          capabilities: reg?.capabilities || [],
          authType: reg?.authType || 'oauth',
          hasApi: reg?.hasApi ?? true,
          connectedAt: i.connected_at,
        };
      }),
    };
  },
};
