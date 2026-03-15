const { spawn, execSync } = require('child_process');
const EventEmitter = require('events');
const https = require('https');
const http = require('http');
const crypto = require('crypto');
const os = require('os');
const fs = require('fs');
const path = require('path');

const RECONNECT_DELAY_MS = 5000;

/**
 * Derive the provisioning API base URL from a webAppUrl.
 * e.g. "https://usedopl.com" → "https://usedopl.com/api"
 */
function deriveProvisioningUrl(webAppUrl) {
  try {
    const parsed = new URL(webAppUrl);
    // Always use HTTPS for the provisioning API
    parsed.protocol = 'https:';
    // Strip any path and append /api
    return `https://${parsed.host}/api`;
  } catch (_) {
    return null;
  }
}

class NodeManager extends EventEmitter {
  constructor({ gatewayUrl, instanceId, authToken, operatorToken, provisioningUrl, webAppUrl }) {
    super();
    this.gatewayUrl = gatewayUrl;
    this.instanceId = instanceId;
    this.authToken = authToken;
    this.operatorToken = operatorToken || authToken;

    // Resolve provisioning API URL in priority order:
    // 1. Explicit provisioningUrl from token
    // 2. Derived from webAppUrl
    // 3. Environment variable
    this.provisioningApiUrl =
      provisioningUrl ||
      (webAppUrl ? deriveProvisioningUrl(webAppUrl) : null) ||
      process.env.PROVISIONING_API_URL ||
      null;
    this.connected = false;
    this.lastError = null;
    this.process = null;
    this.shouldRun = false;
    this.reconnectTimer = null;
    this.prePaired = false;
  }

