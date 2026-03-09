import { NextRequest } from "next/server";
import { requireApiAuth, jsonResponse } from "@/lib/api-auth";
import { fetchGatewayStatus } from "@/lib/gateway-client";
import { getOrganization } from "@/lib/supabase/data";
import { createClient } from "@/lib/supabase/server";
import type { GatewayStatusResponse, GatewayStatusInfo } from "@/types/gateway";

export const dynamic = 'force-dynamic';

// Mock status for when gateway is not connected
const mockStatus: GatewayStatusInfo = {
  agentName: "OpenClaw Agent",
  model: "Claude Sonnet 4",
  uptime: "—",
  runtime: {
    os: "—",
    node: "—",
    shell: "—",
  },
  capabilities: [],
};

// GET /api/gateway/status - Fetch status from connected OpenClaw gateway
export async function GET(request: NextRequest) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  let gatewayUrl: string | null = null;
  let gatewayToken: string | null = null;

  // Check for active org_id from query param (workspace switcher)
  const { searchParams: sp } = new URL(request.url);
  const activeOrgId = sp.get("org_id") || request.headers.get("x-org-id");

  // First check for cloud-provisioned organization
  try {
    let org = null;
    if (activeOrgId) {
      // Use the specific org requested
      const { createClient } = await import("@/lib/supabase/server");
      const supabaseClient = await createClient();
      const { data } = await supabaseClient
        .from("organizations")
        .select("*")
        .eq("id", activeOrgId)
        .eq("owner_id", user.id)
        .single();
      org = data;
    } else {
      org = await getOrganization(user.id);
    }
    // Use org gateway if URL + token exist (don't require exact "running" status — provisioning API can return stale status)
    if (org?.openclaw_gateway_url && org?.openclaw_auth_token) {
      gatewayUrl = org.openclaw_gateway_url;
      gatewayToken = org.openclaw_auth_token;
    }
  } catch (e) {
    console.error("Failed to get organization:", e);
  }

  // Fall back to user_gateways table
  if (!gatewayUrl) {
    try {
      const supabase = await createClient();
      const { data } = await supabase
        .from("user_gateways")
        .select("gateway_url, auth_token")
        .eq("user_id", user.id)
        .limit(1);
      
      if (data && data.length > 0) {
        gatewayUrl = data[0].gateway_url;
        gatewayToken = data[0].auth_token;
      }
    } catch (e) {
      console.error("Failed to get user gateway:", e);
    }
  }

  // Fall back to environment variables
  if (!gatewayUrl) {
    const { searchParams } = new URL(request.url);
    gatewayUrl = searchParams.get("url") || process.env.OPENCLAW_GATEWAY_URL || null;
    gatewayToken = searchParams.get("token") || process.env.OPENCLAW_GATEWAY_TOKEN || null;
  }

  // If no gateway configured, return disconnected
  if (!gatewayUrl || !gatewayToken) {
    const response: GatewayStatusResponse = {
      connected: false,
      status: mockStatus,
      isLive: false,
      error: "No gateway configured",
    };
    return jsonResponse(response);
  }

  try {
    const result = await fetchGatewayStatus(gatewayUrl, gatewayToken);

    if (result.error || !result.status) {
      const response: GatewayStatusResponse = {
        connected: false,
        status: mockStatus,
        latencyMs: result.latencyMs,
        isLive: false,
        error: result.error || "Failed to connect to gateway",
      };
      return jsonResponse(response);
    }

    // Gateway connected successfully
    const response: GatewayStatusResponse = {
      connected: true,
      status: result.status,
      latencyMs: result.latencyMs,
      isLive: true,
    };
    return jsonResponse(response);
  } catch (err) {
    const response: GatewayStatusResponse = {
      connected: false,
      status: mockStatus,
      isLive: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
    return jsonResponse(response);
  }
}
