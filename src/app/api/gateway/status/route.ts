import { NextRequest } from "next/server";
import { requireApiAuth, jsonResponse } from "@/lib/api-auth";
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
