// Momo Desktop: a transparent, click-through window over the whole screen where Momo roams.
// The monkey-mate plugin tells it how Momo feels by POSTing to http://127.0.0.1:47321/mood.

const { app, BrowserWindow, ipcMain, Menu, nativeImage, powerMonitor, screen, Tray } = require('electron')
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const http = require('node:http')
const path = require('node:path')

const PORT = 47321

let win = null
let tray = null
let bubble = null

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

// Momo's speech and thought bubbles: a small window of the system's frosted "liquid glass"
// (vibrancy on macOS, acrylic on Windows) that follows him around.
function createBubble() {
  bubble = new BrowserWindow({
    width: 120,
    height: 40,
    show: false,
    transparent: true,
    frame: false,
    resizable: false,
    movable: false,
    focusable: false,
    skipTaskbar: true,
    hasShadow: true,
    roundedCorners: true,
    alwaysOnTop: true,
    vibrancy: 'popover',
    visualEffectState: 'active',
    backgroundMaterial: 'acrylic',
    webPreferences: { preload: path.join(__dirname, 'bubble-preload.js'), backgroundThrottling: false },
  })
  // Above Momo's own layer, and never in the way of clicks.
  bubble.setAlwaysOnTop(true, 'screen-saver', 1)
  bubble.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  bubble.setIgnoreMouseEvents(true)
  bubble.loadFile(path.join(__dirname, 'bubble.html'))
}

// What the bubble shows and where: anchor is the point just above Momo's head, in screen coordinates.
const said = { text: null, kind: 'speech', anchor: [0, 0], size: [0, 0] }

function placeBubble() {
  if (!bubble || said.text === null) return
  const [width, height] = said.size
  const { workArea } = screen.getPrimaryDisplay()
  const x = Math.round(Math.max(workArea.x + 8, Math.min(workArea.x + workArea.width - width - 8, said.anchor[0] - width / 2)))
  const y = Math.round(Math.max(workArea.y + 8, said.anchor[1] - height - 6))
  bubble.setBounds({ x, y, width, height })
}

ipcMain.on('bubble', (_event, message) => {
  const offset = screen.getPrimaryDisplay().bounds
  said.anchor = [offset.x + message.x, offset.y + message.y]
  if (message.text === null) {
    said.text = null
    bubble?.hide()
    return
  }
  if (message.text !== said.text || message.kind !== said.kind) {
    said.text = message.text
    said.kind = message.kind
    bubble?.webContents.send('show', { text: message.text, kind: message.kind })
    return
  }
  placeBubble()
})

ipcMain.on('bubble-size', (_event, width, height) => {
  said.size = [width, height]
  placeBubble()
  if (said.text !== null && !bubble?.isVisible()) bubble?.showInactive()
})

// Where you are typing (macOS): the native/caret helper reads the text caret's position through the
// Accessibility API, once you allow it from Momo's menu. It never reads any text.
let caret = null
const caretAnswers = []
function startCaret() {
  const helper = path.join(__dirname, 'native', 'caret')
  if (process.platform !== 'darwin' || !fs.existsSync(helper)) return
  caret = spawn(helper, [], { stdio: ['pipe', 'pipe', 'ignore'] })
  let buffer = ''
  caret.stdout.on('data', chunk => {
    buffer += chunk
    for (let end = buffer.indexOf('\n'); end >= 0; end = buffer.indexOf('\n')) {
      const line = buffer.slice(0, end)
      buffer = buffer.slice(end + 1)
      let answer = null
      try {
        answer = JSON.parse(line)
      } catch {}
      caretAnswers.shift()?.(answer)
    }
  })
  caret.on('exit', () => {
    caret = null
    while (caretAnswers.length > 0) caretAnswers.shift()(null)
  })
}

function askCaret(command = 'where') {
  return new Promise(resolve => {
    if (!caret) return resolve(null)
    caretAnswers.push(resolve)
    caret.stdin.write(`${command}\n`)
  })
}

/** The caret in window coordinates, or null when it is not known. */
async function whereTyping() {
  const answer = await askCaret()
  if (!answer || typeof answer.x !== 'number') return null
  const { bounds } = screen.getPrimaryDisplay()
  return { x: answer.x - bounds.x, y: answer.y - bounds.y, w: answer.w, h: answer.h, exact: answer.exact === true }
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
      ...(caret
        ? [{ label: 'Let Momo see where I type…', click: () => askCaret('ask') }]
        : []),
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
        .executeJavaScript('JSON.stringify({ x: Math.round(momo.x), y: Math.round(momo.y), mode: momo.mode, emotion: emotion(), floor: state.floor, isUserBusy: state.isUserBusy, hands: currentGesture(), isTyping: state.isTyping })')
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
// The system's idle time counts whole seconds since the last keyboard or mouse input; input while the
// pointer stays put is taken as typing, and then Momo covers his eyes. Nothing you type is ever read.
const QUIET_AFTER_SECONDS = 3
let isUserBusy = false
let isTyping = false
let lastCursor = { x: 0, y: 0 }
let lastCursorMove = 0
function watchInput() {
  setInterval(() => {
    const idle = powerMonitor.getSystemIdleTime()
    const cursor = screen.getCursorScreenPoint()
    if (cursor.x !== lastCursor.x || cursor.y !== lastCursor.y) lastCursorMove = Date.now()
    lastCursor = cursor
    const busy = idle < QUIET_AFTER_SECONDS
    const isPointerStill = Date.now() - lastCursorMove > 1500
    // Short pauses between words do not count as stopping: typing ends after 3 quiet seconds or a mouse move.
    const typing = isTyping ? idle < 3 && Date.now() - lastCursorMove > 400 : idle < 2 && isPointerStill
    if (busy !== isUserBusy) {
      isUserBusy = busy
      win?.webContents.send('user-busy', busy)
    }
    if (typing !== isTyping) {
      isTyping = typing
      lastCaretCheck = 0
      win?.webContents.send('typing', { typing, caret: null })
    }
    // While you type, tell Momo where every few seconds (and right away when you start).
    if (isTyping && Date.now() - lastCaretCheck > 3000) {
      lastCaretCheck = Date.now()
      whereTyping().then(where => {
        if (isTyping && where) win?.webContents.send('typing', { typing: true, caret: where })
      })
    }
  }, 250)
}
let lastCaretCheck = 0

app.whenReady().then(() => {
  if (process.platform === 'darwin') app.dock?.hide()
  createWindow()
  createBubble()
  startCaret()
  createTray()
  startServer()
  watchInput()
})

app.on('window-all-closed', () => app.quit())
app.on('will-quit', () => caret?.kill())
