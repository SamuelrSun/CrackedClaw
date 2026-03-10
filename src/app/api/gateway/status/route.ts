import { NextRequest } from "next/server";
import { requireApiAuth, jsonResponse } from "@/lib/api-auth";
import { createClient } from "@/lib/supabase/server";
import type { GatewayStatusResponse, GatewayStatusInfo } from "@/types/gateway";

export const dynamic = 'force-dynamic';

const AVAILABLE_TOOLS = ["exec", "browser", "web_search", "web_fetch", "memory", "email", "calendar"];

// GET /api/gateway/status - Serverless runtime: always connected
export async function GET(request: NextRequest) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  // Check companion connection status
  let companionConnected = false;
  try {
    const statusRes = await fetch('https://companion.crackedclaw.com/api/companion/status');
    if (statusRes.ok) {
      const companionStatus = await statusRes.json();
      companionConnected = (companionStatus.connected || []).includes(user.id);
    }
  } catch { /* ignore - companion not available */ }

  // Fetch token usage from user_usage table
  let tokenUsed = 0;
  const tokenLimit = 1000000; // 1M tokens default
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
    agentName: "CrackedClaw Agent",
    model: "Claude Sonnet 4",
    uptime: "serverless",
    runtime: {
      os: "serverless",
      node: process.version,
      shell: "serverless",
      channel: "cloud",
    },
    tokenUsage: {
      used: tokenUsed,
      limit: tokenLimit,
      resetDate,
    },
    capabilities: AVAILABLE_TOOLS,
  };

  const response = {
    connected: true,
    status: statusInfo,
    isLive: true,
    runtime: "serverless",
    companion: companionConnected,
    tools: AVAILABLE_TOOLS,
  };

  return jsonResponse(response);
}
