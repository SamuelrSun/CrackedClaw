import { requireApiAuth, jsonResponse, errorResponse } from "@/lib/api-auth";
import { getUserGateway, upsertIntegrations, logActivity } from "@/lib/supabase/data";
import { fetchGatewayIntegrations } from "@/lib/gateway-client";

/**
 * POST /api/gateway/sync
 * Syncs integrations from the user's OpenClaw gateway into the database
 */
export async function POST() {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  try {
    const gateway = await getUserGateway(user.id);
    
    if (!gateway) {
      return errorResponse("No gateway connected. Please connect your OpenClaw first.", 400);
    }
    
    if (!gateway.auth_token || !gateway.gateway_url) {
      return errorResponse("Gateway connection is incomplete", 400);
    }

    const { integrations, error: fetchError } = await fetchGatewayIntegrations(
      gateway.gateway_url,
      gateway.auth_token
    );

    if (fetchError) {
      return errorResponse(`Could not reach your OpenClaw: ${fetchError}`, 502);
    }

    if (integrations.length === 0) {
      await logActivity("Integrations synced", "No integrations to sync");
      return jsonResponse({
        message: "No integrations to sync",
        synced: [],
        count: 0,
      });
    }

    const syncedIntegrations = await upsertIntegrations(user.id, integrations);

    // Log activity
    await logActivity(
      "Integrations synced",
      `Synced ${syncedIntegrations.length} integration(s)`,
      { count: syncedIntegrations.length, integrations: syncedIntegrations.map(i => i.name) }
    );

    return jsonResponse({
      message: `Synced ${syncedIntegrations.length} integrations`,
      synced: syncedIntegrations,
      count: syncedIntegrations.length,
    });
  } catch (err) {
    console.error("Error syncing integrations:", err);
    return errorResponse("Failed to sync integrations", 500);
  }
}

/**
 * GET /api/gateway/sync
 * Returns the last sync status
 */
export async function GET() {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  try {
    const gateway = await getUserGateway(user.id);
    
    if (!gateway) {
      return jsonResponse({
        hasGateway: false,
        lastSync: null,
      });
    }

    return jsonResponse({
      hasGateway: true,
      gatewayName: gateway.name,
      gatewayStatus: gateway.status,
      lastSync: gateway.last_ping,
    });
  } catch (err) {
    console.error("Error fetching sync status:", err);
    return errorResponse("Failed to fetch sync status", 500);
  }
}
