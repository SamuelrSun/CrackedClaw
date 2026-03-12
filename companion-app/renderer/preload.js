const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('crackedclaw', {
  // ── Window Controls ────────────────────────────────────────────────────────
  windowClose: () => ipcRenderer.send('window-close'),
  windowMinimize: () => ipcRenderer.send('window-minimize'),
  windowZoom: () => ipcRenderer.send('window-zoom'),
  windowSetSize: (width, height, animate) => ipcRenderer.send('window-set-size', { width, height, animate }),
  windowGetSize: () => ipcRenderer.invoke('window-get-size'),

  // ── Connection ────────────────────────────────────────────────────────────
  getState: () => ipcRenderer.invoke('get-state'),
  connect: (token) => ipcRenderer.invoke('connect', token),
  disconnect: () => ipcRenderer.invoke('disconnect'),
  onStatusUpdate: (callback) => {
    ipcRenderer.on('status-update', (_event, data) => callback(data));
  },

  // ── Glass Tint ───────────────────────────────────────────────────────────
  getGlassTint: () => ipcRenderer.invoke('glass-tint:get'),
  setGlassTint: (value) => ipcRenderer.invoke('glass-tint:set', value),

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

    /** Send a message and stream the response. Returns { ok, content, error }. */
    sendMessage: (conversationId, message) =>
      ipcRenderer.invoke('chat:send-message', { conversationId, message }),

    onStreamChunk: (callback) => {
      ipcRenderer.on('chat:stream-chunk', (_event, chunk) => callback(chunk));
    },

    removeStreamListeners: () => {
      ipcRenderer.removeAllListeners('chat:stream-chunk');
    },
  },
});
