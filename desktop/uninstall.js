// Removes Momo from this computer: quits Momo Desktop, deletes Momo.app, his voice model and settings,
// his helpers and key file, resets the permissions macOS gave him, and uninstalls the Claude Code plugin.
// The source code (this folder) is left alone.
//   npm run remove-momo

const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const quietly = (command, args) => {
  try {
    execFileSync(command, args, { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}
const remove = (target, what) => {
  if (!fs.existsSync(target)) return
  fs.rmSync(target, { recursive: true, force: true })
  console.log(`Removed ${what}: ${target}`)
}

// 1. Quit Momo Desktop, wherever it runs from.
if (process.platform === 'win32') {
  quietly('taskkill', ['/F', '/IM', 'electron.exe', '/FI', `WINDOWTITLE eq Momo`])
} else {
  quietly('pkill', ['-f', 'Momo.app/Contents/MacOS'])
  quietly('pkill', ['-f', path.join(__dirname, 'native')])
  quietly('pkill', ['-f', `Electron ${__dirname}`])
}
console.log('Quit Momo Desktop.')

// 2. What Momo Desktop made or downloaded.
remove(path.join(__dirname, 'Momo.app'), 'Momo.app')
remove(path.join(__dirname, 'native', 'caret'), 'the where-you-type helper')
remove(path.join(__dirname, 'native', 'listen'), 'the listening helper')
const appData =
  process.platform === 'darwin'
    ? path.join(os.homedir(), 'Library', 'Application Support')
    : process.platform === 'win32'
      ? (process.env.APPDATA ?? path.join(os.homedir(), 'AppData', 'Roaming'))
      : path.join(os.homedir(), '.config')
remove(path.join(appData, 'momo-desktop'), 'his voice model and settings')
remove(path.join(os.homedir(), '.monkey-mate'), 'his key file')

// 3. The permissions macOS gave Momo (microphone, speech recognition, where you type).
if (process.platform === 'darwin') {
  for (const service of ['Microphone', 'SpeechRecognition', 'Accessibility']) {
    quietly('tccutil', ['reset', service, 'io.github.karammm.momo'])
  }
  console.log('Reset the macOS permissions Momo had.')
}

// 4. The Claude Code plugin.
if (quietly('claude', ['plugin', 'uninstall', 'monkey-mate@monkey-mate'])) console.log('Uninstalled the monkey-mate plugin.')
if (quietly('claude', ['plugin', 'marketplace', 'remove', 'monkey-mate'])) console.log('Removed the monkey-mate marketplace.')

console.log('Momo is gone 🐒👋  (Restart Claude Code to finish. This folder, the source code, is untouched.)')
