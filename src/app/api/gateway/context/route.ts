import { requireApiAuth, jsonResponse } from "@/lib/api-auth";
import { getUserInstance } from "@/lib/gateway/openclaw-proxy";

export const dynamic = "force-dynamic";

/**
 * GET /api/gateway/context
 * Returns context window usage for the user's active gateway session.
 * Queries the gateway's sessions.list via its HTTP protocol.
 */
export async function GET() {
  const { user, error } = await requireApiAuth();
  if (error || !user) return jsonResponse({ error: "Unauthorized" }, 401);

  const instance = await getUserInstance(user.id);
  if (!instance) {
    return jsonResponse({ error: "No active instance" }, 400);
  }

  const gatewayBaseUrl = instance.port === 443
    ? `https://${instance.host}`
    : `http://${instance.host}:${instance.port}`;

  try {
    // Query the gateway's WS-over-HTTP protocol for session list
    const res = await fetch(`${gatewayBaseUrl}/api/sessions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${instance.gatewayToken}`,
      },
      body: JSON.stringify({
        type: "req",
        id: "ctx-1",
        method: "sessions.list",
        params: { activeMinutes: 120 },
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      // Fallback: try the health endpoint for basic info
      const healthRes = await fetch(`${gatewayBaseUrl}/health`, {
        signal: AbortSignal.timeout(3000),
      });
      if (healthRes.ok) {
        const health = await healthRes.json();
        return jsonResponse({
          available: true,
          context: null,
          health,
        });
      }
      return jsonResponse({ error: "Gateway unreachable" }, 502);
    }

    const data = await res.json();
    
    // Extract session context data
    // The sessions.list response contains session entries with token info
    const sessions = data?.payload?.sessions ?? data?.sessions ?? (Array.isArray(data) ? data : []);
    
    // Find the main/webchat session
    const mainSession = sessions.find((s: Record<string, unknown>) => {
      const key = (s.key || s.sessionKey || "") as string;
      return key.includes("webchat") || key.includes("main");
    }) || sessions[0];

    if (!mainSession) {
      return jsonResponse({
        available: true,
        contextTokens: 200000,
        totalTokens: 0,
        percentage: 0,
        compactions: 0,
      });
    }

    const contextTokens = (mainSession.contextTokens as number) || 200000;
    const totalTokens = (mainSession.totalTokens as number) || 0;
    const inputTokens = (mainSession.inputTokens as number) || 0;
    const outputTokens = (mainSession.outputTokens as number) || 0;
    const compactions = (mainSession.compactions as number) || 0;
    const percentage = contextTokens > 0 ? Math.round((totalTokens / contextTokens) * 100) : 0;

    return jsonResponse({
      available: true,
      contextTokens,
      totalTokens,
      inputTokens,
      outputTokens,
      percentage,
      compactions,
    });
  } catch (err) {
    // If gateway query fails, return a graceful fallback
    return jsonResponse({
      available: false,
      error: String(err),
    });
  }
}
