const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('crackedclaw', {
  getState: () => ipcRenderer.invoke('get-state'),
  connect: (token) => ipcRenderer.invoke('connect', token),
  disconnect: () => ipcRenderer.invoke('disconnect'),
  onStatusUpdate: (callback) => {
    ipcRenderer.on('status-update', (_event, data) => callback(data));
  },
});
