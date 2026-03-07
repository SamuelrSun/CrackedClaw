/**
 * Gateway Client for OpenClaw Cloud
 * Centralizes all communication with a user's OpenClaw gateway
 */

import type { 
  GatewayStatusInfo, 
  GatewayMemoryEntry,
  GatewayChatResponse 
} from "@/types/gateway";
import type { Integration, IntegrationType, IntegrationStatus, IntegrationAccount } from "@/types/integration";

const DEFAULT_TIMEOUT = 10000;

interface FetchOptions {
  timeout?: number;
}

/**
 * Raw integration data from OpenClaw gateway
 */
export interface GatewayIntegrationData {
  google?: {
    accounts?: Array<{
      email?: string;
      name?: string;
      scopes?: string[];
      [key: string]: unknown;
    }>;
    [key: string]: unknown;
  };
  slack?: {
    workspaces?: Array<{
      name?: string;
      team_id?: string;
      [key: string]: unknown;
    }>;
    [key: string]: unknown;
  };
  notion?: {
    connections?: Array<{
      workspace_name?: string;
      [key: string]: unknown;
    }>;
    connected?: boolean;
    [key: string]: unknown;
  };
  github?: {
    token?: string;
    username?: string;
    [key: string]: unknown;
  };
  linear?: {
    api_key?: string;
    [key: string]: unknown;
  };
  figma?: {
    token?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/**
 * Fetch status from OpenClaw gateway
 * OpenClaw doesn't have a dedicated /api/status endpoint, so we:
 * 1. First try the root URL (should return HTML if gateway is up)
 * 2. Return a basic "connected" status if reachable
 */
export async function fetchGatewayStatus(
  url: string, 
  token: string,
  options: FetchOptions = {}
): Promise<{ status: GatewayStatusInfo | null; latencyMs: number; error?: string }> {
  const { timeout = DEFAULT_TIMEOUT } = options;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  const startTime = Date.now();
  const baseUrl = url.replace(/\/$/, "");
  
  try {
    // Try a simple HEAD request to the root to check if gateway is up
    const res = await fetch(baseUrl, {
      method: "HEAD",
      headers: {
        "Authorization": `Bearer ${token}`,
      },
      signal: controller.signal,
    });
    
    const latencyMs = Date.now() - startTime;
    clearTimeout(timeoutId);
    
    if (!res.ok && res.status !== 404) {
      return { 
        status: null, 
        latencyMs, 
        error: `Gateway returned ${res.status}: ${res.statusText}` 
      };
    }
    
    // Gateway is reachable - return basic status
    const status: GatewayStatusInfo = {
      agentName: "OpenClaw Agent",
      model: "Claude Sonnet 4",
      uptime: "Running",
      runtime: {
        os: "Linux",
        node: "Unknown",
        shell: "bash",
      },
      capabilities: [],
    };
    
    return { status, latencyMs };
  } catch (err) {
    clearTimeout(timeoutId);
    
    if (err instanceof Error && err.name === "AbortError") {
      return { status: null, latencyMs: timeout, error: "Connection timed out" };
    }
    
    return { 
      status: null, 
      latencyMs: Date.now() - startTime, 
      error: err instanceof Error ? err.message : "Failed to connect" 
    };
  }
}

/**
 * Fetch integrations from OpenClaw gateway
 */
export async function fetchGatewayIntegrations(
  url: string,
  token: string,
  options: FetchOptions = {}
): Promise<{ integrations: Integration[]; raw?: GatewayIntegrationData; error?: string }> {
  // OpenClaw doesn't expose integrations via HTTP API
  // Return empty for now - integrations should be managed via the gateway UI
  return { integrations: [], error: "Integrations sync not available via HTTP" };
}

/**
 * Fetch memory entries from OpenClaw gateway
 */
export async function fetchGatewayMemory(
  url: string, 
  token: string,
  options: FetchOptions = {}
): Promise<{ entries: GatewayMemoryEntry[]; error?: string }> {
  // OpenClaw doesn't expose memory via HTTP API
  return { entries: [], error: "Memory sync not available via HTTP" };
}

/**
 * Send a chat message to OpenClaw gateway using OpenAI-compatible endpoint
 */
export async function sendGatewayMessage(
  url: string, 
  token: string, 
  message: string,
  conversationId?: string | null,
  options: FetchOptions = {}
): Promise<GatewayChatResponse> {
  const { timeout = 60000 } = options;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  const baseUrl = url.replace(/\/$/, "");
  
  try {
    // Use OpenAI-compatible chat completions endpoint
    const chatUrl = `${baseUrl}/v1/chat/completions`;
    
    const res = await fetch(chatUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openclaw:main",
        messages: [{ role: "user", content: message }],
        // Use conversationId as user field for session continuity
        user: conversationId || undefined,
      }),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!res.ok) {
      const errorText = await res.text().catch(() => res.statusText);
      return { 
        id: "", 
        content: "", 
        timestamp: new Date().toISOString(),
        error: `Chat endpoint returned ${res.status}: ${errorText}` 
      };
    }
    
    const data = await res.json();
    
    // Extract response from OpenAI format
    const responseContent = data.choices?.[0]?.message?.content || 
                           data.content || 
                           data.message || 
                           data.response || 
                           "";
    
    return {
      id: data.id || `msg_${Date.now()}`,
      content: responseContent,
      timestamp: new Date().toISOString(),
      conversation_id: conversationId || data.id,
    };
  } catch (err) {
    clearTimeout(timeoutId);
    
    if (err instanceof Error && err.name === "AbortError") {
      return { 
        id: "", 
        content: "", 
        timestamp: new Date().toISOString(),
        error: "Request timed out" 
      };
    }
    
    return { 
      id: "", 
      content: "", 
      timestamp: new Date().toISOString(),
      error: err instanceof Error ? err.message : "Failed to send message" 
    };
  }
}

/**
 * Ping gateway to check connectivity
 */
export async function pingGateway(
  url: string, 
  token: string
): Promise<{ ok: boolean; latencyMs: number }> {
  const startTime = Date.now();
  
  try {
    const result = await fetchGatewayStatus(url, token, { timeout: 5000 });
    return { 
      ok: result.status !== null && !result.error, 
      latencyMs: result.latencyMs 
    };
  } catch {
    return { ok: false, latencyMs: Date.now() - startTime };
  }
}

/**
 * Execute a workflow via OpenClaw gateway
 */
export async function executeWorkflow(
  url: string,
  token: string,
  workflow: { name: string; description: string; config?: Record<string, unknown> },
  options: FetchOptions = {}
): Promise<{ runId: string; status: string; response?: string; error?: string }> {
  const { timeout = 60000 } = options;
  
  try {
    const message = `Run workflow: ${workflow.name}. ${workflow.description}`;
    const response = await sendGatewayMessage(url, token, message, null, { timeout });
    
    if (response.error) {
      return {
        runId: "",
        status: "failed",
        error: response.error,
      };
    }
    
    return {
      runId: response.id || `run_${Date.now()}`,
      status: "completed",
      response: response.content,
    };
  } catch (err) {
    return {
      runId: "",
      status: "failed",
      error: err instanceof Error ? err.message : "Failed to execute workflow",
    };
  }
}
