// Momo as pixel art: a plush little white lemur-monkey with huge ears and big round eyes.
// Pure: no engine calls. Momo is built from shapes (ellipses for the head, ears, body and eyes) on a
// grid of palette characters, then outlined; '.' is see-through.

import type { Emotion } from '../types'

export const TRANSPARENT = -1

export const PALETTE: Record<string, number> = {
  W: 0xf7f2e8, // fur
  w: 0xe3dacb, // fur in shade
  g: 0x968a7b, // outline
  i: 0xf2b8b1, // inner ear
  I: 0xe0a19b, // inner ear, deeper
  t: 0x8c7869, // eye mask
  a: 0xe6ad45, // iris
  A: 0xa8711d, // iris edge
  e: 0x1d1512, // pupil, lids, sunglasses
  h: 0xffffff, // eye shine
  n: 0x5b3934, // nose and mouth
  p: 0xf3c6b8, // muzzle and toes
  k: 0xf7a3a8, // blush
  r: 0xe0504d, // angry blush
}

export const SPRITE_WIDTH = 32
export const SPRITE_HEIGHT = 28

export type Pose = 'sit' | 'jump' | 'squash'

type Grid = string[][]

const CENTER = (SPRITE_WIDTH - 1) / 2

// Paints palette char `c` at x and at its mirror image across Momo's middle.
function both(grid: Grid, x: number, y: number, c: string) {
  put(grid, x, y, c)
  put(grid, SPRITE_WIDTH - 1 - x, y, c)
}

function put(grid: Grid, x: number, y: number, c: string) {
  const row = grid[Math.round(y)]
  const column = Math.round(x)
  if (row !== undefined && column >= 0 && column < SPRITE_WIDTH) {
    row[column] = c
  }
}

/** Fills an ellipse centred at (cx, cy), tilted by `angle` radians, on both sides of Momo. */
function ellipse(grid: Grid, cx: number, cy: number, rx: number, ry: number, c: string, angle = 0) {
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  for (let y = 0; y < SPRITE_HEIGHT; y += 1) {
    for (let x = 0; x <= CENTER + 1; x += 1) {
      const dx = x - cx
      const dy = y - cy
      const u = (dx * cos + dy * sin) / rx
      const v = (-dx * sin + dy * cos) / ry
      if (u * u + v * v <= 1) {
        both(grid, x, y, c)
      }
    }
  }
}

/** Fur next to empty space becomes outline, so every shape reads against any background. */
function outline(grid: Grid) {
  const isEmpty = (x: number, y: number) => (grid[y]?.[x] ?? '.') === '.'
  const edges: [number, number][] = []
  grid.forEach((row, y) =>
    row.forEach((c, x) => {
      if (c !== '.' && (isEmpty(x - 1, y) || isEmpty(x + 1, y) || isEmpty(x, y - 1) || isEmpty(x, y + 1))) {
        edges.push([x, y])
      }
    }),
  )
  for (const [x, y] of edges) {
    put(grid, x, y, 'g')
  }
}

type Eyes = 'open' | 'blink' | 'happy' | 'angry' | 'worried' | 'shades' | 'wide'
type Mouth = 'smile' | 'grin' | 'flat' | 'small' | 'open'
type Face = { eyes: Eyes; mouth: Mouth; isFlushed?: boolean }

const FACES: Record<Emotion, Face> = {
  happy: { eyes: 'happy', mouth: 'grin' },
  proud: { eyes: 'shades', mouth: 'smile' },
  calm: { eyes: 'open', mouth: 'smile' },
  curious: { eyes: 'wide', mouth: 'open' },
  worried: { eyes: 'worried', mouth: 'small' },
  angry: { eyes: 'angry', mouth: 'flat', isFlushed: true },
  sleepy: { eyes: 'blink', mouth: 'small' },
}

// Where the left eye sits; the right one is its mirror.
const EYE_X = 10.5
const EYE_Y = 12

function eyes(grid: Grid, kind: Eyes) {
  ellipse(grid, EYE_X, EYE_Y, 3.9, 3.5, 't')
  const x = EYE_X
  const y = EYE_Y

  if (kind === 'blink') {
    for (let dx = -2; dx <= 2; dx += 1) both(grid, x + dx, y + 1, 'e')
    return
  }
  if (kind === 'happy') {
    both(grid, x - 2, y + 1, 'e')
    both(grid, x - 1, y, 'e')
    both(grid, x, y - 0.6, 'e')
    both(grid, x + 1, y, 'e')
    both(grid, x + 2, y + 1, 'e')
    return
  }
  if (kind === 'shades') {
    for (let dy = -1; dy <= 1; dy += 1) for (let dx = -3; dx <= 3; dx += 1) both(grid, x + dx, y + dy, 'e')
    for (let dx = 3; dx <= CENTER - x + 0.5; dx += 1) both(grid, x + dx, y - 1, 'e')
    both(grid, x - 2, y - 1, 'h')
    both(grid, x - 1, y - 1, 'h')
    return
  }

  ellipse(grid, x, y, 2.6, 2.6, 'A')
  ellipse(grid, x, y, 1.9, 1.9, 'a')
  const pupil = kind === 'wide' ? 1.5 : 1.1
  ellipse(grid, x + 0.3, y + 0.3, pupil, pupil, 'e')
  both(grid, x - 1, y - 1, 'h')

  if (kind === 'angry') {
    // Heavy lids sloping down toward the nose.
    for (let dx = -3; dx <= 3; dx += 1) {
      const lid = Math.round(y - 2 + (dx + 3) / 3)
      for (let ly = y - 3; ly <= lid; ly += 1) both(grid, x + dx, ly, 't')
      both(grid, x + dx, lid, 'e')
    }
  }
  if (kind === 'worried') {
    // Brows sloping up toward the nose.
    for (let dx = -3; dx <= 2; dx += 1) both(grid, x + dx, y - 4 - (dx + 3) / 3, 'e')
  }
}

