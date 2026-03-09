/**
 * Node Status Service
 * Checks if the user's locally paired OpenClaw node is online
 * and what capabilities it exposes (browser, files, notifications, etc.)
 */

import { getOrganization } from '@/lib/supabase/data';

export interface NodeStatus {
  isOnline: boolean;
  nodeId?: string;
  nodeName?: string;
  connectedAt?: string;
  lastSeen?: string;
  capabilities: string[];   // ['browser', 'files', 'notifications', 'camera', 'screen']
  hasBrowser: boolean;
  gatewayUrl?: string;
  authToken?: string;
}

export async function getNodeStatus(userId: string): Promise<NodeStatus> {
  try {
    const org = await getOrganization(userId);
    if (!org?.openclaw_gateway_url || !org?.openclaw_auth_token) {
      return { isOnline: false, capabilities: [], hasBrowser: false };
    }

    const gatewayUrl = org.openclaw_gateway_url;
    const authToken = org.openclaw_auth_token;

    // Base offline status - still includes gatewayUrl and authToken for command generation
    const offline: NodeStatus = { 
      isOnline: false, 
      capabilities: [], 
      hasBrowser: false,
      gatewayUrl,
      authToken,
    };

    try {
      // Extract instance ID from gateway URL (pattern: i-{id}.crackedclaw.com)
      const instanceMatch = gatewayUrl.match(/i-([a-f0-9]+)\./);
      if (!instanceMatch) return offline;
      const instanceId = `oc-${instanceMatch[1]}`;
      
      const provisioningUrl = process.env.PROVISIONING_API_URL || 'http://164.92.75.153:3100';
      const res = await fetch(`${provisioningUrl}/instances/${instanceId}/nodes/status`, {
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) return offline;

      const data = await res.json();
      const nodes: Array<{
        id: string;
        name?: string;
        displayName?: string;
        connected?: boolean;
        status?: string;
        lastSeen?: string;
        connectedAt?: string;
        capabilities?: string[];
      }> = data.nodes || [];
      
      const online = nodes.find(n => n.connected);

      if (!online) return offline;

      const caps: string[] = online.capabilities || ['browser', 'files'];
      return {
        isOnline: true,
        nodeId: online.id,
        nodeName: online.displayName || online.name || 'Your Mac',
        lastSeen: online.lastSeen,
        connectedAt: online.connectedAt,
        capabilities: caps,
        hasBrowser: caps.includes('browser') || true, // nodes always have browser via OpenClaw
        gatewayUrl,
        authToken,
      };
    } catch {
      return offline;
    }
  } catch {
    return { isOnline: false, capabilities: [], hasBrowser: false };
  }
}

export async function hasBrowserCapability(userId: string): Promise<boolean> {
  const status = await getNodeStatus(userId);
  return status.isOnline && status.hasBrowser;
}
