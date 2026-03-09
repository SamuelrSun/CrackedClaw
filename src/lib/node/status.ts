/**
 * Node Status Service
 * Checks if the user's locally paired node is online via the companion relay.
 */

import { createClient } from '@/lib/supabase/server';

export interface NodeStatus {
  isOnline: boolean;
  nodeId?: string;
  nodeName?: string;
  connectedAt?: string;
  lastSeen?: string;
  capabilities: string[];
  hasBrowser: boolean;
}

const COMPANION_STATUS_URL = 'https://companion.crackedclaw.com/api/companion/status';

export async function getNodeStatus(userId: string): Promise<NodeStatus> {
  const offline: NodeStatus = { isOnline: false, capabilities: [], hasBrowser: false };

  try {
    const supabase = await createClient();
    const { data: org } = await supabase
      .from('organizations')
      .select('id')
      .eq('owner_id', userId)
      .single();

    if (!org) return offline;

    const res = await fetch(COMPANION_STATUS_URL, {
      headers: { 'x-org-id': org.id },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return offline;

    const data = await res.json();
    const nodes: Array<{
      id: string;
      name?: string;
      displayName?: string;
      connected?: boolean;
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
