const { ipcMain, shell, BrowserWindow } = require('electron');
const NodeManager = require('./node-manager');

/**
 * Set up all IPC handlers for the two-window architecture.
 *
 * Window 1 (inputBarWindow): setup screen + input pill
 * Window 2 (chatPanelWindow): messages + tint + conversation list
 */
function setupIPC(deps) {
  const {
    getInputBarWindow,
    getChatPanelWindow,
    store,
    getNodeManager,
    setNodeManager,
    getChatManager,
    setChatManager,
    updateTrayMenu,
    initChatManager,
    showChatPanel,
    hideChatPanel,
    toggleChatPanel,
    getChatPanelVisible,
    broadcastToAll,
    getRuntimeManager,
    INPUT_BAR_HEIGHT,
    INPUT_BAR_WIDTH,
  } = deps;

  // ── Click-through IPC ─────────────────────────────────────────────────────
  // Renderer sends this to toggle mouse event pass-through when cursor moves
  // over transparent vs interactive areas.
  ipcMain.on('set-ignore-mouse-events', (event, { ignore }) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.setIgnoreMouseEvents(!!ignore, { forward: true });
  });

  // ── Permissions IPC ───────────────────────────────────────────────────────

  ipcMain.handle('check-permissions', async () => {
    const { systemPreferences } = require('electron');
    return {
      accessibility: systemPreferences.isTrustedAccessibilityClient(false),
      // Screen recording can't be directly checked, but we can try
      screenRecording: true, // assume true, will fail gracefully if not
    };
  });

  ipcMain.handle('open-accessibility-settings', async () => {
    shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility');
  });

  ipcMain.handle('open-screen-recording-settings', async () => {
    shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture');
  });

  // ── Open in Browser ───────────────────────────────────────────────────────

  ipcMain.on('open-in-browser', (_event, url) => {
    if (url && typeof url === 'string') {
      shell.openExternal(url).catch((err) => {
        console.error('[IPC] open-in-browser failed:', err);
      });
    }
  });

  // ── Input-bar window resize helpers ────────────────────────────────────────

  /**
   * Resize the input bar window, anchoring the bottom edge.
   * The bottom of the window stays fixed; height grows upward.
   */
  function resizeInputBar(newWidth, newHeight, animate) {
    const win = getInputBarWindow();
    if (!win || win.isDestroyed()) return;
    const bounds = win.getBounds();
    const bottomEdge = bounds.y + bounds.height; // keep this fixed
    const newY = bottomEdge - newHeight;
    win.setBounds({
      x: bounds.x,
      y: newY,
      width: newWidth || bounds.width,
      height: newHeight,
    }, !!animate);
  }

  // ── Window Controls IPC (input bar window) ─────────────────────────────────

  ipcMain.on('window-close', () => {
    // Input bar cannot be closed by user; this is a no-op
  });

  ipcMain.on('window-minimize', () => {
    // No-op — input bar has no minimize
  });

  ipcMain.on('window-zoom', () => {
    // No-op
  });

  ipcMain.on('window-set-size', (_event, { width, height, animate }) => {
    resizeInputBar(width, height, animate);
  });

  ipcMain.handle('window-get-size', () => {
    const win = getInputBarWindow();
    if (win && !win.isDestroyed()) {
      return win.getSize();
    }
    return [INPUT_BAR_WIDTH, INPUT_BAR_HEIGHT];
  });

  // ── Chat Panel Window Controls ─────────────────────────────────────────────

  ipcMain.on('toggle-chat-panel', () => {
    toggleChatPanel();
  });

  ipcMain.on('show-chat-panel', () => {
    showChatPanel();
  });

  ipcMain.on('close-chat-panel', () => {
    hideChatPanel();
  });

  ipcMain.handle('get-chat-panel-visible', () => {
    return getChatPanelVisible();
  });

  // ── Connection IPC ─────────────────────────────────────────────────────────

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
      const { gatewayUrl, instanceId, authToken, operatorToken, webAppUrl, provisioningUrl } = decoded;

      if (!gatewayUrl || !instanceId || !authToken) {
        return { ok: false, error: 'Invalid token: missing required fields' };
      }

      store.set('connectionToken', rawToken);
      store.set('gatewayUrl', gatewayUrl);
      store.set('instanceId', instanceId);
      store.set('authToken', authToken);
      store.set('webAppUrl', webAppUrl || 'https://usedopl.com');
      if (operatorToken) store.set('operatorToken', operatorToken);
      if (provisioningUrl) store.set('provisioningUrl', provisioningUrl);

      initChatManager(decoded);

      const nodeManager = new NodeManager({ gatewayUrl, instanceId, authToken, operatorToken, provisioningUrl, webAppUrl: webAppUrl || store.get('webAppUrl') });
      if (getRuntimeManager) nodeManager.setRuntimeManager(getRuntimeManager());
      setNodeManager(nodeManager);

      nodeManager.on('status', (status) => {
        // status can be true (connected), false (disconnected), or 'connecting'
        const connected = status === true;
        updateTrayMenu(connected);
        broadcastToAll('status-update', {
          connected,
          connecting: status === 'connecting',
          gatewayUrl,
          instanceId,
          error: nodeManager.lastError,
        });
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
    // Broadcast disconnect to all windows
    broadcastToAll('status-update', { connected: false, disconnected: true });
    return { ok: true };
  });

  // ── Glass Tint IPC ─────────────────────────────────────────────────────────

  ipcMain.handle('glass-tint:get', () => {
    const saved = store.get('glassTintOpacity');
    return (saved !== undefined && saved !== null) ? saved : 0.15;
  });

  ipcMain.handle('glass-tint:set', (_event, value) => {
    const clamped = Math.max(0, Math.min(0.7, Number(value)));
    store.set('glassTintOpacity', clamped);
    // Broadcast to both windows so tint stays in sync
    broadcastToAll('glass-tint-changed', clamped);
    return clamped;
  });

  // ── Conversation selection cross-window sync ───────────────────────────────

  /**
   * Called when either window selects a conversation.
   * Broadcasts to BOTH windows so each can update its UI.
   */
  ipcMain.on('chat:select-conversation', (_event, { id, title }) => {
    broadcastToAll('conversation-selected', { id, title });
  });

  // ── Chat IPC ───────────────────────────────────────────────────────────────

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

  /**
   * chat:send-message — invoked by the input bar window.
   *
   * Flow:
   *  1. Push the user message to the chat panel immediately so it appears.
   *  2. Stream assistant chunks to the chat panel.
   *  3. Return the full response to the input bar.
   */
  ipcMain.handle('chat:send-message', async (_event, { conversationId, message }) => {
    const chatManager = getChatManager();
    if (!chatManager) return { ok: false, error: 'Not connected' };

    const chatPanel = getChatPanelWindow();

    // Push the user message to the chat panel right away
    if (chatPanel && !chatPanel.isDestroyed()) {
      chatPanel.webContents.send('chat:show-user-message', {
        conversationId,
        role: 'user',
        content: message,
        timestamp: new Date().toISOString(),
      });
    }

    try {
      const fullContent = await chatManager.sendMessage(
        conversationId,
        message,
        (chunk) => {
          if (chatPanel && !chatPanel.isDestroyed()) {
            chatPanel.webContents.send('chat:stream-chunk', chunk);
          }
        }
      );

      // Signal message complete to chat panel
      if (chatPanel && !chatPanel.isDestroyed()) {
        chatPanel.webContents.send('chat:message-finalized', { ok: true, content: fullContent });
      }

      return { ok: true, content: fullContent };
    } catch (err) {
      if (chatPanel && !chatPanel.isDestroyed()) {
        chatPanel.webContents.send('chat:message-finalized', { ok: false, error: err.message });
      }
      return { ok: false, error: err.message };
    }
  });
}

module.exports = { setupIPC };
