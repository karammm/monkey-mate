import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Bubble, Emotion, Mood } from '../types'
import { EMOJI } from './art'
import { closeTurn, describeSession, describeTurn, emptyLedger, hadTrouble, record } from './ledger'
import { applySignal, emotionOf, initialMood, resolveSignal, settle } from './mood'
import { loudest, moodLine, reaction } from './phrases'
import { classifyPrompt, classifyTool, errorKey } from './signals'
import type { Observation, Signal } from './signals'
import { SPRITE_WIDTH } from './sprite'
import { encodeCells, initialActor, paint, step } from './stage'
import type { Stage } from './stage'
import { band, pane, PANE_MIN_COLUMNS, STAGE_KEY } from './ui'

const PANE = 'momo'
// About 14 frames a second: smooth hops without keeping the terminal busy.
const ANIMATION_MS = 70
const STAGE_ROWS = 22

const moodAtom = atom({ plugin: 'monkey-mate', key: 'mood' } as const, initialMood(0))
const ledgerAtom = atom({ plugin: 'monkey-mate', key: 'ledger' } as const, emptyLedger())
const bubbleAtom = atom({ plugin: 'monkey-mate', key: 'bubble' } as const, {
  text: 'Hi! I am Momo 🐒 your coding buddy.',
  lines: [],
} as Bubble)

const ALERTS: readonly Signal[] = ['risky', 'repeat-error', 'test-fail']

type ToolInput = { command?: unknown; file_path?: unknown; notebook_path?: unknown }

const asString = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined)

// Phrases rotate instead of being random, so Momo does not repeat itself back to back.
let said = 0

const say = async ($: EngineInterface, text: string, lines: string[] = []) => {
  said += 1
  await update($, bubbleAtom, () => ({ text, lines }))
}

// The animation runs many times a second, so it reads this copy of the mood rather than the state.
let lastMood: Mood = initialMood(0)
let actor = initialActor()
let stage: Stage = { columns: 52, rows: STAGE_ROWS }
let cells = ''

const refreshStatus = async ($: EngineInterface) => {
  lastMood = await read($, moodAtom)
  const emotion = emotionOf(lastMood, await $.clock.now())
  $.ui.status(`🐒 ${EMOJI[emotion]} ${emotion}`)
}

const drawStage = (emotion: Emotion): string => encodeCells(paint(actor, emotion, stage), stage)

/** One frame: Momo moves, and the pane's stage is repainted when anything changed. */
async function animate($: EngineInterface) {
  const emotion = emotionOf(lastMood, await $.clock.now())
  actor = step(actor, emotion, stage, Math.random)
  const next = drawStage(emotion)
  if (next === cells) {
    return
  }
  cells = next
  await $.ui.blit({ requestId: PANE, key: STAGE_KEY, cells, columns: stage.columns, rows: stage.rows })
}

