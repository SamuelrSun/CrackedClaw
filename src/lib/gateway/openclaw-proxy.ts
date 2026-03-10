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
 * Get the user's OpenClaw instance connection info.
 * Checks: 1) openclaw_instances table (stores provisioned instance data)
 *         2) Falls back to provisioning API
 */
export async function getUserInstance(userId: string): Promise<InstanceInfo | null> {
  // Try openclaw_instances table first
  const { data } = await supabase
    .from('openclaw_instances')
    .select('instance_id, host, port, gateway_token, status')
    .eq('user_id', userId)
    .eq('status', 'running')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (data) {
    return {
      instanceId: data.instance_id,
      host: data.host || process.env.OPENCLAW_SERVER_HOST || '164.92.75.153',
      port: data.port || 18100,
      gatewayToken: data.gateway_token,
    };
  }

  // Try getting org-linked instance via provisioning API
  try {
    const { data: org } = await supabase
      .from('organizations')
      .select('id')
      .eq('owner_id', userId)
      .limit(1)
      .single();

    if (org) {
      const provUrl = process.env.PROVISIONING_API_URL || 'http://164.92.75.153:3456';
      const provKey = process.env.PROVISIONING_API_KEY || '';
      const res = await fetch(provUrl + '/api/instances', {
        headers: provKey ? { 'Authorization': 'Bearer ' + provKey } : {},
      });
      if (res.ok) {
        const instances = await res.json();
        const match = (instances.instances || []).find((i: { organization_id: string; status: string }) =>
          i.organization_id === org.id && i.status === 'running'
        );
        if (match) {
          return {
            instanceId: match.id,
            host: process.env.OPENCLAW_SERVER_HOST || '164.92.75.153',
            port: match.port,
            gatewayToken: match.auth_token,
          };
        }
      }
    }
  } catch (err) {
    console.error('Provisioning API lookup failed:', err);
  }

  return null;
}

/**
 * Build the gateway URL for a user's instance
 */
function getGatewayUrl(instance: InstanceInfo): string {
  // If running on same server, use localhost
  if (instance.host === 'localhost' || instance.host === '127.0.0.1') {
    return `http://localhost:${instance.port}`;
  }
  // Remote instance
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
