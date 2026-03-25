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
    this.runtimeManager = null;

    // Resolve provisioning API URL in priority order:
    // 1. Explicit provisioningUrl from token
    // 2. Derived from webAppUrl
    // 3. Environment variable
    // Resolve provisioning API base URL.
    // Raw PROVISIONING_API_URL (e.g. http://164.92.75.153:3100) needs /api appended.
    const rawProvUrl =
      provisioningUrl ||
      (webAppUrl ? deriveProvisioningUrl(webAppUrl) : null) ||
      process.env.PROVISIONING_API_URL ||
      null;
    // Ensure the base URL ends with /api (deriveProvisioningUrl already adds it;
    // raw server URLs like http://host:3100 don't).
    if (rawProvUrl && !rawProvUrl.replace(/\/+$/, '').endsWith('/api')) {
      this.provisioningApiUrl = rawProvUrl.replace(/\/+$/, '') + '/api';
    } else {
      this.provisioningApiUrl = rawProvUrl;
    }
    this.connected = false;
    this.lastError = null;
    this.process = null;
    this.shouldRun = false;
    this.reconnectTimer = null;
    this.prePaired = false;
  }

  setRuntimeManager(rm) {
    this.runtimeManager = rm;
  }

  async start() {
    this.shouldRun = true;
    await this.ensureCLI();
    // Pre-pair device with provisioning API before connecting
    await this.prePairDevice();
    // Ensure exec-approvals.json exists so openclaw node run can execute commands
    // without hitting "exec denied: approval timed out" errors.
    await this.ensureExecApprovals();
    this.spawnNode();
  }

  /**
   * Ensure ~/.openclaw/exec-approvals.json exists with safe defaults.
   *
   * WHY THIS EXISTS:
   *   openclaw node run needs exec permissions to run agent commands. The exec
   *   security system reads ~/.openclaw/exec-approvals.json at startup. If the
   *   file doesn't exist OR if `defaults` is an empty object {}, the security
   *   mode falls back to 'deny' — every command attempt times out with:
   *     "exec denied: approval timed out"
   *   There is no approval UI in the companion app, so users would be stuck.
   *
   *   We write a default policy on first launch (no file, or empty defaults)
   *   using 'allowlist' security mode (safer than 'full'). Known-safe commands
   *   auto-approve; unknown commands fall back to 'allow' since there's no
   *   approval UI in the companion.
   *   If the user has already customized their policy (non-empty defaults),
   *   we leave it completely untouched.
   *
   * SAFE TO CALL MULTIPLE TIMES: idempotent.
   */
  async ensureExecApprovals() {
    const homedir = os.homedir();
    const openclawDir = path.join(homedir, '.openclaw');
    const approvalsPath = path.join(openclawDir, 'exec-approvals.json');

    const defaultPolicy = {
      version: 1,
      defaults: {
        // 'allowlist' security: commands are checked against the allowlist;
        // unknown commands require approval. Safer than 'full' which allows
        // everything without checks.
        security: 'allowlist',
        // 'on-miss' means ask for approval only when a command isn't in the
        // allowlist. Known-safe commands (ls, cat, git, etc.) auto-approve.
        ask: 'on-miss',
        // fallback if ask logic fails: allow rather than block (prevents
        // the companion from freezing on approval timeouts, since there's
        // no approval UI in the companion app yet).
        askFallback: 'allow',
      },
    };

    try {
      // Create ~/.openclaw/ if it doesn't exist yet (first launch scenario)
      fs.mkdirSync(openclawDir, { recursive: true });

      if (fs.existsSync(approvalsPath)) {
        // File exists — check if defaults are customized (non-empty)
        try {
          const existing = JSON.parse(fs.readFileSync(approvalsPath, 'utf-8'));
          const defaults = existing.defaults || {};
          if (Object.keys(defaults).length > 0) {
            // User has their own policy — respect it and don't overwrite
            console.log('[NodeManager] exec-approvals.json has custom defaults — leaving untouched');
            return;
          }
          // Empty defaults {} — fall through to write default policy
          console.log('[NodeManager] exec-approvals.json has empty defaults — writing default policy');
        } catch (parseErr) {
          // Malformed JSON — overwrite with a valid default policy
          console.warn('[NodeManager] exec-approvals.json is malformed, overwriting:', parseErr.message);
        }
      }

      // Write default policy: file didn't exist, had empty defaults, or was malformed
      fs.writeFileSync(approvalsPath, JSON.stringify(defaultPolicy, null, 2), 'utf-8');
      console.log('[NodeManager] Wrote default exec-approvals.json →', approvalsPath);
    } catch (err) {
      // Non-fatal: log and continue. openclaw node run may still work if the
      // file was configured manually, or will fail with a clear error.
      console.warn('[NodeManager] Could not write exec-approvals.json:', err.message);
    }
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
    // If a RuntimeManager is attached, delegate to it
    if (this.runtimeManager) {
      if (this.runtimeManager.isReady()) {
        return; // Runtime already available and verified
      }
      await this.runtimeManager.ensure();
      return;
    }

    // Fallback: check system PATH for openclaw (legacy / developer path)
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

    try {
      execSync('which openclaw', { stdio: 'ignore', env: { ...process.env, PATH: envPath } });
      return;
    } catch (_) {}

    for (const dir of commonPaths) {
      try {
        execSync(`test -x "${dir}/openclaw"`, { stdio: 'ignore' });
        return;
      } catch (_) {}
    }

    throw new Error(
      'OpenClaw CLI not found. Please restart the app to auto-install.'
    );
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
    // Reset approval flag so pairing works on reconnect cycles
    this._approvingPending = false;
    // Emit connecting status so UI can show transitional yellow state
    this.lastError = null;
    this.emit('status', 'connecting');

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

    const openclawPath = this.runtimeManager
      ? this.runtimeManager.getOpenclawPath()
      : 'openclaw';
    const spawnEnv = this.runtimeManager
      ? this.runtimeManager.getEnv()
      : process.env;

    this.process = spawn(openclawPath, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...spawnEnv,
        OPENCLAW_GATEWAY_TOKEN: this.authToken,
      },
    });

    this.process.stdin.end();

    this.process.stdout.on('data', (data) => {
      const line = data.toString().trim();
      console.log('[openclaw node]', line);
      const lower = line.toLowerCase();
      // Detect connection from various openclaw node run output messages
      if (lower.includes('connected') || lower.includes('ready') ||
          lower.includes('paired') || lower.includes('listening') ||
          lower.includes('node online') || lower.includes('authenticated')) {
        this.setConnected(true);
      }
      // Detect explicit disconnection
      if (lower.includes('disconnected') || lower.includes('connection lost')) {
        this.setConnected(false);
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
