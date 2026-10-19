// Drawing Momo: the side pane, and a one-line band when the terminal is too narrow for it.

import type { EngineInterface, ResolveInput } from 'claude-code'

import type { Bubble, Emotion, Mood } from '../types'
import { COLOR, EMOJI, monkey } from './art'
import { moodBar } from './mood'

/** Below this many columns the pane waits, so the band speaks for Momo instead. */
export const PANE_MIN_COLUMNS = 110

type View = { emotion: Emotion; mood: Mood; bubble: Bubble; frame: number }

export function pane($: EngineInterface, e: ResolveInput, { emotion, mood, bubble, frame }: View) {
  const { Box, Text } = $.ui.resolve(e)
  const color = COLOR[emotion]

  return (
    <Box flexDirection="column" paddingX={1}>
      <Text color={color} bold>
        Momo {EMOJI[emotion]} {emotion}
      </Text>
      {monkey(emotion, frame % 4 === 3 ? 1 : 0).map(line => (
        <Text mono>{line}</Text>
      ))}
      <Text dimColor>
        mood {moodBar(mood.score)} {mood.score > 0 ? '+' : ''}
        {mood.score}
      </Text>
      <Box borderStyle="round" borderColor={color} flexDirection="column" paddingX={1} marginTop={1}>
        <Text wrap="wrap">{bubble.text}</Text>
        {bubble.lines.map(line => (
          <Text wrap="wrap">{line}</Text>
        ))}
      </Box>
      <Text dimColor>/momo changes · /momo recap · /momo pet</Text>
    </Box>
  )
}

export function band($: EngineInterface, e: ResolveInput, { emotion, bubble }: View) {
  const { Box, Text } = $.ui.resolve(e)

  return (
    <Box>
      <Text color={COLOR[emotion]}>
        🐒 {EMOJI[emotion]} Momo: <Text wrap="truncate-end">{bubble.text}</Text>
      </Text>
    </Box>
  )
}
