// Builds Momo's small macOS helpers: where you are typing (native/caret.swift) and push-to-talk (native/listen.swift).
// Runs after `npm install`; on other systems, or without Xcode's command line tools, it does nothing
// and Momo simply does not know where you type.

const { execFileSync } = require('node:child_process')
const path = require('node:path')

if (process.platform !== 'darwin') process.exit(0)

const HELPERS = {
  caret: 'Momo can find where you type (after you allow it from his menu)',
  listen: 'push-to-talk: Momo can hear you when you ask him to listen',
}
for (const [name, what] of Object.entries(HELPERS)) {
  const source = path.join(__dirname, 'native', `${name}.swift`)
  const output = path.join(__dirname, 'native', name)
  try {
    execFileSync('swiftc', ['-O', '-swift-version', '5', source, '-o', output], { stdio: 'inherit' })
    console.log(`Built native/${name}: ${what}.`)
  } catch {
    console.log(`Skipped native/${name} (needs Xcode command line tools: xcode-select --install).`)
  }
}
