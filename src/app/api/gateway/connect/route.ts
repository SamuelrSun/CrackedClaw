import { NextRequest } from "next/server";
import { requireApiAuth, jsonResponse, errorResponse } from "@/lib/api-auth";
import { getUserGateway, saveUserGateway, deleteUserGateway, logActivity, getOrganization } from "@/lib/supabase/data";
import type { GatewayConnectionInput } from "@/types/gateway";

export const dynamic = 'force-dynamic';

// GET /api/gateway/connect - Fetch current user's gateway connection
export async function GET(request: NextRequest) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const activeOrgId = searchParams.get("org_id") || request.headers.get("x-org-id");

    // First check for cloud-provisioned organization
    let org = null;
    if (activeOrgId) {
      const { createClient } = await import("@/lib/supabase/server");
      const supabase = await createClient();
      const { data } = await supabase
        .from("organizations")
        .select("*")
        .eq("id", activeOrgId)
        .eq("owner_id", user.id)
        .single();
      org = data;
    } else {
      org = await getOrganization(user.id);
    }
    // Check for URL + token (don't gate on status — instance may be running even if status field is stale)
    if (org?.openclaw_gateway_url && org?.openclaw_auth_token) {
      return jsonResponse({
        gateway: {
          id: org.id,
          name: org.name,
          gateway_url: org.openclaw_gateway_url,
          auth_token: "••••••••",
          status: ["running", "connected", "stopped"].includes(org.openclaw_status) ? "connected" : "disconnected",
          is_cloud: true,
        },
      });
    }

    // Fall back to self-hosted user_gateways
    const gateway = await getUserGateway(user.id);
    
    if (!gateway) {
      return jsonResponse({ gateway: null });
    }

    // Mask the auth token for security
    return jsonResponse({
      gateway: {
        ...gateway,
        auth_token: gateway.auth_token ? "••••••••" : null,
        is_cloud: false,
      },
    });
  } catch (err) {
    console.error("Error fetching gateway:", err);
    return errorResponse("Failed to fetch gateway connection", 500);
  }
}

// POST /api/gateway/connect - Save gateway connection
export async function POST(request: NextRequest) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  try {
    const body: GatewayConnectionInput = await request.json();

    // Validate required fields
    if (!body.gateway_url) {
      return errorResponse("Gateway URL is required", 400);
    }

    if (!body.auth_token) {
      return errorResponse("Auth token is required", 400);
    }

    // Validate URL format
    try {
      new URL(body.gateway_url);
    } catch {
      return errorResponse("Invalid gateway URL format", 400);
    }

    const gateway = await saveUserGateway(user.id, {
      gateway_url: body.gateway_url,
      auth_token: body.auth_token,
      name: body.name || "My OpenClaw",
    });

    await logActivity("gateway.connect", `Connected to ${body.gateway_url}`);

    return jsonResponse({
      gateway: {
        ...gateway,
        auth_token: "••••••••",
      },
    });
  } catch (err) {
    console.error("Error saving gateway:", err);
    return errorResponse("Failed to save gateway connection", 500);
  }
}

// DELETE /api/gateway/connect - Remove gateway connection
export async function DELETE() {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  try {
    await deleteUserGateway(user.id);
    await logActivity("gateway.disconnect", "Disconnected gateway");
    return jsonResponse({ success: true });
  } catch (err) {
    console.error("Error deleting gateway:", err);
    return errorResponse("Failed to disconnect gateway", 500);
  }
}
