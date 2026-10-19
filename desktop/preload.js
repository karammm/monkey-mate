// The small, safe bridge between the window and Electron.

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('monkeyMate', {
  onMood: callback => ipcRenderer.on('mood', (_event, mood) => callback(mood)),
  onActivity: callback => ipcRenderer.on('activity', (_event, activity) => callback(activity)),
  onFloor: callback => ipcRenderer.on('floor', (_event, floor) => callback(floor)),
  onPet: callback => ipcRenderer.on('pet', () => callback()),
  onSummon: callback => ipcRenderer.on('summon', () => callback()),
  onTour: callback => ipcRenderer.on('tour', () => callback()),
  onUserBusy: callback => ipcRenderer.on('user-busy', (_event, busy) => callback(busy)),
  onTyping: callback => ipcRenderer.on('typing', (_event, message) => callback(message)),
  say: message => ipcRenderer.send('bubble', message),
  openMenu: box => ipcRenderer.send('open-menu', box),
  talk: () => ipcRenderer.send('talk'),
  listenForName: on => ipcRenderer.send('listen-for-name', on),
  speaking: on => ipcRenderer.send('speaking', on),
  ask: text => ipcRenderer.send('ask', text),
  question: request => ipcRenderer.send('question', request),
  canThink: () => ipcRenderer.invoke('can-think'),
  onReply: callback => ipcRenderer.on('reply', (_event, reply) => callback(reply)),
  musicApp: () => ipcRenderer.send('menu-action', { action: 'music-app' }),
  voice: request => ipcRenderer.invoke('voice', request),
  onVoicePreset: callback => ipcRenderer.on('voice-preset', (_event, preset) => callback(preset)),
  onMute: callback => ipcRenderer.on('mute', (_event, muted) => callback(muted)),
  muted: muted => ipcRenderer.send('muted', muted),
  onHearing: callback => ipcRenderer.on('hearing', (_event, heard) => callback(heard)),
  onAction: callback => ipcRenderer.on('action', (_event, message) => callback(message)),
  onSize: callback => ipcRenderer.on('size', (_event, size) => callback(size)),
  setHover: isOverMomo => ipcRenderer.send('hover', isOverMomo),
})
