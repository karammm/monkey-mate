// Momo in 3D: a plush white monkey built from soft signed-distance shapes, lit like a toy photo.
// Used by scripts/bake.ts to render the terminal sprites and the README images. Pure TypeScript.

import type { Emotion } from '../types'

export type Pose = 'sit' | 'jump' | 'squash'
export type RGBA = [number, number, number, number]

type V = [number, number, number]

const add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const mul = (a: V, s: number): V => [a[0] * s, a[1] * s, a[2] * s]
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const len = (a: V) => Math.sqrt(dot(a, a))
const norm = (a: V): V => mul(a, 1 / (len(a) || 1))
const clamp = (x: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x))
const mix = (a: V, b: V, t: number): V => add(mul(a, 1 - t), mul(b, t))
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}

/** sRGB hex to linear color. */
const hex = (h: number): V => {
  const c = [(h >> 16) & 255, (h >> 8) & 255, h & 255].map(v => Math.pow(v / 255, 2.2))
  return [c[0] ?? 0, c[1] ?? 0, c[2] ?? 0]
}

const COLORS = {
  fur: hex(0xfbf6ec),
  furShade: hex(0xe9dccb),
  innerEar: hex(0xf6b2ae),
  innerEarDeep: hex(0xe68f8d),
  mask: hex(0x957a68),
  muzzle: hex(0xffe3d8),
  nose: hex(0x4a2c28),
  mouth: hex(0x6b2a2a),
  tongue: hex(0xf08a8c),
  iris: hex(0xf2b54a),
  irisDeep: hex(0xb36a12),
  ring: hex(0x3a2412),
  pupil: hex(0x120c0a),
  blush: hex(0xff9aa8),
  angryBlush: hex(0xff5a5a),
  toe: hex(0xf7c2b6),
  shades: hex(0x15151c),
}

function ellipsoid(p: V, c: V, r: V): number {
  // A good-enough ellipsoid distance (Inigo Quilez's bound).
  const q: V = [(p[0] - c[0]) / r[0], (p[1] - c[1]) / r[1], (p[2] - c[2]) / r[2]]
  const k0 = len(q)
  const k1 = len([q[0] / r[0], q[1] / r[1], q[2] / r[2]])
  return (k0 * (k0 - 1)) / (k1 || 1e-6)
}

function capsule(p: V, a: V, b: V, r: number): number {
  const pa = sub(p, a)
  const ba = sub(b, a)
  const h = clamp(dot(pa, ba) / dot(ba, ba))
  return len(sub(pa, mul(ba, h))) - r
}

function smin(a: number, b: number, k: number): number {
  const h = clamp(0.5 + (0.5 * (b - a)) / k)
  return b * (1 - h) + a * h - k * h * (1 - h)
}

const rotZ = (p: V, c: V, angle: number): V => {
  const x = p[0] - c[0]
  const y = p[1] - c[1]
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  return [c[0] + x * cos + y * sin, c[1] - x * sin + y * cos, p[2]]
}

type Part = 'fur' | 'arm' | 'ear' | 'eye' | 'nose' | 'foot'

/**
 * Which part of Momo to render: all of him, or the layers Momo Desktop animates on their own
 * (the body without ears and tail, his right ear, his tail).
 */
export type Layer = 'all' | 'body' | 'ear' | 'tail'

/** What Momo does with his hands (Momo Desktop only; the terminal sprites keep his arms down). */
export type Gesture = 'none' | 'cover' | 'peek' | 'wave-a' | 'wave-b' | 'clap-a' | 'clap-b' | 'think'

export const GESTURES: Gesture[] = ['cover', 'peek', 'wave-a', 'wave-b', 'clap-a', 'clap-b', 'think']

type Model = {
  pose: Pose
  eyeRadius: number
  earTilt: number
  layer: Layer
  gesture: Gesture
}

// An arm, on Momo's right side of the picture (x > 0): shoulder to elbow to paw.
type Arm = { shoulder: V; elbow: V; paw: V }

