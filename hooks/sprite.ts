// Momo as the terminal draws him: small shaded sprites rendered from the 3D model in scripts/momo3d.ts
// by scripts/bake.ts into sprites.generated.ts. Pure: no engine calls.

import type { Emotion } from '../types'
import { HEIGHT, PALETTE, SPRITES, WIDTH } from './sprites.generated'

export const TRANSPARENT = -1
export const SPRITE_WIDTH = WIDTH
export const SPRITE_HEIGHT = HEIGHT

export type Pose = 'sit' | 'jump' | 'squash'

export const spriteKey = (emotion: Emotion, pose: Pose, isBlinking: boolean): string =>
  `${emotion}:${pose}:${isBlinking ? 1 : 0}`

const cache = new Map<string, number[][]>()

/** Momo's pixels as 0xRRGGBB colors (TRANSPARENT where empty), one array per row. */
export function spritePixels(emotion: Emotion, pose: Pose, isBlinking: boolean, isFacingLeft: boolean): number[][] {
  // Faces whose eyes are already closed or covered have no separate blink sprite.
  const key = SPRITES[spriteKey(emotion, pose, isBlinking)] !== undefined ? spriteKey(emotion, pose, isBlinking) : spriteKey(emotion, pose, false)
  let rows = cache.get(key)
  if (rows === undefined) {
    rows = decode(SPRITES[key] ?? '')
    cache.set(key, rows)
  }

  return isFacingLeft ? rows.map(row => [...row].reverse()) : rows
}

function decode(data: string): number[][] {
  const indexes = fromBase64(data)
  return Array.from({ length: HEIGHT }, (_, y) =>
    Array.from({ length: WIDTH }, (_, x) => {
      const index = indexes[y * WIDTH + x] ?? 0
      return index === 0 ? TRANSPARENT : (PALETTE[index - 1] ?? TRANSPARENT)
    }),
  )
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

export function fromBase64(text: string): Uint8Array {
  const clean = text.replace(/=+$/, '')
  const bytes = new Uint8Array(Math.floor((clean.length * 3) / 4))
  let buffer = 0
  let bits = 0
  let at = 0
  for (const char of clean) {
    buffer = (buffer << 6) | ALPHABET.indexOf(char)
    bits += 6
    if (bits >= 8) {
      bits -= 8
      bytes[at] = (buffer >> bits) & 255
      at += 1
    }
  }
  return bytes
}
