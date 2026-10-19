// Momo Desktop: a transparent, click-through window over the whole screen where Momo roams.
// The monkey-mate plugin tells it how Momo feels by POSTing to http://127.0.0.1:47321/mood.

const { app, BrowserWindow, globalShortcut, ipcMain, Menu, nativeImage, powerMonitor, screen, Tray } = require('electron')
const { execFile, spawn } = require('node:child_process')
const crypto = require('node:crypto')
const fs = require('node:fs')
const http = require('node:http')
const os = require('node:os')
const path = require('node:path')

const PORT = 47321

let win = null
let tray = null
let bubble = null
let menu = null

// Requests for Claude typed into Momo's menu wait here until the monkey-mate plugin collects them.
// Only the plugin can: it must send the key in ~/.monkey-mate/desktop-token, a file only you can read.
const inbox = []
const TOKEN = crypto.randomBytes(24).toString('hex')
function writeToken() {
  const folder = path.join(os.homedir(), '.monkey-mate')
  fs.mkdirSync(folder, { recursive: true, mode: 0o700 })
  fs.writeFileSync(path.join(folder, 'desktop-token'), TOKEN, { mode: 0o600 })
}

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
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      backgroundThrottling: false,
      // Momo's little tune plays when you ask for it from his menu.
      autoplayPolicy: 'no-user-gesture-required',
    },
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

// Momo's ears (macOS): the native/listen helper turns speech into text, on this Mac when it can.
// With "Listen for Momo" on, everything is ignored until you say his name; what follows, up to a pause,
// is your request. Push-to-talk (⌥M or his menu) skips the name. While Momo talks, his ears ignore it.
const LISTEN = path.join(__dirname, 'native', 'listen')
const canTalk = process.platform === 'darwin' && fs.existsSync(LISTEN)
let ears = null
let earsOn = false
let listenForName = false
let isSpeaking = false
// One request being heard: { request, since, lastChange, pushToTalk } or null.
let turn = null

// "Momo", and how speech recognition tends to spell it.
const NAME = /\b(?:momo|mo mo|moe moe|mo-mo|momoe|mohmo)\b/gi

/** The words after the last "Momo" in what was heard, or null when his name was not said. */
function afterName(text) {
  const matches = [...text.matchAll(NAME)]
  const last = matches[matches.length - 1]
  if (!last) return null
  return text.slice(last.index + last[0].length).replace(/^[\s,.!?:;-]+/, '').trim()
}

function startEars() {
  if (ears) return
  ears = spawn(LISTEN, [], { stdio: ['pipe', 'pipe', 'ignore'] })
  let buffer = ''
  ears.stdout.on('data', chunk => {
    buffer += chunk
    for (let end = buffer.indexOf('\n'); end >= 0; end = buffer.indexOf('\n')) {
      const line = buffer.slice(0, end)
      buffer = buffer.slice(end + 1)
      let event = null
      try {
        event = JSON.parse(line)
      } catch {}
      if (!event) continue
      if (typeof event.listening === 'boolean') earsOn = event.listening
      if (typeof event.heard === 'string') onHeard(event.heard)
      if (event.error) {
        turn = null
        win?.webContents.send('hearing', { error: event.error })
      }
    }
  })
  ears.on('exit', () => {
    ears = null
    earsOn = false
  })
}

function ear(command) {
  startEars()
  ears?.stdin.write(`${command}\n`)
}

function onHeard(text) {
  if (isSpeaking) return
  const now = Date.now()
  if (turn) {
    const request = turn.pushToTalk ? text.trim() : (afterName(text) ?? turn.request)
    if (request !== turn.request) {
      turn.request = request
      turn.lastChange = now
      win?.webContents.send('hearing', { partial: request })
    }
    return
  }
  if (!listenForName) return
  const request = afterName(text)
  if (request === null) return
  turn = { request, since: now, lastChange: now, pushToTalk: false }
  win?.webContents.send('hearing', { wake: true, partial: request })
}

/** The request is over: after a pause, or 20 seconds at most. */
function finishTurn() {
  const request = turn?.request.trim() ?? ''
  turn = null
  ear('reset')
  if (!listenForName && earsOn) ear('stop')
  win?.webContents.send('hearing', { request })
}

setInterval(() => {
  if (!turn) return
  const quiet = Date.now() - turn.lastChange
  if (quiet > (turn.request ? 1600 : 6000) || Date.now() - turn.since > 20000) finishTurn()
}, 250)

function toggleListening() {
  if (!canTalk) return win?.webContents.send('hearing', { error: 'unavailable' })
  if (turn) return finishTurn()
  ear(earsOn ? 'reset' : 'start')
  const now = Date.now()
  turn = { request: '', since: now, lastChange: now, pushToTalk: true }
  win?.webContents.send('hearing', { wake: true, partial: '' })
}

ipcMain.on('talk', toggleListening)
ipcMain.on('listen-for-name', (_event, on) => {
  listenForName = canTalk && on === true
  if (listenForName) ear('start')
  else if (earsOn && !turn) ear('stop')
})
// While Momo talks his ears ignore it; afterwards they forget what they heard (his own voice).
ipcMain.on('speaking', (_event, speaking) => {
  isSpeaking = speaking === true
  if (!isSpeaking && earsOn) setTimeout(() => ear('reset'), 250)
})
ipcMain.on('ask', (_event, text) => inbox.push({ type: 'ask', text: String(text).slice(0, 400) }))