  async start() {
    this.shouldRun = true;
    await this.ensureCLI();
    // Auto-approve handles pairing on first connect — no pre-pair needed
    // await this.prePairDevice();
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

  /**
   * Read the local device identity (created by openclaw on first run).
   * Returns { deviceId, publicKey } or null if not found.
   */
  getDeviceIdentity() {
    const homedir = os.homedir();
    const identityPath = path.join(homedir, '.openclaw', 'identity', 'device.json');
    try {
      if (fs.existsSync(identityPath)) {
        const data = JSON.parse(fs.readFileSync(identityPath, 'utf-8'));
        if (data.deviceId && data.publicKeyPem) {
          // Extract base64url key from PEM (strip header/footer, convert)
          const pemBody = data.publicKeyPem
            .replace(/-----BEGIN PUBLIC KEY-----/g, '')
            .replace(/-----END PUBLIC KEY-----/g, '')
            .replace(/\s/g, '');
          // Convert base64 to base64url
          const publicKey = pemBody
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
          return { deviceId: data.deviceId, publicKey };
        }
      }
    } catch (err) {
      console.warn('[NodeManager] Could not read device identity:', err.message);
    }
    return null;
  }

  /**
   * Pre-pair this device with the gateway via the provisioning API.
   * This writes the device to paired.json BEFORE openclaw node run connects,
   * bypassing the broken challenge-response approval flow.
   */
  async prePairDevice() {
    const identity = this.getDeviceIdentity();
    if (!identity) {
      console.log('[NodeManager] No device identity found — will be created by openclaw node run');
      return;
    }

    const displayName = os.hostname() + ' (Dopl Companion)';
    const body = JSON.stringify({
      deviceId: identity.deviceId,
      publicKey: identity.publicKey,
      platform: process.platform,
      displayName,
    });

    if (!this.provisioningApiUrl) {
      console.warn('[NodeManager] No provisioning API URL configured — skipping pre-pair');
      return;
    }

    try {
      const result = await this._httpPost(
        `${this.provisioningApiUrl}/instances/${this.instanceId}/pre-pair`,
        body,
        { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.authToken}` }
      );
      const data = JSON.parse(result);
      if (data.success) {
        this.prePaired = true;
        console.log(`[NodeManager] Device pre-paired successfully${data.alreadyPaired ? ' (already paired)' : ''}`);
      } else {
        console.warn('[NodeManager] Pre-pair failed:', data.error);
      }
    } catch (err) {
      console.warn('[NodeManager] Pre-pair request failed:', err.message);
      // Continue anyway — openclaw node run will attempt pairing normally
    }

    // Give gateway a moment to restart after pre-pair (if it was restarted)
    if (this.prePaired) {
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  /** Simple HTTP POST helper */
  _httpPost(url, body, headers = {}) {
    return new Promise((resolve, reject) => {
      const parsed = new URL(url);
      const mod = parsed.protocol === 'https:' ? https : http;
      const req = mod.request({
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname,
        method: 'POST',
        headers: { ...headers, 'Content-Length': Buffer.byteLength(body) },
        timeout: 10000,
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) resolve(data);
          else reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        });
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')); });
      req.write(body);
      req.end();
    });
  }

  async ensureCLI() {
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
    process.env.PATH = envPath;

    const execOpts = { stdio: 'pipe', env: { ...process.env, PATH: envPath } };

    try {
      execSync('which openclaw', { ...execOpts, stdio: 'ignore' });
      return;
    } catch (_) {}

    for (const dir of commonPaths) {
      try {
        execSync(`test -x "${dir}/openclaw"`, { stdio: 'ignore' });
        return;
      } catch (_) {}
    }

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
        `3. Restart the app\n\n` +
        `The companion app will work without the CLI — you just won't get device features (browser automation, screen context).`
      );
    }

    let npmBin = 'npm';
    for (const dir of commonPaths) {
      try {
        execSync(`test -x "${dir}/npm"`, { stdio: 'ignore' });
        npmBin = `${dir}/npm`;
        break;
      } catch (_) {}
    }

    try {
      execSync(`${npmBin} install -g openclaw`, { ...execOpts, timeout: 120000 });
    } catch (err) {
      const errMsg = err.message || '';
      if (errMsg.includes('EACCES') || errMsg.includes('permission denied')) {
        throw new Error(
          `Permission denied installing OpenClaw CLI.\n\n` +
          `Please run this in Terminal:\n` +
          `  sudo npm install -g openclaw\n\n` +
          `Then restart the app.`
        );
      }
      throw new Error('Failed to install openclaw CLI: ' + errMsg);
    }
  }

  parseGatewayUrl() {
    try {
      const parsed = new URL(this.gatewayUrl);
      const tls = parsed.protocol === 'https:' || parsed.protocol === 'wss:';
      const host = parsed.hostname;
      const port = parsed.port ? parseInt(parsed.port, 10) : tls ? 443 : 80;
      return { host, port, tls };
    } catch (_) {
      return { host: this.gatewayUrl, port: 18789, tls: false };
    }
  }

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

    let reconnectScheduled = false;

    const scheduleReconnect = (reason) => {
      if (reconnectScheduled || !this.shouldRun) return;
      reconnectScheduled = true;
      this.lastError = reason;
      this.emit('status', false);
      this.reconnectTimer = setTimeout(() => this.spawnNode(), RECONNECT_DELAY_MS);
    };

    this.process = spawn('openclaw', args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        OPENCLAW_GATEWAY_TOKEN: this.authToken,
      },
    });

    this.process.stdin.end();

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

      // If we get "pairing required", use auto-approve flow
      if (line.includes('pairing required') && !this._approvingPending) {
        this._approvingPending = true;
        console.log('[NodeManager] Got "pairing required" — requesting auto-approve...');

        // Wait for gateway to create pending entry
        setTimeout(async () => {
          try {
            const approveUrl = `${this.provisioningApiUrl}/instances/${this.instanceId}/approve-pending`;
            const result = await this._httpPost(
              approveUrl,
              '{}',
              {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.authToken}`,
              }
            );
            const data = JSON.parse(result);
            if (data.success) {
              console.log('[NodeManager] Device approved! Reconnecting...');
              // Wait for gateway to process, then kill process to trigger reconnect
              setTimeout(() => {
                if (this.process) {
                  this.process.kill();
                }
              }, 3000);
            } else {
              console.warn('[NodeManager] Approve failed:', data.reason);
              this._approvingPending = false;
            }
          } catch (err) {
            console.warn('[NodeManager] Approve request failed:', err.message);
            this._approvingPending = false;
          }
        }, 2000);
      }
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
  }

  setConnected(value) {
    if (this.connected !== value) {
      this.connected = value;
      this.emit('status', value);
    }
  }
}

module.exports = NodeManager;