const REST: Arm = { shoulder: [0.3, -0.38, 0.12], elbow: [0.31, -0.5, 0.2], paw: [0.3, -0.64, 0.28] }
const LIFTED: Arm = { shoulder: [0.3, -0.34, 0.08], elbow: [0.45, -0.16, 0.14], paw: [0.6, 0.02, 0.2] }
// Paws over the eyes: the arms come up in front of the cheeks.
const COVER: Arm = { shoulder: [0.3, -0.34, 0.14], elbow: [0.52, -0.08, 0.46], paw: [0.27, 0.32, 0.7] }

/** Each gesture's arms: [right, left], both written for the right side and mirrored for the left. */
const ARMS: Record<Gesture, [Arm, Arm]> = {
  none: [REST, REST],
  cover: [COVER, COVER],
  peek: [COVER, { shoulder: COVER.shoulder, elbow: [0.48, -0.2, 0.42], paw: [0.3, 0.1, 0.66] }],
  'wave-a': [{ shoulder: [0.3, -0.32, 0.12], elbow: [0.66, -0.16, 0.26], paw: [0.9, 0.14, 0.3] }, REST],
  'wave-b': [{ shoulder: [0.3, -0.32, 0.12], elbow: [0.68, -0.12, 0.26], paw: [0.8, 0.3, 0.3] }, REST],
  'clap-a': [
    { shoulder: [0.3, -0.36, 0.12], elbow: [0.4, -0.34, 0.36], paw: [0.22, -0.22, 0.56] },
    { shoulder: [0.3, -0.36, 0.12], elbow: [0.4, -0.34, 0.36], paw: [0.22, -0.22, 0.56] },
  ],
  'clap-b': [
    { shoulder: [0.3, -0.36, 0.12], elbow: [0.36, -0.32, 0.38], paw: [0.07, -0.2, 0.6] },
    { shoulder: [0.3, -0.36, 0.12], elbow: [0.36, -0.32, 0.38], paw: [0.07, -0.2, 0.6] },
  ],
  think: [{ shoulder: [0.3, -0.36, 0.12], elbow: [0.44, -0.3, 0.46], paw: [0.12, -0.1, 0.62] }, REST],
}

function armDistance(q: V, arm: Arm): number {
  const upper = capsule(q, arm.shoulder, arm.elbow, 0.105)
  const lower = capsule(q, arm.elbow, arm.paw, 0.1)
  // Paws over the eyes are big enough to hide them completely.
  const isOverEye = arm.paw[1] > 0.25
  const paw = ellipsoid(q, arm.paw, isOverEye ? [0.15, 0.14, 0.09] : [0.11, 0.1, 0.085])
  return smin(smin(upper, lower, 0.05), paw, 0.05)
}

const EYE_Y = 0.33
const EYE_X = 0.27
const EYE_Z = 0.42
const EAR_CENTER: V = [0.86, 0.72, -0.08]
const EAR_SIZE: V = [0.5, 0.3, 0.07]
const EAR_TILT = 0.5
const TAIL: V[] = [
  [0.22, -0.8, -0.2],
  [0.48, -0.76, -0.16],
  [0.66, -0.62, -0.12],
  [0.74, -0.42, -0.09],
  [0.7, -0.26, -0.06],
  [0.6, -0.2, -0.04],
  [0.53, -0.27, -0.03],
  [0.56, -0.35, -0.02],
]

