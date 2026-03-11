/**
 * Node Status Service
 * Checks if the user's locally paired node is online via their OpenClaw gateway.
 */

import { createClient } from '@/lib/supabase/server';
import { getOrganization } from '@/lib/supabase/data';

export interface NodeStatus {
  isOnline: boolean;
  nodeId?: string;
  nodeName?: string;
  connectedAt?: string;
  lastSeen?: string;
  capabilities: string[];
  hasBrowser: boolean;
}

export async function getNodeStatus(userId: string): Promise<NodeStatus> {
  const offline: NodeStatus = { isOnline: false, capabilities: [], hasBrowser: false };

  try {
    const organization = await getOrganization(userId);

    if (!organization?.openclaw_gateway_url || !organization?.openclaw_auth_token) {
      return offline;
    }

    const res = await fetch(`${organization.openclaw_gateway_url}/api/nodes/status`, {
      headers: {
        'Authorization': `Bearer ${organization.openclaw_auth_token}`,
        'Content-Type': 'application/json',
      },
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

    const online = nodes.find(n => n.connected || n.status === 'connected');
    if (!online) return offline;

    const caps: string[] = online.capabilities || ['browser', 'files'];
    return {
      isOnline: true,
      nodeId: online.id,
      nodeName: online.displayName || online.name || 'Your Mac',
      lastSeen: online.lastSeen,
      connectedAt: online.connectedAt,
      capabilities: caps,
      hasBrowser: caps.includes('browser'),
    };
  } catch {
    return offline;
  }
}

export async function hasBrowserCapability(userId: string): Promise<boolean> {
  const status = await getNodeStatus(userId);
  return status.isOnline && status.hasBrowser;
}
