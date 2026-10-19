// Momo on your screen: he walks the floor (the top of the Dock or taskbar), leaps about, perches
// anywhere for a while, can be dragged around, and says what the monkey-mate plugin tells him.

const EMOTIONS = ['happy', 'proud', 'calm', 'curious', 'worried', 'angry', 'sleepy']
const BLINKERS = new Set(['calm', 'curious', 'worried', 'angry'])
// Sprites are 220x160; Momo is drawn at a share of that, picked from the menu and remembered.
const SIZES = { small: 0.4, medium: 0.55, large: 0.75 }
let scale = SIZES.medium
try {
  scale = SIZES[localStorage.getItem('size')] ?? SIZES.medium
} catch {}
const GRAVITY = 0.55 // px per frame per frame, at 60 frames a second
const SLEEPY_AFTER_MS = 10 * 60 * 1000

// How restless each mood is: frames to rest, jump height in px, how far a jump goes (share of the screen),
// and how likely a jump ends perched somewhere up the screen.
const PLANS = {
  happy: { rest: [40, 120], height: [120, 220], reach: 0.35, perch: 0.25 },
  proud: { rest: [30, 80], height: [200, 320], reach: 0.5, perch: 0.35 },
  curious: { rest: [80, 200], height: [60, 120], reach: 0.18, perch: 0.2 },
  calm: { rest: [200, 500], height: [60, 120], reach: 0.2, perch: 0.1 },
  worried: { rest: [25, 60], height: [20, 40], reach: 0.04, perch: 0 },
  angry: { rest: [8, 20], height: [15, 35], reach: 0.01, perch: 0 },
  sleepy: null,
}

const canvas = document.getElementById('screen')
const ctx = canvas.getContext('2d')
const sprites = {}

const state = {
  emotion: 'calm',
  lastNews: Date.now(),
  bubble: { text: 'Hi! I am Momo 🐒', until: Date.now() + 6000 },
  floor: window.innerHeight,
  hearts: [],
  // What Claude is doing right now, while a turn runs: { text } or null.
  work: null,
  // True while you type or move the mouse: Momo holds still.
  isUserBusy: false,
  // True while you type: Momo covers his eyes.
  isTyping: false,
}

// How the ears and tail move per mood: ear angle (radians, up is positive), wiggle size and speed (Hz).
const EARS = {
  happy: { base: 0.1, amp: 0.12, hz: 2 },
  proud: { base: 0.15, amp: 0.05, hz: 0.8 },
  calm: { base: 0, amp: 0.03, hz: 0.5 },
  curious: { base: 0.22, amp: 0.08, hz: 0.7 },
  worried: { base: -0.25, amp: 0.03, hz: 6 },
  angry: { base: -0.38, amp: 0.04, hz: 9 },
  sleepy: { base: -0.4, amp: 0.03, hz: 0.3 },
  working: { base: 0.18, amp: 0.06, hz: 3 },
}
const TAILS = {
  happy: { amp: 0.25, hz: 2.5 },
  proud: { amp: 0.15, hz: 1.5 },
  calm: { amp: 0.1, hz: 0.6 },
  curious: { amp: 0.2, hz: 1 },
  worried: { amp: 0.08, hz: 3 },
  angry: { amp: 0.3, hz: 5 },
  sleepy: { amp: 0.04, hz: 0.3 },
  working: { amp: 0.18, hz: 2 },
}
// While Claude works Momo paces about busily.
const WORKING = { rest: [20, 50], height: [12, 26], reach: 0.03, perch: 0 }
const RIG = window.MOMO_RIG

// Momo's feet: x is his middle, y is where he stands.
const momo = {
  x: window.innerWidth * 0.8,
  y: window.innerHeight,
  vx: 0,
  vy: 0,
  mode: 'idle', // idle | air | perched | dragged
  rest: 60,
  perchFrames: 0,
  squash: 0,
  blink: 120,
  facingLeft: true,
  target: null, // where an air jump means to land: { y } for a perch
  twitch: [0, 0], // frames left of a quick twitch, left ear then right
  // What he does with his hands: a list of { name, ms } steps played in order, each until its end time.
  gestures: [],
}

