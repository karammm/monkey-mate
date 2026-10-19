// Drawing Momo: the side pane, and a one-line band when the terminal is too narrow for it.
// The terminal gets pixel-art Momo on a stage (a Raster the animation repaints); other surfaces get the ASCII Momo.

import type { EngineInterface, ResolveInput } from 'claude-code'

import type { Bubble, Emotion, Mood } from '../types'
import { COLOR, EMOJI, monkey } from './art'
import { moodBar } from './mood'
import type { Stage } from './stage'

/** Below this many columns the pane waits, so the band speaks for Momo instead. */
export const PANE_MIN_COLUMNS = 110

export const STAGE_KEY = 'stage'

type View = { emotion: Emotion; mood: Mood; bubble: Bubble; activity: string | null }

type Scene = { stage: Stage; cells: string }

export function pane($: EngineInterface, e: ResolveInput, { emotion, mood, bubble, activity }: View, scene: Scene) {
  const { Box, Text } = $.ui.resolve(e)
  const color = COLOR[emotion]
  const sign = mood.score > 0 ? '+' : ''

  let picture
  if (e.surface === 'terminal') {
    const { Raster } = $.ui.resolve(e)
    picture = <Raster key={STAGE_KEY} columns={scene.stage.columns} rows={scene.stage.rows} cells={scene.cells} />
  } else {
    picture = (
      <Box flexDirection="column">
        {monkey(emotion, 0).map(line => (
          <Text mono>{line}</Text>
        ))}
      </Box>
    )
  }

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box justifyContent="space-between">
        <Text color={color} bold>
          Momo {EMOJI[emotion]} {emotion}
        </Text>
        <Text dimColor>
          {moodBar(mood.score)} {sign}
          {mood.score}
        </Text>
      </Box>
      {picture}
      {activity !== null && <Text dimColor>💭 {activity}...</Text>}
      <Box borderStyle="round" borderColor={color} flexDirection="column" paddingX={1}>
        <Text wrap="wrap">{bubble.text}</Text>
        {bubble.lines.map(line => (
          <Text wrap="wrap">{line}</Text>
        ))}
      </Box>
      <Text dimColor>/momo changes · /momo recap · /momo pet</Text>
    </Box>
  )
}

export function band($: EngineInterface, e: ResolveInput, { emotion, bubble, activity }: View) {
  const { Box, Text } = $.ui.resolve(e)

  return (
    <Box>
      <Text color={COLOR[emotion]}>
        🐒 {EMOJI[emotion]} Momo: <Text wrap="truncate-end">{activity !== null ? `💭 ${activity}...` : bubble.text}</Text>
      </Text>
    </Box>
  )
}
