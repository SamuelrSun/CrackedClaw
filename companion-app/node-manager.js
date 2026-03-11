const { spawn, execSync } = require('child_process');
const EventEmitter = require('events');
const https = require('https');
const http = require('http');
const crypto = require('crypto');
const os = require('os');

const RECONNECT_DELAY_MS = 5000;
// How long to poll for pending pairing requests before giving up
const APPROVE_POLL_ATTEMPTS = 12;
const APPROVE_POLL_DELAY_MS = 3000;

class NodeManager extends EventEmitter {
  constructor({ gatewayUrl, instanceId, authToken }) {
    super();
    this.gatewayUrl = gatewayUrl;
    this.instanceId = instanceId;
    this.authToken = authToken;
    this.connected = false;
    this.lastError = null;
    this.process = null;
    this.shouldRun = false;
    this.reconnectTimer = null;
    this.pairingToken = null;
    // Generate a stable device ID for this installation
    this.deviceId = 'companion-' + crypto.randomBytes(8).toString('hex');
  }

  async start() {
    this.shouldRun = true;
    await this.ensureCLI();
    // Pre-pair best-effort (don't fail hard if this errors)
    try {
      await this.prePair();
    } catch (err) {
      console.warn('[NodeManager] pre-pair failed (continuing anyway):', err.message);
    }
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
   * Notify CrackedClaw server that we're about to pair.
   * Uses x-gateway-token header (not Authorization) to authenticate.
   * Body: { deviceId, token, displayName, platform }
   */
  async prePair() {
    const url = 'https://crackedclaw.com/api/node/pre-pair';
    const displayName = os.hostname() + ' (CrackedClaw Companion)';
    const bodyObj = {
      deviceId: this.deviceId,
      token: this.authToken,
      displayName,
      platform: process.platform,
    };
    const bodyStr = JSON.stringify(bodyObj);

    return new Promise((resolve, reject) => {
      const transport = url.startsWith('https') ? https : http;
      const urlObj = new URL(url);
      const req = transport.request({
        hostname: urlObj.hostname,
        port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
        path: urlObj.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(bodyStr),
          // Route looks for x-gateway-token, not Authorization
          'x-gateway-token': this.authToken,
        },
      }, (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const data = JSON.parse(body);
              this.pairingToken = data.pairingToken || data.token || this.authToken;
              resolve(data);
            } catch (_) {
              this.pairingToken = this.authToken;
              resolve({});
            }
          } else {
            const err = new Error(`Pre-pair failed (${res.statusCode}): ${body}`);
            this.lastError = err.message;
            reject(err);
          }
        });
      });

      req.on('error', (err) => {
        this.lastError = `Pre-pair request failed: ${err.message}`;
        reject(new Error(this.lastError));
      });

      req.write(bodyStr);
      req.end();
    });
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
   *   OPENCLAW_GATEWAY_TOKEN env var for auth (no --token flag on node run)
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
        OPENCLAW_GATEWAY_TOKEN: this.pairingToken || this.authToken,
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

    // After spawning, poll the gateway for the pending pairing request and auto-approve it.
    // The node needs a moment to connect and register with the gateway first.
    this.pollAndApproveGateway().catch((err) => {
      console.warn('[NodeManager] auto-approve polling failed:', err.message);
    });
  }

  /**
   * Make a raw HTTPS/HTTP request to the OpenClaw gateway REST API.
   * Uses Authorization: Bearer <authToken> to authenticate.
   */
  gatewayRequest(method, path, body) {
    const { host, port, tls } = this.parseGatewayUrl();
    const transport = tls ? https : http;
    const bodyStr = body ? JSON.stringify(body) : null;

    return new Promise((resolve, reject) => {
      const options = {
        hostname: host,
        port,
        path,
        method,
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
          'Content-Type': 'application/json',
          ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
        },
      };

      const req = transport.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try { resolve(JSON.parse(data)); } catch (_) { resolve({}); }
          } else {
            reject(new Error(`Gateway ${method} ${path} returned ${res.statusCode}: ${data}`));
          }
        });
      });

      req.on('error', reject);
      if (bodyStr) req.write(bodyStr);
      req.end();
    });
  }

  /**
   * Poll the OpenClaw gateway for pending device pairing requests and approve them.
   *
   * When `openclaw node run` first connects, it creates a pending pairing request
   * (role: node) that must be approved before the node becomes active.
   * This method calls the gateway REST API directly to detect and approve that request.
   *
   * Retries APPROVE_POLL_ATTEMPTS times with APPROVE_POLL_DELAY_MS between each.
   */
  async pollAndApproveGateway() {
    console.log('[NodeManager] Starting auto-approve polling for pending pairing requests...');

    for (let attempt = 0; attempt < APPROVE_POLL_ATTEMPTS; attempt++) {
      if (!this.shouldRun) return;

      // Wait before polling (give the node time to connect and register)
      await new Promise((r) => setTimeout(r, APPROVE_POLL_DELAY_MS));

      if (!this.shouldRun) return;

      try {
        // Fetch pending pairing requests from the gateway
        const pendingData = await this.gatewayRequest('GET', '/api/nodes/pending');
        const pending = pendingData.pending || [];

        if (pending.length > 0) {
          console.log(`[NodeManager] Found ${pending.length} pending pairing request(s), approving...`);

          for (const node of pending) {
            const requestId = node.requestId;
            if (!requestId) continue;

            try {
              await this.gatewayRequest('POST', '/api/nodes/approve', { requestId });
              console.log(`[NodeManager] Approved pairing request: ${requestId}`);
              this.setConnected(true);
            } catch (err) {
              console.warn(`[NodeManager] Failed to approve request ${requestId}:`, err.message);
            }
          }

          // Successfully processed pending requests — stop polling
          return;
        } else {
          console.log(`[NodeManager] No pending requests yet (attempt ${attempt + 1}/${APPROVE_POLL_ATTEMPTS})`);
        }
      } catch (err) {
        console.warn(`[NodeManager] Pending poll error (attempt ${attempt + 1}):`, err.message);
      }
    }

    console.warn('[NodeManager] Auto-approve polling exhausted — node may need manual approval in CrackedClaw settings.');
    this.lastError = 'Node pairing pending — please approve in CrackedClaw Settings → Devices';
    this.emit('status', false);
  }

  setConnected(value) {
    if (this.connected !== value) {
      this.connected = value;
      this.emit('status', value);
    }
  }
}

module.exports = NodeManager;