const between = ([low, high]) => low + (high - low) * Math.random()
const width = () => 220 * scale
const height = () => 160 * scale

// Hand gestures, played on the floor or a perch: cover his eyes, peek, wave, clap, think.
const GESTURE_FRAMES = {
  // Played once over their step: the paws glide up to his eyes, or back down.
  raise: ['lift-1', 'lift-2', 'lift-3'],
  lower: ['lift-3', 'lift-2', 'lift-1'],
  cover: ['cover'],
  peek: ['peek'],
  think: ['think'],
  wave: ['wave-a', 'wave-b'],
  clap: ['clap-a', 'clap-b'],
}

const ONCE = new Set(['raise', 'lower'])

/** Plays gestures in order, e.g. gesture(['cover', 2200], ['peek', 1200]). */
function gesture(...steps) {
  let at = Date.now()
  momo.gestures = steps.map(([name, ms]) => ({ name, start: at, until: (at += ms) }))
}

/** Covers his eyes smoothly (paws glide up), holding them there for `ms`, then whatever follows. */
function coverEyes(ms, ...after) {
  const isCovered = currentGesture() === 'cover' || currentGesture() === 'peek'
  gesture(...(isCovered ? [] : [['raise', 200]]), ['cover', ms], ...after)
}

function currentGesture() {
  momo.gestures = momo.gestures.filter(step => step.until > Date.now())
  return momo.gestures[0]?.name ?? null
}

function load() {
  for (const emotion of EMOTIONS) {
    for (const frame of Object.values(GESTURE_FRAMES).flat()) {
      const image = new Image()
      image.src = `sprites/${emotion}-g-${frame}.png`
      sprites[`${emotion}-g-${frame}`] = image
    }
  }
  for (const part of ['ear', 'tail']) {
    const image = new Image()
    image.src = `sprites/${part}.png`
    sprites[part] = image
  }
  for (const emotion of EMOTIONS) {
    for (const pose of ['sit', 'jump', 'squash']) {
      for (const blink of [0, 1]) {
        if (blink === 1 && !BLINKERS.has(emotion)) continue
        const image = new Image()
        image.src = `sprites/${emotion}-${pose}-${blink}.png`
        sprites[`${emotion}-${pose}-${blink}`] = image
      }
    }
  }
}

function resize() {
  const ratio = window.devicePixelRatio || 1
  canvas.width = Math.round(window.innerWidth * ratio)
  canvas.height = Math.round(window.innerHeight * ratio)
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
}

function emotion() {
  return Date.now() - state.lastNews > SLEEPY_AFTER_MS ? 'sleepy' : state.emotion
}

function leap(plan) {
  const span = window.innerWidth * plan.reach
  const targetX = momo.x + (Math.random() * 2 - 1) * span
  // A perch is a spot somewhere up the screen: on top of a window, the edge of the terminal, anywhere.
  const targetY = Math.random() < plan.perch ? between([window.innerHeight * 0.2, state.floor - 160]) : state.floor
  leapTo(targetX, targetY, between(plan.height))
}

/** Jumps to land with his feet at (x, y); a spot above the floor is a perch. */
function leapTo(x, y, height = 60) {
  const targetX = Math.max(width() / 2, Math.min(window.innerWidth - width() / 2, x))
  const targetY = Math.min(state.floor, y)
  const isPerch = targetY < state.floor - 5
  const rise = Math.max(height, momo.y - targetY + 40)
  momo.vy = -Math.sqrt(2 * GRAVITY * rise)
  const up = -momo.vy / GRAVITY
  const down = Math.sqrt((2 * Math.max(1, targetY - (momo.y - rise))) / GRAVITY)
  momo.vx = (targetX - momo.x) / (up + down)
  momo.facingLeft = momo.vx === 0 ? momo.facingLeft : momo.vx < 0
  momo.mode = 'air'
  momo.target = isPerch ? { y: targetY } : null
}

