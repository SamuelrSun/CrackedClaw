/**
 * Node Status Service
 * Checks if the user's locally paired node is online via their OpenClaw gateway.
 * Uses WebSocket JSON-RPC (the gateway doesn't expose REST endpoints for node status).
 */

import { getUserProfile } from '@/lib/supabase/data';
import WebSocket from 'ws';

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

const WS_TIMEOUT_MS = 4000;

/**
 * Query gateway via WebSocket JSON-RPC for paired/connected nodes.
 * Opens a short-lived WS connection, sends connect + node.pair.list, returns results.
 */
async function queryGatewayNodes(gatewayUrl: string, authToken: string): Promise<{
  paired: Array<{ id: string; name?: string; displayName?: string; connected?: boolean; lastSeen?: string; capabilities?: string[] }>;
  pending: Array<{ requestId?: string; id?: string }>;
}> {
  return new Promise((resolve, reject) => {
    // Convert HTTPS URL to WSS
    const parsed = new URL(gatewayUrl);
    const tls = parsed.protocol === 'https:' || parsed.protocol === 'wss:';
    const wsUrl = `${tls ? 'wss' : 'ws'}://${parsed.host}`;

    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrl, { rejectUnauthorized: false });
    } catch (err) {
      return reject(err);
    }

    let reqId = 0;
    let settled = false;
    let connectReqId: number | null = null;
    let listReqId: number | null = null;

    const finish = (err: Error | null, val?: { paired: Array<{ id: string; name?: string; displayName?: string; connected?: boolean; lastSeen?: string; capabilities?: string[] }>; pending: Array<{ requestId?: string; id?: string }> }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { ws.close(); } catch (_) {}
      if (err) reject(err);
      else resolve(val!);
    };

    const timer = setTimeout(() => {
      finish(new Error('WebSocket query timed out'));
    }, WS_TIMEOUT_MS);

    const sendReq = (method: string, params: Record<string, unknown>) => {
      const id = ++reqId;
      ws.send(JSON.stringify({ type: 'req', id, method, params }));
      return id;
    };

    ws.on('open', () => {
      connectReqId = sendReq('connect', {
        client: {
          id: 'dopl-web',
          displayName: 'Dopl Web',
          mode: 'backend',
          version: '1.0.0',
          platform: 'web',
        },
        role: 'operator',
        scopes: ['operator.pairing'],
        auth: { token: authToken },
        minProtocol: 3,
        maxProtocol: 3,
      });
    });

    ws.on('message', (raw: Buffer) => {
      if (settled) return;

      let msg: { type?: string; id?: number; ok?: boolean; result?: Record<string, unknown>; error?: { message?: string; code?: string } };
      try {
        msg = JSON.parse(raw.toString());
      } catch (_) {
        return;
      }

      if (msg.type !== 'res') return;

      if (msg.id === connectReqId) {
        if (!msg.ok) {
          return finish(new Error(`Gateway connect rejected: ${msg.error?.message || 'unknown'}`));
        }
        listReqId = sendReq('node.pair.list', {});
        return;
      }

      if (msg.id === listReqId) {
        if (!msg.ok) {
          return finish(new Error(`node.pair.list failed: ${msg.error?.message || 'unknown'}`));
        }
        const paired = (msg.result?.paired || []) as Array<{ id: string; name?: string; displayName?: string; connected?: boolean; lastSeen?: string; capabilities?: string[] }>;
        const pending = (msg.result?.pending || []) as Array<{ requestId?: string; id?: string }>;
        return finish(null, { paired, pending });
      }
    });

    ws.on('error', (err: Error) => {
      finish(new Error(`WebSocket error: ${err.message}`));
    });

    ws.on('close', (code: number, reason: Buffer) => {
      const reasonStr = reason ? reason.toString() : '';
      finish(new Error(`WebSocket closed (code ${code}${reasonStr ? ': ' + reasonStr : ''})`));
    });
  });
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
