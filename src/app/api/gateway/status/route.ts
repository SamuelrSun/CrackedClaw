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
      }
    } catch { /* gateway unreachable */ }
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
    tools: AVAILABLE_TOOLS,
  };

  return jsonResponse(response);
}
