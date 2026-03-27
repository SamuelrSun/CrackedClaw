const { ipcMain, shell, BrowserWindow, Notification } = require('electron');
const NodeManager = require('./node-manager');
const EventManager = require('./event-manager');

/**
 * Set up all IPC handlers for the two-window architecture.
 *
 * Window 1 (inputBarWindow): setup screen + input pill
 * Window 2 (chatPanelWindow): messages + tint + conversation list
 */
/**
 * Wire all EventManager event listeners.
 * Exported so index.js can call it for the auto-reconnect path too.
 *
 * @param {EventManager} em - The EventManager instance to wire.
 * @param {object} deps     - Same deps object passed to setupIPC.
 */
function wireEventManager(em, deps) {
  const {
    getChatPanelWindow,
    getInputBarWindow,
    getChatPanelVisible,
    broadcastToAll,
    showChatPanel,
    store,
  } = deps;

  // Helper to fire a desktop notification — mirrors fireNotification but
  // without the inline-reply chain (that lives inside setupIPC scope).
  // For task completions we just notify and open the panel on click.
  function _simpleNotification(conversationId, title, body) {
    if (!Notification.isSupported()) return;
    const notif = new Notification({
      title,
      body,
      silent: store.get('notificationsSilent', false),
    });
    notif.on('click', () => {
      showChatPanel();
      // Only switch conversation in the main panel, not pop-outs
      const cp = getChatPanelWindow();
      if (cp && !cp.isDestroyed()) cp.webContents.send('conversation-selected', { id: conversationId, title: 'Chat' });
      const ibw = getInputBarWindow();
      if (ibw && !ibw.isDestroyed()) ibw.show();
    });
    notif.show();
  }

  em.on('new_message', (data) => {
    // data: { id, conversation_id, role, content, created_at }

    // Push the message into all chat windows showing the right conversation
    broadcastToAll('chat:pushed-message', {
      id: data.id,
      conversationId: data.conversation_id,
      role: data.role,
      content: data.content,
      timestamp: data.created_at,
    });

    // Fire a desktop notification when the panel isn't focused / visible
    const notificationsEnabled = store.get('notificationsEnabled', true);
    const appFocused = BrowserWindow.getFocusedWindow() !== null;
    const panelVisible = getChatPanelVisible();
    if (notificationsEnabled && (!appFocused || !panelVisible)) {
      const plain = (data.content || '')
        .replace(/[#*_`~\[\]()>]/g, '')
        .replace(/\n+/g, ' ')
        .trim();
      const summary = plain.length > 120 ? plain.slice(0, 117) + '…' : plain;
      _simpleNotification(data.conversation_id, 'Dopl', summary || 'New message');
    }
  });

  em.on('task_update', (data) => {
    // Broadcast task updates to both windows so the UI can reflect status changes
    broadcastToAll('task-update', data);

    // Fire a notification when a task completes
    if (data.status === 'completed' && data.result) {
      const notificationsEnabled = store.get('notificationsEnabled', true);
      if (!notificationsEnabled) return;

      const plain = (data.result || '')
        .replace(/[#*_`~\[\]()>]/g, '')
        .replace(/\n+/g, ' ')
        .trim();
      const summary = plain.length > 120 ? plain.slice(0, 117) + '…' : plain;
      const taskLabel = data.label || data.name || 'Task';
      _simpleNotification(
        data.conversation_id,
        `✅ ${taskLabel}`,
        summary || 'Task completed'
      );
    }
  });
}

function setupIPC(deps) {
  const {
    getInputBarWindow,
    getChatPanelWindow,
    createPopOutChatWindow,
    store,
    getNodeManager,
    setNodeManager,
    getChatManager,
    setChatManager,
    getEventManager,
    setEventManager,
    updateTrayMenu,
    initChatManager,
    showChatPanel,
    hideChatPanel,
    toggleChatPanel,
    getChatPanelVisible,
    broadcastToAll,
    getRuntimeManager,
    storeToken,
    loadToken,
    clearToken,
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
      accessibilityPrompted: store.get('accessibilityPrompted', false),
      screenRecordingPrompted: store.get('screenRecordingPrompted', false),
      // Screen recording can't be directly checked on macOS
      screenRecording: true,
    };
  });

  ipcMain.handle('open-accessibility-settings', async () => {
    shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility');
  });

  ipcMain.handle('open-screen-recording-settings', async () => {
    shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture');
  });

  // Re-trigger the native accessibility dialog (for when user needs to re-grant after an app update)
  ipcMain.handle('prompt-accessibility', async () => {
    const { systemPreferences } = require('electron');
    systemPreferences.isTrustedAccessibilityClient(true);
    store.set('accessibilityPrompted', true);
    return { prompted: true };
  });

  // Reset permission prompt flags — allows first-launch prompts to fire again
  ipcMain.handle('reset-permission-prompts', async () => {
    store.delete('accessibilityPrompted');
    store.delete('screenRecordingPrompted');
    return { ok: true };
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

  // ── Pop-out chat window ────────────────────────────────────────────────────

  ipcMain.handle('pop-out-chat', (_event, { conversationId } = {}) => {
    if (createPopOutChatWindow) {
      createPopOutChatWindow(conversationId || '');
      return { ok: true };
    }
    return { ok: false, error: 'Pop-out not available' };
  });

  // ── Connection IPC ─────────────────────────────────────────────────────────

  ipcMain.handle('get-state', () => {
    const nodeManager = getNodeManager();
    const token = loadToken ? loadToken() : store.get('connectionToken') || null;
    return {
      connected: nodeManager ? nodeManager.connected : false,
      token: token ? '***' : null, // don't send raw token to renderer
      hasToken: !!token,
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

      if (storeToken) storeToken(rawToken); else store.set('connectionToken', rawToken);
      store.set('gatewayUrl', gatewayUrl);
      store.set('instanceId', instanceId);
      store.set('authToken', authToken);
      store.set('webAppUrl', webAppUrl || 'https://usedopl.com');
      if (operatorToken) store.set('operatorToken', operatorToken);
      if (provisioningUrl) store.set('provisioningUrl', provisioningUrl);

      initChatManager(decoded);

      // Stop any existing EventManager and remove its listeners before creating a new one.
      // This prevents listener accumulation across reconnects.
      const existingEm = getEventManager ? getEventManager() : null;
      if (existingEm) {
        existingEm.stop();
        existingEm.removeAllListeners();
      }

      const em = new EventManager({
        webAppUrl: webAppUrl || store.get('webAppUrl') || 'https://usedopl.com',
        authToken,
      });
      if (setEventManager) setEventManager(em);
      wireEventManager(em, deps);
      em.start();

      const nodeManager = new NodeManager({ gatewayUrl, instanceId, authToken, operatorToken, provisioningUrl, webAppUrl: webAppUrl || store.get('webAppUrl') });
      const rm = getRuntimeManager ? getRuntimeManager() : null;
      if (rm) {
        nodeManager.setRuntimeManager(rm);
        // Tell RuntimeManager where the provisioning API is so it can
        // dynamically fetch the required openclaw version on next ensure().
        // nodeManager.provisioningApiUrl is already resolved (handles both
        // explicit provisioningUrl and derived-from-webAppUrl cases).
        if (nodeManager.provisioningApiUrl) {
          rm.setProvisioningUrl(nodeManager.provisioningApiUrl);
        }
      }
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
    // Stop the background event stream
    if (getEventManager) {
      const em = getEventManager();
      if (em) { em.stop(); setEventManager(null); }
    }
    setChatManager(null);
    if (clearToken) clearToken(); else store.delete('connectionToken');
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
  ipcMain.on('chat:select-conversation', (event, { id, title }) => {
    // Only send back to the window that selected — don't sync across windows
    event.sender.send('conversation-selected', { id, title });
  });

  // ── Notification Helper ────────────────────────────────────────────────────

  /**
   * Create and show a rich desktop notification for a Dopl response.
   *
   * Features:
   *  - Inline reply field (hasReply) so the user can reply without opening the app
   *  - Reply handler streams the response back and fires a follow-up notification
   *    recursively, enabling a full back-and-forth from the notification tray
   *  - Click handler brings the chat panel into view
   *
   * @param {string} conversationId - The conversation to reply into.
   * @param {string} fullContent    - The assistant's full markdown response.
   */
  function fireNotification(conversationId, fullContent) {
    if (!fullContent || !Notification.isSupported()) return;

    const plain = fullContent.replace(/[#*_`~\[\]()>]/g, '').replace(/\n+/g, ' ').trim();
    const summary = plain.length > 120 ? plain.slice(0, 117) + '…' : plain;

    const notif = new Notification({
      title: 'Dopl',
      body: summary || 'Response ready',
      silent: store.get('notificationsSilent', false),
      hasReply: true,
      replyPlaceholder: 'Reply to Dopl…',
      closeButtonText: 'Dismiss',
    });

    // Click → open chat panel on the right conversation (main panel only)
    notif.on('click', () => {
      showChatPanel();
      const cp = getChatPanelWindow();
      if (cp && !cp.isDestroyed()) cp.webContents.send('conversation-selected', { id: conversationId, title: 'Chat' });
      const ibw = getInputBarWindow();
      if (ibw && !ibw.isDestroyed()) ibw.show();
    });

    // Inline reply → send as a new message, stream to chat panel, then recurse
    notif.on('reply', (_event, replyText) => {
      if (!replyText || !replyText.trim()) return;

      // Bring conversation into view (main panel only)
      showChatPanel();
      const cp = getChatPanelWindow();
      if (cp && !cp.isDestroyed()) cp.webContents.send('conversation-selected', { id: conversationId, title: 'Chat' });
      const ibw = getInputBarWindow();
      if (ibw && !ibw.isDestroyed()) ibw.show();

      const cm = getChatManager();
      if (!cm) return;

      const chatPanel = getChatPanelWindow();

      // Echo the user's reply immediately into all chat windows
      broadcastToAll('chat:show-user-message', {
        conversationId,
        role: 'user',
        content: replyText.trim(),
        timestamp: new Date().toISOString(),
      });

      // Send and stream the response
      cm.sendMessage(conversationId, replyText.trim(), (chunk) => {
        broadcastToAll('chat:stream-chunk', { conversationId, text: chunk });
      }).then((responseContent) => {
        broadcastToAll('chat:message-finalized', { ok: true, content: responseContent, conversationId });

        // Tell the input bar that the notification-triggered reply is complete
        // so it can reset isStreaming / re-enable the input if needed
        const ib = getInputBarWindow();
        if (ib && !ib.isDestroyed()) {
          ib.webContents.send('chat:reply-from-notification-complete', { conversationId });
        }

        // Fire a follow-up notification so the user can keep the thread going
        // entirely from the notification tray (recursive chain)
        fireNotification(conversationId, responseContent);
      }).catch((err) => {
        broadcastToAll('chat:message-finalized', { ok: false, error: err.message, conversationId });
      });
    });

    notif.show();
  }

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

    // Push the user message to ALL chat windows (each will filter by conversationId)
    broadcastToAll('chat:show-user-message', {
      conversationId,
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    });

    try {
      const fullContent = await chatManager.sendMessage(
        conversationId,
        message,
        (chunk) => {
          // Broadcast chunk with conversationId so each window can filter
          broadcastToAll('chat:stream-chunk', { conversationId, text: chunk });
        }
      );

      // Signal message complete to all windows
      broadcastToAll('chat:message-finalized', { ok: true, content: fullContent, conversationId });

      // ── Desktop notification ─────────────────────────────────────────────
      // Notify only when the app is not focused or the chat panel is hidden.
      const appFocused = BrowserWindow.getFocusedWindow() !== null;
      const panelVisible = getChatPanelVisible();
      const notificationsEnabled = store.get('notificationsEnabled', true);
      const shouldNotify = notificationsEnabled && (!appFocused || !panelVisible);

      if (shouldNotify) {
        fireNotification(conversationId, fullContent);
      }

      return { ok: true, content: fullContent };
    } catch (err) {
      // Handle billing errors (402 insufficient balance / 429 legacy usage limit)
      if (err.billingData) {
        broadcastToAll('chat:billing-error', err.billingData);
        broadcastToAll('chat:message-finalized', { ok: false, error: err.message, billingData: err.billingData, conversationId });
        return { ok: false, error: err.message, billingData: err.billingData };
      }
      broadcastToAll('chat:message-finalized', { ok: false, error: err.message, conversationId });
      return { ok: false, error: err.message };
    }
  });

  // ── Abort IPC ────────────────────────────────────────────────────────────────

  ipcMain.handle('chat:abort-message', () => {
    const chatManager = getChatManager();
    if (chatManager) chatManager.abortMessage();
    return { ok: true };
  });

  // ── Balance IPC ──────────────────────────────────────────────────────────────

  ipcMain.handle('billing:get-balance', async () => {
    const chatManager = getChatManager();
    if (!chatManager) return { ok: false, error: 'Not connected' };
    try {
      const baseUrl = await chatManager._resolveBaseUrl();
      // Use companion-specific balance endpoint
      const res = await fetch(`${baseUrl}/api/companion/balance`, {
        headers: { 'X-Companion-Token': chatManager.authToken },
      });
      if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
      const data = await res.json();
      return { ok: true, balance: data.balance_usd ?? data.balance ?? null };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  // ── Notification Preferences IPC ───────────────────────────────────────────

  ipcMain.handle('notifications:get-enabled', () => store.get('notificationsEnabled', true));
  ipcMain.handle('notifications:set-enabled', (_event, value) => {
    store.set('notificationsEnabled', !!value);
    return !!value;
  });
  ipcMain.handle('notifications:get-silent', () => store.get('notificationsSilent', false));
  ipcMain.handle('notifications:set-silent', (_event, value) => {
    store.set('notificationsSilent', !!value);
    return !!value;
  });
}

module.exports = { setupIPC, wireEventManager };
