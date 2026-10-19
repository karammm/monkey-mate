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

/** Which of several signals Momo talks about: the most emotional one. */
export const loudest = (signals: readonly Signal[]): Signal | undefined => {
  const order: Signal[] = ['risky', 'repeat-error', 'test-fail', 'build-fail', 'test-pass', 'build-ok', 'error']

  return order.find(signal => signals.includes(signal))
}
