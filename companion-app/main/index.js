const { app, BrowserWindow, Tray, Menu, nativeImage, screen, ipcMain, safeStorage, globalShortcut } = require('electron');
const path = require('path');
const Store = require('electron-store');
const NodeManager = require('./node-manager');
const ChatManager = require('./chat-manager');
const RuntimeManager = require('./runtime-manager');
const EventManager = require('./event-manager');
const { setupIPC, wireEventManager } = require('./ipc');

const store = new Store();

// ── Secure token storage helpers ──────────────────────────────────────────────
// Uses Electron's safeStorage (OS keychain) when available, falls back to plain store.

function storeToken(rawToken) {
  if (safeStorage.isEncryptionAvailable()) {
    const encrypted = safeStorage.encryptString(rawToken);
    store.set('connectionTokenEncrypted', encrypted.toString('base64'));
    store.delete('connectionToken'); // remove any old plaintext token
  } else {
    store.set('connectionToken', rawToken);
  }
}

function loadToken() {
  // Try encrypted first
  const encrypted = store.get('connectionTokenEncrypted');
  if (encrypted && safeStorage.isEncryptionAvailable()) {
    try {
      return safeStorage.decryptString(Buffer.from(encrypted, 'base64'));
    } catch (err) {
      console.warn('[Token] Failed to decrypt stored token:', err.message);
      store.delete('connectionTokenEncrypted');
      return null;
    }
  }
  // Fall back to plaintext (legacy / encryption unavailable)
  return store.get('connectionToken') || null;
}

function clearToken() {
  store.delete('connectionToken');
  store.delete('connectionTokenEncrypted');
}
const runtimeManager = new RuntimeManager();
let inputBarWindow = null;
let chatPanelWindow = null;
let tray = null;
let nodeManager = null;
let chatManager = null;
let eventManager = null;
let chatPanelVisible = false;

// ── Dimensions ────────────────────────────────────────────────────────────────

const INPUT_BAR_WIDTH  = 680;
const INPUT_BAR_HEIGHT = 68;   // just the pill — chat mode
const SETUP_HEIGHT     = 340;  // setup card mode
const CHAT_PANEL_WIDTH  = 680;
const CHAT_PANEL_HEIGHT = 460;
const PANEL_GAP = 7; // px between input bar and chat panel

// ── Window creation ───────────────────────────────────────────────────────────

function getInputBarPosition(height) {
  // Use persisted position if available
  const saved = store.get('inputBarBounds');
  if (saved && typeof saved.x === 'number' && typeof saved.y === 'number') {
    return { x: saved.x, y: saved.y };
  }
  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;
  const h = height || INPUT_BAR_HEIGHT;
  const x = Math.round((sw - INPUT_BAR_WIDTH) / 2);
  const y = Math.round(sh - h - 20);
  return { x, y };
}

function createInputBarWindow() {
  const { x, y } = getInputBarPosition();
  inputBarWindow = new BrowserWindow({
    x,
    y,
    width: INPUT_BAR_WIDTH,
    height: INPUT_BAR_HEIGHT,
    minWidth: 400,
    minHeight: INPUT_BAR_HEIGHT,
    resizable: false,
    maximizable: false,
    minimizable: false,
    closable: false,        // no native close
    transparent: true,
    frame: false,
    hasShadow: false,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../renderer/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  inputBarWindow.loadFile(path.join(__dirname, '../renderer/input-bar.html'));

  inputBarWindow.once('ready-to-show', () => {
    inputBarWindow.show();
    // Start ignoring mouse events on transparent areas; renderer will toggle
    // via IPC when the cursor is over interactive elements.
    inputBarWindow.setIgnoreMouseEvents(true, { forward: true });
  });

  // Follow chat panel when input bar is moved
  inputBarWindow.on('moved', () => {
    // Persist position
    store.set('inputBarBounds', inputBarWindow.getBounds());
    // Keep chat panel aligned
    if (chatPanelVisible && chatPanelWindow && !chatPanelWindow.isDestroyed()) {
      positionChatPanel();
    }
  });

  // Never let the user close the input bar — only quit does that
  inputBarWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
    }
  });
}

