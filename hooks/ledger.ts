// What changed: per turn and per session. Pure: no engine calls.

import type { Ledger, TurnLog } from '../types'
import { countTests, didTestsFail, isTestCommand } from './signals'
import type { Observation } from './signals'

export const emptyTurn = (): TurnLog => ({ files: {}, commands: [], tests: [], errors: 0, warnings: [] })

export const emptyLedger = (): Ledger => ({
  current: emptyTurn(),
  last: null,
  session: {
    turns: 0,
    files: {},
    commands: 0,
    failedCommands: 0,
    testRuns: 0,
    testRunsPassed: 0,
    warnings: 0,
  },
})

const short = (command: string): string => {
  const line = command.split('\n')[0] ?? ''

  return line.length > 60 ? `${line.slice(0, 57)}...` : line
}

export const record = (ledger: Ledger, observation: Observation, warning?: string): Ledger => {
  const current: TurnLog = {
    ...ledger.current,
    files: { ...ledger.current.files },
    commands: [...ledger.current.commands],
    tests: [...ledger.current.tests],
    warnings: warning ? [...ledger.current.warnings, warning] : ledger.current.warnings,
    errors: ledger.current.errors + (observation.isError ? 1 : 0),
  }
  const session = { ...ledger.session, files: { ...ledger.session.files } }

  if (observation.filePath !== undefined && !observation.isError) {
    const change = observation.isCreate ? 'created' : 'edited'
    // A file created this turn stays "created" however often it is edited after.
    current.files[observation.filePath] = current.files[observation.filePath] === 'created' ? 'created' : change
    session.files[observation.filePath] = session.files[observation.filePath] === 'created' ? 'created' : change
  }

  if (observation.command !== undefined) {
    const command = short(observation.command)
    current.commands.push({ command, isOk: !observation.isError })
    session.commands += 1
    session.failedCommands += observation.isError ? 1 : 0

    if (isTestCommand(observation.command)) {
      const isOk = !didTestsFail(observation)
      current.tests.push({ command, isOk, ...countTests(observation.text) })
      session.testRuns += 1
      session.testRunsPassed += isOk ? 1 : 0
    }
  }

  session.warnings += warning ? 1 : 0

  return { ...ledger, current, session }
}

/** Closes the turn: it becomes `last`, and a fresh one starts. Empty turns are not kept. */
export const closeTurn = (ledger: Ledger): Ledger => {
  const isEmpty =
    Object.keys(ledger.current.files).length === 0 && ledger.current.commands.length === 0 && ledger.current.errors === 0

  return {
    current: emptyTurn(),
    last: isEmpty ? ledger.last : ledger.current,
    session: { ...ledger.session, turns: ledger.session.turns + (isEmpty ? 0 : 1) },
  }
}

export const hadTrouble = (turn: TurnLog): boolean =>
  turn.errors > 0 || turn.tests.some(test => !test.isOk) || turn.warnings.length > 0

const plural = (count: number, word: string): string => `${count} ${word}${count === 1 ? '' : 's'}`

const testLine = (turn: TurnLog): string | null => {
  const last = turn.tests[turn.tests.length - 1]
  if (last === undefined) {
    return null
  }
  const counts =
    last.passed !== null || last.failed !== null ? ` (${last.passed ?? 0} passed, ${last.failed ?? 0} failed)` : ''

  return last.isOk ? `✅ tests green${counts}` : `❌ tests failing${counts}`
}

/** Momo's report on one turn, one line per thing worth saying. */
export const describeTurn = (turn: TurnLog | null): string[] => {
  if (turn === null) {
    return ['Nothing changed yet. I am watching! 👀']
  }
  const lines: string[] = []
  const files = Object.entries(turn.files)
  const created = files.filter(([, change]) => change === 'created')
  const edited = files.filter(([, change]) => change === 'edited')

  if (created.length > 0) {
    lines.push(`🆕 ${plural(created.length, 'file')} created: ${created.map(([path]) => basename(path)).join(', ')}`)
  }
  if (edited.length > 0) {
    lines.push(`✏️  ${plural(edited.length, 'file')} edited: ${edited.map(([path]) => basename(path)).join(', ')}`)
  }
  const failed = turn.commands.filter(command => !command.isOk)
  if (turn.commands.length > 0) {
    lines.push(`💻 ${plural(turn.commands.length, 'command')} run${failed.length > 0 ? `, ${failed.length} failed` : ''}`)
  }
  const tests = testLine(turn)
  if (tests !== null) {
    lines.push(tests)
  }
  for (const warning of turn.warnings) {
    lines.push(`⚠️  ${warning}`)
  }
  if (lines.length === 0) {
    lines.push('Just talking this turn, no changes. 🍌')
  }

  return lines
}

/** The whole turn in one short, plain sentence, for Momo's bubble. */
export const summarizeTurn = (turn: TurnLog): string => {
  const files = Object.keys(turn.files).map(basename)
  const changed =
    files.length === 0
      ? ''
      : files.length <= 2
        ? `Changed ${files.join(' and ')}`
        : `Changed ${files.length} files`
  const lastTest = turn.tests[turn.tests.length - 1]
  const tests = lastTest === undefined ? '' : lastTest.isOk ? 'tests pass' : 'tests fail'
  const failed = turn.commands.filter(command => !command.isOk).length
  const parts = [changed, tests].filter(Boolean)

  if (lastTest !== undefined && !lastTest.isOk) return `Not done yet ❌ ${parts.join(', ')}`
  if (failed > 0 && files.length === 0) return `Something did not work ❌`
  if (parts.length === 0) return 'Done ✅ No changes'

  return `Done ✅ ${parts.join(', ')}`
}

export const describeSession = (ledger: Ledger): string[] => {
  const { session } = ledger
  const files = Object.values(session.files)
  const created = files.filter(change => change === 'created').length

  return [
    `🔁 ${plural(session.turns, 'turn')} with changes`,
    `📁 ${plural(files.length, 'file')} touched (${created} new, ${files.length - created} edited)`,
    `💻 ${plural(session.commands, 'command')} (${session.failedCommands} failed)`,
    `🧪 ${plural(session.testRuns, 'test run')} (${session.testRunsPassed} green)`,
    `⚠️  ${plural(session.warnings, 'warning')} from me`,
  ]
}

export const basename = (path: string): string => path.split(/[\\/]/).filter(Boolean).pop() ?? path