/** Distance to Momo and which part was hit, at point p (x is mirrored: Momo is symmetric). */
function scene(p0: V, m: Model): { d: number; part: Part } {
  let p = p0
  if (m.pose === 'squash') {
    // Squash toward the ground and spread a little.
    p = [p[0] / 1.08, (p[1] + 1) / 0.9 - 1, p[2] / 1.04]
  }
  const ax: V = [Math.abs(p[0]), p[1], p[2]]

  if (m.layer === 'ear') {
    // Only the ear on the viewer's right; Momo Desktop mirrors it for the other one.
    const d = p[0] > 0 ? ellipsoid(rotZ(p, EAR_CENTER, -m.earTilt), EAR_CENTER, EAR_SIZE) : 1
    return { d, part: 'ear' }
  }

  const head = ellipsoid(p, [0, 0.3, 0], [0.68, 0.58, 0.55])
  const cheeks = ellipsoid(ax, [0.4, 0.1, 0.12], [0.32, 0.26, 0.3])
  const muzzle = ellipsoid(p, [0, 0.1, 0.4], [0.21, 0.14, 0.14])
  const body = ellipsoid(p, [0, -0.5, -0.02], [0.42, 0.38, 0.36])
  let fur = smin(head, cheeks, 0.12)
  fur = smin(fur, muzzle, 0.08)
  fur = smin(fur, body, 0.16)

  const [right, left] = m.pose === 'jump' ? [LIFTED, LIFTED] : ARMS[m.gesture]
  const arms = Math.min(armDistance(p, right), armDistance([-p[0], p[1], p[2]], left))
  // Arms in front of the face stay their own shape; resting arms melt into the body like a plush.
  const isArm = arms < fur
  fur = m.gesture === 'none' || m.pose === 'jump' ? smin(fur, arms, 0.08) : Math.min(smin(fur, arms, 0.02), arms)

  // A curly tail on Momo's right, and a little tuft on top of his head.
  let tail = capsule(p, TAIL[0] as V, TAIL[1] as V, 0.056)
  for (let i = 2; i < TAIL.length; i += 1) {
    tail = smin(tail, capsule(p, TAIL[i - 1] as V, TAIL[i] as V, 0.056 - i * 0.002), 0.05)
  }
  if (m.layer === 'tail') return { d: tail, part: 'fur' }
  if (m.layer === 'all') fur = smin(fur, tail, 0.05)
  const tuft = Math.min(
    ellipsoid(p, [0, 0.9, 0.05], [0.07, 0.11, 0.07]),
    ellipsoid(p, [-0.08, 0.86, 0.06], [0.06, 0.09, 0.06]),
    ellipsoid(p, [0.08, 0.87, 0.04], [0.06, 0.09, 0.06]),
  )
  fur = smin(fur, tuft, 0.06)

  const footY = m.pose === 'jump' ? -0.94 : -0.88
  const foot = ellipsoid(ax, [0.19, footY, 0.18], [0.16, 0.1, 0.16])
  const furAndFeet = smin(fur, foot, 0.06)

  const earPoint = rotZ(ax, EAR_CENTER, -m.earTilt)
  const ear = ellipsoid(earPoint, EAR_CENTER, EAR_SIZE)

  const eye = ellipsoid(ax, [EYE_X, EYE_Y, EYE_Z], [m.eyeRadius, m.eyeRadius, m.eyeRadius * 0.85])
  const nose = ellipsoid(p, [0, 0.2, 0.515], [0.065, 0.045, 0.04])

  let best: { d: number; part: Part } =
    m.layer === 'body'
      ? { d: furAndFeet, part: foot < fur ? 'foot' : isArm ? 'arm' : 'fur' }
      : { d: smin(ear, furAndFeet, 0.07), part: ear < furAndFeet ? 'ear' : foot < fur ? 'foot' : isArm ? 'arm' : 'fur' }
  if (eye < best.d) best = { d: eye, part: 'eye' }
  if (nose < best.d) best = { d: nose, part: 'nose' }
  return best
}

function normalAt(p: V, m: Model): V {
  const e = 0.002
  const d = (q: V) => scene(q, m).d
  return norm([
    d([p[0] + e, p[1], p[2]]) - d([p[0] - e, p[1], p[2]]),
    d([p[0], p[1] + e, p[2]]) - d([p[0], p[1] - e, p[2]]),
    d([p[0], p[1], p[2] + e]) - d([p[0], p[1], p[2] - e]),
  ])
}

function occlusion(p: V, n: V, m: Model): number {
  let shade = 0
  for (let i = 1; i <= 4; i += 1) {
    const h = 0.04 * i
    shade += (h - scene(add(p, mul(n, h)), m).d) / i
  }
  return clamp(1 - 2.2 * shade)
}

type Face = {
  eyes: 'open' | 'blink' | 'happy' | 'angry' | 'worried' | 'shades' | 'wide'
  mouth: 'smile' | 'grin' | 'flat' | 'small' | 'open'
  isFlushed?: boolean
}

