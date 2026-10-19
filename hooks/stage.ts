// Momo's little stage: where Momo stands, hops and lands, and how that becomes terminal cells.
// Pure: no engine calls. Each terminal cell holds two pixels, top and bottom, drawn with '▀'.

import type { Emotion } from '../types'
import { SPRITE_HEIGHT, SPRITE_WIDTH, spritePixels, spriteRows, TRANSPARENT } from './sprite'
import type { Pose } from './sprite'

const GRAVITY = 0.9 // pixels per tick per tick
const SHADOW = 0x6f6a64
const DEFAULT_COLOR = 0x01000000
const UPPER_HALF = 0x2580
const LOWER_HALF = 0x2584
const SPACE = 0x20

export type Actor = {
  /** Left edge, in pixels. */
  x: number
  /** Height above the ground, in pixels: 0 is standing. */
  y: number
  vx: number
  vy: number
  isFacingLeft: boolean
  /** Ticks left before Momo decides what to do next. */
  restTicks: number
  /** Ticks left of a landing squash. */
  squashTicks: number
  /** Ticks until the next blink. */
  blinkTicks: number
}

export type Stage = { columns: number; rows: number }

export const initialActor = (): Actor => ({
  x: 2,
  y: 0,
  vx: 0,
  vy: 0,
  isFacingLeft: false,
  restTicks: 10,
  squashTicks: 0,
  blinkTicks: 40,
})

type Plan = { restTicks: [number, number]; height: [number, number]; reach: number }

// How restless each emotion is: ticks to rest, how high a jump goes and how far (both 0..1 of the room there is).
const PLANS: Record<Emotion, Plan | null> = {
  happy: { restTicks: [8, 25], height: [0.6, 0.9], reach: 0.8 },
  proud: { restTicks: [5, 15], height: [0.8, 1], reach: 1 },
  curious: { restTicks: [10, 30], height: [0.25, 0.4], reach: 0.4 },
  calm: { restTicks: [30, 80], height: [0.3, 0.5], reach: 0.5 },
  worried: { restTicks: [6, 14], height: [0.1, 0.2], reach: 0.15 },
  angry: { restTicks: [2, 6], height: [0.1, 0.25], reach: 0.05 },
  sleepy: null,
}

const between = ([low, high]: [number, number], random: () => number): number => low + (high - low) * random()

/** One animation step. `random` returns 0..1. */
export function step(actor: Actor, emotion: Emotion, stage: Stage, random: () => number): Actor {
  const room = Math.max(0, stage.columns - SPRITE_WIDTH)
  const headroom = Math.max(0, stage.rows * 2 - SPRITE_HEIGHT)
  const blinkTicks = actor.blinkTicks <= 0 ? 30 + Math.floor(random() * 50) : actor.blinkTicks - 1

  if (actor.y > 0 || actor.vy > 0) {
    const y = Math.min(headroom, actor.y + actor.vy)
    const x = Math.max(0, Math.min(room, actor.x + actor.vx))
    if (y <= 0) {
      return { ...actor, x, y: 0, vx: 0, vy: 0, squashTicks: 2, blinkTicks }
    }

    return { ...actor, x, y, vy: actor.vy - GRAVITY, blinkTicks }
  }

  const squashTicks = Math.max(0, actor.squashTicks - 1)
  const plan = PLANS[emotion]
  if (plan === null || actor.restTicks > 0) {
    return { ...actor, restTicks: actor.restTicks - 1, squashTicks, blinkTicks }
  }

  // Time to jump: pick a spot within reach and leap toward it.
  const reach = room * plan.reach
  const target = Math.max(0, Math.min(room, actor.x + (random() * 2 - 1) * reach))
  // Rising at vy against gravity peaks at vy² / 2g: pick vy for the height wanted.
  const vy = Math.sqrt(2 * GRAVITY * Math.max(1, headroom * between(plan.height, random)))
  const airTicks = Math.max(1, (2 * vy) / GRAVITY)
  const vx = (target - actor.x) / airTicks

  return {
    ...actor,
    vx,
    vy,
    y: 0.01,
    isFacingLeft: vx === 0 ? actor.isFacingLeft : vx < 0,
    restTicks: Math.round(between(plan.restTicks, random)),
    squashTicks: 0,
    blinkTicks,
  }
}

