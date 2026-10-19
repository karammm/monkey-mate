// The bridge for Momo's click menu.

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('menu', {
  act: message => ipcRenderer.send('menu-action', message),
  size: height => ipcRenderer.send('menu-size', height),
  onOpen: callback => ipcRenderer.on('open', (_event, info) => callback(info)),
})
