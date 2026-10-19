export type Emotion =
  | 'happy'
  | 'proud'
  | 'calm'
  | 'curious'
  | 'worried'
  | 'angry'
  | 'sleepy'

/** Momo's feelings: a score that drifts back to 0, plus short-lived flashes. */
export type Mood = {
  /** -100 (furious) .. +100 (ecstatic); decays toward 0 every turn. */
  score: number
  /** Successful tool calls in a row. */
  streak: number
  /** The last error's first line, to notice the same mistake twice. */
  lastError: string | null
  /** An emotion that overrides the score until `until` (ms). */
  flash: { emotion: Emotion; until: number } | null
  /** When Momo last saw anything happen (ms). */
  lastEventAt: number
}

export type FileChange = 'created' | 'edited'

export type CommandLog = { command: string; isOk: boolean }

export type TestLog = { command: string; isOk: boolean; passed: number | null; failed: number | null }

/** What happened in one turn. */
export type TurnLog = {
  files: Record<string, FileChange>
  commands: CommandLog[]
  tests: TestLog[]
  errors: number
  warnings: string[]
}

/** What Momo watched this session. */
export type Ledger = {
  current: TurnLog
  last: TurnLog | null
  session: {
    turns: number
    files: Record<string, FileChange>
    commands: number
    failedCommands: number
    testRuns: number
    testRunsPassed: number
    warnings: number
  }
}

/** What the speech bubble says and what it is about. */
export type Bubble = { text: string; lines: string[] }

declare module 'claude-code' {
  interface PluginState {
    'monkey-mate': {
      mood: Mood
      ledger: Ledger
      bubble: Bubble
      frame: number
    }
  }
}