const FACES: Record<Emotion, Face> = {
  happy: { eyes: 'happy', mouth: 'grin' },
  proud: { eyes: 'shades', mouth: 'smile' },
  calm: { eyes: 'open', mouth: 'smile' },
  curious: { eyes: 'wide', mouth: 'small' },
  worried: { eyes: 'worried', mouth: 'small' },
  angry: { eyes: 'angry', mouth: 'flat', isFlushed: true },
  sleepy: { eyes: 'blink', mouth: 'small' },
}

const segmentDistance = (x: number, y: number, a: [number, number], b: [number, number]) => {
  const pax = x - a[0]
  const pay = y - a[1]
  const bax = b[0] - a[0]
  const bay = b[1] - a[1]
  const h = clamp((pax * bax + pay * bay) / (bax * bax + bay * bay))
  return Math.hypot(pax - bax * h, pay - bay * h)
}

const polylineDistance = (x: number, y: number, points: [number, number][]) => {
  let best = Infinity
  for (let i = 1; i < points.length; i += 1) {
    best = Math.min(best, segmentDistance(x, y, points[i - 1] as [number, number], points[i] as [number, number]))
  }
  return best
}

/** The surface color at a hit point, before lighting; `spec` is how glossy it is. */
function albedo(p: V, part: Part, face: Face, m: Model, isBlinking: boolean): { color: V; spec: number } {
  const ax = Math.abs(p[0])
  const eyes = isBlinking && (face.eyes === 'open' || face.eyes === 'wide' || face.eyes === 'angry' || face.eyes === 'worried') ? 'blink' : face.eyes

  if (part === 'nose') return { color: COLORS.nose, spec: 0.6 }
  // Arms and paws are plain fur, even where they cross the face.
  if (part === 'arm') return { color: COLORS.fur, spec: 0 }

  if (part === 'ear') {
    const q = rotZ([ax, p[1], p[2]], EAR_CENTER, -m.earTilt)
    const u = (q[0] - EAR_CENTER[0]) / EAR_SIZE[0]
    const v = (q[1] - EAR_CENTER[1]) / EAR_SIZE[1]
    const inner = (u * u) / 0.62 + (v * v) / 0.5
    if (p[2] > EAR_CENTER[2] - 0.01 && inner < 1) {
      return { color: mix(COLORS.innerEarDeep, COLORS.innerEar, smoothstep(0.1, 0.9, inner)), spec: 0.05 }
    }
    return { color: COLORS.fur, spec: 0 }
  }

  if (face.eyes === 'shades' && p[2] > 0.25) {
    const lens = Math.max(Math.abs(ax - EYE_X) / 0.22, Math.abs(p[1] - EYE_Y + 0.01) / 0.15)
    const bridge = ax < 0.08 && Math.abs(p[1] - EYE_Y - 0.03) < 0.03
    if (lens < 1 || bridge) {
      const shine = Math.abs(p[1] - EYE_Y - 0.06 + (ax - EYE_X) * 0.6) < 0.025 && lens < 0.85
      return { color: shine ? hex(0x9aa3b8) : COLORS.shades, spec: 0.9 }
    }
  }

  if (part === 'eye') {
    const r = m.eyeRadius
    const qx = (ax - EYE_X) / r
    const qy = (p[1] - EYE_Y) / r
    // A plush's eye: closed eyes are stitched lines on the mask.
    if (eyes === 'blink' || eyes === 'happy') {
      const line = eyes === 'happy' ? Math.abs(qy - (0.25 - 0.55 * qx * qx)) : Math.abs(qy - (-0.15 - 0.35 * qx * qx))
      return { color: line < 0.16 ? COLORS.pupil : COLORS.mask, spec: 0.05 }
    }
    // Lids for angry (down toward the nose) and worried (up toward the nose); inward is toward Momo's middle.
    const inward = -qx
    if (eyes === 'angry' && qy > 0.25 - 0.55 * inward) return { color: COLORS.mask, spec: 0.05 }
    if (eyes === 'worried' && qy > 0.55 + 0.3 * inward) return { color: COLORS.mask, spec: 0.05 }
    const d = Math.hypot(qx + 0.05, qy + 0.05)
    const catchlight = Math.hypot(qx + 0.32, qy - 0.36) < 0.2 || Math.hypot(qx - 0.22, qy + 0.3) < 0.08
    if (catchlight) return { color: [1, 1, 1], spec: 1 }
    const pupil = eyes === 'wide' ? 0.42 : 0.33
    if (d < pupil) return { color: COLORS.pupil, spec: 1 }
    if (d < 0.78) return { color: mix(COLORS.irisDeep, COLORS.iris, smoothstep(pupil, 0.75, d)), spec: 1 }
    return { color: COLORS.ring, spec: 1 }
  }

  if (part === 'foot') {
    const toe = p[2] > 0.3 && p[1] < -0.86
    return { color: toe ? COLORS.toe : COLORS.fur, spec: 0 }
  }

  // Fur: eye mask, brows, blush, muzzle and mouth are painted onto it.
  let color = COLORS.fur
  if (p[2] > 0) {
    const maskD = Math.hypot(ax - EYE_X, (p[1] - EYE_Y) * 0.95)
    if (maskD < 0.29) color = mix(COLORS.mask, COLORS.fur, smoothstep(0.24, 0.29, maskD))

    if (face.eyes === 'angry' || face.eyes === 'worried') {
      const brow: [[number, number], [number, number]] =
        face.eyes === 'angry' ? [[0.42, 0.66], [0.14, 0.55]] : [[0.42, 0.58], [0.14, 0.68]]
      if (segmentDistance(ax, p[1], brow[0], brow[1]) < 0.035) return { color: COLORS.pupil, spec: 0 }
    }

    const blush = Math.hypot(ax - 0.45, p[1] - 0.08)
    if (blush < 0.1) color = mix(face.isFlushed ? COLORS.angryBlush : COLORS.blush, color, smoothstep(0.03, 0.1, blush))

    if (p[2] > 0.3) {
      const muzzle = Math.hypot(p[0] / 0.2, (p[1] - 0.12) / 0.13)
      if (muzzle < 1) color = mix(COLORS.muzzle, color, smoothstep(0.75, 1, muzzle))
      const mouth = mouthAt(p[0], p[1], m.pose === 'jump' && face.mouth !== 'flat' ? 'open' : face.mouth)
      if (mouth !== null) return { color: mouth, spec: 0.2 }
    }

    // Lighter belly.
    if (p[1] < -0.2) {
      const belly = Math.hypot(p[0] / 0.3, (p[1] + 0.52) / 0.3)
      if (belly < 1) color = mix(hex(0xfffcf6), color, smoothstep(0.6, 1, belly))
    }
  }
  return { color, spec: 0 }
}

