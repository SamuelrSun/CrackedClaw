const { ipcMain } = require('electron');
const NodeManager = require('./node-manager');

/**
 * Set up all IPC handlers.
 *
 * @param {object} deps
 * @param {() => BrowserWindow} deps.getMainWindow
 * @param {import('electron-store')} deps.store
 * @param {() => NodeManager|null} deps.getNodeManager
 * @param {(nm: NodeManager|null) => void} deps.setNodeManager
 * @param {() => object|null} deps.getChatManager
 * @param {(cm: object|null) => void} deps.setChatManager
 * @param {(connected: boolean) => void} deps.updateTrayMenu
 * @param {(decoded: object) => void} deps.initChatManager
 */
function setupIPC(deps) {
  const {
    getMainWindow,
    store,
    getNodeManager,
    setNodeManager,
    getChatManager,
    setChatManager,
    updateTrayMenu,
    initChatManager,
  } = deps;

  // ── Window Controls IPC ──────────────────────────────────────────────────────

  ipcMain.on('window-close', () => {
    const mainWindow = getMainWindow();
    if (mainWindow) mainWindow.hide();
  });

  ipcMain.on('window-minimize', () => {
    const mainWindow = getMainWindow();
    if (mainWindow) mainWindow.minimize();
  });

  ipcMain.on('window-zoom', () => {
    const mainWindow = getMainWindow();
    if (mainWindow) {
      if (mainWindow.isMaximized()) mainWindow.unmaximize();
      else mainWindow.maximize();
    }
  });

  // ── Connection IPC ───────────────────────────────────────────────────────────

  ipcMain.handle('get-state', () => {
    const nodeManager = getNodeManager();
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

      const nodeManager = new NodeManager({ gatewayUrl, instanceId, authToken, operatorToken });
      setNodeManager(nodeManager);

      nodeManager.on('status', (connected) => {
        updateTrayMenu(connected);
        const mainWindow = getMainWindow();
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
    const nodeManager = getNodeManager();
    if (nodeManager) {
      nodeManager.stop();
      setNodeManager(null);
    }
    setChatManager(null);
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
    const chatManager = getChatManager();
    if (!chatManager) return { ok: false, error: 'Not connected' };
    try {
      const conversations = await chatManager.listConversations();
      return { ok: true, conversations };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('chat:create-conversation', async (_event, title) => {
    const chatManager = getChatManager();
    if (!chatManager) return { ok: false, error: 'Not connected' };
    try {
      const conversation = await chatManager.createConversation(title);
      return { ok: true, conversation };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('chat:load-messages', async (_event, conversationId) => {
    const chatManager = getChatManager();
    if (!chatManager) return { ok: false, error: 'Not connected' };
    try {
      const messages = await chatManager.loadMessages(conversationId);
      return { ok: true, messages };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('chat:save-message', async (_event, { conversationId, role, content }) => {
    const chatManager = getChatManager();
    if (!chatManager) return { ok: false, error: 'Not connected' };
    try {
      const message = await chatManager.saveMessage(conversationId, role, content);
      return { ok: true, message };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('chat:send-message', async (event, { conversationId, message }) => {
    const chatManager = getChatManager();
    if (!chatManager) return { ok: false, error: 'Not connected' };
    try {
      const fullContent = await chatManager.sendMessage(
        conversationId,
        message,
        (chunk) => {
          // Forward streaming chunks to renderer
          const mainWindow = getMainWindow();
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

module.exports = { setupIPC };
