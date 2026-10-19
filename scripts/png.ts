// Minimal PNG and animated PNG (APNG) writer for the baked images. Runs under Bun or Node.

import { deflateSync } from 'node:zlib'

/** One image: rows of [r, g, b, a] pixels, 0..255. */
export type Image = number[][][]

type Background = [number, number, number] | null

const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k += 1) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  }
  return c >>> 0
})

function crc(bytes: Uint8Array): number {
  let c = 0xffffffff
  for (const byte of bytes) {
    c = (CRC_TABLE[(c ^ byte) & 255] ?? 0) ^ (c >>> 8)
  }
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type), data])
  const sum = Buffer.alloc(4)
  sum.writeUInt32BE(crc(body))
  return Buffer.concat([length, body, sum])
}

/** Pixel rows to compressed scanlines; with a background, transparency is blended onto it. */
function encode(image: Image, background: Background) {
  const height = image.length
  const width = image[0]?.length ?? 0
  const raw = Buffer.alloc(height * (width * 4 + 1))
  image.forEach((row, y) =>
    row.forEach(([r = 0, g = 0, b = 0, a = 0], x) => {
      const at = y * (width * 4 + 1) + 1 + x * 4
      if (background) {
        const t = a / 255
        raw[at] = Math.round(r * t + background[0] * (1 - t))
        raw[at + 1] = Math.round(g * t + background[1] * (1 - t))
        raw[at + 2] = Math.round(b * t + background[2] * (1 - t))
        raw[at + 3] = 255
      } else {
        raw.set([r, g, b, a], at)
      }
    }),
  )
  return { width, height, data: deflateSync(raw) }
}

function header(width: number, height: number): Buffer {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bits per channel
  ihdr[9] = 6 // RGBA
  return chunk('IHDR', ihdr)
}

export function png(image: Image, background: Background = null): Buffer {
  const { width, height, data } = encode(image, background)
  return Buffer.concat([SIGNATURE, header(width, height), chunk('IDAT', data), chunk('IEND', Buffer.alloc(0))])
}

/** Frames of one size to an animated PNG that loops forever, `delayMs` per frame. */
export function apng(frames: Image[], background: Background, delayMs: number): Buffer {
  const encoded = frames.map(frame => encode(frame, background))
  const first = encoded[0]
  if (first === undefined) {
    throw new Error('apng needs at least one frame')
  }
  const parts = [SIGNATURE, header(first.width, first.height)]
  const control = Buffer.alloc(8)
  control.writeUInt32BE(frames.length)
  parts.push(chunk('acTL', control))

  let sequence = 0
  encoded.forEach((frame, index) => {
    const fctl = Buffer.alloc(26)
    fctl.writeUInt32BE(sequence++)
    fctl.writeUInt32BE(frame.width, 4)
    fctl.writeUInt32BE(frame.height, 8)
    fctl.writeUInt16BE(delayMs, 20)
    fctl.writeUInt16BE(1000, 22)
    parts.push(chunk('fcTL', fctl))
    if (index === 0) {
      parts.push(chunk('IDAT', frame.data))
    } else {
      const number = Buffer.alloc(4)
      number.writeUInt32BE(sequence++)
      parts.push(chunk('fdAT', Buffer.concat([number, frame.data])))
    }
  })
  parts.push(chunk('IEND', Buffer.alloc(0)))
  return Buffer.concat(parts)
}
