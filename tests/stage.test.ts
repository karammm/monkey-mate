import { describe, expect, test } from 'claude-code/testing'

import type { Emotion } from '../types'
import { SPRITE_HEIGHT, SPRITE_WIDTH, spriteKey, spritePixels, TRANSPARENT } from '../hooks/sprite'
import type { Pose } from '../hooks/sprite'
import { SPRITES } from '../hooks/sprites.generated'
import { encodeCells, initialActor, paint, poseOf, step, toBase64 } from '../hooks/stage'

const EMOTIONS = ['happy', 'proud', 'calm', 'curious', 'worried', 'angry', 'sleepy'] as const
const STAGE = { columns: 52, rows: 22 }

// A fixed sequence instead of Math.random, so runs repeat.
const sequence = () => {
  let seed = 7
  return () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
}

describe('sprite', () => {
  test('every baked sprite decodes to a full box of real colors', () => {
    for (const key of Object.keys(SPRITES)) {
      const [emotion, pose, blink] = key.split(':') as [Emotion, Pose, string]
      const pixels = spritePixels(emotion, pose, blink === '1', false)
      expect(pixels.length).toBe(SPRITE_HEIGHT)
      let solid = 0
      for (const row of pixels) {
        expect(row.length).toBe(SPRITE_WIDTH)
        for (const color of row) {
          expect(color === TRANSPARENT || (color >= 0 && color <= 0xffffff)).toBe(true)
          solid += color === TRANSPARENT ? 0 : 1
        }
      }
      // Momo fills a good part of his box.
      expect(solid > (SPRITE_WIDTH * SPRITE_HEIGHT) / 4).toBe(true)
    }
  })

  test('there is a sprite for every mood and pose, and facing left mirrors it', () => {
    for (const emotion of EMOTIONS) {
      for (const pose of ['sit', 'jump', 'squash'] as const) {
        expect(SPRITES[spriteKey(emotion, pose, false)] !== undefined).toBe(true)
      }
    }
    const right = spritePixels('calm', 'sit', false, false)
    const left = spritePixels('calm', 'sit', false, true)
    expect(left[10]).toEqual([...(right[10] ?? [])].reverse())
  })
})

describe('stage', () => {
  test('Momo jumps around but never leaves the stage', () => {
    for (const emotion of EMOTIONS) {
      let actor = initialActor()
      const random = sequence()
      let jumped = false
      for (let tick = 0; tick < 2000; tick += 1) {
        actor = step(actor, emotion, STAGE, random)
        jumped ||= poseOf(actor) === 'jump'
        expect(actor.x >= 0 && actor.x <= STAGE.columns - SPRITE_WIDTH).toBe(true)
        expect(actor.y >= 0 && actor.y <= STAGE.rows * 2 - SPRITE_HEIGHT).toBe(true)
      }
      expect(jumped).toBe(emotion !== 'sleepy')
    }
  })

  test('a sleepy Momo stays put', () => {
    let actor = initialActor()
    for (let tick = 0; tick < 500; tick += 1) {
      actor = step(actor, 'sleepy', STAGE, Math.random)
    }
    expect(actor.x).toBe(initialActor().x)
  })

  test('cells hold one glyph, foreground and background per cell', () => {
    const cells = encodeCells(paint(initialActor(), 'happy', STAGE), STAGE)
    expect(cells.length).toBe((Math.ceil((STAGE.columns * STAGE.rows * 12) / 3) * 4))
  })

  test('base64 matches the standard alphabet and padding', () => {
    const bytes = (text: string) => new TextEncoder().encode(text)
    expect(toBase64(bytes('Momo'))).toBe('TW9tbw==')
    expect(toBase64(bytes('monkey'))).toBe('bW9ua2V5')
    expect(toBase64(bytes('banana!'))).toBe('YmFuYW5hIQ==')
  })
})
