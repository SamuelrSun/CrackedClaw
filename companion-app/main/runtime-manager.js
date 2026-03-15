/**
 * RuntimeManager — ensures Node.js 22 + openclaw CLI are available
 * Downloads them to app-local directory on first launch.
 * Users never need to touch a terminal.
 */
const { execSync, exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const fs = require('fs');
const path = require('path');
const https = require('https');
const os = require('os');
const { app } = require('electron');

const NODE_VERSION = '22.14.0';
const RUNTIME_DIR = path.join(app.getPath('userData'), 'runtime');
const NODE_DIR = path.join(RUNTIME_DIR, 'node');
const NODE_BIN = path.join(NODE_DIR, 'bin', 'node');
const NPM_BIN = path.join(NODE_DIR, 'bin', 'npm');
// NPX_BIN kept for reference — unused but available
// const NPX_BIN = path.join(NODE_DIR, 'bin', 'npx');
const OPENCLAW_DIR = path.join(RUNTIME_DIR, 'openclaw');
const OPENCLAW_BIN = path.join(OPENCLAW_DIR, 'node_modules', '.bin', 'openclaw');

class RuntimeManager {
  constructor() {
    this.ready = false;
    this.status = 'checking';
    this.error = null;
    this.listeners = [];
  }

  onStatus(fn) {
    this.listeners.push(fn);
  }

  _emit(status, detail) {
    this.status = status;
    for (const fn of this.listeners) fn(status, detail);
  }

  /**
   * Check if runtime is already set up and functional.
   * Verifies binaries actually exist and are executable.
   */
  isReady() {
    try {
      if (!fs.existsSync(NODE_BIN) || !fs.existsSync(OPENCLAW_BIN)) return false;
      // Quick sanity check — make sure node binary is executable
      execSync(`"${NODE_BIN}" --version`, { stdio: 'ignore', timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the path to the openclaw binary (bundled preferred, system fallback).
   */
  getOpenclawPath() {
    if (fs.existsSync(OPENCLAW_BIN)) {
      try {
        execSync(`"${NODE_BIN}" "${OPENCLAW_BIN}" --version`, { stdio: 'ignore', timeout: 5000 });
        return OPENCLAW_BIN;
      } catch {
        // Bundled broken, fall through to system
      }
    }
    // Fall back to system openclaw
    try {
      const which = execSync('which openclaw', { encoding: 'utf-8', stdio: 'pipe' }).trim();
      if (which) return which;
    } catch {}
    return null;
  }

  /**
   * Get the path to node binary (bundled preferred, system Node 22+ fallback).
   */
  getNodePath() {
    if (fs.existsSync(NODE_BIN)) {
      try {
        execSync(`"${NODE_BIN}" --version`, { stdio: 'ignore', timeout: 5000 });
        return NODE_BIN;
      } catch {}
    }
    // Check system node — must be v22+
    try {
      const sysNode = execSync('which node', { encoding: 'utf-8', stdio: 'pipe' }).trim();
      if (sysNode) {
        const ver = execSync(`"${sysNode}" -v`, { encoding: 'utf-8', stdio: 'pipe' }).trim();
        const match = ver.match(/^v(\d+)\./);
        if (match && parseInt(match[1]) >= 22) return sysNode;
      }
    } catch {}
    return null;
  }

  /**
   * Get env with bundled node/npm/openclaw in PATH.
   * Falls back gracefully if bundled dirs don't exist yet.
   */
  getEnv() {
    const nodeBinDir = path.join(NODE_DIR, 'bin');
    const openclawBinDir = path.join(OPENCLAW_DIR, 'node_modules', '.bin');
    return {
      ...process.env,
      PATH: `${openclawBinDir}:${nodeBinDir}:${process.env.PATH || ''}`,
    };
  }

  /**
   * Ensure runtime is available — download if needed.
   * Idempotent: safe to call multiple times or after interrupted downloads.
   */
  async ensure() {
    if (this.isReady()) {
      this.ready = true;
      this._emit('ready');
      return;
    }

    try {
      fs.mkdirSync(RUNTIME_DIR, { recursive: true });

      // Step 1: Download Node.js if needed (or if existing install is broken)
      const nodeFunctional = fs.existsSync(NODE_BIN) && (() => {
        try { execSync(`"${NODE_BIN}" --version`, { stdio: 'ignore', timeout: 5000 }); return true; } catch { return false; }
      })();

      if (!nodeFunctional) {
        // Clean up any partial/broken node dir before downloading
        if (fs.existsSync(NODE_DIR)) {
          try { fs.rmSync(NODE_DIR, { recursive: true, force: true }); } catch {}
        }
        this._emit('downloading-node', `Downloading Node.js ${NODE_VERSION}...`);
        await this._downloadNode();
      }

      // Step 2: Install openclaw if needed (or if existing install is broken)
      const openclawFunctional = fs.existsSync(OPENCLAW_BIN) && (() => {
        try { execSync(`"${NODE_BIN}" "${OPENCLAW_BIN}" --version`, { stdio: 'ignore', timeout: 5000 }); return true; } catch { return false; }
      })();

      if (!openclawFunctional) {
        // Clean up any partial openclaw dir before reinstalling
        if (fs.existsSync(OPENCLAW_DIR)) {
          try { fs.rmSync(OPENCLAW_DIR, { recursive: true, force: true }); } catch {}
        }
        this._emit('installing-openclaw', 'Installing OpenClaw...');
        await this._installOpenclaw();
      }

      this.ready = true;
      this._emit('ready');
    } catch (err) {
      this.error = err.message;
      this._emit('error', err.message);
      throw err;
    }
  }

  async _downloadNode() {
    const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
    const platform = process.platform === 'darwin' ? 'darwin' : 'linux';
    const filename = `node-v${NODE_VERSION}-${platform}-${arch}`;
    const url = `https://nodejs.org/dist/v${NODE_VERSION}/${filename}.tar.gz`;
    const tarPath = path.join(RUNTIME_DIR, `${filename}.tar.gz`);

    // Remove stale tar if it exists from a prior interrupted download
    if (fs.existsSync(tarPath)) {
      try { fs.unlinkSync(tarPath); } catch {}
    }

    console.log(`[RuntimeManager] Downloading Node.js from ${url}`);
    await this._download(url, tarPath);

    console.log('[RuntimeManager] Extracting Node.js...');
    const tmpDir = `${NODE_DIR}_tmp_${Date.now()}`;
    await execAsync(
      `tar xzf "${tarPath}" -C "${RUNTIME_DIR}" && mv "${RUNTIME_DIR}/${filename}" "${tmpDir}"`,
      { timeout: 60000 }
    );
    // Atomic rename
    fs.renameSync(tmpDir, NODE_DIR);

    // Clean up tar
    try { fs.unlinkSync(tarPath); } catch {}

    // Verify
    const ver = execSync(`"${NODE_BIN}" -v`, { encoding: 'utf-8' }).trim();
    console.log(`[RuntimeManager] Node.js ${ver} installed at ${NODE_DIR}`);
  }

  async _installOpenclaw() {
    fs.mkdirSync(OPENCLAW_DIR, { recursive: true });

    // Create a minimal package.json so npm install works
    const pkg = { name: 'dopl-openclaw-runtime', version: '1.0.0', private: true };
    fs.writeFileSync(path.join(OPENCLAW_DIR, 'package.json'), JSON.stringify(pkg, null, 2));

    console.log('[RuntimeManager] Installing openclaw via bundled npm...');
    // Use the bundled node to invoke bundled npm
    await execAsync(
      `"${NODE_BIN}" "${NPM_BIN}" install openclaw --no-fund --no-audit`,
      {
        cwd: OPENCLAW_DIR,
        timeout: 180000, // 3 minutes — npm can be slow on first install
        env: this.getEnv(),
      }
    );

    console.log('[RuntimeManager] OpenClaw CLI installed at', OPENCLAW_BIN);
  }

  /**
   * Download a URL to a file, following redirects.
   */
  _download(url, destPath) {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(destPath);
      let resolved = false;

      const cleanup = (err) => {
        if (resolved) return;
        resolved = true;
        file.close();
        try { fs.unlinkSync(destPath); } catch {}
        reject(err);
      };

      const request = (targetUrl) => {
        https.get(targetUrl, (response) => {
          if (response.statusCode === 301 || response.statusCode === 302) {
            const location = response.headers.location;
            if (!location) { cleanup(new Error('Redirect without location header')); return; }
            request(location);
            return;
          }
          if (response.statusCode !== 200) {
            cleanup(new Error(`Download failed: HTTP ${response.statusCode} from ${targetUrl}`));
            return;
          }
          response.pipe(file);
          file.on('finish', () => {
            if (resolved) return;
            resolved = true;
            file.close(resolve);
          });
          response.on('error', cleanup);
        }).on('error', cleanup);
      };

      file.on('error', cleanup);
      request(url);
    });
  }
}

module.exports = RuntimeManager;
