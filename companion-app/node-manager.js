const { spawn, execSync } = require('child_process');
const EventEmitter = require('events');
const https = require('https');
const http = require('http');
const crypto = require('crypto');
const os = require('os');
const WebSocket = require('ws');

const RECONNECT_DELAY_MS = 5000;
// How long to poll for pending pairing requests before giving up
const APPROVE_POLL_ATTEMPTS = 15;
const APPROVE_POLL_DELAY_MS = 2000;
// Timeout for each WebSocket approve attempt
const WS_ATTEMPT_TIMEOUT_MS = 12000;

class NodeManager extends EventEmitter {
  constructor({ gatewayUrl, instanceId, authToken, operatorToken }) {
    super();
    this.gatewayUrl = gatewayUrl;
    this.instanceId = instanceId;
    this.authToken = authToken;
    // operatorToken is the device token for the bootstrapped operator device.
    // Falls back to authToken (the gateway shared-secret token).
    this.operatorToken = operatorToken || authToken;
    this.connected = false;
    this.lastError = null;
    this.process = null;
    this.shouldRun = false;
    this.reconnectTimer = null;
    // Generate a stable device ID for this installation
    this.deviceId = 'companion-' + crypto.randomBytes(8).toString('hex');
  }

  async start() {
    this.shouldRun = true;
    await this.ensureCLI();
    this.spawnNode();
  }

