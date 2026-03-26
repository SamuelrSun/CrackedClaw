/**
 * Maton API Gateway Proxy — route API calls through Maton's managed OAuth gateway.
 * 
 * Usage:
 *   const response = await matonApiCall(apiKey, 'slack', 'api/chat.postMessage', {
 *     method: 'POST',
 *     body: JSON.stringify({ channel: 'C0123456', text: 'Hello!' }),
 *   });
 * 
 * The gateway auto-injects the user's OAuth token for the target service.
 * Docs: https://gateway.maton.ai/{app}/{native-api-path}
 */

const GATEWAY_BASE = 'https://gateway.maton.ai';

export interface MatonProxyOptions {
  method?: string;
  body?: string | FormData;
  headers?: Record<string, string>;
  connectionId?: string;  // Specify which connection if user has multiple for same app
  timeoutMs?: number;
}

export interface MatonProxyResponse {
  ok: boolean;
  status: number;
  data: unknown;
  headers: Record<string, string>;
}

/**
 * Make an API call through Maton's gateway.
 * 
 * @param apiKey     User's Maton API key
 * @param app        Maton app name (e.g., "slack", "google-mail", "notion")
 * @param path       Native API path (e.g., "api/chat.postMessage", "gmail/v1/users/me/messages")
 * @param options    Request options
 * @returns          Proxy response with parsed data
 */
export async function matonApiCall(
  apiKey: string,
  app: string,
  path: string,
  options: MatonProxyOptions = {},
): Promise<MatonProxyResponse> {
  const { method = 'GET', body, headers: extraHeaders, connectionId, timeoutMs = 30_000 } = options;

  // Build URL: gateway.maton.ai/{app}/{native-api-path}
  const url = `${GATEWAY_BASE}/${encodeURIComponent(app)}/${path}`;

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${apiKey}`,
    ...extraHeaders,
  };

  // Set Content-Type for JSON bodies if not already set
  if (body && typeof body === 'string' && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  // Specify connection if multiple exist for same app
  if (connectionId) {
    headers['Maton-Connection'] = connectionId;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body || undefined,
    signal: AbortSignal.timeout(timeoutMs),
  });

  // Parse response
  const contentType = res.headers.get('content-type') || '';
  let data: unknown;
  if (contentType.includes('json')) {
    data = await res.json();
  } else {
    data = await res.text();
  }

  // Collect response headers
  const responseHeaders: Record<string, string> = {};
  res.headers.forEach((value, key) => {
    responseHeaders[key] = value;
  });

  return {
    ok: res.ok,
    status: res.status,
    data,
    headers: responseHeaders,
  };
}

/**
 * Helper: List Slack channels via Maton
 */
export async function matonSlackChannels(apiKey: string, connectionId?: string) {
  return matonApiCall(apiKey, 'slack', 'api/conversations.list', { connectionId });
}

/**
 * Helper: Send Slack message via Maton
 */
export async function matonSlackMessage(apiKey: string, channel: string, text: string, connectionId?: string) {
  return matonApiCall(apiKey, 'slack', 'api/chat.postMessage', {
    method: 'POST',
    body: JSON.stringify({ channel, text }),
    connectionId,
  });
}

/**
 * Helper: List Gmail messages via Maton
 */
export async function matonGmailMessages(apiKey: string, query?: string, connectionId?: string) {
  const params = query ? `?q=${encodeURIComponent(query)}` : '';
  return matonApiCall(apiKey, 'google-mail', `gmail/v1/users/me/messages${params}`, { connectionId });
}

/**
 * Helper: List Google Calendar events via Maton
 */
export async function matonCalendarEvents(apiKey: string, calendarId = 'primary', connectionId?: string) {
  const now = new Date().toISOString();
  return matonApiCall(
    apiKey,
    'google-calendar',
    `calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?timeMin=${now}&maxResults=10&singleEvents=true&orderBy=startTime`,
    { connectionId },
  );
}