// Momo's voice (macOS): the system voice says the line a little slowly into a sound file; Momo Desktop
// plays it back faster, which makes it higher and cuter but still clear. Elsewhere the page speaks.
const VOICES = { cute: { voice: 'Samantha', rate: 150 }, tiny: { voice: 'Junior', rate: 145 }, soft: { voice: 'Samantha', rate: 165 } }
ipcMain.handle('voice', (_event, { text, preset }) => {
  if (process.platform !== 'darwin') return null
  const { voice, rate } = VOICES[preset] ?? VOICES.cute
  const file = path.join(os.tmpdir(), `momo-${crypto.randomBytes(6).toString('hex')}.wav`)
  return new Promise(resolve =>
    execFile('say', ['-v', voice, '-r', `${rate}`, '--file-format=WAVE', '--data-format=LEI16@22050', '-o', file, String(text).slice(0, 300)], error => {
      if (error) return resolve(null)
      const bytes = fs.readFileSync(file)
      fs.rmSync(file, { force: true })
      resolve(new Uint8Array(bytes))
    }),
  )
})

// Momo's click menu: a small glass window beside him.
const MENU_WIDTH = 260
function createMenu() {
  menu = new BrowserWindow({
    width: MENU_WIDTH,
    height: 340,
    show: false,
    transparent: true,
    frame: false,
    resizable: false,
    movable: false,
    skipTaskbar: true,
    hasShadow: true,
    roundedCorners: true,
    alwaysOnTop: true,
    vibrancy: 'popover',
    visualEffectState: 'active',
    backgroundMaterial: 'acrylic',
    webPreferences: { preload: path.join(__dirname, 'menu-preload.js') },
  })
  menu.setAlwaysOnTop(true, 'screen-saver', 2)
  menu.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  menu.on('blur', () => menu?.hide())
  menu.loadFile(path.join(__dirname, 'menu.html'))
}

ipcMain.on('menu-size', (_event, height) => menu?.setSize(MENU_WIDTH, Math.min(600, height)))

// The overlay asks for the menu with Momo's box in window coordinates.
ipcMain.on('open-menu', (_event, { x, y, w, h, ...settings }) => {
  if (!menu) return
  const { bounds, workArea } = screen.getPrimaryDisplay()
  const [, height] = menu.getSize()
  const right = bounds.x + x + w / 2 + 8
  const left = bounds.x + x - w / 2 - MENU_WIDTH - 8
  const menuX = right + MENU_WIDTH < workArea.x + workArea.width ? right : left
  const menuY = Math.max(workArea.y + 8, Math.min(workArea.y + workArea.height - height - 8, bounds.y + y - h / 2 - height / 2))
  menu.setPosition(Math.round(menuX), Math.round(menuY))
  menu.show()
  menu.focus()
  menu.webContents.send('open', { ...settings, canTalk, isListening: turn !== null })
})

ipcMain.on('menu-action', (_event, { action, text }) => {
  menu?.hide()
  if (action === 'close') return
  if (action === 'ask') {
    inbox.push({ type: 'ask', text: String(text).slice(0, 400) })
    win?.webContents.send('action', { action: 'asked' })
    return
  }
  if (action === 'talk') {
    toggleListening()
    return
  }
  if (action === 'music-app') {
    toggleMusicApp().then(said => win?.webContents.send('action', { action: 'say', text: said }))
    return
  }
  win?.webContents.send('action', { action })
})

/** Play or pause Spotify or Apple Music, whichever is open (macOS asks once to let Momo control it). */
function toggleMusicApp() {
  if (process.platform !== 'darwin') return Promise.resolve('I can only do that on a Mac for now 🎧')
  const isOpen = app => new Promise(resolve => execFile('pgrep', ['-x', app], error => resolve(!error)))
  const playPause = app =>
    new Promise(resolve =>
      execFile('osascript', ['-e', `tell application "${app}" to playpause`], error =>
        resolve(error ? `I could not reach ${app}. Did you let me control it? 🙈` : `${app}: play / pause 🎶`),
      ),
    )
  return isOpen('Spotify').then(spotify =>
    spotify ? playPause('Spotify') : isOpen('Music').then(music => (music ? playPause('Music') : 'Open Spotify or Music first 🎧')),
  )
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
        label: 'Voice',
        submenu: [
          ['cute', 'Cute'],
          ['tiny', 'Tiny'],
          ['soft', 'Soft'],
        ].map(([preset, label]) => ({ label, click: () => win?.webContents.send('voice-preset', preset) })),
      },
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
    if (request.method === 'GET' && request.url === '/inbox') {
      if (request.headers['x-momo-token'] !== TOKEN) {
        response.statusCode = 403
        response.end()
        return
      }
      response.setHeader('content-type', 'application/json')
      response.end(JSON.stringify(inbox.splice(0)))
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
  createMenu()
  writeToken()
  startCaret()
  createTray()
  startServer()
  // ⌥M (Alt+M): talk to Momo from anywhere; press again to stop, or just pause and he stops listening.
  if (canTalk) globalShortcut.register('Alt+M', toggleListening)
  watchInput()
})

app.on('window-all-closed', () => app.quit())
app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  caret?.kill()
  ears?.kill()
})
