// Momo's emotional engine: signals move a score, the score drifts home to calm. Pure: no engine calls.

import type { Emotion, Mood } from '../types'
import type { Signal } from './signals'

export const SLEEPY_AFTER_MS = 10 * 60 * 1000
const FLASH_MS = 20 * 1000

const DELTA: Record<Signal, number> = {
  'test-pass': 20,
  'test-fail': -15,
  'build-ok': 10,
  'build-fail': -12,
  edit: 2,
  success: 1,
  error: -10,
  'repeat-error': -25,
  risky: -5,
  frustration: -12,
  praise: 15,
  prompt: 0,
}

const FLASH: Partial<Record<Signal, Emotion>> = {
  risky: 'worried',
  'repeat-error': 'angry',
  prompt: 'curious',
  praise: 'happy',
}

const clamp = (score: number): number => Math.max(-100, Math.min(100, Math.round(score)))

export const initialMood = (now: number): Mood => ({
  score: 0,
  streak: 0,
  lastError: null,
  flash: null,
  lastEventAt: now,
})

const isFailureSignal = (signal: Signal): boolean =>
  signal === 'error' || signal === 'test-fail' || signal === 'build-fail'

/** A failure with the same first line as the last one is a repeat: Momo takes that personally. */
export const resolveSignal = (mood: Mood, signal: Signal, errorText?: string): Signal =>
  isFailureSignal(signal) && errorText !== undefined && errorText.length > 0 && errorText === mood.lastError
    ? 'repeat-error'
    : signal

/** `errorText` is the failing output's key, used to spot the same error twice in a row. */
export const applySignal = (mood: Mood, signal: Signal, now: number, errorText?: string): Mood => {
  const next = resolveSignal(mood, signal, errorText)
  const isFailure = isFailureSignal(signal)
  const isGood = DELTA[next] > 0
  const streak = isFailure || next === 'repeat-error' ? 0 : isGood ? mood.streak + 1 : mood.streak
  const flashEmotion = FLASH[next]

  return {
    score: clamp(mood.score + DELTA[next]),
    streak,
    lastError: isFailure ? (errorText ?? mood.lastError) : isGood ? null : mood.lastError,
    flash: flashEmotion ? { emotion: flashEmotion, until: now + FLASH_MS } : mood.flash,
    lastEventAt: now,
  }
}

/** End of a turn: feelings settle. A turn without trouble halves any grudge. */
export const settle = (mood: Mood, hadTrouble: boolean): Mood => {
  const factor = mood.score < 0 && !hadTrouble ? 0.5 : 0.75

  return { ...mood, score: clamp(mood.score * factor) }
}

export const emotionOf = (mood: Mood, now: number): Emotion => {
  if (now - mood.lastEventAt > SLEEPY_AFTER_MS) {
    return 'sleepy'
  }
  if (mood.flash !== null && now < mood.flash.until) {
    return mood.flash.emotion
  }
  if (mood.score <= -45) {
    return 'angry'
  }
  if (mood.score <= -15) {
    return 'worried'
  }
  if (mood.score >= 50 || mood.streak >= 10) {
    return 'proud'
  }
  if (mood.score >= 12) {
    return 'happy'
  }

  return 'calm'
}

/** -100..100 as a 10-cell bar, for the pane. */
export const moodBar = (score: number): string => {
  const filled = Math.round((score + 100) / 20)

  return '█'.repeat(filled) + '░'.repeat(10 - filled)
}
