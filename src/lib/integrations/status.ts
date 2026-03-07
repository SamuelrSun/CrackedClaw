/**
 * Integration Status Checking
 * Determines what integrations are available for a user
 */

import { createClient } from '@/lib/supabase/client';
import { INTEGRATIONS, getIntegrationsWithApi } from './registry';

export interface ApiConnectionStatus {
  provider: string;
  integrationId: string;
  connected: boolean;
  scopes?: string[];
  lastSync?: Date | null;
  error?: string;
}

export interface BrowserSessionStatus {
  integrationId: string;
  loggedIn: boolean;
  lastUsed: Date | null;
  sessionValid: boolean;
}

export interface IntegrationStatus {
  api: ApiConnectionStatus[];
  browser: BrowserSessionStatus[];
  summary: {
    apiConnected: number;
    apiTotal: number;
    browserLoggedIn: number;
    browserTotal: number;
  };
}

export interface IntegrationCounts {
  apiCount: number;
  apiConnected: number;
  browserUnlimited: boolean;
  totalPossible: number;
}

// Type for database integration record
interface UserIntegrationRecord {
  slug: string;
  status?: string;
  type?: string;
  config?: Record<string, unknown>;
  last_sync?: string;
}

/**
 * Get a simple status (no user context required)
 * For use in routes that don't have user info
 */
export function getSimpleStatus(): {
  apiCount: number;
  browserAvailable: boolean;
} {
  return {
    apiCount: getIntegrationsWithApi().length,
    browserAvailable: true,
  };
}

/**
 * Check if an integration is available (has any connection method)
 */
export function isIntegrationAvailable(integrationId: string): boolean {
  const integration = INTEGRATIONS.find((i) => i.id === integrationId);
  return !!integration;
}

/**
 * Get required setup steps for an integration
 */
export function getRequiredSetup(integrationId: string): string[] {
  const integration = INTEGRATIONS.find((i) => i.id === integrationId);
  if (!integration) return [];
  
  const steps: string[] = [];
  if (integration.apiProvider) {
    steps.push(`Connect ${integration.name} via OAuth`);
  }
  if (integration.browserFallback) {
    steps.push(`Or log in via browser session`);
  }
  return steps;
}

/**
 * Check what integrations are available for a user
 */
export async function getIntegrationStatus(userId: string): Promise<IntegrationStatus> {
  const supabase = createClient();
  
  const { data: userIntegrations, error } = await supabase
    .from('integrations')
    .select('*')
    .eq('user_id', userId);
  
  if (error) {
    console.error('Error fetching integrations:', error);
    return {
      api: [],
      browser: [],
      summary: {
        apiConnected: 0,
        apiTotal: getIntegrationsWithApi().length,
        browserLoggedIn: 0,
        browserTotal: INTEGRATIONS.filter((i) => i.browserFallback).length,
      },
    };
  }
  
  const integrationMap = new Map(
    (userIntegrations as UserIntegrationRecord[] | null)?.map((i: UserIntegrationRecord) => [i.slug, i]) ?? []
  );
  
  const apiStatus: ApiConnectionStatus[] = getIntegrationsWithApi().map((integration) => {
    const userInt = integrationMap.get(integration.id);
    return {
      provider: integration.apiProvider || 'oauth',
      integrationId: integration.id,
      connected: userInt?.status === 'connected',
      scopes: (userInt?.config as { scopes?: string[] } | undefined)?.scopes,
      lastSync: userInt?.last_sync ? new Date(userInt.last_sync) : null,
    };
  });
  
  const browserStatus: BrowserSessionStatus[] = INTEGRATIONS
    .filter((i) => i.browserFallback)
    .map((integration) => {
      const userInt = integrationMap.get(integration.id);
      const isBrowserConnected = 
        userInt?.type === 'browser' && userInt?.status === 'connected';
      return {
        integrationId: integration.id,
        loggedIn: isBrowserConnected,
        lastUsed: userInt?.last_sync ? new Date(userInt.last_sync) : null,
        sessionValid: isBrowserConnected,
      };
    });
  
  return {
    api: apiStatus,
    browser: browserStatus,
    summary: {
      apiConnected: apiStatus.filter((s) => s.connected).length,
      apiTotal: apiStatus.length,
      browserLoggedIn: browserStatus.filter((s) => s.loggedIn).length,
      browserTotal: browserStatus.length,
    },
  };
}

/**
 * Get simplified counts for display
 */
export async function getIntegrationCounts(userId: string): Promise<IntegrationCounts> {
  const status = await getIntegrationStatus(userId);
  
  return {
    apiCount: status.api.length,
    apiConnected: status.summary.apiConnected,
    browserUnlimited: true,
    totalPossible: INTEGRATIONS.length,
  };
}

/**
 * Check if a specific integration is connected
 */
export async function isIntegrationConnected(
  userId: string, 
  integrationId: string
): Promise<boolean> {
  const status = await getIntegrationStatus(userId);
  
  const apiIntegration = status.api.find((a) => a.integrationId === integrationId);
  if (apiIntegration?.connected) return true;
  
  const browserIntegration = status.browser.find((b) => b.integrationId === integrationId);
  if (browserIntegration?.loggedIn) return true;
  
  return false;
}

/**
 * Get the connection type for an integration
 */
export async function getIntegrationConnectionType(
  userId: string,
  integrationId: string
): Promise<'api' | 'browser' | 'both' | 'none'> {
  const status = await getIntegrationStatus(userId);
  
  const apiConnected = status.api.find((a) => 
    a.integrationId === integrationId && a.connected
  );
  const browserConnected = status.browser.find((b) => 
    b.integrationId === integrationId && b.loggedIn
  );
  
  if (apiConnected && browserConnected) return 'both';
  if (apiConnected) return 'api';
  if (browserConnected) return 'browser';
  return 'none';
}

/**
 * Get a user-friendly status message
 */
export function getStatusMessage(status: IntegrationStatus): string {
  const { apiConnected, apiTotal, browserLoggedIn, browserTotal } = status.summary;
  
  const parts: string[] = [];
  
  if (apiConnected > 0) {
    parts.push(`${apiConnected}/${apiTotal} API integrations connected`);
  }
  
  if (browserLoggedIn > 0) {
    parts.push(`${browserLoggedIn}/${browserTotal} browser sessions active`);
  }
  
  if (parts.length === 0) {
    return 'No integrations connected yet';
  }
  
  return parts.join(', ');
}

/**
 * Get dashboard status summary
 */
export async function getDashboardStatus(userId: string): Promise<{
  connected: string[];
  available: string[];
  recommended: string[];
}> {
  const status = await getIntegrationStatus(userId);
  const connected = status.api
    .filter((a) => a.connected)
    .map((a) => a.integrationId);
  
  const available = INTEGRATIONS
    .filter((i) => !connected.includes(i.id))
    .map((i) => i.id);
  
  const recommended = ['google', 'slack', 'notion']
    .filter((id) => !connected.includes(id) && available.includes(id));
  
  return { connected, available, recommended };
}
