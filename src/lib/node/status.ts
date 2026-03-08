/**
 * Node Status Service
 * Checks if the user's locally paired OpenClaw node is online
 * and what capabilities it exposes (browser, files, notifications, etc.)
 */

import { createClient } from '@/lib/supabase/server';
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
  const offline: NodeStatus = { isOnline: false, capabilities: [], hasBrowser: false };

  try {
    const org = await getOrganization(userId);
    if (!org?.openclaw_gateway_url || !org?.openclaw_auth_token) return offline;

    const gatewayUrl = org.openclaw_gateway_url;
    const authToken = org.openclaw_auth_token;

    const res = await fetch(`${gatewayUrl}/api/nodes/status`, {
      headers: { Authorization: `Bearer ${authToken}` },
      signal: AbortSignal.timeout(5000),
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
      hasBrowser: caps.includes('browser') || true, // nodes always have browser via OpenClaw
      gatewayUrl,
      authToken,
    };
  } catch {
    return offline;
  }
}

export async function hasBrowserCapability(userId: string): Promise<boolean> {
  const status = await getNodeStatus(userId);
  return status.isOnline && status.hasBrowser;
}