function step() {
  const mood = emotion()
  const plan = state.work && mood !== 'sleepy' ? WORKING : PLANS[mood]
  momo.twitch = momo.twitch.map(frames => (frames > 0 ? frames - 1 : !state.isUserBusy && Math.random() < 0.002 ? 10 : 0))
  momo.blink = momo.blink <= 0 ? 90 + Math.random() * 180 : momo.blink - 1
  momo.squash = Math.max(0, momo.squash - 1)

  if (momo.mode === 'air') {
    momo.x += momo.vx
    momo.y += momo.vy
    momo.vy += GRAVITY
    const landing = momo.target ? momo.target.y : state.floor
    if (momo.vy > 0 && momo.y >= landing) {
      momo.y = landing
      momo.vx = 0
      momo.vy = 0
      momo.squash = 8
      momo.mode = momo.target ? 'perched' : 'idle'
      momo.perchFrames = momo.target ? between([360, 900]) : 0
      momo.rest = plan ? between(plan.rest) : 60
      momo.target = null
    }
  } else if (momo.mode === 'perched') {
    if (!state.isUserBusy) momo.perchFrames -= 1
    if (momo.perchFrames <= 0 && mood !== 'sleepy' && !state.isUserBusy) {
      // Hop down to the floor.
      momo.target = null
      momo.vy = -6
      momo.vx = (Math.random() * 2 - 1) * 2
      momo.facingLeft = momo.vx < 0
      momo.mode = 'air'
    }
  } else if (momo.mode === 'idle') {
    momo.y = state.floor
    // He finishes a jump he is in, but starts none while you are busy.
    if (state.isUserBusy) return finishStep()
    // While Claude works, Momo thinks between his busy little hops.
    if (state.work && mood !== 'sleepy' && !currentGesture() && momo.rest > 15) gesture(['think', momo.rest * 16])
    // Now and then a calm Momo plays peekaboo.
    if (mood === 'calm' && !state.work && !currentGesture() && Math.random() < 0.0004) {
      coverEyes(1400, ['peek', 700], ['cover', 500], ['lower', 240])
    }
    // He stays put while his hands are busy; thinking still counts down to his next hop.
    if (currentGesture()) {
      if (currentGesture() === 'think') momo.rest -= 1
      return finishStep()
    }
    momo.rest -= 1
    if (plan && momo.rest <= 0) leap(plan)
  }

  finishStep()
}

function finishStep() {
  state.hearts = state.hearts
    .map(heart => ({ ...heart, y: heart.y - 1.2, life: heart.life - 1 }))
    .filter(heart => heart.life > 0)
}

function poseOf() {
  if (momo.mode === 'air' || momo.mode === 'dragged') return 'jump'
  return momo.squash > 0 ? 'squash' : 'sit'
}

