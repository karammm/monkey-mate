// The small, safe bridge between the window and Electron.

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('monkeyMate', {
  onMood: callback => ipcRenderer.on('mood', (_event, mood) => callback(mood)),
  onActivity: callback => ipcRenderer.on('activity', (_event, activity) => callback(activity)),
  onFloor: callback => ipcRenderer.on('floor', (_event, floor) => callback(floor)),
  onPet: callback => ipcRenderer.on('pet', () => callback()),
  onSummon: callback => ipcRenderer.on('summon', () => callback()),
  onTour: callback => ipcRenderer.on('tour', () => callback()),
  onSize: callback => ipcRenderer.on('size', (_event, size) => callback(size)),
  setHover: isOverMomo => ipcRenderer.send('hover', isOverMomo),
})
