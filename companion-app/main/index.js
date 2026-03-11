const { app, BrowserWindow, Tray, Menu, nativeImage, screen } = require('electron');
const path = require('path');
const Store = require('electron-store');
const NodeManager = require('./node-manager');
const ChatManager = require('./chat-manager');
const { setupIPC } = require('./ipc');

const store = new Store();
let mainWindow = null;
let tray = null;
let nodeManager = null;
let chatManager = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 680,
    height: 500,
    minWidth: 400,
    minHeight: 200,
    resizable: true,
    maximizable: false,
    transparent: true,
    frame: false,
    hasShadow: true,
    backgroundColor: '#00000000',
    vibrancy: 'light',
    visualEffectState: 'active',
    alwaysOnTop: true,
    skipTaskbar: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../renderer/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  mainWindow.once('ready-to-show', () => {
    positionWindowBottomCenter();
    mainWindow.show();
  });

  mainWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

function positionWindowBottomCenter() {
  if (!mainWindow) return;
  try {
    const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
    const [winWidth, winHeight] = mainWindow.getSize();
    const x = Math.round((screenWidth - winWidth) / 2);
    const y = Math.round(screenHeight - winHeight - 20); // 20px from bottom
    mainWindow.setPosition(x, y);
  } catch (_) {
    // Ignore positioning errors
  }
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
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        positionWindowBottomCenter();
        mainWindow.show();
      }
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
      click: () => {
        if (mainWindow) {
          positionWindowBottomCenter();
          mainWindow.show();
        }
      },
    },
    {
      label: connected ? 'Disconnect' : 'Connect',
      click: () => {
        if (connected) {
          nodeManager && nodeManager.stop();
        } else {
          positionWindowBottomCenter();
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

function initChatManager(decoded) {
  const { gatewayUrl, authToken } = decoded;
  // webAppUrl might be missing from old tokens — fall back to stored value or default
  const webAppUrl = decoded.webAppUrl || store.get('webAppUrl') || 'https://crackedclaw.com';
  chatManager = new ChatManager({ gatewayUrl, authToken, webAppUrl });
}

app.whenReady().then(() => {
  setupIPC({
    getMainWindow: () => mainWindow,
    store,
    getNodeManager: () => nodeManager,
    setNodeManager: (nm) => { nodeManager = nm; },
    getChatManager: () => chatManager,
    setChatManager: (cm) => { chatManager = cm; },
    updateTrayMenu,
    initChatManager,
  });

  createWindow();
  createTray();

  // Auto-reconnect if token exists
  const rawToken = store.get('connectionToken');
  if (rawToken) {
    try {
      const decoded = JSON.parse(Buffer.from(rawToken, 'base64').toString('utf-8'));

      // Init chat manager from stored token
      initChatManager(decoded);

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
