// The bridge for the glass bubble window: it receives text and reports how big it turned out.

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('bubble', {
  onShow: callback => ipcRenderer.on('show', (_event, message) => callback(message)),
  reportSize: (width, height) => ipcRenderer.send('bubble-size', width, height),
})
