const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage } = require('electron');
const path = require('path');
const Store = require('electron-store');
const NodeManager = require('./node-manager');
const ChatManager = require('./chat-manager');

const store = new Store();
let mainWindow = null;
let tray = null;
let nodeManager = null;
let chatManager = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 620,
    minWidth: 640,
    minHeight: 480,
    resizable: true,
    maximizable: true,
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
          nodeManager && nodeManager.stop();
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

function initChatManager(decoded) {
  const { gatewayUrl, authToken } = decoded;
  // webAppUrl might be missing from old tokens — fall back to stored value or default
  const webAppUrl = decoded.webAppUrl || store.get('webAppUrl') || 'https://crackedclaw.com';
  chatManager = new ChatManager({ gatewayUrl, authToken, webAppUrl });
}

function setupIPC() {
  // ── Connection IPC ───────────────────────────────────────────────────────────

  ipcMain.handle('get-state', () => {
    return {
      connected: nodeManager ? nodeManager.connected : false,
      token: store.get('connectionToken') || null,
      gatewayUrl: store.get('gatewayUrl') || null,
      instanceId: store.get('instanceId') || null,
      webAppUrl: store.get('webAppUrl') || null,
      error: nodeManager ? nodeManager.lastError : null,
    };
  });

  ipcMain.handle('connect', async (_event, rawToken) => {
    try {
      const decoded = JSON.parse(Buffer.from(rawToken, 'base64').toString('utf-8'));
      const { gatewayUrl, instanceId, authToken, operatorToken, webAppUrl } = decoded;

      if (!gatewayUrl || !instanceId || !authToken) {
        return { ok: false, error: 'Invalid token: missing required fields' };
      }

      store.set('connectionToken', rawToken);
      store.set('gatewayUrl', gatewayUrl);
      store.set('instanceId', instanceId);
      store.set('authToken', authToken);
      store.set('webAppUrl', webAppUrl || 'https://crackedclaw.com');
      if (operatorToken) store.set('operatorToken', operatorToken);

      // Init chat manager
      initChatManager(decoded);

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
    chatManager = null;
    store.delete('connectionToken');
    store.delete('gatewayUrl');
    store.delete('instanceId');
    store.delete('authToken');
    store.delete('webAppUrl');
    updateTrayMenu(false);
    return { ok: true };
  });

  // ── Chat IPC ─────────────────────────────────────────────────────────────────

  ipcMain.handle('chat:list-conversations', async () => {
    if (!chatManager) return { ok: false, error: 'Not connected' };
    try {
      const conversations = await chatManager.listConversations();
      return { ok: true, conversations };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('chat:create-conversation', async (_event, title) => {
    if (!chatManager) return { ok: false, error: 'Not connected' };
    try {
      const conversation = await chatManager.createConversation(title);
      return { ok: true, conversation };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('chat:load-messages', async (_event, conversationId) => {
    if (!chatManager) return { ok: false, error: 'Not connected' };
    try {
      const messages = await chatManager.loadMessages(conversationId);
      return { ok: true, messages };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('chat:save-message', async (_event, { conversationId, role, content }) => {
    if (!chatManager) return { ok: false, error: 'Not connected' };
    try {
      const message = await chatManager.saveMessage(conversationId, role, content);
      return { ok: true, message };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('chat:send-message', async (event, { conversationId, message }) => {
    if (!chatManager) return { ok: false, error: 'Not connected' };
    try {
      const fullContent = await chatManager.sendMessage(
        conversationId,
        message,
        (chunk) => {
          // Forward streaming chunks to renderer
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('chat:stream-chunk', chunk);
          }
        }
      );
      return { ok: true, content: fullContent };
    } catch (err) {
      return { ok: false, error: err.message };
    }
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
