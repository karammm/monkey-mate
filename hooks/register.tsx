import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Bubble, Emotion, Mood } from '../types'
import { EMOJI } from './art'
import { closeTurn, describeSession, describeTurn, emptyLedger, hadTrouble, record, summarizeTurn } from './ledger'
import { applySignal, emotionOf, initialMood, resolveSignal, settle } from './mood'
import { activityLine, doneLine, loudest, moodLine, reaction } from './phrases'
import { classifyPrompt, classifyTool, errorKey, isTestCommand } from './signals'
import type { Observation, Signal } from './signals'
import { SPRITE_WIDTH } from './sprite'
import { encodeCells, initialActor, paint, step } from './stage'
import type { Stage } from './stage'
import { band, pane, STAGE_KEY } from './ui'

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

const activityAtom = atom({ plugin: 'monkey-mate', key: 'activity' } as const, null as string | null)

const ALERTS: readonly Signal[] = ['risky', 'repeat-error', 'test-fail']

type ToolInput = { command?: unknown; file_path?: unknown; notebook_path?: unknown }

const asString = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined)

// Phrases rotate instead of being random, so Momo does not repeat itself back to back.
let said = 0

const say = async ($: EngineInterface, text: string, lines: string[] = []) => {
  said += 1
  await update($, bubbleAtom, () => ({ text, lines }))
  if (isDesktopUp) {
    await tellDesktop($, emotionOf(lastMood, await $.clock.now()), text)
  }
}

// Momo Desktop: the companion app that lets Momo roam the whole screen (desktop/ in this plugin).
// The person starts it; the plugin only talks to it when it is running.
const DESKTOP = 'http://127.0.0.1:47321'
let isDesktopUp = false
let toldEmotion: Emotion | null = null
// Whether Momo's pane is on screen; when it is, the band above the prompt stays out of the way.
let isPaneShown = false

/** Tells Momo Desktop how Momo feels and what he says; quiet when it is not running. */
async function tellDesktop($: EngineInterface, emotion: Emotion, text?: string) {
  toldEmotion = emotion
  const body = JSON.stringify({ emotion, text, score: lastMood.score })
  await $.http
    .fetch(`${DESKTOP}/mood`, { method: 'POST', headers: { 'content-type': 'application/json' }, body })
    .catch(() => {
      isDesktopUp = false
    })
}

/** Shows what Claude is doing, in the pane and on Momo Desktop; null when the turn is over. */
async function showActivity($: EngineInterface, text: string | null) {
  await update($, activityAtom, () => text)
  if (isDesktopUp) {
    const body = JSON.stringify({ working: text !== null, text: text ?? undefined })
    await $.http
      .fetch(`${DESKTOP}/activity`, { method: 'POST', headers: { 'content-type': 'application/json' }, body })
      .catch(() => {
        isDesktopUp = false
      })
  }
}

// "Ask Claude…" in Momo's menu: Momo Desktop keeps the request until this plugin collects it with the key
// it wrote to ~/.monkey-mate/desktop-token. The request goes into the prompt box as a draft; you send it.
let desktopKey: string | null = null

let isCollecting = false

async function collectRequests($: EngineInterface) {
  if (!isDesktopUp || isCollecting) {
    return
  }
  isCollecting = true
  try {
    await collectNow($)
  } finally {
    isCollecting = false
  }
}

async function collectNow($: EngineInterface) {
  if (desktopKey === null) {
    const home = (await $.env.get('HOME')) ?? (await $.env.get('USERPROFILE'))
    const key = home ? await $.fs.read(`${home}/.monkey-mate/desktop-token`).catch(() => '') : ''
    desktopKey = key.trim() || null
    if (desktopKey === null) {
      return
    }
  }
  const response = await $.http.fetch(`${DESKTOP}/inbox`, { headers: { 'x-momo-token': desktopKey } }).catch(() => null)
  if (response?.status === 403) {
    // Momo Desktop restarted with a new key.
    desktopKey = null
    return
  }
  if (!response?.ok) {
    return
  }
  const requests = JSON.parse(response.text) as { type?: unknown; text?: unknown; byName?: unknown }[]
  for (const request of requests) {
    if (typeof request.text !== 'string' || request.text.trim() === '') {
      continue
    }
    if (request.type === 'ask') {
      await draftForClaude($, request.text)
    } else if (request.type === 'question') {
      await answerQuestion($, request.text, request.byName === true)
    }
  }
}

/** Puts a request in Claude Code's prompt box as a draft; the person sends it. */
async function draftForClaude($: EngineInterface, text: string) {
  const draft = await $.prompt.read()
  const isEmpty = draft.text.trim() === ''
  await $.prompt.fill({ text: isEmpty ? text : `\n${text}`, mode: isEmpty ? 'replace' : 'append' })
  $.ui.toast('🐒 Momo put your request in the prompt box. Press Enter to send it.')
}

