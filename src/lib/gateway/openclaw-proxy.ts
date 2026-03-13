/**
 * OpenClaw Gateway Proxy
 * Routes chat messages through a user's OpenClaw instance instead of direct Claude API calls.
 * The instance handles tool execution, skills, browser, memory — everything.
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface InstanceInfo {
  instanceId: string;
  host: string;
  port: number;
  gatewayToken: string;
}

/**
 * Get the user's OpenClaw instance connection info from the profiles table.
 */
export async function getUserInstance(userId: string): Promise<InstanceInfo | null> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('instance_id, gateway_url, auth_token, instance_status')
    .eq('id', userId)
    .eq('instance_status', 'running')
    .single();

  if (profile?.gateway_url && profile?.auth_token) {
    // Parse gateway_url to extract host and port
    // gateway_url is like "https://i-f2da86c0.usedopl.com" or "http://164.92.75.153:18100"
    let host: string;
    let port: number;

    try {
      const parsed = new URL(profile.gateway_url);
      host = parsed.hostname;
      port = parsed.port ? parseInt(parsed.port, 10) : (parsed.protocol === 'https:' ? 443 : 80);
    } catch {
      return null;
    }

    return {
      instanceId: profile.instance_id || 'unknown',
      host,
      port,
      gatewayToken: profile.auth_token,
    };
  }

  return null;
}

/**
 * Build the gateway URL for a user's instance.
 * For SSL domains (port 443), use https://host.
 * For local/IP instances, use http://host:port.
 */
function getGatewayUrl(instance: InstanceInfo): string {
  if (instance.port === 443) {
    return `https://${instance.host}`;
  }
  if (instance.host === 'localhost' || instance.host === '127.0.0.1') {
    return `http://localhost:${instance.port}`;
  }
  return `http://${instance.host}:${instance.port}`;
}

export interface ProxyStreamOptions {
  userId: string;
  messages: Array<{ role: string; content: string }>;
  model?: string;
  systemPrompt?: string;
  onToken?: (text: string) => void;
  onDone?: (fullContent: string) => void;
  onError?: (error: string) => void;
}

/**
 * Stream chat through the user's OpenClaw gateway instance.
 * Uses OpenAI-compatible /v1/chat/completions endpoint with streaming.
 */
export async function* streamThroughGateway(
  options: ProxyStreamOptions,
): AsyncGenerator<{ type: 'token'; text: string } | { type: 'done'; content: string } | { type: 'error'; message: string }> {
  const instance = await getUserInstance(options.userId);
  if (!instance) {
    yield { type: 'error', message: 'No active OpenClaw instance found. Please set up your agent instance.' };
    return;
  }

  const url = getGatewayUrl(instance) + '/v1/chat/completions';

  // Build messages array with optional system prompt
  const messages = [];
  if (options.systemPrompt) {
    messages.push({ role: 'system', content: options.systemPrompt });
  }
  messages.push(...options.messages);

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + instance.gatewayToken,
      },
      body: JSON.stringify({
        messages,
        model: options.model || 'claude-sonnet-4',
        stream: true,
      }),
    });
  } catch (err) {
    yield { type: 'error', message: 'Failed to connect to OpenClaw instance: ' + String(err) };
    return;
  }

  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    yield { type: 'error', message: 'Gateway returned ' + response.status + ': ' + text };
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    yield { type: 'error', message: 'No response body from gateway' };
    return;
  }

  const decoder = new TextDecoder();
  let fullContent = '';
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;

        const data = trimmed.slice(6);
        if (data === '[DONE]') {
          yield { type: 'done', content: fullContent };
          return;
        }

        try {
          const chunk = JSON.parse(data);
          const delta = chunk.choices?.[0]?.delta;
          if (delta?.content) {
            fullContent += delta.content;
            yield { type: 'token', text: delta.content };
          }
        } catch {
          // Skip unparseable chunks
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  if (fullContent) {
    yield { type: 'done', content: fullContent };
  }
}

/**
 * Non-streaming chat through gateway (for simple tool calls)
 */
export async function chatThroughGateway(
  userId: string,
  messages: Array<{ role: string; content: string }>,
  systemPrompt?: string,
): Promise<{ content: string; error?: string }> {
  const instance = await getUserInstance(userId);
  if (!instance) return { content: '', error: 'No active instance' };

  const url = getGatewayUrl(instance) + '/v1/chat/completions';
  const allMessages = [];
  if (systemPrompt) allMessages.push({ role: 'system', content: systemPrompt });
  allMessages.push(...messages);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + instance.gatewayToken,
      },
      body: JSON.stringify({
        messages: allMessages,
        model: 'claude-sonnet-4',
        stream: false,
      }),
    });

    if (!res.ok) {
      return { content: '', error: 'Gateway error: ' + res.status };
    }

    const data = await res.json();
    return { content: data.choices?.[0]?.message?.content || '' };
  } catch (err) {
    return { content: '', error: String(err) };
  }
}
