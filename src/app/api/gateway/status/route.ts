import { NextRequest } from "next/server";
import { requireApiAuth, jsonResponse } from "@/lib/api-auth";
import { createClient } from "@/lib/supabase/server";
import { getUserInstance } from "@/lib/gateway/openclaw-proxy";
import { getNodeStatus } from "@/lib/node/status";
import type { GatewayStatusInfo } from "@/types/gateway";

export const dynamic = 'force-dynamic';

const AVAILABLE_TOOLS = ["exec", "browser", "web_search", "web_fetch", "memory", "email", "calendar"];

// GET /api/gateway/status
export async function GET(request: NextRequest) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  // Check companion connection status via user's gateway.
  // Use a short timeout so this doesn't block the whole response.
  let companionConnected = false;
  const nodeStatusPromise = Promise.race([
    getNodeStatus(user.id).catch(() => null),
    new Promise<null>(r => setTimeout(() => r(null), 3000)), // 3s hard cap
  ]);

  // Check real gateway health
  let gatewayConnected = false;
  let gatewayHealth: Record<string, unknown> | null = null;
  let runtimeMode = "serverless";
  let browserRelayConnected = false;

  const instance = await getUserInstance(user.id);
  if (instance) {
    runtimeMode = "openclaw-gateway";
    const gatewayBaseUrl = instance.port === 443
      ? `https://${instance.host}`
      : `http://${instance.host}:${instance.port}`;
    try {
      const healthRes = await fetch(`${gatewayBaseUrl}/health`, {
        signal: AbortSignal.timeout(5000),
      });
      if (healthRes.ok) {
        gatewayHealth = await healthRes.json();
        gatewayConnected = true;

        // Check if health response includes relay info
        if (gatewayHealth && typeof gatewayHealth === "object") {
          const h = gatewayHealth as Record<string, unknown>;
          if (typeof h.browserRelay === "boolean") {
            browserRelayConnected = h.browserRelay;
          } else if (typeof h.relay === "object" && h.relay !== null) {
            const relay = h.relay as Record<string, unknown>;
            browserRelayConnected = !!(relay.connected || (typeof relay.clients === "number" && relay.clients > 0));
          } else if (typeof h.cowork === "object" && h.cowork !== null) {
            const cowork = h.cowork as Record<string, unknown>;
            browserRelayConnected = !!(cowork.relay || cowork.browserRelay);
          }
        }
      }
    } catch { /* gateway unreachable */ }

    // Try dedicated relay status endpoint if health didn't include relay info
    if (gatewayConnected && !browserRelayConnected) {
      try {
        const relayRes = await fetch(`${gatewayBaseUrl}/relay/status`, {
          signal: AbortSignal.timeout(2000),
        });
        if (relayRes.ok) {
          const relayData = await relayRes.json() as Record<string, unknown>;
          // Accept various shapes: {connected: true}, {clients: 1}, {active: true}
          if (relayData.connected === true || relayData.active === true) {
            browserRelayConnected = true;
          } else if (typeof relayData.clients === "number" && relayData.clients > 0) {
            browserRelayConnected = true;
          } else if (typeof relayData.extensionClients === "number" && relayData.extensionClients > 0) {
            browserRelayConnected = true;
          }
        }
      } catch { /* relay status endpoint not available — that's fine */ }
    }
  }

  // Fetch token usage from user_usage table
  let tokenUsed = 0;
  const tokenLimit = 1000000;
  let resetDate: string | undefined;
  try {
    const supabase = await createClient();
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    resetDate = monthEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    const { data: usageRows } = await supabase
      .from('user_usage')
      .select('tokens_used')
      .eq('user_id', user.id)
      .gte('date', monthStart);

    if (usageRows) {
      tokenUsed = usageRows.reduce((sum, r) => sum + (r.tokens_used || 0), 0);
    }
  } catch { /* ignore */ }

  const statusInfo: GatewayStatusInfo = {
    agentName: "Dopl Agent",
    model: "Claude Sonnet 4",
    uptime: gatewayConnected ? "live" : "serverless",
    runtime: {
      os: gatewayConnected ? "linux" : "serverless",
      node: process.version,
      shell: gatewayConnected ? "bash" : "serverless",
      channel: gatewayConnected ? "gateway" : "cloud",
    },
    tokenUsage: {
      used: tokenUsed,
      limit: tokenLimit,
      resetDate,
    },
    capabilities: AVAILABLE_TOOLS,
  };

  // Resolve the node status (was running in parallel with gateway health + token usage)
  const nodeStatus = await nodeStatusPromise;
  if (nodeStatus && typeof nodeStatus === 'object' && 'isOnline' in nodeStatus) {
    companionConnected = (nodeStatus as { isOnline: boolean }).isOnline;
  }

  const response = {
    connected: true, // Always true — either gateway or serverless fallback is available
    status: statusInfo,
    isLive: gatewayConnected,
    runtime: runtimeMode,
    gateway: gatewayConnected ? {
      instanceId: instance?.instanceId,
      health: gatewayHealth,
    } : null,
    companion: companionConnected,
    browserRelay: browserRelayConnected,
    tools: AVAILABLE_TOOLS,
  };

  return jsonResponse(response);
}
