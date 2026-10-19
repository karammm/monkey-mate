import { describe, expect, test } from 'claude-code/testing'

import { monkey, WIDTH } from '../hooks/art'
import { closeTurn, describeSession, describeTurn, emptyLedger, hadTrouble, record } from '../hooks/ledger'
import { applySignal, emotionOf, initialMood, settle, SLEEPY_AFTER_MS } from '../hooks/mood'
import { activityLine } from '../hooks/phrases'
import { classifyPrompt, classifyTool, countTests, isRisky } from '../hooks/signals'
import type { Observation } from '../hooks/signals'

const bash = (command: string, text: string, isError = false): Observation => ({
  tool: 'Bash',
  command,
  isError,
  text,
})

describe('signals', () => {
  test('spots risky commands on mac and windows', () => {
    expect(isRisky('rm -rf node_modules')).toBe(true)
    expect(isRisky('git push --force origin main')).toBe(true)
    expect(isRisky('git reset --hard HEAD~3')).toBe(true)
    expect(isRisky('Remove-Item .\\dist -Recurse -Force')).toBe(true)
    expect(isRisky('rd /s /q build')).toBe(true)
    expect(isRisky('rm notes.txt')).toBe(false)
    expect(isRisky('git push origin main')).toBe(false)
  })

  test('tells passing tests from failing ones', () => {
    expect(classifyTool(bash('npm test', 'Tests: 42 passed, 42 total'))).toEqual(['test-pass'])
    expect(classifyTool(bash('npx vitest run', 'Tests  2 failed | 40 passed'))).toEqual(['test-fail'])
    expect(classifyTool(bash('pytest', 'boom', true))).toEqual(['test-fail'])
    expect(countTests('Tests: 2 failed, 40 passed')).toEqual({ passed: 40, failed: 2 })
  })

  test('edits, errors and builds', () => {
    expect(classifyTool({ tool: 'Edit', filePath: '/a/b.ts', isError: false, text: '' })).toEqual(['edit'])
    expect(classifyTool(bash('node x.js', 'ReferenceError', true))).toEqual(['error'])
    expect(classifyTool(bash('npm run build', 'done'))).toEqual(['build-ok'])
  })

  test('reads how the person feels', () => {
    expect(classifyPrompt('that is wrong, it still fails')).toEqual(['frustration'])
    expect(classifyPrompt('perfect, thanks!')).toEqual(['praise'])
    expect(classifyPrompt('add a login page')).toEqual(['prompt'])
    expect(classifyPrompt('/momo changes')).toEqual([])
  })
})

describe('activity', () => {
  test('says what Claude is busy with', () => {
    expect(activityLine('Edit', undefined, '/repo/src/app.ts')).toBe('Claude is editing app.ts')
    expect(activityLine('Write', undefined, 'C:\\repo\\notes.md')).toBe('Claude is editing notes.md')
    expect(activityLine('Bash', 'npm test')).toBe('Claude is running npm test')
    expect(activityLine('Grep')).toBe('Claude is reading the code')
    expect(activityLine('mcp__github__create_pr')).toBe('Claude is using a connected tool')
  })
})

describe('mood', () => {
  test('a passing test makes Momo happy, a repeated error makes Momo angry', () => {
    let mood = initialMood(0)
    mood = applySignal(mood, 'test-pass', 1)
    expect(emotionOf(mood, 2)).toBe('happy')

    mood = applySignal(mood, 'error', 3, 'TypeError: x is undefined')
    mood = applySignal(mood, 'error', 4, 'TypeError: x is undefined')
    expect(emotionOf(mood, 5)).toBe('angry')
  })

  test('risky commands flash worried, then it wears off', () => {
    const mood = applySignal(initialMood(0), 'risky', 0)
    expect(emotionOf(mood, 1)).toBe('worried')
    expect(emotionOf(mood, 60_000)).toBe('calm')
  })

  test('Momo is emotionally balanced: anger cools after a clean turn', () => {
    let mood = { ...initialMood(0), score: -80 }
    mood = settle(mood, false)
    expect(mood.score).toBe(-40)
    mood = settle(mood, false)
    expect(emotionOf(mood, 1)).toBe('worried')
    mood = settle(settle(mood, false), false)
    expect(emotionOf(mood, 1)).toBe('calm')
  })

  test('gets sleepy when nothing happens', () => {
    expect(emotionOf(initialMood(0), SLEEPY_AFTER_MS + 1)).toBe('sleepy')
  })

  test('the score stays within -100..100', () => {
    let mood = initialMood(0)
    for (let i = 0; i < 20; i += 1) {
      mood = applySignal(mood, 'test-pass', i)
    }
    expect(mood.score).toBe(100)
    expect(emotionOf(mood, 20)).toBe('proud')
  })
})

describe('ledger', () => {
  test('reports what changed in a turn', () => {
    let ledger = emptyLedger()
    ledger = record(ledger, { tool: 'Write', filePath: '/p/new.ts', isCreate: true, isError: false, text: '' })
    ledger = record(ledger, { tool: 'Edit', filePath: '/p/new.ts', isError: false, text: '' })
    ledger = record(ledger, { tool: 'Edit', filePath: 'C:\\p\\old.ts', isError: false, text: '' })
    ledger = record(ledger, bash('npm test', '3 passed'))
    ledger = closeTurn(ledger)

    const lines = describeTurn(ledger.last)
    expect(lines[0]).toBe('🆕 1 file created: new.ts')
    expect(lines[1]).toBe('✏️  1 file edited: old.ts')
    expect(lines).toContain('✅ tests green (3 passed, 0 failed)')
    expect(ledger.session.turns).toBe(1)
    expect(describeSession(ledger)[1]).toBe('📁 2 files touched (1 new, 1 edited)')
  })

  test('a failing command or warning is trouble', () => {
    const ledger = record(emptyLedger(), bash('rm -rf /tmp/x', '', false), 'risky command')
    expect(hadTrouble(ledger.current)).toBe(true)
    expect(hadTrouble(emptyLedger().current)).toBe(false)
  })

  test('a turn with nothing in it keeps the last real one', () => {
    const ledger = closeTurn(record(emptyLedger(), bash('make', 'ok')))
    expect(closeTurn(ledger).last).toEqual(ledger.last)
  })
})

describe('art', () => {
  test('every face is the same width so the pane never jitters', () => {
    for (const emotion of ['happy', 'proud', 'calm', 'curious', 'worried', 'angry', 'sleepy'] as const) {
      for (const line of [...monkey(emotion, 0), ...monkey(emotion, 1)]) {
        expect(line.length).toBe(WIDTH)
      }
    }
  })
})
