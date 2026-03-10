const { spawn, execSync } = require('child_process');
const EventEmitter = require('events');
const https = require('https');
const http = require('http');

const RECONNECT_DELAY_MS = 5000;

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
  }

  async start() {
    this.shouldRun = true;
    await this.ensureCLI();
    await this.prePair();
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

  async prePair() {
    const url = 'https://crackedclaw.com/api/node/pre-pair';

    return new Promise((resolve, reject) => {
      const transport = url.startsWith('https') ? https : http;
      const req = transport.request(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.authToken}`,
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

      req.end();
    });
  }

  spawnNode() {
    if (!this.shouldRun) return;

    const token = this.pairingToken || this.authToken;
    const args = ['node', 'run', '--gateway', this.gatewayUrl, '--token', token];

    this.process = spawn('openclaw', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
    });

    this.process.stdout.on('data', (data) => {
      const line = data.toString().trim();
      if (line.toLowerCase().includes('connected') || line.toLowerCase().includes('ready')) {
        this.setConnected(true);
      }
    });

    this.process.stderr.on('data', (data) => {
      this.lastError = data.toString().trim();
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
  }

  setConnected(value) {
    if (this.connected !== value) {
      this.connected = value;
      this.emit('status', value);
    }
  }
}

module.exports = NodeManager;
