/**
 * ChatManager — handles all chat API interactions for the companion app.
 *
 * Persistence: calls the web app's /api/companion/* endpoints
 * (authenticated via X-Companion-Token: authToken).
 *
 * Streaming: routes through the web app's /api/gateway/chat/stream SSE endpoint
 * (same pipeline as the web app — includes billing, memory, workflows).
 */
class ChatManager {
  constructor({ gatewayUrl, authToken, webAppUrl }) {
    this.gatewayUrl = (gatewayUrl || '').replace(/\/$/, '');
    this.authToken = authToken;
    // Normalize: strip trailing slash. Fetch follows redirects by default,
    // but POST→307→POST can lose the body in some runtimes, so we proactively
    // resolve the final URL on first request via _resolveBaseUrl().
    this.webAppUrl = (webAppUrl || 'https://usedopl.com').replace(/\/$/, '');
    this._resolvedBaseUrl = null; // cached after first resolution
  }

  /**
   * Resolve the actual base URL by following any redirects on a HEAD request.
   * Caches the result so subsequent calls are instant.
   * e.g., https://usedopl.com → 307 → https://www.usedopl.com
   */
  async _resolveBaseUrl() {
    if (this._resolvedBaseUrl) return this._resolvedBaseUrl;
    try {
      const res = await fetch(`${this.webAppUrl}/api/companion/conversations`, {
        method: 'HEAD',
        headers: this._apiHeaders,
        redirect: 'follow',
      });
      // Extract the origin from the final URL after redirects
      const finalUrl = res.url;
      if (finalUrl) {
        const parsed = new URL(finalUrl);
        this._resolvedBaseUrl = `${parsed.protocol}//${parsed.host}`;
        if (this._resolvedBaseUrl !== this.webAppUrl) {
          console.log(`[ChatManager] Resolved base URL: ${this.webAppUrl} → ${this._resolvedBaseUrl}`);
        }
      } else {
        this._resolvedBaseUrl = this.webAppUrl;
      }
    } catch {
      // If HEAD fails, just use the original URL — fetch will follow redirects
      this._resolvedBaseUrl = this.webAppUrl;
    }
    return this._resolvedBaseUrl;
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
    const baseUrl = await this._resolveBaseUrl();
    const res = await fetch(`${baseUrl}/api/companion/conversations`, {
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
    const baseUrl = await this._resolveBaseUrl();
    const url = `${baseUrl}/api/companion/conversations`;
    console.log('[ChatManager] createConversation →', url);
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
    const baseUrl = await this._resolveBaseUrl();
    const res = await fetch(
      `${baseUrl}/api/companion/conversations/${conversationId}/messages`,
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
    const baseUrl = await this._resolveBaseUrl();
    const res = await fetch(
      `${baseUrl}/api/companion/conversations/${conversationId}/messages`,
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
   *
   * @param {string} conversationId
   * @param {string} userContent
   * @param {(chunk: string) => void} onChunk - called with each streamed text delta
   * @returns {Promise<string>} the full assistant response
   */
  async sendMessage(conversationId, userContent, onChunk) {
    return await this._sendViaWebApp(conversationId, userContent, onChunk);
  }

  /**
   * Abort the currently streaming message, if any.
   */
  abortMessage() {
    if (this._activeController) {
      this._activeController.abort();
      this._activeController = null;
    }
  }

  /**
   * Route the message through the Dopl web app's /api/gateway/chat/stream endpoint.
   * This gives the full Dopl system prompt, workflow matching, memory, etc.
   */
  async _sendViaWebApp(conversationId, userContent, onChunk) {
    const controller = new AbortController();
    this._activeController = controller;
    const timeoutId = setTimeout(() => controller.abort(), 120_000);

    const baseUrl = await this._resolveBaseUrl();
    const response = await fetch(`${baseUrl}/api/gateway/chat/stream`, {
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
      // Surface billing errors with structured data so callers can handle them
      // 402 = insufficient balance (PAYGO), 429 = legacy usage limit
      if (response.status === 402 || response.status === 429) {
        try {
          const errData = JSON.parse(text);
          // Normalize both old and new error formats
          const reason = errData.reason || errData.error || 'Insufficient balance';
          const err = new Error(`billing_error: ${reason}`);
          err.billingData = {
            type: response.status === 402 ? 'insufficient_balance' : 'usage_limit',
            balance: errData.balance ?? null,
            required: errData.required ?? null,
            reason: errData.reason || errData.error || 'Usage limit reached',
            nextResetLabel: errData.nextResetLabel || null,
            topUpUrl: errData.topUpUrl || null,
          };
          throw err;
        } catch (parseErr) {
          if (parseErr.billingData) throw parseErr;
        }
      }
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
      if (this._activeController === controller) {
        this._activeController = null;
      }
    }

    // Server handles persistence — no need to save messages here
    return fullContent;
  }

  // Legacy _sendViaGateway removed — gateway doesn't expose /v1/chat/completions.
  // All chat goes through the web app's SSE endpoint which has full Dopl context,
  // billing, memory, and workflow matching.
}

module.exports = ChatManager;