function draw() {
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)
  const mood = emotion()
  const w = width()
  const h = height()
  const left = momo.x - w / 2
  const top = momo.y - h

  // A soft shadow on the floor while he is near it.
  const lift = state.floor - momo.y
  if (lift < 260) {
    const size = (w * 0.32) / (1 + lift / 120)
    ctx.fillStyle = `rgba(20, 15, 15, ${0.22 / (1 + lift / 80)})`
    ctx.beginPath()
    ctx.ellipse(momo.x, state.floor - 4, size, size * 0.18, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.save()
  if (momo.facingLeft) {
    ctx.translate(momo.x * 2, 0)
    ctx.scale(-1, 1)
  }
  ctx.translate(left, top)
  ctx.scale(w / RIG.size[0], h / RIG.size[1])
  drawMomo(mood)
  ctx.restore()

  if (mood === 'sleepy') {
    const t = Date.now() / 600
    ctx.font = '600 18px -apple-system, "Segoe UI", sans-serif'
    ctx.fillStyle = 'rgba(120, 130, 170, 0.9)'
    ctx.fillText('z', momo.x + 40, top + 20 - (t % 3) * 6)
    ctx.fillText('Z', momo.x + 52, top + 4 - ((t + 1.5) % 3) * 6)
  }

  for (const heart of state.hearts) {
    ctx.globalAlpha = Math.min(1, heart.life / 30)
    ctx.font = '20px "Apple Color Emoji", "Segoe UI Emoji", sans-serif'
    ctx.fillText('💗', heart.x, heart.y)
    ctx.globalAlpha = 1
  }

  // Speech and thoughts show in the glass bubble window, which follows Momo's head.
  let message = null
  if (state.bubble && Date.now() < state.bubble.until) {
    message = { text: state.bubble.text, kind: 'speech' }
  } else if (state.work) {
    // Steps in progress get animated dots; finished ones ("Changed app.ts ✓") do not.
    const isDone = /[✓✅❌]$/u.test(state.work.text)
    const dots = isDone ? '' : '.'.repeat(1 + (Math.floor(Date.now() / 400) % 3))
    message = { text: `${state.work.text}${dots}`, kind: 'thought' }
  }
  say(message, momo.x, top + 10)
}

let lastSaid = { text: null, x: 0, y: 0 }
function say(message, x, y) {
  const text = message?.text ?? null
  const hasMoved = Math.abs(x - lastSaid.x) >= 1 || Math.abs(y - lastSaid.y) >= 1
  if (text === lastSaid.text && (text === null || !hasMoved)) return
  lastSaid = { text, x, y }
  window.monkeyMate.say({ text, kind: message?.kind ?? 'speech', x: Math.round(x), y: Math.round(y) })
}

/** Momo in sprite pixels: tail, ears and body, the ears and tail swinging around their pivots. */
function drawMomo(mood) {
  const pose = poseOf()
  const blink = momo.blink < 6 && BLINKERS.has(mood) ? 1 : 0
  const hands = pose === 'sit' && momo.mode !== 'dragged' ? currentGesture() : null
  let body = sprites[`${mood}-${pose}-${blink}`] ?? sprites[`${mood}-${pose}-0`]
  if (hands) {
    const frames = GESTURE_FRAMES[hands]
    const step = momo.gestures[0]
    const frame = ONCE.has(hands)
      ? frames[Math.min(frames.length - 1, Math.floor(((Date.now() - step.start) / (step.until - step.start)) * frames.length))]
      : frames[Math.floor(Date.now() / (hands === 'clap' ? 160 : 260)) % frames.length]
    body = sprites[`${mood}-g-${frame}`] ?? body
  }
  const t = performance.now() / 1000
  const look = state.work && mood !== 'sleepy' ? 'working' : mood
  // While you are busy the ears and tail barely move: just the base pose and a slow breath.
  const still = state.isUserBusy ? 0.15 : 1
  const ears = { ...EARS[look], amp: EARS[look].amp * still, hz: state.isUserBusy ? 0.3 : EARS[look].hz }
  const tail = { ...TAILS[look], amp: TAILS[look].amp * still, hz: state.isUserBusy ? 0.3 : TAILS[look].hz }
  // In the air the ears trail behind: down while rising, up while falling.
  const flap = momo.mode === 'air' ? Math.max(-0.45, Math.min(0.45, momo.vy * 0.04)) : 0
  const earAngle = (side, phase) =>
    ears.base + ears.amp * Math.sin(t * ears.hz * Math.PI * 2 + phase) + flap + (momo.twitch[side] > 0 ? 0.25 : 0)

  // Squashing on landing pulls everything toward the ground.
  const squash = pose === 'squash'
  const ground = RIG.size[1] - 3
  const at = ([x, y]) => (squash ? [110 + (x - 110) * 1.08, ground + (y - ground) * 0.9] : [x, y])

  const swing = (image, pivot, angle, mirror) => {
    if (!image?.complete) return
    const [px, py] = at(pivot)
    ctx.save()
    if (mirror) {
      ctx.translate(RIG.size[0], 0)
      ctx.scale(-1, 1)
    }
    ctx.translate(px, py)
    // Canvas y points down, so a lift (positive angle) turns counter-clockwise on screen.
    ctx.rotate(-angle)
    ctx.translate(-pivot[0], -pivot[1])
    ctx.drawImage(image, 0, 0)
    ctx.restore()
  }

  swing(sprites.tail, RIG.tail, tail.amp * Math.sin(t * tail.hz * Math.PI * 2), false)
  swing(sprites.ear, RIG.ear, earAngle(1, 0), false)
  swing(sprites.ear, RIG.ear, earAngle(0, 0.8), true)
  if (body?.complete) ctx.drawImage(body, 0, 0)
}

function isOverMomo(x, y) {
  const w = width()
  const h = height()
  return x > momo.x - w * 0.38 && x < momo.x + w * 0.38 && y > momo.y - h * 0.95 && y < momo.y
}

function pet() {
  state.emotion = 'happy'
  state.lastNews = Date.now()
  state.bubble = { text: 'Hehe! 🍌', until: Date.now() + 3000 }
  for (let i = 0; i < 6; i += 1) {
    state.hearts.push({ x: momo.x - 30 + Math.random() * 60, y: momo.y - height() + Math.random() * 30, life: 60 + i * 8 })
  }
  gesture(['clap', 1400])
}

/** How Momo takes news: his mood, what he says, and what his hands do. */
function react(emotion, text, bubbleMs = 7000) {
  const before = state.emotion
  if (EMOTIONS.includes(emotion)) state.emotion = emotion
  state.lastNews = Date.now()
  if (text) state.bubble = { text, until: Date.now() + bubbleMs }
  // Covering his eyes is one quiet move, so it happens even while you are busy; waving and clapping wait.
  if (emotion === 'worried') return coverEyes(2000, ['peek', 1200], ['lower', 240])
  if (state.isUserBusy) return
  else if ((emotion === 'happy' || emotion === 'proud') && text) gesture(['clap', 1600])
  else if (emotion === 'curious' && before !== 'curious') gesture(['wave', 1400])
  else if (momo.mode === 'idle') momo.rest = 0
}

// Mouse: hovering Momo makes the window catch clicks; a click pets him, a drag carries him anywhere.
let hovering = false
let drag = null
window.addEventListener('mousemove', event => {
  const over = isOverMomo(event.clientX, event.clientY) || drag !== null
  if (over !== hovering) {
    hovering = over
    window.monkeyMate.setHover(over)
    canvas.style.cursor = over ? 'grab' : 'default'
  }
  if (drag) {
    drag.moved ||= Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 4
    momo.x = event.clientX - drag.dx
    momo.y = event.clientY - drag.dy
  }
})
window.addEventListener('mousedown', event => {
  if (!isOverMomo(event.clientX, event.clientY)) return
  drag = { startX: event.clientX, startY: event.clientY, dx: event.clientX - momo.x, dy: event.clientY - momo.y, moved: false }
  momo.mode = 'dragged'
  canvas.style.cursor = 'grabbing'
})
window.addEventListener('mouseup', () => {
  if (!drag) return
  const moved = drag.moved
  drag = null
  canvas.style.cursor = 'grab'
  // Dropped near the floor he stands; anywhere else he sits right where you put him.
  if (state.floor - momo.y < 30) {
    momo.y = state.floor
    momo.mode = 'idle'
  } else {
    momo.mode = 'perched'
    momo.perchFrames = between([600, 1200])
  }
  momo.squash = 8
  if (!moved) pet()
})

// While you type, Momo politely covers his eyes; when you stop, he peeks out and lowers his paws.
let lastNotPeeking = 0
window.monkeyMate.onTyping(({ typing, caret }) => {
  const wasTyping = state.isTyping
  state.isTyping = typing
  if (!typing) {
    if (currentGesture() === 'cover' || currentGesture() === 'raise') gesture(['peek', 700], ['lower', 240])
    return
  }
  if (caret) sitBeside(caret)
  if (!wasTyping) {
    coverEyes(10 * 60 * 1000)
    if (Date.now() - lastNotPeeking > 60_000 && (!state.bubble || Date.now() > state.bubble.until)) {
      lastNotPeeking = Date.now()
      state.bubble = { text: '🙈 Not peeking!', until: Date.now() + 2200 }
    }
  }
})

/** Knowing where you type, Momo sits just beside it (never on top of your text), facing it. */
function sitBeside(caret) {
  // Without an exact caret (many terminals) the field's bottom edge is where the typing line usually is.
  const line = caret.exact ? caret : { x: caret.x + caret.w - 24, y: caret.y + caret.h - 34, w: 0, h: 24 }
  const gap = 24 + width() / 2
  const right = line.x + line.w + gap
  const x = right + width() / 2 < window.innerWidth ? right : line.x - gap
  const y = line.y + line.h + 6
  if (Math.hypot(momo.x - x, momo.y - y) < 120 || momo.mode === 'air' || momo.mode === 'dragged') return
  // One quiet hop over there, then he stays put while you type.
  momo.facingLeft = x > line.x
  leapTo(x, y, 30)
}
window.monkeyMate.onUserBusy(busy => {
  state.isUserBusy = busy
  // When you stop, he waits a moment before moving again.
  if (!busy && momo.mode === 'idle') momo.rest = Math.max(momo.rest, 30)
})
window.monkeyMate.onActivity(({ working, text }) => {
  state.work = working ? { text: text || 'Claude is working' } : null
  state.lastNews = Date.now()
  if (working && momo.mode === 'idle' && !state.isUserBusy) momo.rest = 0
})
window.monkeyMate.onMood(({ emotion, text }) => react(emotion, text))
window.monkeyMate.onFloor(floor => {
  state.floor = floor
  if (momo.mode === 'idle') momo.y = floor
})
window.monkeyMate.onPet(pet)
window.monkeyMate.onSize(size => {
  scale = SIZES[size] ?? scale
  try {
    localStorage.setItem('size', size)
  } catch {}
})
window.monkeyMate.onSummon(() => {
  momo.x = window.innerWidth / 2
  momo.y = state.floor - 200
  momo.vy = 0
  momo.vx = 0
  momo.mode = 'air'
  momo.target = null
  state.bubble = { text: 'Here I am!', until: Date.now() + 3000 }
  gesture(['wave', 1800])
})

// A quick tour of every mood, from the menu: handy to see what Momo can do.
const TOUR = [
  ['happy', 'Tests are green! 🎉'],
  ['proud', 'Flawless streak. Banana break earned.'],
  ['curious', 'Ooh, a new task! What are we building?'],
  ['worried', 'Whoa! That command can destroy things.'],
  ['angry', 'Same error twice! Try a different approach.'],
  ['sleepy', 'Zzz... wake me when we code.'],
  ['calm', 'All quiet. I am watching.'],
]
window.monkeyMate.onTour(() => {
  TOUR.forEach(([emotion, text], index) =>
    setTimeout(() => react(emotion, text, 3800), index * 4000),
  )
})

window.addEventListener('resize', resize)
resize()
load()
momo.y = state.floor
// Hello!
gesture(['wave', 2200])

let last = performance.now()
function frame(now) {
  // Physics runs at 60 steps a second whatever the display's refresh rate.
  let steps = Math.min(5, Math.round((now - last) / (1000 / 60)))
  if (steps > 0) last = now
  while (steps-- > 0) step()
  draw()
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)
