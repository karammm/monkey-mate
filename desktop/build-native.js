// Builds the small macOS helper that tells Momo where you are typing (native/caret.swift).
// Runs after `npm install`; on other systems, or without Xcode's command line tools, it does nothing
// and Momo simply does not know where you type.

const { execFileSync } = require('node:child_process')
const path = require('node:path')

if (process.platform !== 'darwin') process.exit(0)

const source = path.join(__dirname, 'native', 'caret.swift')
const output = path.join(__dirname, 'native', 'caret')
try {
  execFileSync('swiftc', ['-O', '-swift-version', '5', source, '-o', output], { stdio: 'inherit' })
  console.log('Built native/caret: Momo can find where you type (after you allow it from his menu).')
} catch {
  console.log('Skipped native/caret (needs Xcode command line tools: xcode-select --install).')
}
