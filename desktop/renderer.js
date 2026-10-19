// Momo on your screen: he walks the floor (the top of the Dock or taskbar), leaps about, perches
// anywhere for a while, can be dragged around, and says what the monkey-mate plugin tells him.

const EMOTIONS = ['happy', 'proud', 'calm', 'curious', 'worried', 'angry', 'sleepy']
const BLINKERS = new Set(['calm', 'curious', 'worried', 'angry'])
const SCALE = 0.75 // sprites are 220x160; Momo is drawn at 165x120
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
}

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
}

const between = ([low, high]) => low + (high - low) * Math.random()
const width = () => 220 * SCALE
const height = () => 160 * SCALE

function load() {
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
  const targetX = Math.max(width() / 2, Math.min(window.innerWidth - width() / 2, momo.x + (Math.random() * 2 - 1) * span))
  const isPerch = Math.random() < plan.perch
  // A perch is a spot somewhere up the screen: on top of a window, the edge of the terminal, anywhere.
  const targetY = isPerch ? between([window.innerHeight * 0.2, state.floor - 160]) : state.floor
  const rise = Math.max(between(plan.height), momo.y - targetY + 40)
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
  const plan = PLANS[mood]
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
    momo.perchFrames -= 1
    if (momo.perchFrames <= 0 && mood !== 'sleepy') {
      // Hop down to the floor.
      momo.target = null
      momo.vy = -6
      momo.vx = (Math.random() * 2 - 1) * 2
      momo.facingLeft = momo.vx < 0
      momo.mode = 'air'
    }
  } else if (momo.mode === 'idle') {
    momo.y = state.floor
    momo.rest -= 1
    if (plan && momo.rest <= 0) leap(plan)
  }

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

  const blink = momo.blink < 6 && BLINKERS.has(mood) ? 1 : 0
  const image = sprites[`${mood}-${poseOf()}-${blink}`] ?? sprites[`${mood}-${poseOf()}-0`]
  if (image?.complete) {
    ctx.save()
    if (momo.facingLeft) {
      ctx.translate(momo.x * 2, 0)
      ctx.scale(-1, 1)
    }
    ctx.drawImage(image, left, top, w, h)
    ctx.restore()
  }

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

  if (state.bubble && Date.now() < state.bubble.until) drawBubble(state.bubble.text, momo.x, top + 8)
}

function drawBubble(text, x, bottom) {
  ctx.font = '500 14px -apple-system, "Segoe UI", sans-serif'
  const lines = wrap(text, 240)
  const lineHeight = 19
  const w = Math.max(...lines.map(line => ctx.measureText(line).width)) + 24
  const h = lines.length * lineHeight + 16
  const left = Math.max(8, Math.min(window.innerWidth - w - 8, x - w / 2))
  const top = Math.max(8, bottom - h - 14)

  ctx.fillStyle = 'rgba(255, 252, 246, 0.97)'
  ctx.strokeStyle = 'rgba(120, 105, 95, 0.55)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.roundRect(left, top, w, h, 12)
  ctx.fill()
  ctx.stroke()
  // The tail, pointing at Momo.
  const tail = Math.max(left + 16, Math.min(left + w - 16, x))
  ctx.beginPath()
  ctx.moveTo(tail - 7, top + h - 1)
  ctx.lineTo(tail, top + h + 10)
  ctx.lineTo(tail + 7, top + h - 1)
  ctx.fill()

  ctx.fillStyle = '#2b2622'
  lines.forEach((line, index) => ctx.fillText(line, left + 12, top + 22 + index * lineHeight))
}

function wrap(text, maxWidth) {
  const lines = []
  let line = ''
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line)
      line = word
    } else {
      line = next
    }
  }
  if (line) lines.push(line)
  return lines.slice(0, 4)
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
  if (momo.mode === 'idle') leap({ height: [120, 160], reach: 0, perch: 0, rest: [60, 90] })
}

// Mouse: hovering Momo makes the window catch clicks; a click pets him, a drag carries him anywhere.
let hovering = false
let drag = null
window.addEventListener('mousemove', event => {
  const over = isOverMomo(event.clientX, event.clientY) || drag !== null
  if (over !== hovering) {
    hovering = over
    window.momo.setHover(over)
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

window.momo.onMood(({ emotion, text }) => {
  if (EMOTIONS.includes(emotion)) state.emotion = emotion
  state.lastNews = Date.now()
  if (text) state.bubble = { text, until: Date.now() + 7000 }
  // Momo reacts right away.
  if (momo.mode === 'idle') momo.rest = 0
})
window.momo.onFloor(floor => {
  state.floor = floor
  if (momo.mode === 'idle') momo.y = floor
})
window.momo.onPet(pet)
window.momo.onSummon(() => {
  momo.x = window.innerWidth / 2
  momo.y = state.floor - 200
  momo.vy = 0
  momo.vx = 0
  momo.mode = 'air'
  momo.target = null
  state.bubble = { text: 'Here I am!', until: Date.now() + 3000 }
})

window.addEventListener('resize', resize)
resize()
load()
momo.y = state.floor

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
