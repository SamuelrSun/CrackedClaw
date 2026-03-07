import { NextRequest } from "next/server";
import { requireApiAuth, jsonResponse, errorResponse } from "@/lib/api-auth";
import { fetchGatewayMemory } from "@/lib/gateway-client";
import { memoryEntries as mockMemoryEntries } from "@/lib/mock-data";
import type { GatewayMemoryResponse, GatewayMemoryEntry } from "@/types/gateway";

// Convert mock entries to gateway format
function toGatewayEntries(entries: typeof mockMemoryEntries): GatewayMemoryEntry[] {
  return entries.map((entry) => ({
    id: entry.id,
    content: entry.content,
    source: 'user' as const,
    category: entry.category,
    createdAt: entry.createdAt,
  }));
}

// GET /api/gateway/memory - Fetch memory from connected OpenClaw gateway
export async function GET(request: NextRequest) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  // Check for gateway configuration
  const { searchParams } = new URL(request.url);
  const gatewayUrl = searchParams.get("url") || process.env.OPENCLAW_GATEWAY_URL;
  const gatewayToken = searchParams.get("token") || process.env.OPENCLAW_GATEWAY_TOKEN;

  // If no gateway configured, return mock data
  if (!gatewayUrl || !gatewayToken) {
    const response: GatewayMemoryResponse = {
      entries: toGatewayEntries(mockMemoryEntries),
      total: mockMemoryEntries.length,
      source: 'mock',
      error: "No gateway configured - showing demo data",
    };
    return jsonResponse(response);
  }

  try {
    const result = await fetchGatewayMemory(gatewayUrl, gatewayToken);

    if (result.error || result.entries.length === 0) {
      // Gateway configured but memory not available - return mock with warning
      const response: GatewayMemoryResponse = {
        entries: toGatewayEntries(mockMemoryEntries),
        total: mockMemoryEntries.length,
        source: 'mock',
        error: result.error || "Memory endpoint not available - showing demo data",
      };
      return jsonResponse(response);
    }

    // Gateway memory fetched successfully
    const response: GatewayMemoryResponse = {
      entries: result.entries,
      total: result.entries.length,
      source: 'live',
    };
    return jsonResponse(response);
  } catch (err) {
    // Unexpected error - return mock
    const response: GatewayMemoryResponse = {
      entries: toGatewayEntries(mockMemoryEntries),
      total: mockMemoryEntries.length,
      source: 'mock',
      error: err instanceof Error ? err.message : "Unknown error",
    };
    return jsonResponse(response);
  }
}
