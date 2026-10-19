// What Momo says. Picked by a counter, not Math.random, so tests are stable.

import type { Emotion } from '../types'
import type { Signal } from './signals'

const MOOD_LINES: Record<Emotion, string[]> = {
  happy: ['Things are going well! 🍌', 'Nice and smooth.', 'I like where this is going.'],
  proud: ['We are on fire! 🔥', 'Look at us go. Banana break earned.', 'Flawless streak. I am proud of you two.'],
  calm: ['All quiet. I am watching.', 'Steady as a banana.', 'Ready when you are.'],
  curious: ['Ooh, a new task! What are we building?', 'Hmm, tell me more...', 'Let us see what Claude does.'],
  worried: ['Hmm... that does not look right.', 'Careful now.', 'I have a bad feeling about this.'],
  angry: ['That is the same error AGAIN! 😤', 'Stop and read the error, please!', 'Grr. Slow down and rethink.'],
  sleepy: ['Zzz... wake me when we code.', '*yawn* still here.', 'Taking a little nap.'],
}

const REACTIONS: Partial<Record<Signal, string[]>> = {
  'test-pass': ['Tests are green! 🎉', 'All tests pass. Banana for everyone!', 'Green across the board!'],
  'test-fail': ['Tests are failing. Let us fix that.', 'Red tests! Read the failure first.', 'Oops, a test broke.'],
  'build-ok': ['Build passed. 👍', 'It compiles!'],
  'build-fail': ['The build broke.', 'Build error. Check the first message.'],
  'repeat-error': ['Same error twice! Try a different approach.', 'We have seen this one before... rethink it.'],
  risky: ['Whoa! That command can destroy things. Double-check it.', 'Risky command! Are you sure?'],
  frustration: ['I hear you. Let us slow down and get it right.', 'Deep breath. One fix at a time.'],
  praise: ['Aww, thanks! 🐒', 'Team work!', 'Happy monkey noises!'],
  error: ['A command failed.', 'Something went wrong there.'],
}

export const moodLine = (emotion: Emotion, counter: number): string => {
  const lines = MOOD_LINES[emotion]

  return lines[counter % lines.length] ?? ''
}

export const reaction = (signal: Signal, counter: number): string | null => {
  const lines = REACTIONS[signal]

  return lines ? (lines[counter % lines.length] ?? null) : null
}

/** What Momo says Claude is busy with, from the tool it is about to use. */
// Momo narrates in very short, plain words, so anyone can follow along: what is changing, then what changed.
export const activityLine = (tool: string, command?: string, filePath?: string): string => {
  const file = fileName(filePath)
  if (file && tool === 'Write') return `Writing ${file}`
  if (file && /^(Edit|MultiEdit|NotebookEdit)$/.test(tool)) return `Changing ${file}`
  if (command !== undefined) return commandLine(command)
  if (/^(Read|Grep|Glob|LS)$/.test(tool)) return 'Reading the code'
  if (/^(WebSearch|WebFetch)$/.test(tool)) return 'Looking it up online'
  if (/^(Agent|Task)$/.test(tool)) return 'Asking a helper'
  if (tool === 'TodoWrite') return 'Planning the steps'
  if (tool.startsWith('mcp__')) return 'Using a connected app'

  return 'Working'
}

const COMMANDS: [RegExp, string][] = [
  [/\b(test|tests|jest|vitest|pytest|mocha|go test|cargo test)\b/i, 'Testing the code'],
  [/\bgit\s+commit\b/i, 'Saving the changes'],
  [/\bgit\s+push\b/i, 'Uploading the changes'],
  [/\bgit\s+(status|diff|log|show)\b/i, 'Checking what changed'],
  [/\b(npm|pnpm|yarn|bun)\s+(i|install|add)\b|\bpip3?\s+install\b|\bbrew\s+install\b/i, 'Installing packages'],
  [/\b(build|tsc|compile|make)\b/i, 'Building the app'],
  [/\b(dev|start|serve)\b|\belectron\b/i, 'Starting the app'],
  [/^\s*(rm|del|rd)\b|Remove-Item/i, 'Deleting files'],
  [/^\s*(mkdir|cp|mv|touch)\b/i, 'Organizing files'],
  [/^\s*(ls|cat|head|tail|grep|rg|find|pwd|wc|tree)\b/i, 'Looking around'],
  [/\b(curl|wget)\b/i, 'Checking a website'],
]

const commandLine = (command: string): string =>
  COMMANDS.find(([pattern]) => pattern.test(command))?.[1] ?? 'Running a command'

const fileName = (path?: string): string | undefined => path?.split(/[\\/]/).filter(Boolean).pop()

/** What changed once a step is done; null when the step changed nothing worth saying. */
export const doneLine = (
  tool: string,
  outcome: { isError: boolean; isCreate?: boolean; filePath?: string; testsPassed?: boolean },
): string | null => {
  if (outcome.testsPassed !== undefined) return outcome.testsPassed ? 'Tests pass ✅' : 'Tests failed ❌'
  if (outcome.isError) return 'That did not work ❌'
  const file = fileName(outcome.filePath)
  if (file && /^(Write|Edit|MultiEdit|NotebookEdit)$/.test(tool)) return outcome.isCreate ? `Made ${file} ✓` : `Changed ${file} ✓`

  return null
}

/** Which of several signals Momo talks about: the most emotional one. */
export const loudest = (signals: readonly Signal[]): Signal | undefined => {
  const order: Signal[] = ['risky', 'repeat-error', 'test-fail', 'build-fail', 'test-pass', 'build-ok', 'error']

  return order.find(signal => signals.includes(signal))
}