  stop() {
    this.shouldRun = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.process) {
      this.process.kill('SIGTERM');
      this.process = null;
    }
    this.setConnected(false);
  }

  async ensureCLI() {
    try {
      execSync('which openclaw', { stdio: 'ignore' });
    } catch (_) {
      try {
        execSync('npm install -g openclaw', { stdio: 'pipe', timeout: 60000 });
      } catch (err) {
        throw new Error('Failed to install openclaw CLI: ' + err.message);
      }
    }
  }

  /**
   * Parse the gateway URL to extract host, port, and whether to use TLS.
   * gatewayUrl looks like: https://i-abc123.crackedclaw.com
   */
  parseGatewayUrl() {
    try {
      const parsed = new URL(this.gatewayUrl);
      const tls = parsed.protocol === 'https:' || parsed.protocol === 'wss:';
      const host = parsed.hostname;
      const port = parsed.port
        ? parseInt(parsed.port, 10)
        : tls ? 443 : 80;
      return { host, port, tls };
    } catch (_) {
      // Fallback: treat as hostname only
      return { host: this.gatewayUrl, port: 18789, tls: false };
    }
  }

  /**
   * Spawn `openclaw node run` with the correct flags.
   *
   * openclaw node run uses:
   *   --host <gateway-host>
   *   --port <port>
   *   --tls  (if HTTPS/WSS)
   *   OPENCLAW_GATEWAY_TOKEN env var for auth
   */
  spawnNode() {
    if (!this.shouldRun) return;

    const { host, port, tls } = this.parseGatewayUrl();
    const displayName = os.hostname() + ' (CrackedClaw Companion)';

    const args = [
      'node', 'run',
      '--host', host,
      '--port', String(port),
      '--display-name', displayName,
    ];
    if (tls) args.push('--tls');

    this.process = spawn('openclaw', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        // Auth via env var — openclaw node run resolves token from OPENCLAW_GATEWAY_TOKEN
        OPENCLAW_GATEWAY_TOKEN: this.authToken,
      },
    });

    this.process.stdout.on('data', (data) => {
      const line = data.toString().trim();
      console.log('[openclaw node]', line);
      if (line.toLowerCase().includes('connected') || line.toLowerCase().includes('ready')) {
        this.setConnected(true);
      }
    });

    this.process.stderr.on('data', (data) => {
      const line = data.toString().trim();
      console.error('[openclaw node stderr]', line);
      this.lastError = line;
    });

    this.process.on('close', (code) => {
      this.process = null;
      this.setConnected(false);

      if (this.shouldRun) {
        this.lastError = `Process exited with code ${code}, reconnecting...`;
        this.emit('status', false);
        this.reconnectTimer = setTimeout(() => this.spawnNode(), RECONNECT_DELAY_MS);
      }
    });

    this.process.on('error', (err) => {
      this.lastError = err.message;
      this.process = null;
      this.setConnected(false);

      if (this.shouldRun) {
        this.reconnectTimer = setTimeout(() => this.spawnNode(), RECONNECT_DELAY_MS);
      }
    });

    // After spawning the node process, poll via WebSocket to auto-approve its pairing request.
    this.approveViaWebSocket().catch((err) => {
      console.warn('[NodeManager] auto-approve failed:', err.message);
    });
  }

  // ---------------------------------------------------------------------------
  // WebSocket-based auto-approve (Option B)
  //
  // OpenClaw's gateway does NOT expose REST endpoints for node pairing.
  // Pairing is managed via WebSocket JSON-RPC methods:
  //   - node.pair.list   → list pending pairing requests
  //   - node.pair.approve → approve a pending request by requestId
  //
  // This method opens a short-lived operator WebSocket connection to the gateway,
  // polls for the node's pending pairing request, approves it, and disconnects.
  // ---------------------------------------------------------------------------

  /**
   * Poll the gateway via WebSocket for pending node pairing requests and approve them.
   * Retries APPROVE_POLL_ATTEMPTS times with APPROVE_POLL_DELAY_MS between each.
   */
  async approveViaWebSocket() {
    console.log('[NodeManager] Starting WebSocket auto-approve for node pairing...');

    for (let attempt = 0; attempt < APPROVE_POLL_ATTEMPTS; attempt++) {
      if (!this.shouldRun) return;

      // Give the node process time to connect and register with the gateway
      await new Promise((r) => setTimeout(r, APPROVE_POLL_DELAY_MS));

      if (!this.shouldRun) return;

      try {
        const result = await this._wsApproveAttempt();

        if (result.approved) {
          console.log(`[NodeManager] Node pairing auto-approved successfully (attempt ${attempt + 1})`);
          this.setConnected(true);
          return;
        }

        if (result.alreadyPaired) {
          console.log('[NodeManager] Node is already paired — no approval needed');
          this.setConnected(true);
          return;
        }

        if (result.noPending) {
          console.log(`[NodeManager] No pending requests yet (attempt ${attempt + 1}/${APPROVE_POLL_ATTEMPTS})`);
        }
      } catch (err) {
        console.warn(`[NodeManager] WS approve attempt ${attempt + 1}/${APPROVE_POLL_ATTEMPTS} failed: ${err.message}`);
      }
    }

    console.warn('[NodeManager] Auto-approve polling exhausted — node may need manual approval');
    this.lastError = 'Node pairing pending — please approve in CrackedClaw Settings → Devices';
    this.emit('status', false);
  }

  /**
   * Single WebSocket attempt: connect as operator, list pending node pairings, approve all.
   *
   * The OpenClaw WS protocol requires:
   *   1. First frame must be a "connect" request with client info, role, scopes, and auth
   *   2. Gateway responds with hello (ok/error)
   *   3. After hello OK, send JSON-RPC method calls
   *
   * We connect as role:"operator" with scopes:["operator.pairing"] using token auth
   * (the gateway's shared-secret auth token). No device identity is needed — when
   * device is omitted from connect params, the gateway skips pairing for the
   * approver connection itself.
   *
   * @returns {{ approved: boolean, noPending: boolean, alreadyPaired: boolean }}
   */
  _wsApproveAttempt() {
    return new Promise((resolve, reject) => {
      const { host, port, tls } = this.parseGatewayUrl();
      const wsUrl = `${tls ? 'wss' : 'ws'}://${host}:${port}`;

      let ws;
      try {
        ws = new WebSocket(wsUrl, {
          // Skip TLS cert verification for self-signed certs (common on VPS instances)
          rejectUnauthorized: false,
        });
      } catch (err) {
        return reject(new Error(`WebSocket creation failed: ${err.message}`));
      }

      let reqId = 0;
      let settled = false;
      let connectReqId = null;
      let listReqId = null;
      const approveReqIds = new Set();
      let approvedCount = 0;
      let totalToApprove = 0;

      const finish = (err, val) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try { ws.close(); } catch (_) {}
        if (err) reject(err);
        else resolve(val);
      };

      const timer = setTimeout(() => {
        finish(new Error('WebSocket approve attempt timed out'));
      }, WS_ATTEMPT_TIMEOUT_MS);

      const sendReq = (method, params) => {
        const id = ++reqId;
        const frame = JSON.stringify({ type: 'req', id, method, params });
        ws.send(frame);
        return id;
      };

      ws.on('open', () => {
        // Step 1: Send the connect handshake.
        // Connect as a backend operator with pairing scope.
        // Using token auth (gateway shared secret) — no device identity needed.
        connectReqId = sendReq('connect', {
          client: {
            id: 'gateway-client',
            displayName: 'CrackedClaw Auto-Approver',
            mode: 'backend',
            version: '1.0.0',
            platform: process.platform,
          },
          role: 'operator',
          scopes: ['operator.pairing', 'operator.admin'],
          auth: { token: this.authToken },
          minProtocol: 3,
          maxProtocol: 3,
        });
      });

      ws.on('message', (raw) => {
        if (settled) return;

        let msg;
        try {
          msg = JSON.parse(raw.toString());
        } catch (_) {
          return; // Ignore malformed frames
        }

        // We only care about response frames
        if (msg.type !== 'res') return;

        // --- Handle connect response ---
        if (msg.id === connectReqId) {
          if (!msg.ok) {
            const errMsg = msg.error?.message || msg.error?.code || 'unknown connect error';
            return finish(new Error(`Gateway connect rejected: ${errMsg}`));
          }
          // Connected successfully. Now list pending node pairing requests.
          listReqId = sendReq('node.pair.list', {});
          return;
        }

        // --- Handle node.pair.list response ---
        if (msg.id === listReqId) {
          if (!msg.ok) {
            const errMsg = msg.error?.message || 'list failed';
            return finish(new Error(`node.pair.list failed: ${errMsg}`));
          }

          const pending = msg.result?.pending || [];
          const paired = msg.result?.paired || [];

          // If the node is already paired, we're done
          if (paired.length > 0 && pending.length === 0) {
            return finish(null, { approved: false, noPending: false, alreadyPaired: true });
          }

          // No pending requests yet — the node hasn't connected/registered
          if (pending.length === 0) {
            return finish(null, { approved: false, noPending: true, alreadyPaired: false });
          }

          // Approve all pending node pairing requests
          totalToApprove = pending.length;
          console.log(`[NodeManager] Found ${totalToApprove} pending node pairing request(s), approving...`);

          for (const node of pending) {
            const requestId = node.requestId || node.id;
            if (!requestId) {
              totalToApprove--;
              continue;
            }
            const aid = sendReq('node.pair.approve', { requestId });
            approveReqIds.add(aid);
          }

          // Edge case: all entries lacked a requestId
          if (approveReqIds.size === 0) {
            return finish(null, { approved: false, noPending: true, alreadyPaired: false });
          }
          return;
        }

        // --- Handle node.pair.approve responses ---
        if (approveReqIds.has(msg.id)) {
          approveReqIds.delete(msg.id);

          if (msg.ok) {
            approvedCount++;
            const nodeId = msg.result?.node?.nodeId || 'unknown';
            console.log(`[NodeManager] Approved node: ${nodeId}`);
          } else {
            const errMsg = msg.error?.message || 'approve failed';
            console.warn(`[NodeManager] Approve failed for request: ${errMsg}`);
          }

          // All approve responses received — we're done
          if (approveReqIds.size === 0) {
            return finish(null, {
              approved: approvedCount > 0,
              noPending: approvedCount === 0,
              alreadyPaired: false,
            });
          }
          return;
        }
      });

      ws.on('error', (err) => {
        finish(new Error(`WebSocket error: ${err.message}`));
      });

      ws.on('close', (code, reason) => {
        const reasonStr = reason ? reason.toString() : '';
        finish(new Error(`WebSocket closed (code ${code}${reasonStr ? ': ' + reasonStr : ''})`));
      });
    });
  }

  setConnected(value) {
    if (this.connected !== value) {
      this.connected = value;
      this.emit('status', value);
    }
  }
}

module.exports = NodeManager;
