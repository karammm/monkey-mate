// Momo Desktop: a transparent, click-through window over the whole screen where Momo roams.
// The monkey-mate plugin tells it how Momo feels by POSTing to http://127.0.0.1:47321/mood.

const { app, BrowserWindow, ipcMain, Menu, nativeImage, powerMonitor, screen, Tray } = require('electron')
const http = require('node:http')
const path = require('node:path')

const PORT = 47321

let win = null
let tray = null

if (!app.requestSingleInstanceLock()) {
  app.quit()
}

function createWindow() {
  const { bounds } = screen.getPrimaryDisplay()
  win = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    transparent: true,
    frame: false,
    hasShadow: false,
    resizable: false,
    movable: false,
    focusable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    backgroundColor: '#00000000',
    // Momo's window never takes focus, so keep it from being treated as a background tab and paused.
    webPreferences: { preload: path.join(__dirname, 'preload.js'), backgroundThrottling: false },
  })
  win.setAlwaysOnTop(true, 'screen-saver')
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  // Clicks pass through to the apps underneath, except on Momo himself (see 'hover').
  win.setIgnoreMouseEvents(true, { forward: true })
  win.webContents.setBackgroundThrottling(false)
  win.loadFile(path.join(__dirname, 'index.html'))

  // Where the floor is: the top of the Dock or taskbar.
  const sendFloor = () => {
    const display = screen.getPrimaryDisplay()
    win?.webContents.send('floor', display.workArea.y + display.workArea.height - display.bounds.y)
  }
  win.webContents.on('did-finish-load', sendFloor)
  screen.on('display-metrics-changed', sendFloor)
}

function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, 'sprites', 'tray.png'))
  tray = new Tray(icon.resize({ height: 18 }))
  tray.setToolTip('Momo')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Pet Momo', click: () => win?.webContents.send('pet') },
      { label: 'Call Momo here', click: () => win?.webContents.send('summon') },
      { label: 'Show all his moods', click: () => win?.webContents.send('tour') },
      {
        label: 'Size',
        submenu: ['small', 'medium', 'large'].map(size => ({
          label: size[0].toUpperCase() + size.slice(1),
          click: () => win?.webContents.send('size', size),
        })),
      },
      { type: 'separator' },
      { label: 'Quit Momo', click: () => app.quit() },
    ]),
  )
}

function startServer() {
  const server = http.createServer((request, response) => {
    if (request.method === 'GET' && request.url === '/health') {
      response.end('ok')
      return
    }
    // Where Momo is and how he feels, for checking that he moves.
    if (request.method === 'GET' && request.url === '/status') {
      win?.webContents
        .executeJavaScript('JSON.stringify({ x: Math.round(momo.x), y: Math.round(momo.y), mode: momo.mode, emotion: emotion(), floor: state.floor, isUserBusy: state.isUserBusy })')
        .then(json => response.end(json))
        .catch(() => response.end('{}'))
      return
    }
    if (request.method !== 'POST' || (request.url !== '/mood' && request.url !== '/activity')) {
      response.statusCode = 404
      response.end()
      return
    }
    let body = ''
    request.on('data', chunk => {
      body += chunk
      if (body.length > 10_000) request.destroy()
    })
    request.on('end', () => {
      try {
        const { emotion, text, score, working } = JSON.parse(body)
        if (request.url === '/activity') {
          win?.webContents.send('activity', { working: working === true, text: String(text ?? '').slice(0, 120) })
          response.end('ok')
          return
        }
        win?.webContents.send('mood', {
          emotion: String(emotion ?? 'calm'),
          text: String(text ?? '').slice(0, 200),
          score: Number(score ?? 0),
        })
        response.end('ok')
      } catch {
        response.statusCode = 400
        response.end()
      }
    })
  })
  // Only this computer can talk to Momo.
  server.listen(PORT, '127.0.0.1')
  server.on('error', () => app.quit())
}

ipcMain.on('hover', (_event, isOverMomo) => {
  win?.setIgnoreMouseEvents(!isOverMomo, { forward: true })
})

// While you are typing or using the mouse anywhere, Momo keeps still so he never distracts you.
// The system's idle time counts whole seconds since the last keyboard or mouse input.
const QUIET_AFTER_SECONDS = 3
let isUserBusy = false
function watchInput() {
  setInterval(() => {
    const busy = powerMonitor.getSystemIdleTime() < QUIET_AFTER_SECONDS
    if (busy !== isUserBusy) {
      isUserBusy = busy
      win?.webContents.send('user-busy', busy)
    }
  }, 250)
}

app.whenReady().then(() => {
  if (process.platform === 'darwin') app.dock?.hide()
  createWindow()
  createTray()
  startServer()
  watchInput()
})

app.on('window-all-closed', () => app.quit())