function mouthAt(x: number, y: number, kind: Face['mouth']): V | null {
  const line = 0.017
  if (kind === 'smile') {
    const d = Math.min(
      polylineDistance(x, y, [[-0.11, 0.105], [-0.055, 0.07], [0, 0.1], [0.055, 0.07], [0.11, 0.105]]),
      segmentDistance(x, y, [0, 0.16], [0, 0.1]),
    )
    return d < line ? COLORS.mouth : null
  }
  if (kind === 'grin') {
    const open = Math.hypot(x / 0.1, (y - 0.065) / 0.065) < 1 && y < 0.095
    if (open) return y < 0.035 && Math.abs(x) < 0.06 ? COLORS.tongue : COLORS.mouth
    return segmentDistance(x, y, [0, 0.16], [0, 0.095]) < line ? COLORS.mouth : null
  }
  if (kind === 'flat') {
    const d = Math.min(segmentDistance(x, y, [-0.09, 0.075], [0.09, 0.075]), segmentDistance(x, y, [0, 0.16], [0, 0.075]))
    return d < line ? COLORS.mouth : null
  }
  if (kind === 'small') {
    if (Math.hypot(x / 0.03, (y - 0.075) / 0.035) < 1) return COLORS.mouth
    return segmentDistance(x, y, [0, 0.16], [0, 0.11]) < line ? COLORS.mouth : null
  }
  if (Math.hypot(x / 0.06, (y - 0.065) / 0.06) < 1) return y < 0.04 ? COLORS.tongue : COLORS.mouth
  return null
}

