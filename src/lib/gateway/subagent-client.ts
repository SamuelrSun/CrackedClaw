export interface SubagentInfo {
  id: string;
  label?: string;
  status: string;
  runtime?: string;
  model?: string;
  createdAt?: string;
  depth?: number;
}

async function gatewayFetch(
  gatewayUrl: string,
  authToken: string,
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const base = gatewayUrl.replace(/\/$/, '');
  return fetch(`${base}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
}

/**
 * List active subagents on a gateway instance.
 * Tries /api/sessions?active=true first, falls back to /v1/sessions.
 */
export async function listSubagents(
  gatewayUrl: string,
  authToken: string
): Promise<SubagentInfo[]> {
  let res = await gatewayFetch(gatewayUrl, authToken, '/api/sessions?active=true');
  if (!res.ok) {
    res = await gatewayFetch(gatewayUrl, authToken, '/v1/sessions');
  }
  if (!res.ok) {
    throw new Error(`Gateway returned ${res.status} when listing sessions`);
  }
  const data = await res.json();
  const sessions: SubagentInfo[] = Array.isArray(data)
    ? data
    : Array.isArray(data?.sessions)
    ? data.sessions
    : [];

  // Filter to only subagent sessions (depth > 0 or label contains "subagent")
  return sessions.filter(s =>
    (s.depth && s.depth > 0) ||
    (s.label && s.label.toLowerCase().includes('subagent')) ||
    (s.id && s.id.toLowerCase().includes('subagent'))
  ).map(s => ({
    id: s.id,
    label: s.label,
    status: s.status || 'unknown',
    runtime: s.runtime,
    model: s.model,
    createdAt: s.createdAt,
    depth: s.depth,
  }));
}

/**
 * Get recent messages from a subagent session.
 */
export async function getSubagentHistory(
  gatewayUrl: string,
  authToken: string,
  sessionId: string,
  limit = 20
): Promise<{ role: string; content: string; timestamp?: string }[]> {
  const res = await gatewayFetch(
    gatewayUrl,
    authToken,
    `/api/sessions/${encodeURIComponent(sessionId)}/messages?limit=${limit}`
  );
  if (!res.ok) {
    throw new Error(`Gateway returned ${res.status} fetching session history`);
  }
  const data = await res.json();
  return Array.isArray(data) ? data : data?.messages ?? [];
}

/**
 * Kill/stop a subagent session.
 */
export async function killSubagent(
  gatewayUrl: string,
  authToken: string,
  sessionId: string
): Promise<{ success: boolean }> {
  const res = await gatewayFetch(
    gatewayUrl,
    authToken,
    `/api/sessions/${encodeURIComponent(sessionId)}`,
    { method: 'DELETE' }
  );
  return { success: res.ok };
}
