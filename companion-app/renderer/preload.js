const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('dopl', {
  // ── Click-through toggle ──────────────────────────────────────────────────
  /** Toggle mouse event pass-through for transparent window areas. */
  setIgnoreMouseEvents: (ignore) => ipcRenderer.send('set-ignore-mouse-events', { ignore }),

  // ── Focus input (from global shortcut) ──────────────────────────────────
  onFocusInput: (callback) => {
    ipcRenderer.on('focus-input', () => callback());
  },

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

  /**
   * Fired by main before re-wiring event listeners on reconnect.
   * Renderers should call removeAllChatListeners() then re-register.
   */
  onCleanupListeners: (callback) => {
    ipcRenderer.on('cleanup-listeners', (_event) => callback());
  },

  // ── Glass Tint ───────────────────────────────────────────────────────────
  getGlassTint: () => ipcRenderer.invoke('glass-tint:get'),
  setGlassTint: (value) => ipcRenderer.invoke('glass-tint:set', value),
  /** Fires when the tint is changed from the OTHER window. */
  onGlassTintChanged: (callback) => {
    ipcRenderer.on('glass-tint-changed', (_event, value) => callback(value));
  },

  // ── Permissions ──────────────────────────────────────────────────────────
  permissions: {
    check: () => ipcRenderer.invoke('check-permissions'),
    openAccessibility: () => ipcRenderer.invoke('open-accessibility-settings'),
    openScreenRecording: () => ipcRenderer.invoke('open-screen-recording-settings'),
    promptAccessibility: () => ipcRenderer.invoke('prompt-accessibility'),
    resetPrompts: () => ipcRenderer.invoke('reset-permission-prompts'),
  },

  // ── Open in Browser ──────────────────────────────────────────────────────
  /** Opens a URL in the user's default browser via shell.openExternal(). */
  openInBrowser: (url) => ipcRenderer.send('open-in-browser', url),

  // ── Runtime Setup ─────────────────────────────────────────────────────────
  runtime: {
    /** Get current runtime status (ready, downloading-node, installing-openclaw, error). */
    status: () => ipcRenderer.invoke('runtime-status'),
    /** Retry runtime setup after a failure. */
    retry: () => ipcRenderer.invoke('runtime-retry'),
    /** Register a callback for real-time runtime status updates. */
    onStatus: (callback) => {
      ipcRenderer.on('runtime-status-update', (_event, data) => callback(data.status, data.detail));
    },
  },

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

    /** Abort the currently streaming message. */
    abortMessage: () =>
      ipcRenderer.invoke('chat:abort-message'),

    /** Chat panel listens for the user message echo (sent before streaming). */
    onShowUserMessage: (callback) => {
      ipcRenderer.on('chat:show-user-message', (_event, data) => callback(data));
    },

    /**
     * Streaming chunk (for chat panel).
     * data: { conversationId: string, text: string }
     */
    onStreamChunk: (callback) => {
      ipcRenderer.on('chat:stream-chunk', (_event, data) => callback(data));
    },

    /** Called when the assistant message is complete (chat panel finalizes bubble). */
    onMessageFinalized: (callback) => {
      ipcRenderer.on('chat:message-finalized', (_event, data) => callback(data));
    },

    removeStreamListeners: () => {
      ipcRenderer.removeAllListeners('chat:stream-chunk');
      ipcRenderer.removeAllListeners('chat:show-user-message');
      ipcRenderer.removeAllListeners('chat:message-finalized');
      ipcRenderer.removeAllListeners('chat:pushed-message');
    },

    /** Remove ALL chat + event listeners. Call before re-registering on reconnect. */
    removeAllChatListeners: () => {
      ipcRenderer.removeAllListeners('chat:stream-chunk');
      ipcRenderer.removeAllListeners('chat:show-user-message');
      ipcRenderer.removeAllListeners('chat:message-finalized');
      ipcRenderer.removeAllListeners('chat:pushed-message');
      ipcRenderer.removeAllListeners('chat:billing-error');
      ipcRenderer.removeAllListeners('chat:reply-from-notification-complete');
      ipcRenderer.removeAllListeners('task-update');
      ipcRenderer.removeAllListeners('conversation-selected');
      ipcRenderer.removeAllListeners('status-update');
      ipcRenderer.removeAllListeners('glass-tint-changed');
      ipcRenderer.removeAllListeners('chat-panel-state');
      ipcRenderer.removeAllListeners('runtime-status-update');
    },

    /**
     * Fires when a background assistant message arrives via the EventManager
     * (i.e., from a task that completed while no active stream was running).
     */
    onPushedMessage: (callback) => {
      ipcRenderer.on('chat:pushed-message', (_event, data) => callback(data));
    },

    /**
     * Fires when an agent_task row changes (status updates, completions, errors).
     * Useful for updating task progress indicators in the chat panel.
     */
    onTaskUpdate: (callback) => {
      ipcRenderer.on('task-update', (_event, data) => callback(data));
    },

    /**
     * Fires when a notification inline-reply has been fully streamed and the
     * assistant response is complete. The input bar uses this to reset its
     * isStreaming state if the conversation that just finished matches the one
     * currently tracked in the input bar.
     */
    onReplyFromNotificationComplete: (callback) => {
      ipcRenderer.on('chat:reply-from-notification-complete', (_event, data) => callback(data));
    },

    /**
     * Fires when the API returns a billing error (402 insufficient balance
     * or 429 legacy usage limit). The input bar should show the error.
     * data: { type, balance, required, reason, nextResetLabel, topUpUrl }
     */
    onBillingError: (callback) => {
      ipcRenderer.on('chat:billing-error', (_event, data) => callback(data));
    },
  },

  // ── Pop-out chat window ──────────────────────────────────────────────────
  /** Spawns a new independent pop-out chat window for the given conversation. */
  popOutChat: (conversationId) => ipcRenderer.invoke('pop-out-chat', { conversationId }),

  // ── Billing ──────────────────────────────────────────────────────────────
  billing: {
    getBalance: () => ipcRenderer.invoke('billing:get-balance'),
  },

  // ── Notification Preferences ──────────────────────────────────────────────
  notifications: {
    getEnabled: () => ipcRenderer.invoke('notifications:get-enabled'),
    setEnabled: (value) => ipcRenderer.invoke('notifications:set-enabled', value),
    getSilent: () => ipcRenderer.invoke('notifications:get-silent'),
    setSilent: (value) => ipcRenderer.invoke('notifications:set-silent', value),
  },
});
