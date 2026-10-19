// Momo as pixel art: a little white snow monkey, 18x18 pixels per pose. Pure: no engine calls.
// Each character is one pixel; PALETTE says its color, '.' is see-through.

import type { Emotion } from '../types'

export const TRANSPARENT = -1

export const PALETTE: Record<string, number> = {
  W: 0xf7f4ef, // fur
  w: 0xddd6cc, // fur in shade
  g: 0x9c9389, // fur outline
  p: 0xf3c3b4, // face
  P: 0xe3a493, // face in shade
  e: 0x2a1a16, // eye
  h: 0xffffff, // eye shine
  n: 0xb4675c, // nose
  m: 0x7d3530, // mouth
  k: 0xf59aa0, // blush
  i: 0xe8a6a3, // inner ear
  r: 0xd94a4a, // angry blush
}

const HEAD = [
  '......gggggg......',
  '....ggWWWWWWgg....',
  '...gWWWWWWWWWWg...',
  '..gWWWWWWWWWWWWg..',
]

const EYES = {
  open: ['giiWphepppphepWiig', 'giiWpeeppppeepWiig'],
  blink: ['giiWppppppppppWiig', 'giiWpeeppppeepWiig'],
  happy: ['giiWpeeppppeepWiig', 'giiWeppeppeppeWiig'],
  angry: ['giiWpehpppphepWiig', 'giiWpeeppppeepWiig'],
  worried: ['giiWpheppppehpWiig', 'giiWpeeppppeepWiig'],
  shades: ['giiWeheeeeeheeWiig', 'giiWpeeeppeeepWiig'],
}

// Two rows: the top of the face and the row over the eyes. Angry slopes down inward, worried up.
const BROWS = {
  none: ['.gWWWppppppppWWWg.', 'gggWppppppppppWggg'],
  angry: ['.gWWWeppppppeWWWg.', 'gggWppeppppeppWggg'],
  worried: ['.gWWWpeppppepWWWg.', 'gggWeppppppppeWggg'],
}

const CHEEKS = {
  calm: 'gggWppkpnnpkppWggg',
  angry: 'gggWpprpnnprppWggg',
}

const MOUTHS = {
  smile: ['.gWWWppPmmPppWWWg.', '..gWWWPPPPPPWWWg..'],
  grin: ['.gWWWpmmmmmmpWWWg.', '..gWWWPmmmmPWWWg..'],
  flat: ['.gWWWppmmmmppWWWg.', '..gWWWPPPPPPWWWg..'],
  small: ['.gWWWpppmmpppWWWg.', '..gWWWPPPPPPWWWg..'],
  open: ['.gWWWpppmmpppWWWg.', '..gWWWPPmmPPWWWg..'],
}

const BODY = {
  sit: [
    '...gwWWWWWWWWwg...',
    '..gWWWwWWWWwWWWg..',
    '.gWWwgWWWWWWgwWWg.',
    '.gWWg.gWWWWg.gWWg.',
    '..gpg.gWWWWg.gpg..',
    '......gwWWwg..ggg.',
    '.....gpp..ppg..gg.',
  ],
  jump: [
    'gp.gwWWWWWWWWwg.pg',
    'gWggWWwWWWWwWWggWg',
    '.gWWWgWWWWWWgWWWg.',
    '.....gWWWWWWg.....',
    '......gWWWWg...gg.',
    '......gw..wg..gg..',
    '.....gpp..ppg.....',
  ],
  squash: [
    '..gwWWWWWWWWWWwg..',
    '.gWWWwWWWWWWwWWWg.',
    'gWWwgWWWWWWWWgwWWg',
    'gpg.gWWWWWWWWg.gpg',
    '....gwWWWWWWwg.ggg',
    '...gpp......ppg.gg',
    '..................',
  ],
}

export type Pose = 'sit' | 'jump' | 'squash'

type Face = { eyes: keyof typeof EYES; brows: keyof typeof BROWS; cheeks: keyof typeof CHEEKS; mouth: keyof typeof MOUTHS }

const FACES: Record<Emotion, Face> = {
  happy: { eyes: 'happy', brows: 'none', cheeks: 'calm', mouth: 'grin' },
  proud: { eyes: 'shades', brows: 'none', cheeks: 'calm', mouth: 'smile' },
  calm: { eyes: 'open', brows: 'none', cheeks: 'calm', mouth: 'smile' },
  curious: { eyes: 'open', brows: 'none', cheeks: 'calm', mouth: 'open' },
  worried: { eyes: 'worried', brows: 'worried', cheeks: 'calm', mouth: 'small' },
  angry: { eyes: 'angry', brows: 'angry', cheeks: 'angry', mouth: 'flat' },
  sleepy: { eyes: 'blink', brows: 'none', cheeks: 'calm', mouth: 'small' },
}

export const SPRITE_WIDTH = 18
export const SPRITE_HEIGHT = 18

/** Momo's pixels for an emotion and pose, as palette characters, one string per row. */
export function spriteRows(emotion: Emotion, pose: Pose, isBlinking: boolean): string[] {
  const face = FACES[emotion]
  const eyes = isBlinking && face.eyes !== 'happy' && face.eyes !== 'shades' ? EYES.blink : EYES[face.eyes]
  // In the air Momo always looks delighted.
  const mouth = pose === 'jump' && emotion !== 'angry' ? MOUTHS.open : MOUTHS[face.mouth]

  return [...HEAD.slice(0, 4), ...BROWS[face.brows], ...eyes, CHEEKS[face.cheeks], ...mouth, ...BODY[pose]]
}

/** The rows as colors, mirrored when Momo faces left. */
export function spritePixels(rows: readonly string[], isFacingLeft: boolean): number[][] {
  return rows.map(row => {
    const pixels = [...row].map(char => PALETTE[char] ?? TRANSPARENT)

    return isFacingLeft ? pixels.reverse() : pixels
  })
}
