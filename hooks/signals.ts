// Turns what Claude did into the signals Momo has feelings about. Pure: no engine calls.

export type Signal =
  | 'test-pass'
  | 'test-fail'
  | 'build-ok'
  | 'build-fail'
  | 'edit'
  | 'success'
  | 'error'
  | 'repeat-error'
  | 'risky'
  | 'frustration'
  | 'praise'
  | 'prompt'

/** One finished tool call as Momo sees it. */
export type Observation = {
  tool: string
  command?: string
  filePath?: string
  isCreate?: boolean
  isError: boolean
  text: string
}

const RISKY: RegExp[] = [
  /\brm\s+(-[a-z]*r[a-z]*f|-[a-z]*f[a-z]*r|--recursive\s+--force|--force\s+--recursive)\b/i,
  /\bgit\s+push\b.*(--force\b|\s-f\b)/i,
  /\bgit\s+reset\s+--hard\b/i,
  /\bgit\s+clean\s+-[a-z]*f/i,
  /\bgit\s+branch\s+-D\b/,
  /\bdrop\s+(table|database|schema)\b/i,
  /\bchmod\s+-R\s+777\b/i,
  /\bmkfs(\.\w+)?\b/i,
  /\bdd\s+if=/i,
  /\bRemove-Item\b.*-Recurse\b.*-Force\b/i,
  /\bdel\s+\/[sq]\b/i,
  /\brd\s+\/s\b/i,
  /\bformat\s+[a-z]:/i,
]

const TEST_COMMAND =
  /\b(test|tests|jest|vitest|pytest|mocha|ava|tap|rspec|phpunit|go\s+test|cargo\s+test|dotnet\s+test|npm\s+t|bun\s+test|deno\s+test)\b/i

const BUILD_COMMAND = /\b(build|tsc|compile|cargo\s+build|go\s+build|make|gradle|mvn|webpack|vite\s+build)\b/i

const FAILED_OUTPUT = /\b(\d+\s+fail(ed|ing|ures?)?|FAIL\b|failures?:\s*[1-9]|error(s)?:\s*[1-9]|Tests?:\s+\d+\s+failed)/i

const FRUSTRATION =
  /\b(wrong|again|still (not|broken|failing)|doesn'?t work|not working|broke|broken|stop|undo|revert|why (did|would) you|useless|wtf|ugh)\b|!!+/i

const PRAISE = /\b(thanks|thank you|great|perfect|awesome|nice|good job|well done|love it|amazing|works now)\b/i

export const isRisky = (command: string): boolean => RISKY.some(pattern => pattern.test(command))

export const isTestCommand = (command: string): boolean => TEST_COMMAND.test(command)

export const isBuildCommand = (command: string): boolean => !isTestCommand(command) && BUILD_COMMAND.test(command)

/** `12 passed`, `3 failed`, `Tests: 2 failed, 40 passed` and the like. */
export const countTests = (text: string): { passed: number | null; failed: number | null } => {
  const passed = text.match(/(\d+)\s+(passed|passing|ok\b)/i)
  const failed = text.match(/(\d+)\s+(failed|failing|failures?)/i)

  return {
    passed: passed ? Number(passed[1]) : null,
    failed: failed ? Number(failed[1]) : null,
  }
}

export const didTestsFail = (observation: Observation): boolean => {
  if (observation.isError) {
    return true
  }
  const { failed } = countTests(observation.text)

  return failed !== null ? failed > 0 : FAILED_OUTPUT.test(observation.text)
}

/** The first meaningful line of an error, so the same mistake twice is noticed. */
export const errorKey = (text: string): string =>
  (text.split('\n').find(line => line.trim().length > 0) ?? '').trim().slice(0, 120)

export const classifyTool = (observation: Observation): Signal[] => {
  const signals: Signal[] = []
  const { command } = observation

  if (command !== undefined && isRisky(command)) {
    signals.push('risky')
  }

  if (command !== undefined && isTestCommand(command)) {
    signals.push(didTestsFail(observation) ? 'test-fail' : 'test-pass')

    return signals
  }

  if (command !== undefined && isBuildCommand(command)) {
    signals.push(observation.isError ? 'build-fail' : 'build-ok')

    return signals
  }

  if (observation.isError) {
    signals.push('error')
  } else if (observation.filePath !== undefined) {
    signals.push('edit')
  } else {
    signals.push('success')
  }

  return signals
}

export const classifyPrompt = (text: string): Signal[] => {
  if (text.trimStart().startsWith('/')) {
    return []
  }
  if (FRUSTRATION.test(text)) {
    return ['frustration']
  }
  if (PRAISE.test(text)) {
    return ['praise']
  }

  return ['prompt']
}