function createChatPanelWindow() {
  const savedSize = store.get('chatPanelSize');
  const cpWidth = (savedSize && savedSize.width) || CHAT_PANEL_WIDTH;
  const cpHeight = (savedSize && savedSize.height) || CHAT_PANEL_HEIGHT;

  chatPanelWindow = new BrowserWindow({
    width: cpWidth,
    height: cpHeight,
    minWidth: 400,
    minHeight: 200,
    resizable: true,
    maximizable: false,
    minimizable: false,
    closable: false,        // no native close — custom X button instead
    transparent: true,
    frame: false,
    hasShadow: false,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../renderer/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  chatPanelWindow.loadFile(path.join(__dirname, '../renderer/chat-panel.html'));
  // Chat panel starts ignoring mouse events; renderer toggles when cursor is over panel
  chatPanelWindow.setIgnoreMouseEvents(true, { forward: true });

  // Persist size when user resizes
  chatPanelWindow.on('resize', () => {
    if (chatPanelWindow && !chatPanelWindow.isDestroyed()) {
      const [w, h] = chatPanelWindow.getSize();
      store.set('chatPanelSize', { width: w, height: h });
    }
  });

  // Intercept native close → hide (the custom X button calls close-chat-panel IPC)
  chatPanelWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      hideChatPanel();
    }
  });
}

// ── Chat panel positioning ────────────────────────────────────────────────────

function positionChatPanel() {
  if (!chatPanelWindow || !inputBarWindow) return;
  if (chatPanelWindow.isDestroyed() || inputBarWindow.isDestroyed()) return;

  const ibBounds = inputBarWindow.getBounds();
  const [cpW, cpH] = chatPanelWindow.getSize();
  const x = ibBounds.x;
  const y = ibBounds.y - cpH - PANEL_GAP;
  const { height: screenH } = screen.getPrimaryDisplay().workAreaSize;
  const safeY = Math.max(20, Math.min(y, screenH - cpH - 20));

  chatPanelWindow.setPosition(x, safeY);
}

function showChatPanel() {
  if (!chatPanelWindow || chatPanelWindow.isDestroyed()) return;
  positionChatPanel();
  chatPanelWindow.show();
  chatPanelVisible = true;
  if (inputBarWindow && !inputBarWindow.isDestroyed()) {
    inputBarWindow.webContents.send('chat-panel-state', { visible: true });
  }
  // Show in Dock + Cmd+Tab when chat panel is visible (macOS)
  if (process.platform === 'darwin' && app.dock) {
    app.dock.show();
  }
}

function hideChatPanel() {
  if (!chatPanelWindow || chatPanelWindow.isDestroyed()) return;
  chatPanelWindow.hide();
  chatPanelVisible = false;
  if (inputBarWindow && !inputBarWindow.isDestroyed()) {
    inputBarWindow.webContents.send('chat-panel-state', { visible: false });
  }
  // Hide from Dock + Cmd+Tab when only the input pill is showing (macOS)
  if (process.platform === 'darwin' && app.dock) {
    app.dock.hide();
  }
}

function toggleChatPanel() {
  if (chatPanelVisible) {
    hideChatPanel();
  } else {
    showChatPanel();
  }
}

// ── Tray ──────────────────────────────────────────────────────────────────────