/**
 * Anything said to Momo that he cannot do himself: a quick model call decides whether it is a question
 * (answered in a sentence or two, for him to say) or a task (drafted for Claude, for the person to send).
 */
async function answerQuestion($: EngineInterface, question: string, byName: boolean) {
  const facts = await gatherFacts($)
  const result = await $.model.complete({
    model: 'haiku',
    maxTokens: 200,
    timeoutMs: 20_000,
    system: MOMO_MIND,
    prompt: `Facts right now:\n${facts}\n\nThe person said to you: "${question.slice(0, 400)}"`,
  })
  const reply = result.isAnswered ? parseReply(result.text) : null
  if (reply?.kind === 'task') {
    await draftForClaude($, question)
    await tellDesktopReply($, 'Okay! I put it in Claude’s prompt box. Press Enter to send it ✨', byName)
    return
  }
  await tellDesktopReply($, reply?.say ?? 'Hmm, my brain is fuzzy right now 🙈 Try again?', byName)
}

const MOMO_MIND = [
  'You are Momo, a cute little white monkey who keeps the person company while they code with Claude Code.',
  'The person just said something to you out loud. Reply with JSON only, no other text:',
  '{"kind":"answer","say":"..."} to answer, or {"kind":"task"} when they want something done to their code,',
  'files or computer (write, change, fix, run, build, test, create, install, delete, commit, push...).',
  'An answer is one or two short, simple, friendly sentences to be spoken aloud: no markdown, no lists,',
  'round numbers, at most 30 words, a little playful. For questions about their computer, Claude or the',
  'project, use the facts given; if the facts do not say, say you are not sure. Never make numbers up.',
].join(' ')

function parseReply(text: string): { kind: 'answer' | 'task'; say?: string } | null {
  const json = text.match(/\{[\s\S]*\}/)?.[0]
  if (!json) {
    return text.trim() ? { kind: 'answer', say: text.trim().slice(0, 300) } : null
  }
  try {
    const value = JSON.parse(json) as { kind?: unknown; say?: unknown }
    if (value.kind === 'task') {
      return { kind: 'task' }
    }
    return typeof value.say === 'string' ? { kind: 'answer', say: value.say.slice(0, 300) } : null
  } catch {
    return null
  }
}

/** A quick, read-only snapshot for Momo to answer from: the computer, Claude's work, the project. */
async function gatherFacts($: EngineInterface): Promise<string> {
  const isWindows = (await $.env.get('OS')) === 'Windows_NT'
  const run = async (argv: string[]) => {
    const result = await $.process.run(argv, { timeoutMs: 4000 }).catch(() => null)
    return result?.exitCode === 0 ? result.stdout.trim().slice(0, 1200) : ''
  }
  const computer = isWindows
    ? [
        await run([
          'powershell',
          '-NoProfile',
          '-Command',
          'Get-CimInstance Win32_Processor | Select-Object Name,LoadPercentage | Format-List; ' +
            'Get-CimInstance Win32_OperatingSystem | Select-Object FreePhysicalMemory,TotalVisibleMemorySize | Format-List; ' +
            'Get-PSDrive C | Select-Object Used,Free | Format-List; ' +
            'Get-CimInstance Win32_Battery | Select-Object EstimatedChargeRemaining,BatteryStatus | Format-List',
        ]),
      ]
    : [
        await run(['sh', '-c', 'top -l 1 -n 0 2>/dev/null | head -n 10 || top -bn1 | head -n 5']),
        await run(['sh', '-c', 'sysctl -n machdep.cpu.brand_string hw.ncpu 2>/dev/null; uptime']),
        await run(['sh', '-c', 'pmset -g batt 2>/dev/null']),
        await run(['df', '-h', '/']),
      ]
  const ledger = await read($, ledgerAtom)
  const activity = await read($, activityAtom)
  const branch = await run(['git', 'rev-parse', '--abbrev-ref', 'HEAD'])
  const emotion = emotionOf(await read($, moodAtom), await $.clock.now())

  return [
    `Time: ${new Date(await $.clock.now()).toString()}`,
    `Claude right now: ${activity ?? 'waiting for the person'}`,
    `Last turn: ${ledger.last ? summarizeTurn(ledger.last) : 'nothing changed yet this session'}`,
    `This session: ${describeSession(ledger).join('; ')}`,
    `Project folder: ${await $.session.cwd().catch(() => 'unknown')}${branch ? `, git branch ${branch}` : ''}`,
    `Momo's mood: ${emotion}`,
    'Computer:',
    ...computer.filter(Boolean),
  ].join('\n')
}

