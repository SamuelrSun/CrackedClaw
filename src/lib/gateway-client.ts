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
  options: FetchOptions & { systemPrompt?: string } = {}
): Promise<GatewayChatResponse> {
  const { timeout = 60000, systemPrompt } = options;
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
        messages: systemPrompt
          ? [
              { role: "system", content: systemPrompt },
              { role: "user", content: message },
            ]
          : [{ role: "user", content: message }],
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

export interface StreamChunk {
  type: "token" | "tool_start" | "tool_end" | "thinking" | "done" | "error";
  text?: string;
  tool?: string;
  input?: Record<string, unknown>;
  result?: string;
  conversation_id?: string;
  message?: string;
}

/**
 * Stream a chat message to OpenClaw gateway using OpenAI-compatible endpoint
 */
export async function streamGatewayMessage(
  url: string,
  token: string,
  message: string,
  conversationId?: string | null,
  onChunk?: (chunk: StreamChunk) => void,
  options: FetchOptions & { systemPrompt?: string } = {}
): Promise<{ fullContent: string; error?: string }> {
  const { timeout = 120000, systemPrompt } = options;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  const baseUrl = url.replace(/\/$/, "");

  try {
    const chatUrl = `${baseUrl}/v1/chat/completions`;

    const res = await fetch(chatUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify({
        model: "openclaw:main",
        messages: systemPrompt
          ? [
              { role: "system", content: systemPrompt },
              { role: "user", content: message },
            ]
          : [{ role: "user", content: message }],
        stream: true,
        user: conversationId || undefined,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const errorText = await res.text().catch(() => res.statusText);
      const errMsg = `Chat endpoint returned ${res.status}: ${errorText}`;
      onChunk?.({ type: "error", message: errMsg });
      return { fullContent: "", error: errMsg };
    }

    // If server doesn't stream (returns JSON), handle gracefully
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("text/event-stream") && !contentType.includes("text/plain")) {
      const data = await res.json();
      const content =
        data.choices?.[0]?.message?.content ||
        data.content ||
        data.message ||
        data.response ||
        "";
      onChunk?.({ type: "token", text: content });
      onChunk?.({ type: "done", conversation_id: conversationId || data.id });
      return { fullContent: content };
    }

    const reader = res.body?.getReader();
    if (!reader) {
      return { fullContent: "", error: "No response body" };
    }

    const decoder = new TextDecoder();
    let fullContent = "";
    let buf = "";
    let currentToolName: string | null = null;

    const processLine = (line: string) => {
      if (line.startsWith(":") || !line.trim()) return;
      const dataPrefix = "data: ";
      if (!line.startsWith(dataPrefix)) return;
      const jsonStr = line.slice(dataPrefix.length).trim();
      if (jsonStr === "[DONE]") {
        onChunk?.({ type: "done", conversation_id: conversationId || undefined });
        return;
      }
      let parsed: Record<string, unknown>;
      try { parsed = JSON.parse(jsonStr); } catch { return; }
      const evtType = parsed.type as string | undefined;

      // Anthropic streaming format
      if (evtType === "content_block_start") {
        const block = parsed.content_block as Record<string, unknown> | undefined;
        if (block?.type === "tool_use") {
          currentToolName = (block.name as string) || "unknown";
          const input = (block.input as Record<string, unknown>) || {};
          onChunk?.({ type: "tool_start", tool: currentToolName, input });
        }
        return;
      }
      if (evtType === "content_block_delta") {
        const delta = parsed.delta as Record<string, unknown> | undefined;
        if (delta?.type === "text_delta") {
          const text = (delta.text as string) || "";
          fullContent += text;
          onChunk?.({ type: "token", text });
        } else if (delta?.type === "thinking_delta") {
          onChunk?.({ type: "thinking", text: (delta.thinking as string) || "" });
        }
        return;
      }
      if (evtType === "content_block_stop") {
        if (currentToolName) {
          onChunk?.({ type: "tool_end", tool: currentToolName, result: "done" });
          currentToolName = null;
        }
        return;
      }
      if (evtType === "message_stop" || evtType === "message_delta") return;

      // OpenAI streaming format
      const choices = parsed.choices as Array<Record<string, unknown>> | undefined;
      if (choices && choices.length > 0) {
        const delta = choices[0].delta as Record<string, unknown> | undefined;
        if (delta) {
          const text = delta.content as string | undefined;
          if (text) { fullContent += text; onChunk?.({ type: "token", text }); }
          const toolCalls = delta.tool_calls as Array<Record<string, unknown>> | undefined;
          if (toolCalls?.length) {
            const fn = toolCalls[0].function as Record<string, unknown> | undefined;
            if (fn?.name) {
              currentToolName = fn.name as string;
              let input: Record<string, unknown> = {};
              try { input = JSON.parse((fn.arguments as string) || "{}"); } catch { /* partial */ }
              onChunk?.({ type: "tool_start", tool: currentToolName, input });
            }
          }
        }
        const fin = choices[0].finish_reason as string | undefined;
        if (fin === "tool_calls" && currentToolName) {
          onChunk?.({ type: "tool_end", tool: currentToolName, result: "done" });
          currentToolName = null;
        }
        if (fin === "stop") onChunk?.({ type: "done", conversation_id: conversationId || undefined });
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        if (buf.trim()) processLine(buf);
        onChunk?.({ type: "done", conversation_id: conversationId || undefined });
        break;
      }
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() || "";
      for (const line of lines) processLine(line);
    }
    return { fullContent };
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === "AbortError") {
      const msg = "Request timed out";
      onChunk?.({ type: "error", message: msg });
      return { fullContent: "", error: msg };
    }
    const msg = err instanceof Error ? err.message : "Failed to send message";
    onChunk?.({ type: "error", message: msg });
    return { fullContent: "", error: msg };
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
