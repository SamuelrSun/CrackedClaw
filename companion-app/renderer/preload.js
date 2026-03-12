const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('dopl', {
  // ── Window Controls (input bar resize) ────────────────────────────────────
  windowSetSize: (width, height, animate) => ipcRenderer.send('window-set-size', { width, height, animate }),
  windowGetSize: () => ipcRenderer.invoke('window-get-size'),

  // ── Chat Panel Window Controls ────────────────────────────────────────────
  toggleChatPanel: () => ipcRenderer.send('toggle-chat-panel'),
  showChatPanel:   () => ipcRenderer.send('show-chat-panel'),
  closeChatPanel:  () => ipcRenderer.send('close-chat-panel'),
  getChatPanelVisible: () => ipcRenderer.invoke('get-chat-panel-visible'),

  /** Called by input bar when its chat panel toggle button state needs syncing. */
  onChatPanelState: (callback) => {
    ipcRenderer.on('chat-panel-state', (_event, data) => callback(data));
  },

  // ── Connection ────────────────────────────────────────────────────────────
  getState: () => ipcRenderer.invoke('get-state'),
  connect:  (token) => ipcRenderer.invoke('connect', token),
  disconnect: () => ipcRenderer.invoke('disconnect'),
  onStatusUpdate: (callback) => {
    ipcRenderer.on('status-update', (_event, data) => callback(data));
  },

  // ── Glass Tint ───────────────────────────────────────────────────────────
  getGlassTint: () => ipcRenderer.invoke('glass-tint:get'),
  setGlassTint: (value) => ipcRenderer.invoke('glass-tint:set', value),
  /** Fires when the tint is changed from the OTHER window. */
  onGlassTintChanged: (callback) => {
    ipcRenderer.on('glass-tint-changed', (_event, value) => callback(value));
  },

  // ── Open in Browser ──────────────────────────────────────────────────────
  /** Opens a URL in the user's default browser via shell.openExternal(). */
  openInBrowser: (url) => ipcRenderer.send('open-in-browser', url),

  // ── Conversation sync across windows ─────────────────────────────────────
  /**
   * Notify main that a conversation was selected. Main will broadcast
   * 'conversation-selected' to BOTH windows.
   */
  selectConversation: (id, title) => ipcRenderer.send('chat:select-conversation', { id, title }),
  onConversationSelected: (callback) => {
    ipcRenderer.on('conversation-selected', (_event, data) => callback(data));
  },

  // ── Chat ─────────────────────────────────────────────────────────────────
  chat: {
    listConversations: () =>
      ipcRenderer.invoke('chat:list-conversations'),

    createConversation: (title) =>
      ipcRenderer.invoke('chat:create-conversation', title),

    loadMessages: (conversationId) =>
      ipcRenderer.invoke('chat:load-messages', conversationId),

    saveMessage: (conversationId, role, content) =>
      ipcRenderer.invoke('chat:save-message', { conversationId, role, content }),

    /** Send a message from the input bar. Returns { ok, content, error }. */
    sendMessage: (conversationId, message) =>
      ipcRenderer.invoke('chat:send-message', { conversationId, message }),

    /** Chat panel listens for the user message echo (sent before streaming). */
    onShowUserMessage: (callback) => {
      ipcRenderer.on('chat:show-user-message', (_event, data) => callback(data));
    },

    /** Streaming chunk (for chat panel). */
    onStreamChunk: (callback) => {
      ipcRenderer.on('chat:stream-chunk', (_event, chunk) => callback(chunk));
    },

    /** Called when the assistant message is complete (chat panel finalizes bubble). */
    onMessageFinalized: (callback) => {
      ipcRenderer.on('chat:message-finalized', (_event, data) => callback(data));
    },

    removeStreamListeners: () => {
      ipcRenderer.removeAllListeners('chat:stream-chunk');
      ipcRenderer.removeAllListeners('chat:show-user-message');
      ipcRenderer.removeAllListeners('chat:message-finalized');
    },
  },
});
