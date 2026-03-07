import { NextRequest } from "next/server";
import { requireApiAuth, jsonResponse, errorResponse } from "@/lib/api-auth";
import type { GatewayTestResult } from "@/types/gateway";

// POST /api/gateway/test - Test gateway connection
export async function POST(request: NextRequest) {
  const { error } = await requireApiAuth();
  if (error) return error;

  try {
    const body = await request.json();
    const { gateway_url, auth_token } = body;

    // Validate required fields
    if (!gateway_url) {
      return errorResponse("Gateway URL is required", 400);
    }

    if (!auth_token) {
      return errorResponse("Auth token is required", 400);
    }

    // Validate URL format
    let url: URL;
    try {
      url = new URL(gateway_url);
    } catch {
      return errorResponse("Invalid gateway URL format", 400);
    }

    // Ping the gateway to test connection
    const startTime = Date.now();
    
    try {
      // Try the /api/status endpoint (common OpenClaw gateway endpoint)
      const statusUrl = new URL("/api/status", url.origin);
      
      const response = await fetch(statusUrl.toString(), {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${auth_token}`,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      const latencyMs = Date.now() - startTime;

      if (!response.ok) {
        const result: GatewayTestResult = {
          success: false,
          latencyMs,
          error: response.status === 401 
            ? "Invalid auth token" 
            : `Gateway returned ${response.status}`,
        };
        return jsonResponse(result);
      }

      // Try to parse the response for agent info
      let agentName: string | undefined;
      let model: string | undefined;

      try {
        const data = await response.json();
        agentName = data.agent_name || data.name || data.agentName;
        model = data.model || data.default_model || data.defaultModel;
      } catch {
        // Response might not be JSON, that's okay
      }

      const result: GatewayTestResult = {
        success: true,
        latencyMs,
        agentName,
        model,
      };

      return jsonResponse(result);
    } catch (fetchError) {
      const latencyMs = Date.now() - startTime;
      
      const errorMessage = fetchError instanceof Error 
        ? fetchError.message 
        : "Unknown error";
      
      const result: GatewayTestResult = {
        success: false,
        latencyMs,
        error: errorMessage.includes("abort") || errorMessage.includes("timeout")
          ? "Connection timed out"
          : `Unable to reach gateway: ${errorMessage}`,
      };

      return jsonResponse(result);
    }
  } catch (err) {
    console.error("Error testing gateway:", err);
    return errorResponse("Failed to test gateway connection", 500);
  }
}
