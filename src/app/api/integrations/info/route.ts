/**
 * Integration Info API
 * Returns available integrations, counts, and capabilities
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  INTEGRATIONS,
  CATEGORIES,
  getIntegrationsWithApi,
  getIntegrationsWithBrowserOnly,
  getSimpleStatus,
  getIntegrationCounts,
  getAllCapabilities,
} from '@/lib/integrations';

export const runtime = 'edge';

interface CategoryMeta {
  name: string;
  icon: string;
  order: number;
}

/**
 * GET /api/integrations/info
 * 
 * Query params:
 * - category: Filter by category
 * - hasApi: Filter by API availability (true/false)
 * - withStatus: Include user's connection status (requires auth)
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category');
  const hasApi = searchParams.get('hasApi');
  const withStatus = searchParams.get('withStatus') === 'true';

  // Filter integrations
  let integrations = [...INTEGRATIONS];

  if (category) {
    integrations = integrations.filter((i) => i.category === category);
  }

  if (hasApi !== null) {
    const wantApi = hasApi === 'true';
    integrations = integrations.filter((i) => i.hasApi === wantApi);
  }

  // Get user status if requested
  let userStatus: Record<string, { connected: boolean; method: 'api' | 'browser' | null }> = {};
  
  if (withStatus) {
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const { data: userIntegrations } = await supabase
          .from('integrations')
          .select('slug, status, type')
          .eq('user_id', user.id);
        
        if (userIntegrations) {
          for (const ui of userIntegrations) {
            userStatus[ui.slug] = {
              connected: ui.status === 'connected',
              method: ui.status === 'connected' 
                ? (ui.type === 'browser' ? 'browser' : 'api')
                : null,
            };
          }
        }
      }
    } catch (error) {
      console.error('Error fetching user integrations:', error);
    }
  }

  // Build response
  const counts = getSimpleStatus();
  const apiIntegrations = getIntegrationsWithApi();
  const browserOnlyIntegrations = getIntegrationsWithBrowserOnly();

  // Type-safe category iteration
  const categoryEntries = Object.entries(CATEGORIES) as [string, CategoryMeta][];

  return NextResponse.json({
    // Integration registry
    integrations: integrations.map((i) => ({
      id: i.id,
      name: i.name,
      icon: i.icon,
      category: i.category,
      description: i.description,
      hasApi: i.hasApi,
      apiProvider: i.apiProvider,
      browserFallback: i.browserFallback,
      authType: i.authType,
      capabilities: i.capabilities,
      // Include user status if available
      ...(withStatus && userStatus[i.id] ? { status: userStatus[i.id] } : {}),
    })),
    
    // Categories
    categories: categoryEntries.map(([id, meta]) => ({
      id,
      name: meta.name,
      icon: meta.icon,
      order: meta.order,
      count: INTEGRATIONS.filter((i) => i.category === id).length,
    })),
    
    // Counts summary
    counts: {
      total: INTEGRATIONS.length,
      withApi: apiIntegrations.length,
      browserOnly: browserOnlyIntegrations.length,
      capabilities: getAllCapabilities().length,
    },
    
    // Quick access lists
    apiProviders: {
      maton: apiIntegrations.filter((i) => i.apiProvider === 'maton').length,
      native: apiIntegrations.filter((i) => i.apiProvider === 'native').length,
      oauth: apiIntegrations.filter((i) => i.apiProvider === 'oauth').length,
    },
    
    // For agent prompts
    promptInfo: {
      apiCount: counts.apiCount,
      browserUnlimited: counts.browserAvailable,
      popularApi: ['Google Workspace', 'Slack', 'Notion', 'GitHub', 'HubSpot'],
      browserOnly: ['LinkedIn', 'WhatsApp', 'Instagram', 'Facebook', 'TikTok'],
    },
  });
}