const KEY = norm([-0.55, 0.7, 0.65])
const FILL = norm([0.7, 0.15, 0.5])
const RIM = norm([0.2, 0.6, -0.8])

/** Lights one hit: soft wrap lighting for plush, a cool fill, a fluffy rim and glossy eyes. */
function shade(p: V, part: Part, face: Face, m: Model, isBlinking: boolean): V {
  const n = normalAt(p, m)
  const { color, spec } = albedo(p, part, face, m, isBlinking)
  const ao = occlusion(p, n, m)
  const wrap = (l: V, w: number) => clamp((dot(n, l) + w) / (1 + w))
  const key = wrap(KEY, 0.45)
  const fill = wrap(FILL, 0.3)
  const rim = Math.pow(clamp(1 - n[2]), 2.5) * clamp(dot(n, RIM) + 0.6)
  const warmShadow: V = [1, 0.92, 0.86]
  let light: V = add(mul([1, 0.98, 0.94], 1.0 * key), mul([0.75, 0.82, 1], 0.32 * fill))
  light = add(light, mul(warmShadow, 0.22 * ao))
  let out: V = [color[0] * light[0] * ao, color[1] * light[1] * ao, color[2] * light[2] * ao]
  out = add(out, mul([1, 0.97, 0.92], 0.35 * rim))
  if (spec > 0) {
    const h = norm(add(KEY, [0, 0, 1]))
    out = add(out, mul([1, 1, 1], spec * Math.pow(clamp(dot(n, h)), 60) * 0.9))
  }
  return out
}

export type RenderOptions = {
  width: number
  height: number
  /** Samples per pixel along each axis, for smooth edges. */
  samples: number
  /** World units across the image; Momo is about 2.6 wide. */
  span: number
  /** World y of the image's bottom edge. */
  bottom: number
  /** Which part to render; all of Momo when left out. */
  layer?: Layer
  /** What he does with his hands; arms down when left out. */
  gesture?: Gesture
}

/** Where the ear and tail layers attach to the body, in world units: Momo Desktop swings them around these. */
export const RIG = {
  earPivot: [0.5, 0.53] as [number, number],
  tailPivot: [TAIL[0]?.[0] ?? 0, TAIL[0]?.[1] ?? 0] as [number, number],
}

const toSrgb = (v: number) => Math.round(255 * Math.pow(clamp(v), 1 / 2.2))

/** Renders Momo; returns rows of RGBA, alpha 0 where nothing was hit. */
export function render(emotion: Emotion, pose: Pose, isBlinking: boolean, options: RenderOptions): RGBA[][] {
  const face = FACES[emotion]
  const model: Model = {
    pose,
    eyeRadius: face.eyes === 'wide' ? 0.215 : 0.195,
    earTilt: pose === 'jump' && options.layer !== 'ear' ? 0.75 : EAR_TILT,
    layer: options.layer ?? 'all',
    gesture: options.gesture ?? 'none',
  }
  const scale = options.span / options.width
  const rows: RGBA[][] = []
  for (let py = 0; py < options.height; py += 1) {
    const row: RGBA[] = []
    for (let px = 0; px < options.width; px += 1) {
      let sum: V = [0, 0, 0]
      let hits = 0
      for (let sy = 0; sy < options.samples; sy += 1) {
        for (let sx = 0; sx < options.samples; sx += 1) {
          const x = (px + (sx + 0.5) / options.samples) * scale - options.span / 2
          const y = options.bottom + (options.height - py - (sy + 0.5) / options.samples) * scale
          let z = 2
          for (let step = 0; step < 90; step += 1) {
            const p: V = [x, y, z]
            const hit = scene(p, model)
            if (hit.d < 0.0015) {
              sum = add(sum, shade(p, hit.part, face, model, isBlinking))
              hits += 1
              break
            }
            z -= Math.max(hit.d, 0.002)
            if (z < -1.5) break
          }
        }
      }
      const total = options.samples * options.samples
      row.push(
        hits === 0
          ? [0, 0, 0, 0]
          : [toSrgb(sum[0] / hits), toSrgb(sum[1] / hits), toSrgb(sum[2] / hits), Math.round((255 * hits) / total)],
      )
    }
    rows.push(row)
  }
  return rows
}
