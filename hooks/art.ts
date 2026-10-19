// Momo, the little big-eared white monkey, in ASCII, for surfaces without pixel graphics. Every line is the same width so the pane never jitters.

import type { Emotion } from '../types'

type Face = { brow: string; eyes: string; mouth: string; extra?: string }

const FACES: Record<Emotion, Face> = {
  happy: { brow: '       ', eyes: ' ^   ^ ', mouth: ' \\___/ ' },
  proud: { brow: '   *   ', eyes: ' O   O ', mouth: ' \\___/ ' },
  calm: { brow: '       ', eyes: ' o   o ', mouth: '  ---  ' },
  curious: { brow: '     ? ', eyes: ' o   O ', mouth: '   o   ' },
  worried: { brow: ' /   \\ ', eyes: ' o   o ', mouth: '  ~~~  ', extra: '  ;' },
  angry: { brow: ' \\   / ', eyes: ' >   < ', mouth: ' /===\\ ', extra: ' #!' },
  sleepy: { brow: '     z ', eyes: ' -   - ', mouth: '   o   ', extra: ' Zz' },
}

const BLINK = ' -   - '

/** Momo's face for an emotion; odd frames blink (sleepy Momo is already blinking). */
export const monkey = (emotion: Emotion, frame: number): string[] => {
  const face = FACES[emotion]
  const eyes = frame % 2 === 1 && emotion !== 'angry' ? BLINK : face.eyes
  const extra = face.extra ?? ''

  return [
    `  __           __  ${extra}`,
    ` /  \\ .-"""-. /  \\`,
    ` \\   /${face.brow}\\   /`,
    `  \\  |${eyes}|  /`,
    `     |${face.mouth}|`,
    `      '-----'`,
    `      /|   |\\`,
    `     (_|___|_)`,
  ].map(line => line.padEnd(WIDTH))
}

export const WIDTH = 22

export const EMOJI: Record<Emotion, string> = {
  happy: '😄',
  proud: '🤩',
  calm: '🙂',
  curious: '🤔',
  worried: '😟',
  angry: '😠',
  sleepy: '😴',
}

export const COLOR: Record<Emotion, 'success' | 'warning' | 'error' | 'claude' | 'suggestion' | 'subtle'> = {
  happy: 'success',
  proud: 'success',
  calm: 'suggestion',
  curious: 'claude',
  worried: 'warning',
  angry: 'error',
  sleepy: 'subtle',
}
