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
    // On macOS, Electron doesn't inherit the full login shell PATH.
    // Homebrew installs to /opt/homebrew/bin (Apple Silicon) or /usr/local/bin (Intel).
    // We ALWAYS expand process.env.PATH first so every subsequent spawn finds binaries.
    const commonPaths = [
      '/opt/homebrew/bin',
      '/usr/local/bin',
      '/usr/bin',
      '/opt/local/bin',
    ];
    const envPath = [
      ...(process.env.PATH ? process.env.PATH.split(':') : []),
      ...commonPaths,
    ].filter(Boolean).join(':');

    // Patch the global PATH immediately — spawnNode() reads process.env directly.
    process.env.PATH = envPath;

    const execOpts = {
      stdio: 'pipe',
      env: { ...process.env, PATH: envPath },
    };

    // Check if openclaw is already installed (use expanded PATH)
    try {
      execSync('which openclaw', { ...execOpts, stdio: 'ignore' });
      return; // Already on PATH — good to go
    } catch (_) {}

    // Try direct path lookup as a fallback (in case 'which' fails for other reasons)
    for (const dir of commonPaths) {
      try {
        execSync(`test -x "${dir}/openclaw"`, { stdio: 'ignore' });
        return; // Found it — PATH already patched above
      } catch (_) {}
    }

    // openclaw not found — check Node version before attempting install
    let nodeVersion = '';
    try {
      nodeVersion = execSync('node -v', { ...execOpts, encoding: 'utf-8' }).trim();
    } catch (_) {}

    const vMatch = nodeVersion.match(/^v(\d+)\.(\d+)/);
    const major = vMatch ? parseInt(vMatch[1], 10) : 0;
    const minor = vMatch ? parseInt(vMatch[2], 10) : 0;

    if (major < 22 || (major === 22 && minor < 12)) {
      throw new Error(
        `OpenClaw requires Node.js >= 22.12.0 but your system has ${nodeVersion || 'none'}.\n\n` +
        `To fix this:\n` +
        `1. Install Node.js 22+ from https://nodejs.org\n` +
        `2. Then run: sudo npm install -g openclaw\n` +
        `3. Restart Dopl Connect\n\n` +
        `The companion app will work without the CLI — you just won't get device features (browser automation, screen context).`
      );
    }

    // Try to install openclaw via npm
    let npmBin = 'npm';
    for (const dir of commonPaths) {
      try {
        execSync(`test -x "${dir}/npm"`, { stdio: 'ignore' });
        npmBin = `${dir}/npm`;
        break;
      } catch (_) {}
    }

    try {
      // Try without sudo first, then with sudo
      execSync(`${npmBin} install -g openclaw`, { ...execOpts, timeout: 120000 });
    } catch (err) {
      const errMsg = err.message || '';
      if (errMsg.includes('EACCES') || errMsg.includes('permission denied')) {
        throw new Error(
          `Permission denied installing OpenClaw CLI.\n\n` +
          `Please run this in Terminal:\n` +
          `  sudo npm install -g openclaw\n\n` +
          `Then restart Dopl Connect.`
        );
      }
      throw new Error('Failed to install openclaw CLI: ' + errMsg);
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
    const displayName = os.hostname() + ' (Dopl Companion)';

    const args = [
      'node', 'run',
      '--host', host,
      '--port', String(port),
      '--display-name', displayName,
    ];
    if (tls) args.push('--tls');

    // Track whether we've already scheduled a reconnect for this spawn cycle.
    // Both 'error' and 'close' can fire for the same process — without this guard,
    // two reconnect timers would stack, doubling processes on each failure.
    let reconnectScheduled = false;

    const scheduleReconnect = (reason) => {
      if (reconnectScheduled || !this.shouldRun) return;
      reconnectScheduled = true;
      this.lastError = reason;
      this.emit('status', false);
      this.reconnectTimer = setTimeout(() => this.spawnNode(), RECONNECT_DELAY_MS);
    };

    this.process = spawn('openclaw', args, {
      // Use 'pipe' for all three (not 'ignore' for stdin) — Electron v28 on macOS
      // throws EBADF on reconnect attempts when stdin is 'ignore' and the parent
      // process's fd 0 is in a bad state after a previous failed spawn.
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        // Auth via env var — openclaw node run resolves token from OPENCLAW_GATEWAY_TOKEN
        OPENCLAW_GATEWAY_TOKEN: this.authToken,
      },
    });

    // We don't write to stdin — close it so the child doesn't hang waiting for input.
    this.process.stdin.end();

    // Track whether the process actually started (vs immediate spawn error)
    let processStarted = false;

    this.process.stdout.on('data', (data) => {
      processStarted = true;
      const line = data.toString().trim();
      console.log('[openclaw node]', line);
      if (line.toLowerCase().includes('connected') || line.toLowerCase().includes('ready')) {
        this.setConnected(true);
      }
    });

    this.process.stderr.on('data', (data) => {
      processStarted = true;
      const line = data.toString().trim();
      console.error('[openclaw node stderr]', line);
      this.lastError = line;
    });

    this.process.on('close', (code) => {
      this.process = null;
      this.setConnected(false);
      scheduleReconnect(`Process exited with code ${code}, reconnecting...`);
    });

    this.process.on('error', (err) => {
      this.process = null;
      this.setConnected(false);
      scheduleReconnect(`Spawn error: ${err.message}, reconnecting...`);
    });

    // Only start auto-approve polling after a short delay to confirm the process
    // actually spawned. If it fails immediately (ENOENT), don't waste 30s on WS polling.
    setTimeout(() => {
      if (processStarted && this.shouldRun) {
        this.approveViaWebSocket().catch((err) => {
          console.warn('[NodeManager] auto-approve failed:', err.message);
        });
      }
    }, 1000);
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
    this.lastError = 'Node pairing pending — please approve in Dopl Settings → Devices';
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
            displayName: 'Dopl Auto-Approver',
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
