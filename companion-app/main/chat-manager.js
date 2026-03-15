/**
 * ChatManager — handles all chat API interactions for the companion app.
 *
 * Persistence: calls the web app's /api/companion/* endpoints
 * (authenticated via X-Companion-Token: authToken).
 *
 * Streaming: calls the gateway's /v1/chat/completions directly
 * (bypasses Vercel; authenticated via Authorization: Bearer authToken).
 */
class ChatManager {
  constructor({ gatewayUrl, authToken, webAppUrl }) {
    this.gatewayUrl = (gatewayUrl || '').replace(/\/$/, '');
    this.authToken = authToken;
    // Normalize: always use www.usedopl.com (non-www returns 307 redirects
    // which break Node.js fetch for POST requests)
    let normalizedUrl = (webAppUrl || 'https://www.usedopl.com').replace(/\/$/, '');
    normalizedUrl = normalizedUrl.replace('://usedopl.com', '://www.usedopl.com');
    this.webAppUrl = normalizedUrl;
  }

  /** Headers for web app persistence API calls */
  get _apiHeaders() {
    return {
      'Content-Type': 'application/json',
      'X-Companion-Token': this.authToken,
    };
  }

  // ─── Conversation CRUD ──────────────────────────────────────────────────────

  async listConversations() {
    const res = await fetch(`${this.webAppUrl}/api/companion/conversations`, {
      headers: this._apiHeaders,
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`listConversations HTTP ${res.status}: ${txt}`);
    }
    const data = await res.json();
    return data.conversations || [];
  }

  async createConversation(title = 'New Chat') {
    const url = `${this.webAppUrl}/api/companion/conversations`;
    console.log('[ChatManager] createConversation →', url, '| webAppUrl:', this.webAppUrl);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: this._apiHeaders,
        body: JSON.stringify({ title }),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(`createConversation HTTP ${res.status}: ${txt}`);
      }
      return res.json();
    } catch (err) {
      console.error('[ChatManager] createConversation FAILED:', err.message, '| url:', url);
      throw err;
    }
  }

  async loadMessages(conversationId) {
    const res = await fetch(
      `${this.webAppUrl}/api/companion/conversations/${conversationId}/messages`,
      { headers: this._apiHeaders }
    );
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`loadMessages HTTP ${res.status}: ${txt}`);
    }
    const data = await res.json();
    return data.messages || [];
  }

  async saveMessage(conversationId, role, content) {
    const res = await fetch(
      `${this.webAppUrl}/api/companion/conversations/${conversationId}/messages`,
      {
        method: 'POST',
        headers: this._apiHeaders,
        body: JSON.stringify({ role, content }),
      }
    );
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`saveMessage HTTP ${res.status}: ${txt}`);
    }
    return res.json();
  }

  // ─── Streaming Chat ─────────────────────────────────────────────────────────

  /**
   * Send a message, stream the response via the Dopl web app's SSE endpoint.
   * Falls back to direct gateway call if the web app endpoint is unavailable.
   *
   * @param {string} conversationId
   * @param {string} userContent
   * @param {(chunk: string) => void} onChunk - called with each streamed text delta
   * @returns {Promise<string>} the full assistant response
   */
  async sendMessage(conversationId, userContent, onChunk) {
    // Try the web app's SSE endpoint first (preferred — has full Dopl context)
    try {
      return await this._sendViaWebApp(conversationId, userContent, onChunk);
    } catch (err) {
      console.warn('[ChatManager] Web app stream failed, falling back to direct gateway:', err.message);
    }

    // Fallback: direct gateway call (legacy path)
    return await this._sendViaGateway(conversationId, userContent, onChunk);
  }

  /**
   * Route the message through the Dopl web app's /api/gateway/chat/stream endpoint.
   * This gives the full Dopl system prompt, workflow matching, memory, etc.
   */
  async _sendViaWebApp(conversationId, userContent, onChunk) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120_000);

    const response = await fetch(`${this.webAppUrl}/api/gateway/chat/stream`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'X-Companion-Token': this.authToken,
      },
      body: JSON.stringify({
        message: userContent,
        conversation_id: conversationId,
        model: 'sonnet',
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Web app stream error ${response.status}: ${text}`);
    }

    if (!response.body) {
      throw new Error('Web app returned no response body');
    }

    // Parse the Dopl SSE format: data: {"type":"token","text":"..."}\n\n
    const reader = response.body.getReader();
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
          if (!trimmed.startsWith('data: ')) continue;

          const data = trimmed.slice(6).trim();
          if (data === '[DONE]') break;

          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'token' && parsed.text) {
              fullContent += parsed.text;
              onChunk(parsed.text);
            } else if (parsed.type === 'done') {
              // Stream complete — server has already persisted the messages
              break;
            } else if (parsed.type === 'error') {
              throw new Error(`Stream error: ${parsed.message}`);
            }
          } catch (parseErr) {
            // Re-throw structured errors, ignore malformed chunks
            if (parseErr.message && parseErr.message.startsWith('Stream error:')) throw parseErr;
          }
        }
      }
    } finally {
      clearTimeout(timeoutId);
      reader.releaseLock();
    }

    // Server handles persistence — no need to save messages here
    return fullContent;
  }

  /**
   * Legacy fallback: call the gateway's /v1/chat/completions directly.
   * Used when the web app SSE endpoint is unreachable (e.g. offline).
   */
  async _sendViaGateway(conversationId, userContent, onChunk) {
    // 1. Load history for context
    let history = [];
    try {
      history = await this.loadMessages(conversationId);
    } catch (err) {
      console.warn('[ChatManager] Could not load history:', err.message);
    }

    // 2. Save the user message first
    try {
      await this.saveMessage(conversationId, 'user', userContent);
    } catch (err) {
      console.warn('[ChatManager] Could not save user message:', err.message);
    }

    // 3. Build messages array for the gateway (system + history + new message)
    const messages = [
      {
        role: 'system',
        content:
          'You are a helpful AI assistant running as part of Dopl. ' +
          'Be concise, accurate, and friendly. ' +
          'Today\'s date is ' + new Date().toLocaleDateString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
          }) + '.',
      },
      // Include up to the last 40 history messages to avoid context overflow
      ...history.slice(-40).map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: userContent },
    ];

    // 4. Stream from gateway (with 2-minute abort timeout)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120_000);

    const response = await fetch(`${this.gatewayUrl}/v1/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.authToken}`,
      },
      body: JSON.stringify({
        model: 'default',
        messages,
        stream: true,
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Gateway error ${response.status}: ${text}`);
    }

    if (!response.body) {
      throw new Error('Gateway returned no response body');
    }

    // 5. Parse OpenAI SSE stream
    const reader = response.body.getReader();
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
          if (!trimmed.startsWith('data: ')) continue;

          const data = trimmed.slice(6).trim();
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              fullContent += delta;
              onChunk(delta);
            }
          } catch (_) {
            // Ignore malformed SSE chunks
          }
        }
      }
    } finally {
      clearTimeout(timeoutId);
      reader.releaseLock();
    }

    // 6. Save assistant response
    if (fullContent) {
      try {
        await this.saveMessage(conversationId, 'assistant', fullContent);
      } catch (err) {
        console.warn('[ChatManager] Could not save assistant message:', err.message);
      }
    }

    return fullContent;
  }
}

module.exports = ChatManager;
