/**
 * EventManager — Persistent SSE connection to /api/companion/events
 *
 * Keeps the companion app up-to-date with background task completions and
 * new assistant messages even when no active chat stream is running.
 *
 * Features:
 *  - Connects via SSE (fetch + ReadableStream)
 *  - Auto-reconnects with exponential backoff (2s → 60s)
 *  - Deduplicates messages already seen during an active chat stream
 *  - Emits: 'connected', 'disconnected', 'new_message', 'task_update'
 */

const EventEmitter = require('events');

class EventManager extends EventEmitter {
  constructor({ webAppUrl, authToken }) {
    super();
    // Normalize base URL — strip trailing slash
    this.webAppUrl = (webAppUrl || '').replace(/\/$/, '');
    this.authToken = authToken;

    this.connected = false;
    this.shouldRun = false;
    this.reconnectDelay = 2000;
    this.maxReconnectDelay = 60000;
    this.reconnectTimer = null;
    this.abortController = null;
    this.heartbeatTimer = null;
    this.heartbeatTimeoutMs = 90000; // 90s — if no data in this window, reconnect

    // Track message IDs seen during active chat streaming to avoid duplicates
    // when the Realtime subscription also fires for the same message.
    this.recentMessageIds = new Set();
    this.maxTrackedIds = 200;
  }

  /**
   * Mark a message ID as already seen (e.g., received during active chat stream).
   * Prevents showing a duplicate desktop notification when Realtime fires.
   */
  markSeen(messageId) {
    this.recentMessageIds.add(messageId);
    // Evict oldest entry when cap is exceeded
    if (this.recentMessageIds.size > this.maxTrackedIds) {
      const first = this.recentMessageIds.values().next().value;
      this.recentMessageIds.delete(first);
    }
  }

  /** Begin the event stream connection. */
  start() {
    if (this.shouldRun) return; // already running
    this.shouldRun = true;
    this.reconnectDelay = 2000;
    this._connect();
  }

  /** Stop the event stream and cancel any pending reconnect. */
  stop() {
    this.shouldRun = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.heartbeatTimer) {
      clearTimeout(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.connected = false;
  }

  /** Reset the heartbeat timer — called whenever data arrives. */
  _resetHeartbeat() {
    if (this.heartbeatTimer) clearTimeout(this.heartbeatTimer);
    if (!this.shouldRun) return;
    this.heartbeatTimer = setTimeout(() => {
      console.warn('[EventManager] No data received in', this.heartbeatTimeoutMs, 'ms — forcing reconnect');
      // Abort the current connection to break out of the reader loop
      if (this.abortController) {
        this.abortController.abort();
        this.abortController = null;
      }
      // _connect's catch block + _scheduleReconnect will handle the rest
    }, this.heartbeatTimeoutMs);
  }

  async _connect() {
    if (!this.shouldRun) return;

    this.abortController = new AbortController();
    const url = `${this.webAppUrl}/api/companion/events`;

    try {
      const response = await fetch(url, {
        headers: {
          'X-Companion-Token': this.authToken,
          'Accept': 'text/event-stream',
        },
        signal: this.abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`Event stream HTTP error: ${response.status}`);
      }

      this.connected = true;
      this.reconnectDelay = 2000; // reset backoff on successful connect
      this.emit('connected');
      this._resetHeartbeat(); // start heartbeat watchdog

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        this._resetHeartbeat(); // any data resets the watchdog
        buffer += decoder.decode(value, { stream: true });

        // SSE format: one or more "event: type\ndata: {...}\n\n" blocks
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || ''; // keep incomplete trailing chunk

        for (const part of parts) {
          const lines = part.split('\n');
          let eventType = 'message';
          let data = null;

          for (const line of lines) {
            if (line.startsWith('event: ')) {
              eventType = line.slice(7).trim();
            } else if (line.startsWith('data: ')) {
              try {
                data = JSON.parse(line.slice(6));
              } catch {
                // malformed JSON — skip
              }
            }
          }

          if (data !== null) {
            this._handleEvent(eventType, data);
          }
        }
      }
    } catch (err) {
      if (err.name === 'AbortError' && !this.shouldRun) return; // intentional stop()
      // AbortError with shouldRun=true means heartbeat timeout — fall through to reconnect
      if (err.name !== 'AbortError') {
        console.error('[EventManager] Connection error:', err.message);
      }
    }

    if (this.heartbeatTimer) { clearTimeout(this.heartbeatTimer); this.heartbeatTimer = null; }
    this.connected = false;
    this.emit('disconnected');
    this._scheduleReconnect();
  }

  _scheduleReconnect() {
    if (!this.shouldRun) return;
    console.log(`[EventManager] Reconnecting in ${this.reconnectDelay}ms…`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this._connect();
    }, this.reconnectDelay);
    // Exponential backoff capped at maxReconnectDelay
    this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, this.maxReconnectDelay);
  }

  _handleEvent(type, data) {
    switch (type) {
      case 'new_message':
        // Deduplicate: skip if already seen from the active chat stream
        if (data.id && this.recentMessageIds.has(data.id)) return;
        if (data.id) this.markSeen(data.id);
        this.emit('new_message', data);
        break;

      case 'task_update':
        this.emit('task_update', data);
        break;

      case 'ping':
        // Keep-alive heartbeat — no action needed
        break;

      case 'connected':
        console.log('[EventManager] Server confirmed connection');
        break;

      default:
        console.log('[EventManager] Unknown event type:', type, data);
    }
  }
}

module.exports = EventManager;