async function tellDesktopReply($: EngineInterface, text: string, byName: boolean) {
  if (!isDesktopUp || desktopKey === null) {
    return
  }
  await $.http
    .fetch(`${DESKTOP}/reply`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-momo-token': desktopKey },
      body: JSON.stringify({ text, byName }),
    })
    .catch(() => undefined)
}

async function checkDesktop($: EngineInterface): Promise<boolean> {
  const response = await $.http.fetch(`${DESKTOP}/health`).catch(() => null)
  isDesktopUp = response?.ok === true

  return isDesktopUp
}

async function desktopHelp($: EngineInterface): Promise<string> {
  if (await checkDesktop($)) {
    await tellDesktop($, emotionOf(lastMood, await $.clock.now()), 'I am connected to Claude! 🐒')

    return '🐒 Momo Desktop is running and connected. Momo will react on your screen as you work.'
  }

  return [
    '🐒 Momo Desktop lets Momo roam your whole screen. Start it in a terminal (the first run downloads Electron):',
    `   cd "${$.plugin.root}/desktop" && npm install && npm start`,
    'Then run /momo desktop again to connect.',
  ].join('\n')
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
  if (isDesktopUp && emotion !== toldEmotion) {
    await tellDesktop($, emotion)
  }
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
      argumentHint: '[changes|recap|pet|desktop|quiet|loud]',
    })
    const now = await $.clock.now()
    await update($, moodAtom, mood => (mood.lastEventAt === 0 ? initialMood(now) : mood))
    $.clock.every(ANIMATION_MS, () => void animate($).catch(() => undefined))
    $.clock.every(2000, () => void collectRequests($).catch(() => undefined))
    void $.ui.open({ id: PANE, title: 'Momo 🐒' }).then(({ isPlaced }) => {
      isPaneShown = isPlaced
    })
    await checkDesktop($)
    await refreshStatus($)

    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    const signals = classifyPrompt(e.text)
    if (signals.length > 0) {
      await feel($, signals)
      await showActivity($, 'Thinking')
    }

    return next(e)
  }).catch(($, e, next) => next(e))

  on('tool.call', async ($, e, next) => {
    const input = e as ToolInput
    // Subagents use tools too; only the main conversation's steps are shown.
    if (e.agentId === undefined) {
      await showActivity($, activityLine(String(e.tool), asString(input.command), asString(input.file_path) ?? asString(input.notebook_path)))
    }
    const ran = await next(e)
    if (ran.deny !== undefined) {
      return ran
    }
    const isError = ran.isError === true
    // Reads and searches are not news; Momo only reacts to things that change or fail.
    if (ran.isReadOnly === true && !isError) {
      return ran
    }

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

    // Then say what changed, in plain words: "Changed app.ts ✓", "Tests pass ✅".
    if (e.agentId === undefined) {
      const isTest = observation.command !== undefined && isTestCommand(observation.command)
      const done = doneLine(observation.tool, { ...observation, testsPassed: isTest ? !signals.includes('test-fail') : undefined })
      if (done !== null) {
        await showActivity($, done)
      }
    }

    return ran
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    // Subagents finish turns too; Momo only judges the main conversation.
    if (e.agentId !== undefined) {
      return next(e)
    }
    if (!isDesktopUp) {
      await checkDesktop($)
    }
    const { current } = await read($, ledgerAtom)
    const isTrouble = hadTrouble(current)
    const lines = describeTurn(current)
    const isEmpty = Object.keys(current.files).length === 0 && current.commands.length === 0 && current.errors === 0

    await showActivity($, null)
    await update($, ledgerAtom, closeTurn)
    await update($, moodAtom, mood => settle(mood, isTrouble))

    if (!isEmpty) {
      await say($, summarizeTurn(current), lines)
    }
    await refreshStatus($)

    return next(e)
  })

  on('command.run', { command: 'momo' }, async ($, e) => {
    const [action = ''] = e.args.trim().toLowerCase().split(/\s+/)
    void $.ui.open({ id: PANE, title: 'Momo 🐒', focus: true }).then(({ isPlaced }) => {
      isPaneShown = isPlaced
    })

    if (action === 'desktop') {
      return { text: await desktopHelp($) }
    }

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
        '/momo desktop  let Momo roam your whole screen',
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

    return pane($, e, { emotion, mood, bubble: await read($, bubbleAtom), activity: await read($, activityAtom) }, { stage, cells })
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (isPaneShown || e.props.hasSurvey) {
      return next(e)
    }
    const mood = await read($, moodAtom)

    return band($, e, {
      emotion: emotionOf(mood, await $.clock.now()),
      mood,
      bubble: await read($, bubbleAtom),
      activity: await read($, activityAtom),
    })
  })
}
