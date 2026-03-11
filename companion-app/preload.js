const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('crackedclaw', {
  // ── Connection ────────────────────────────────────────────────────────────
  getState: () => ipcRenderer.invoke('get-state'),
  connect: (token) => ipcRenderer.invoke('connect', token),
  disconnect: () => ipcRenderer.invoke('disconnect'),
  onStatusUpdate: (callback) => {
    ipcRenderer.on('status-update', (_event, data) => callback(data));
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
