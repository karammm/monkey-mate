// Momo, the little white monkey, in ASCII. Every line is the same width so the pane never jitters.

import type { Emotion } from '../types'

type Face = { brow: string; eyes: string; mouth: string; extra?: string }

const FACES: Record<Emotion, Face> = {
  happy: { brow: '       ', eyes: ' ^   ^ ', mouth: ' \\___/ ' },
  proud: { brow: '   *   ', eyes: '[■]-[■]', mouth: ' \\___/ ' },
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
    `    .-"""""-.  ${extra}`,
    ` .-/ ${face.brow} \\-.`,
    `( (| ${eyes} |) )`,
    ` '-\\ ${face.mouth} /-'`,
    `    '-.___.-'`,
    `     /|   |\\`,
    `      |___|`,
  ].map(line => line.padEnd(WIDTH))
}

export const WIDTH = 19

export const EMOJI: Record<Emotion, string> = {
  happy: '😄',
  proud: '😎',
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
