import { describe, expect, test } from 'claude-code/testing'

import { SPRITE_HEIGHT, SPRITE_WIDTH, spriteRows, PALETTE } from '../hooks/sprite'
import { encodeCells, initialActor, paint, poseOf, step, toBase64 } from '../hooks/stage'

const EMOTIONS = ['happy', 'proud', 'calm', 'curious', 'worried', 'angry', 'sleepy'] as const
const STAGE = { columns: 44, rows: 20 }

// A fixed sequence instead of Math.random, so runs repeat.
const sequence = () => {
  let seed = 7
  return () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
}

describe('sprite', () => {
  test('every pose fills the sprite box and uses only palette colors', () => {
    for (const emotion of EMOTIONS) {
      for (const pose of ['sit', 'jump', 'squash'] as const) {
        const rows = spriteRows(emotion, pose, false)
        expect(rows.length).toBe(SPRITE_HEIGHT)
        for (const row of rows) {
          expect(row.length).toBe(SPRITE_WIDTH)
          for (const char of row) {
            expect(char === '.' || PALETTE[char] !== undefined).toBe(true)
          }
        }
      }
    }
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