export function poseOf(actor: Actor): Pose {
  if (actor.y > 0) {
    return 'jump'
  }

  return actor.squashTicks > 0 ? 'squash' : 'sit'
}

/** The stage as pixels: Momo, plus a shadow on the ground while airborne. */
export function paint(actor: Actor, emotion: Emotion, stage: Stage): number[][] {
  const height = stage.rows * 2
  const pixels = Array.from({ length: height }, () => new Array<number>(stage.columns).fill(TRANSPARENT))
  const left = Math.round(actor.x)
  const top = height - SPRITE_HEIGHT - Math.round(actor.y)

  if (actor.y > 1) {
    const shadowWidth = Math.max(4, SPRITE_WIDTH - 4 - Math.round(actor.y / 2))
    const shadowLeft = left + Math.round((SPRITE_WIDTH - shadowWidth) / 2)
    for (let column = shadowLeft; column < shadowLeft + shadowWidth; column += 1) {
      setPixel(pixels, height - 1, column, SHADOW)
    }
  }

  const sprite = spritePixels(spriteRows(emotion, poseOf(actor), actor.blinkTicks < 3), actor.isFacingLeft)
  sprite.forEach((row, rowIndex) =>
    row.forEach((color, columnIndex) => {
      if (color !== TRANSPARENT) {
        setPixel(pixels, top + rowIndex, left + columnIndex, color)
      }
    }),
  )

  return pixels
}

function setPixel(pixels: number[][], row: number, column: number, color: number) {
  const line = pixels[row]
  if (line !== undefined && column >= 0 && column < line.length) {
    line[column] = color
  }
}

/** Pixels (2 per cell, top and bottom) as a Raster's `cells`: base64 of u32 [glyph, fg, bg] per cell. */
export function encodeCells(pixels: readonly number[][], stage: Stage): string {
  const words = new Uint32Array(stage.columns * stage.rows * 3)
  for (let row = 0; row < stage.rows; row += 1) {
    for (let column = 0; column < stage.columns; column += 1) {
      const top = pixels[row * 2]?.[column] ?? TRANSPARENT
      const bottom = pixels[row * 2 + 1]?.[column] ?? TRANSPARENT
      const at = (row * stage.columns + column) * 3
      if (top === TRANSPARENT && bottom === TRANSPARENT) {
        words.set([SPACE, DEFAULT_COLOR, DEFAULT_COLOR], at)
      } else if (top === TRANSPARENT) {
        words.set([LOWER_HALF, bottom, DEFAULT_COLOR], at)
      } else {
        words.set([UPPER_HALF, top, bottom === TRANSPARENT ? DEFAULT_COLOR : bottom], at)
      }
    }
  }

  return toBase64(littleEndianBytes(words))
}

function littleEndianBytes(words: Uint32Array): Uint8Array {
  const bytes = new Uint8Array(words.length * 4)
  const view = new DataView(bytes.buffer)
  words.forEach((word, index) => view.setUint32(index * 4, word, true))

  return bytes
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

export function toBase64(bytes: Uint8Array): string {
  let out = ''
  for (let index = 0; index < bytes.length; index += 3) {
    const a = bytes[index] ?? 0
    const b = bytes[index + 1]
    const c = bytes[index + 2]
    const triple = (a << 16) | ((b ?? 0) << 8) | (c ?? 0)
    out += ALPHABET[(triple >> 18) & 63]
    out += ALPHABET[(triple >> 12) & 63]
    out += b === undefined ? '=' : ALPHABET[(triple >> 6) & 63]
    out += c === undefined ? '=' : ALPHABET[triple & 63]
  }

  return out
}