const feel = async ($: EngineInterface, signals: readonly Signal[], errorText?: string) => {
  const now = await $.clock.now()
  const before = await read($, moodAtom)
  const resolved = signals.map(signal => resolveSignal(before, signal, errorText))
  await update($, moodAtom, mood => signals.reduce((next, signal) => applySignal(next, signal, now, errorText), mood))
  // Momo reacts at once: a happy leap, a worried shuffle or an angry stomp on the next frame.
  actor = { ...actor, restTicks: 0 }

  const signal = loudest(resolved) ?? resolved.find(one => one === 'frustration' || one === 'praise')
  const line = signal ? reaction(signal, said) : null
  if (line !== null) {
    await say($, line)
    if (signal && ALERTS.includes(signal) && (await $.store.get('quiet')) !== true) {
      $.ui.toast(`🐒 Momo: ${line}`)
    }
  }
  await refreshStatus($)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'momo',
      description: 'Talk to Momo, your monkey buddy: changes, recap, pet, quiet, loud',
      argumentHint: '[changes|recap|pet|quiet|loud]',
    })
    const now = await $.clock.now()
    await update($, moodAtom, mood => (mood.lastEventAt === 0 ? initialMood(now) : mood))
    $.clock.every(ANIMATION_MS, () => void animate($).catch(() => undefined))
    void $.ui.open({ id: PANE, title: 'Momo 🐒' })
    await refreshStatus($)

    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    const signals = classifyPrompt(e.text)
    if (signals.length > 0) {
      await feel($, signals)
    }

    return next(e)
  }).catch(($, e, next) => next(e))

  on('tool.call', async ($, e, next) => {
    const ran = await next(e)
    if (ran.deny !== undefined) {
      return ran
    }
    const isError = ran.isError === true
    // Reads and searches are not news; Momo only reacts to things that change or fail.
    if (ran.isReadOnly === true && !isError) {
      return ran
    }

    const input = e as ToolInput
    const result = ran.result as { type?: unknown } | undefined
    const observation: Observation = {
      tool: String(e.tool),
      command: asString(input.command),
      filePath: asString(input.file_path) ?? asString(input.notebook_path),
      isCreate: result?.type === 'create',
      isError,
      text: ran.text ?? '',
    }
    const signals = classifyTool(observation)
    const warning = signals.includes('risky') ? `risky command: ${observation.command?.slice(0, 50)}` : undefined
    const isFailure = isError || signals.includes('test-fail') || signals.includes('build-fail')

    await update($, ledgerAtom, ledger => record(ledger, observation, warning))
    await feel($, signals, isFailure ? errorKey(observation.text) : undefined)

    return ran
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    // Subagents finish turns too; Momo only judges the main conversation.
    if (e.agentId !== undefined) {
      return next(e)
    }
    const { current } = await read($, ledgerAtom)
    const isTrouble = hadTrouble(current)
    const lines = describeTurn(current)
    const isEmpty = Object.keys(current.files).length === 0 && current.commands.length === 0 && current.errors === 0

    await update($, ledgerAtom, closeTurn)
    await update($, moodAtom, mood => settle(mood, isTrouble))

    if (!isEmpty) {
      const emotion = emotionOf(await read($, moodAtom), await $.clock.now())
      await say($, isTrouble ? 'Hmm, this turn had problems:' : `${moodLine(emotion, said)} This turn:`, lines)
    }
    await refreshStatus($)

    return next(e)
  })

  on('command.run', { command: 'momo' }, async ($, e) => {
    const [action = ''] = e.args.trim().toLowerCase().split(/\s+/)
    void $.ui.open({ id: PANE, title: 'Momo 🐒', focus: true })

    if (action === 'changes') {
      const { last, current } = await read($, ledgerAtom)
      const isCurrentEmpty = Object.keys(current.files).length === 0 && current.commands.length === 0
      const lines = describeTurn(isCurrentEmpty ? last : current)
      await say($, 'Here is what changed in the last turn:', lines)

      return { text: ['🐒 Momo: here is what changed in the last turn', ...lines].join('\n') }
    }
    if (action === 'recap') {
      const lines = describeSession(await read($, ledgerAtom))
      await say($, 'Session recap:', lines)

      return { text: ['🐒 Momo: session recap', ...lines].join('\n') }
    }
    if (action === 'pet') {
      await feel($, ['praise'])
      await say($, 'Hehe! *happy monkey noises* 🍌')

      return { text: '🐒 Momo loved that.' }
    }
    if (action === 'quiet' || action === 'loud') {
      await $.store.set('quiet', action === 'quiet')

      return { text: action === 'quiet' ? '🐒 Momo will stop popping up toasts.' : '🐒 Momo will warn you with toasts again.' }
    }

    const emotion = emotionOf(await read($, moodAtom), await $.clock.now())

    return {
      text: [
        `🐒 Momo is ${emotion} ${EMOJI[emotion]}: ${moodLine(emotion, said)}`,
        '/momo changes  what changed in the last turn',
        '/momo recap    the whole session so far',
        '/momo pet      make Momo happy',
        '/momo quiet    no more toasts (/momo loud to undo)',
      ].join('\n'),
    }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const mood = await read($, moodAtom)
    const emotion = emotionOf(mood, await $.clock.now())
    const columns = Math.max(SPRITE_WIDTH + 2, Math.min(64, e.props.bodyColumns - 2))
    if (columns !== stage.columns) {
      stage = { columns, rows: STAGE_ROWS }
      actor = { ...actor, x: Math.min(actor.x, Math.max(0, columns - SPRITE_WIDTH)) }
    }
    lastMood = mood
    cells = drawStage(emotion)

    return pane($, e, { emotion, mood, bubble: await read($, bubbleAtom) }, { stage, cells })
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const isWide = (e.viewport?.columns ?? 0) >= PANE_MIN_COLUMNS
    if (isWide || e.props.hasSurvey) {
      return next(e)
    }
    const mood = await read($, moodAtom)

    return band($, e, {
      emotion: emotionOf(mood, await $.clock.now()),
      mood,
      bubble: await read($, bubbleAtom),
    })
  })
}
