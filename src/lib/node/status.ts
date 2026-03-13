/**
 * Node Status Service
 * Checks if the user's locally paired node is online via their OpenClaw gateway.
 * Uses WebSocket JSON-RPC (the gateway doesn't expose REST endpoints for node status).
 */

import { getUserProfile } from '@/lib/supabase/data';

export interface NodeStatus {
  isOnline: boolean;
  nodeId?: string;
  nodeName?: string;
  connectedAt?: string;
  lastSeen?: string;
  capabilities: string[];
  hasBrowser: boolean;
  nodes: Array<{
    id: string;
    name: string;
    connected: boolean;
    lastSeen?: string;
    capabilities?: string[];
  }>;
}

// Node status is now checked via provisioning API instead of WebSocket
// (WS requires challenge-response device auth that's too complex for status checks)

/**
 * Query gateway for paired/connected nodes via the provisioning API.
 * The direct WebSocket approach fails because the gateway requires 
 * challenge-response device auth that's too complex for a status check.
 * Instead, we query the provisioning API on the server which can run
 * `openclaw status` or check the paired.json file directly.
 * 
 * Fallback: check if the gateway is at least reachable (healthz endpoint).
 */
async function queryGatewayNodes(gatewayUrl: string, _authToken: string): Promise<{
  paired: Array<{ id: string; name?: string; displayName?: string; connected?: boolean; lastSeen?: string; capabilities?: string[] }>;
  pending: Array<{ requestId?: string; id?: string }>;
}> {
  // Extract instance ID from gateway URL (e.g., https://i-82749eae.usedopl.com -> oc-82749eae)
  const urlMatch = gatewayUrl.match(/i-([a-f0-9]+)\./);
  const instanceId = urlMatch ? `oc-${urlMatch[1]}` : null;
  
  if (!instanceId) {
    throw new Error('Could not extract instance ID from gateway URL');
  }

  // Try to read paired.json from the instance directory via provisioning API
  const provisioningUrl = process.env.PROVISIONING_API_URL || 'http://164.92.75.153:3100';
  const provisioningSecret = process.env.PROVISIONING_API_SECRET || process.env.PROVISIONING_SECRET || '';
  
  try {
    const res = await fetch(`${provisioningUrl}/api/instances/${instanceId}/nodes`, {
      headers: provisioningSecret ? { 'Authorization': `Bearer ${provisioningSecret}` } : {},
      signal: AbortSignal.timeout(3000),
    });
    
    if (res.ok) {
      const data = await res.json() as { paired?: Array<{ id: string; name?: string; displayName?: string; connected?: boolean; lastSeen?: string; capabilities?: string[] }>; pending?: Array<{ requestId?: string; id?: string }> };
      return {
        paired: data.paired || [],
        pending: data.pending || [],
      };
    }
  } catch {
    // Provisioning API not available or endpoint doesn't exist — fall through
  }

  // Fallback: check if gateway healthz is reachable and check for paired.json via filesystem
  // If gateway is live, assume companion might be connected (optimistic)
  try {
    const healthRes = await fetch(`${gatewayUrl}/healthz`, {
      signal: AbortSignal.timeout(2000),
    });
    if (healthRes.ok) {
      // Gateway is live — we can't determine node status without WS challenge
      // Return empty but don't error (the system prompt will show "not connected"
      // which is wrong but safe, and the user can still use the agent)
      return { paired: [], pending: [] };
    }
  } catch {
    // Gateway unreachable
  }

  return { paired: [], pending: [] };
}

export async function getNodeStatus(userId: string): Promise<NodeStatus> {
  const offline: NodeStatus = { isOnline: false, capabilities: [], hasBrowser: false, nodes: [] };

  try {
    const profile = await getUserProfile(userId);
    if (!profile?.gateway_url || !profile?.auth_token) {
      return offline;
    }

    const { paired } = await queryGatewayNodes(
      profile.gateway_url,
      profile.auth_token
    );

    const allNodes = paired.map(n => ({
      id: n.id,
      name: n.displayName || n.name || 'Unknown Device',
      connected: n.connected === true,
      lastSeen: n.lastSeen,
      capabilities: n.capabilities,
    }));

    const online = allNodes.find(n => n.connected);
    if (!online) {
      return { ...offline, nodes: allNodes };
    }

    const caps: string[] = online.capabilities || ['browser', 'files'];
    return {
      isOnline: true,
      nodeId: online.id,
      nodeName: online.name,
      lastSeen: online.lastSeen,
      capabilities: caps,
      hasBrowser: caps.includes('browser'),
      nodes: allNodes,
    };
  } catch {
    return offline;
  }
}

export async function hasBrowserCapability(userId: string): Promise<boolean> {
  const status = await getNodeStatus(userId);
  return status.isOnline && status.hasBrowser;
}