function mouth(grid: Grid, kind: Mouth) {
  const y = 16
  both(grid, CENTER, y - 1, 'n') // nose
  if (kind === 'smile') {
    both(grid, CENTER - 1, y, 'n')
    both(grid, CENTER - 2, y - 0.6, 'n')
  } else if (kind === 'grin') {
    for (let dx = 0; dx <= 2; dx += 1) both(grid, CENTER - dx, y, 'n')
    for (let dx = 0; dx <= 1; dx += 1) both(grid, CENTER - dx, y + 1, 'n')
    both(grid, CENTER, y + 1, 'k')
  } else if (kind === 'flat') {
    for (let dx = 0; dx <= 2; dx += 1) both(grid, CENTER - dx, y + 1, 'n')
  } else if (kind === 'small') {
    both(grid, CENTER, y + 1, 'n')
  } else {
    both(grid, CENTER, y, 'n')
    both(grid, CENTER, y + 1, 'n')
    both(grid, CENTER - 1, y + 0.5, 'n')
  }
}

function body(grid: Grid, pose: Pose) {
  const lift = pose === 'jump' ? -1 : pose === 'squash' ? 1 : 0
  const squash = pose === 'squash' ? 1.3 : 1
  ellipse(grid, CENTER, 21.5 + lift, 6.8 * squash, 5 / squash, 'W')
  ellipse(grid, CENTER, 23 + lift, 3.8 * squash, 2.6 / squash, 'w')

  if (pose === 'jump') {
    // Arms up, feet dangling.
    ellipse(grid, 7.5, 19, 1.6, 3, 'W', 0.6)
    ellipse(grid, 12.5, 26, 1.8, 1.6, 'W')
    both(grid, 12, 27, 'p')
  } else {
    ellipse(grid, 8, 22 + lift, 1.7, 3.4, 'W', -0.35)
    ellipse(grid, 11, 26, 2.8 * squash, 1.6, 'W')
    both(grid, 10, 27, 'p')
    both(grid, 12, 27, 'p')
  }
}

/** Momo's pixels for an emotion and pose, as palette characters, one string per row. */
export function spriteRows(emotion: Emotion, pose: Pose, isBlinking: boolean): string[] {
  const grid: Grid = Array.from({ length: SPRITE_HEIGHT }, () => new Array<string>(SPRITE_WIDTH).fill('.'))
  const face = FACES[emotion]
  const drop = pose === 'squash' ? 1 : 0
  const flap = pose === 'jump' ? -0.15 : 0

  // Huge ears, tilted up and out, with a pink inside.
  ellipse(grid, 4.8, 6 + drop, 6.2, 3.4, 'W', 0.62 + flap)
  ellipse(grid, 5.2, 6.2 + drop, 4.6, 2, 'i', 0.62 + flap)
  ellipse(grid, 5.6, 6.4 + drop, 2.6, 0.9, 'I', 0.62 + flap)

  body(grid, pose)

  // A big round head.
  ellipse(grid, CENTER, 12 + drop, 8.6, 7.2, 'W')
  ellipse(grid, CENTER, 16.5 + drop, 2.6, 1.6, 'p')
  outline(grid)

  both(grid, 8, 15 + drop, face.isFlushed ? 'r' : 'k')
  both(grid, 9, 15 + drop, face.isFlushed ? 'r' : 'k')

  const steady = face.eyes === 'happy' || face.eyes === 'shades' || face.eyes === 'blink'
  const shift = drop === 1 ? 1 : 0
  const faceGrid = shift ? grid.slice(shift) : grid
  eyes(faceGrid, isBlinking && !steady ? 'blink' : face.eyes)
  mouth(faceGrid, pose === 'jump' && emotion !== 'angry' ? 'open' : face.mouth)

  return grid.map(row => row.join(''))
}

/** The rows as colors, mirrored when Momo faces left. */
export function spritePixels(rows: readonly string[], isFacingLeft: boolean): number[][] {
  return rows.map(row => {
    const pixels = [...row].map(char => PALETTE[char] ?? TRANSPARENT)

    return isFacingLeft ? pixels.reverse() : pixels
  })
}
