const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage } = require('electron');
const path = require('path');
const Store = require('electron-store');
const NodeManager = require('./node-manager');

const store = new Store();
let mainWindow = null;
let tray = null;
let nodeManager = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 450,
    height: 350,
    resizable: false,
    maximizable: false,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#F7F7F5',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile('index.html');

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

function createTrayIcon(connected) {
  const size = 16;
  const canvas = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="8" cy="8" r="6" fill="${connected ? '#22C55E' : '#EF4444'}" />
    </svg>`;
  return nativeImage.createFromBuffer(
    Buffer.from(canvas),
    { width: size, height: size }
  );
}

function createTray() {
  const icon = createTrayIcon(false);
  tray = new Tray(icon);
  tray.setToolTip('CrackedClaw Connect');
  updateTrayMenu(false);

  tray.on('click', () => {
    if (mainWindow) {
      mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
    }
  });
}

function updateTrayMenu(connected) {
  const statusLabel = connected ? 'Connected' : 'Disconnected';
  const menu = Menu.buildFromTemplate([
    { label: `Status: ${statusLabel}`, enabled: false },
    { type: 'separator' },
    {
      label: 'Show Window',
      click: () => mainWindow && mainWindow.show(),
    },
    {
      label: connected ? 'Disconnect' : 'Connect',
      click: () => {
        if (connected) {
          nodeManager.stop();
        } else {
          mainWindow && mainWindow.show();
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.isQuitting = true;
        if (nodeManager) nodeManager.stop();
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(menu);

  try {
    tray.setImage(createTrayIcon(connected));
  } catch (_) {
    // SVG tray icons may not render on all platforms; ignore
  }
}

function setupIPC() {
  ipcMain.handle('get-state', () => {
    return {
      connected: nodeManager ? nodeManager.connected : false,
      token: store.get('connectionToken') || null,
      gatewayUrl: store.get('gatewayUrl') || null,
      instanceId: store.get('instanceId') || null,
      error: nodeManager ? nodeManager.lastError : null,
    };
  });

  ipcMain.handle('connect', async (_event, rawToken) => {
    try {
      const decoded = JSON.parse(Buffer.from(rawToken, 'base64').toString('utf-8'));
      const { gatewayUrl, instanceId, authToken, operatorToken } = decoded;

      if (!gatewayUrl || !instanceId || !authToken) {
        return { ok: false, error: 'Invalid token: missing required fields' };
      }

      store.set('connectionToken', rawToken);
      store.set('gatewayUrl', gatewayUrl);
      store.set('instanceId', instanceId);
      store.set('authToken', authToken);
      if (operatorToken) store.set('operatorToken', operatorToken);

      nodeManager = new NodeManager({ gatewayUrl, instanceId, authToken, operatorToken });

      nodeManager.on('status', (connected) => {
        updateTrayMenu(connected);
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('status-update', {
            connected,
            gatewayUrl,
            instanceId,
            error: nodeManager.lastError,
          });
        }
      });

      await nodeManager.start();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('disconnect', () => {
    if (nodeManager) {
      nodeManager.stop();
      nodeManager = null;
    }
    store.delete('connectionToken');
    store.delete('gatewayUrl');
    store.delete('instanceId');
    store.delete('authToken');
    updateTrayMenu(false);
    return { ok: true };
  });
}

app.whenReady().then(() => {
  setupIPC();
  createWindow();
  createTray();

  // Auto-reconnect if token exists
  const rawToken = store.get('connectionToken');
  if (rawToken) {
    try {
      const decoded = JSON.parse(Buffer.from(rawToken, 'base64').toString('utf-8'));
      nodeManager = new NodeManager(decoded);

      nodeManager.on('status', (connected) => {
        updateTrayMenu(connected);
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('status-update', {
            connected,
            gatewayUrl: decoded.gatewayUrl,
            instanceId: decoded.instanceId,
            error: nodeManager.lastError,
          });
        }
      });

      nodeManager.start().catch(() => {});
    } catch (_) {
      store.delete('connectionToken');
    }
  }
});

app.on('window-all-closed', () => {
  // Keep running in tray on macOS
});

app.on('before-quit', () => {
  app.isQuitting = true;
  if (nodeManager) nodeManager.stop();
});