function createTrayIcon(connected) {
  const size = 16;
  const svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <circle cx="8" cy="8" r="6" fill="${connected ? '#22C55E' : '#EF4444'}" />
  </svg>`;
  return nativeImage.createFromBuffer(Buffer.from(svg), { width: size, height: size });
}

function updateTrayMenu(connected) {
  const statusLabel = connected ? 'Connected' : 'Disconnected';
  const menu = Menu.buildFromTemplate([
    { label: `Status: ${statusLabel}`, enabled: false },
    { type: 'separator' },
    {
      label: 'Show Input Bar',
      click: () => {
        if (inputBarWindow) {
          inputBarWindow.show();
        }
      },
    },
    {
      label: 'Toggle Chat Panel',
      click: () => toggleChatPanel(),
    },
    {
      label: connected ? 'Disconnect' : 'Connect',
      click: () => {
        if (connected) {
          nodeManager && nodeManager.stop();
        } else {
          inputBarWindow && inputBarWindow.show();
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.isQuitting = true;
        if (nodeManager) nodeManager.stop();
        if (inputBarWindow && !inputBarWindow.isDestroyed()) inputBarWindow.destroy();
        if (chatPanelWindow && !chatPanelWindow.isDestroyed()) chatPanelWindow.destroy();
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(menu);

  try {
    tray.setImage(createTrayIcon(connected));
  } catch (_) {}
}

function createTray() {
  const icon = createTrayIcon(false);
  tray = new Tray(icon);
  tray.setToolTip('Dopl Connect');
  updateTrayMenu(false);

  tray.on('click', () => {
    if (inputBarWindow) {
      inputBarWindow.show();
    }
  });
}

// ── Chat Manager ──────────────────────────────────────────────────────────────

function initChatManager(decoded) {
  const { gatewayUrl, authToken } = decoded;
  const webAppUrl = decoded.webAppUrl || store.get('webAppUrl') || 'https://usedopl.com';
  chatManager = new ChatManager({ gatewayUrl, authToken, webAppUrl });
}

// ── Broadcast helpers ─────────────────────────────────────────────────────────

function broadcastToAll(channel, data) {
  if (inputBarWindow && !inputBarWindow.isDestroyed()) {
    inputBarWindow.webContents.send(channel, data);
  }
  if (chatPanelWindow && !chatPanelWindow.isDestroyed()) {
    chatPanelWindow.webContents.send(channel, data);
  }
}

// ── App lifecycle ─────────────────────────────────────────────────────────────

// Single-instance lock — quit if another instance is already running
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (inputBarWindow && !inputBarWindow.isDestroyed()) {
      inputBarWindow.show();
    }
  });
}

app.whenReady().then(() => {
  const ipcDeps = {
    getInputBarWindow: () => inputBarWindow,
    getChatPanelWindow: () => chatPanelWindow,
    store,
    getNodeManager: () => nodeManager,
    setNodeManager: (nm) => { nodeManager = nm; },
    getChatManager: () => chatManager,
    setChatManager: (cm) => { chatManager = cm; },
    getEventManager: () => eventManager,
    setEventManager: (em) => { eventManager = em; },
    updateTrayMenu,
    initChatManager,
    showChatPanel,
    hideChatPanel,
    toggleChatPanel,
    getChatPanelVisible: () => chatPanelVisible,
    broadcastToAll,
    getRuntimeManager: () => runtimeManager,
    storeToken,
    loadToken,
    clearToken,
    SETUP_HEIGHT,
    INPUT_BAR_HEIGHT,
    INPUT_BAR_WIDTH,
  };
  setupIPC(ipcDeps);

  // ── Runtime IPC ───────────────────────────────────────────────────────────
  ipcMain.handle('runtime-status', () => ({
    ready: runtimeManager.ready,
    status: runtimeManager.status,
    error: runtimeManager.error,
  }));

  ipcMain.handle('runtime-retry', async () => {
    try {
      runtimeManager.ready = false;
      runtimeManager.error = null;
      runtimeManager.status = 'checking';
      await runtimeManager.ensure();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  // Forward runtime status changes to the input bar renderer
  runtimeManager.onStatus((status, detail) => {
    if (inputBarWindow && !inputBarWindow.isDestroyed()) {
      inputBarWindow.webContents.send('runtime-status-update', { status, detail });
    }
  });

  // Start with Dock hidden (LSUIElement: true hides by default, but
  // explicitly hide in case the plist flag is removed in the future)
  if (process.platform === 'darwin' && app.dock) {
    app.dock.hide();
  }

  createInputBarWindow();
  createChatPanelWindow();
  createTray();

  // ── Global shortcut: Cmd+Shift+Space to toggle input bar + focus ──────────
  const shortcutRegistered = globalShortcut.register('CommandOrControl+Shift+Space', () => {
    if (!inputBarWindow || inputBarWindow.isDestroyed()) return;

    if (inputBarWindow.isVisible() && inputBarWindow.isFocused()) {
      // Already visible and focused — hide it
      inputBarWindow.hide();
      if (chatPanelVisible) hideChatPanel();
    } else {
      // Show, bring to front, and focus the input
      inputBarWindow.show();
      inputBarWindow.focus();
      inputBarWindow.webContents.send('focus-input');
    }
  });

  if (!shortcutRegistered) {
    console.warn('[Shortcut] Failed to register Cmd+Shift+Space — may be in use by another app');
  } else {
    console.log('[Shortcut] Cmd+Shift+Space registered for toggle');
  }

  // ── Permission triggers ──
  // Check accessibility on each launch. Screen recording is checked only once
  // (on first launch) since desktopCapturer-based detection is unreliable on
  // newer macOS and causes false positives that open System Preferences every time.
  {
    const { systemPreferences, shell } = require('electron');

    // Accessibility — passing true shows the system prompt if not already granted
    const accessibilityGranted = systemPreferences.isTrustedAccessibilityClient(false);
    if (!accessibilityGranted) {
      setTimeout(() => {
        systemPreferences.isTrustedAccessibilityClient(true);
        console.log('[Permissions] Accessibility: prompt shown');
      }, 2000);
    } else {
      console.log('[Permissions] Accessibility: granted');
    }

    // Screen Recording — prompt once on first launch only
    const screenRecordingPrompted = store.get('screenRecordingPrompted', false);
    if (!screenRecordingPrompted) {
      store.set('screenRecordingPrompted', true);
      setTimeout(() => {
        console.log('[Permissions] Screen Recording: first launch, opening preferences…');
        shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture');
      }, 4000);
    }
  }

  // ── Kick off runtime setup (downloads Node.js + openclaw if needed) ─────────
  // Run this eagerly so it's ready by the time the user connects.
  runtimeManager.ensure().catch((err) => {
    console.error('[RuntimeManager] Setup failed:', err.message);
  });

  // Auto-reconnect if token exists
  const rawToken = loadToken();
  if (rawToken) {
    try {
      const decoded = JSON.parse(Buffer.from(rawToken, 'base64').toString('utf-8'));
      initChatManager(decoded);

      // Start the persistent background event stream
      eventManager = new EventManager({
        webAppUrl: decoded.webAppUrl || store.get('webAppUrl') || 'https://usedopl.com',
        authToken: decoded.authToken,
      });
      wireEventManager(eventManager, ipcDeps);
      eventManager.start();

      nodeManager = new NodeManager(decoded);
      nodeManager.setRuntimeManager(runtimeManager);
      // Wire provisioning URL to RuntimeManager so it can fetch the required
      // openclaw version dynamically on next ensure() call.
      if (nodeManager.provisioningApiUrl) {
        runtimeManager.setProvisioningUrl(nodeManager.provisioningApiUrl);
      }
      nodeManager.on('status', (status) => {
        // status can be true (connected), false (disconnected), or 'connecting'
        const connected = status === true;
        updateTrayMenu(connected);
        broadcastToAll('status-update', {
          connected,
          connecting: status === 'connecting',
          gatewayUrl: decoded.gatewayUrl,
          instanceId: decoded.instanceId,
          error: nodeManager.lastError,
        });
      });
      nodeManager.start().catch(() => {});
    } catch (_) {
      clearToken();
    }
  }
});

app.on('window-all-closed', () => {
  // Keep running in tray
});

app.on('before-quit', () => {
  app.isQuitting = true;
  globalShortcut.unregisterAll();
  if (nodeManager) nodeManager.stop();
  if (eventManager) eventManager.stop();
  // Force-destroy both windows — .destroy() bypasses closable:false and close event handlers
  if (inputBarWindow && !inputBarWindow.isDestroyed()) inputBarWindow.destroy();
  if (chatPanelWindow && !chatPanelWindow.isDestroyed()) chatPanelWindow.destroy();
});

// Handle macOS dock "Quit" menu item
app.on('will-quit', () => {
  app.isQuitting = true;
});
